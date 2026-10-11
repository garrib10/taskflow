import { describe, expect, it, vi } from "vitest";
import { boardReducer } from "../domain/board/boardReducer";
import { selectOrderedTasks } from "../domain/board/boardOrdering";
import { currentBoardRaw, fixtureDate, freezeDeep, makeBoard, makeTask } from "../test/fixtures";
import { legacyChecklistFixture, v15BoardFixture } from "../test/migrationFixtures";
import { decodeBoard, loadBoard, saveBoard, STORAGE_KEY } from "../utils/storage";
import { migrateBoard, migrateV2ToV3 } from "./migrations";
import { encodeBoardV3, validateStoredBoard } from "./schema";
import { PersistenceSession } from "./session";

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
function memory(initial: string | null) {
  let raw = initial;
  const storage = { getItem: vi.fn((key: string) => key === STORAGE_KEY ? raw : null), setItem: vi.fn((_key: string, next: string) => { raw = next; }) };
  return storage;
}

describe("approved migration paths", () => {
  it.each([0, 1])("migrates schema %i through checklist conversion and schema 3 without clocks or invented IDs", version => {
    const source = legacyChecklistFixture();
    freezeDeep(source);
    const original = JSON.stringify(source);
    const raw = version === 0 ? original : JSON.stringify({ schemaVersion: version, board: source });
    const loaded = decodeBoard(raw);
    if (loaded.kind !== "migrated") throw new Error("Expected migration");
    expect(loaded.fromVersion).toBe(version);
    const tasks = loaded.board.columns.flatMap(column => column.tasks);
    expect(tasks.map(task => task.id)).toEqual(["parent", "open", "complete"]);
    expect(tasks.find(task => task.id === "complete")).toMatchObject({ parentId: "parent", status: "done", priority: "high", category: "devops", description: "", createdAt: new Date("2024-05-10T15:30:00.000Z") });
    expect(tasks.find(task => task.id === "open")).toMatchObject({ parentId: "parent", status: "todo" });
    expect(tasks.find(task => task.id === "parent")?.subtasks).toEqual([]);
    expect(loaded.board.lastUpdated).toEqual(new Date("2024-05-10T15:30:00.000Z"));
    expect(loaded.board.columns.every(column => column.manualOrder === undefined)).toBe(true);
    expect(migrateBoard(json(source), version === 0 ? 0 : 1)).toEqual({ kind: "valid", board: loaded.board });
    expect(JSON.stringify(source)).toBe(original);
    const target = memory(raw);
    expect(saveBoard(loaded.board, raw, () => target, () => "upgrade").kind).toBe("saved");
    expect(loadBoard(() => target)).toMatchObject({ kind: "current", board: loaded.board });
    expect(target.setItem).toHaveBeenCalledOnce();
  });

  it("preserves every v1.5 field, checklist, linked child and over-capacity record in one schema-3 write", () => {
    const board = v15BoardFixture();
    const source = json(board);
    freezeDeep(source);
    const raw = JSON.stringify({ schemaVersion: 2, revision: "v15", board: source });
    const target = memory(raw);
    const loaded = loadBoard(() => target);
    expect(target.setItem).not.toHaveBeenCalled();
    if (loaded.kind !== "migrated") throw new Error("Expected v1.5 migration");
    expect(loaded.fromVersion).toBe(2);
    expect(loaded.board).toEqual(board);
    expect(migrateV2ToV3(source)).toEqual(migrateV2ToV3(source));
    expect(encodeBoardV3(loaded.board)).toEqual({
      ...JSON.parse(JSON.stringify(board)),
      columns: JSON.parse(JSON.stringify(board)).columns.map((column: object) => ({ ...column, manualOrder: null })),
    });
    expect(saveBoard(loaded.board, raw, () => target, () => "v3")).toMatchObject({ kind: "saved", revision: "v3" });
    const writes = target.setItem.mock.calls;
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0][1]).schemaVersion).toBe(3);
    expect(JSON.parse(writes[0][1]).board.columns.map((column: { tasks: unknown[] }) => column.tasks.length)).toEqual([4, 7, 5, 1]);
    const next = new PersistenceSession(() => target);
    next.save(next.board);
    next.save(next.board);
    expect(next.board).toEqual(board);
    expect(target.setItem).toHaveBeenCalledOnce();
    expect(source).toEqual(json(board));
  });

  it("preserves independent valid saved lists and never-initialized columns", () => {
    const board = v15BoardFixture();
    board.columns[0].manualOrder = ["low", "equal-second", "parent", "equal-first"];
    board.columns[3].manualOrder = ["child"];
    freezeDeep(board);
    const migrated = migrateV2ToV3(json(board));
    if (migrated.kind !== "valid") throw new Error("Expected migration");
    expect(migrated.board).toEqual(board);
    expect(encodeBoardV3(migrated.board).columns.map(column => column.manualOrder)).toEqual([
      ["low", "equal-second", "parent", "equal-first"], null, null, ["child"],
    ]);
    expect(selectOrderedTasks(migrated.board.columns[0], "priority").tasks.map(task => task.id)).toEqual(["parent", "equal-first", "equal-second", "low"]);
    expect(selectOrderedTasks(migrated.board.columns[0], "manual").tasks.map(task => task.id)).toEqual(board.columns[0].manualOrder);
  });

  it("defers initial positions until the explicit first Manual switch, including intervening Priority edits", () => {
    const migrated = migrateV2ToV3(json(makeBoard([makeTask({ id: "a", priority: "low" }), makeTask({ id: "b", priority: "medium" })])));
    if (migrated.kind !== "valid") throw new Error("Expected migration");
    expect(selectOrderedTasks(migrated.board.columns[0], "priority").tasks.map(task => task.id)).toEqual(["b", "a"]);
    const changed = boardReducer(migrated.board, { type: "UPDATE_TASK", taskId: "a", edits: { title: "Promoted task", description: "Details", priority: "high", category: "feature" }, updatedAt: fixtureDate });
    const initialized = boardReducer(changed, { type: "INITIALIZE_MANUAL_ORDER", updatedAt: fixtureDate });
    expect(initialized.columns.map(column => column.manualOrder)).toEqual([["a", "b"], [], [], []]);
    expect(boardReducer(initialized, { type: "INITIALIZE_MANUAL_ORDER", updatedAt: fixtureDate })).toBe(initialized);
    expect(migrated.board.columns[0].manualOrder).toBeUndefined();
  });

  it("treats literal schema-3 data as current without rewriting unknown fields or its revision on mount", () => {
    const data = JSON.parse(JSON.stringify(makeBoard()));
    data.columns.forEach((column: Record<string, unknown>) => { column.manualOrder = null; });
    const raw = JSON.stringify({ schemaVersion: 3, revision: "original", board: data, optionalExtension: "untouched until edit" });
    const target = memory(raw);
    const session = new PersistenceSession(() => target);
    session.save(session.board);
    expect(decodeBoard(raw)).toMatchObject({ kind: "current", revision: "original", board: makeBoard() });
    expect(target.setItem).not.toHaveBeenCalled();
    expect(target.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("keeps malformed preferences separate and projects capacity and interaction extras out of migration/writeback", () => {
    const board = { ...v15BoardFixture(), capacity: { "in-progress": 100 }, query: "private", dialog: { draft: "private" }, orderingMode: "manual" };
    const raw = JSON.stringify({ schemaVersion: 2, revision: "v15", board });
    const values = new Map([[STORAGE_KEY, raw], ["taskflow-view-preferences", "{broken"]]);
    const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
    const session = new PersistenceSession(() => storage);
    expect(session.board).toEqual(v15BoardFixture());
    session.save(session.board);
    expect(values.get("taskflow-view-preferences")).toBe("{broken");
    expect(storage.getItem.mock.calls.every(([key]) => key === STORAGE_KEY)).toBe(true);
    const saved = JSON.parse(values.get(STORAGE_KEY)!);
    expect(Object.keys(saved.board).sort()).toEqual(["columns", "id", "lastUpdated", "name"]);
    expect(Object.keys(saved).sort()).toEqual(["board", "revision", "schemaVersion"]);
  });
});

describe("failure preservation and recovery handoff", () => {
  it.each([2, 3] as const)("preserves schema %i with damaged order, restores only safe core and blocks all saves", version => {
    const domain = boardReducer(v15BoardFixture(), { type: "INITIALIZE_MANUAL_ORDER", updatedAt: fixtureDate });
    const data = encodeBoardV3(domain);
    data.columns[0].manualOrder = ["parent", "parent"];
    const raw = JSON.stringify({ schemaVersion: version, revision: "damaged", board: data });
    const target = memory(raw);
    const loaded = loadBoard(() => target);
    expect(loaded).toMatchObject({ kind: "order-recovery", version, raw, affectedColumns: ["todo"] });
    if (loaded.kind !== "order-recovery") throw new Error("Expected order recovery");
    expect(loaded.board.columns[0].manualOrder).toBeUndefined();
    expect(loaded.board.columns[1].manualOrder).toEqual(domain.columns[1].manualOrder);
    expect(loaded.board.columns.flatMap(column => column.tasks)).toEqual(domain.columns.flatMap(column => column.tasks));
    const session = new PersistenceSession(() => target);
    expect(session.orderRecovery).toEqual(loaded);
    expect(session.notice?.message).toContain("saving is paused");
    const edited = boardReducer(session.board, { type: "UPDATE_TASK", taskId: "parent", edits: { title: "Unsaved local work", description: "Details", priority: "high", category: "devops" }, updatedAt: fixtureDate });
    session.save(edited);
    expect(saveBoard(edited, raw, () => target).kind).toBe("conflict");
    expect(target.setItem).not.toHaveBeenCalled();
    expect(target.getItem(STORAGE_KEY)).toBe(raw);
  });

  it.each([undefined, "bad", ["task-1", "task-1"], [], ["foreign"], [1]])("classifies invalid required schema-3 order without inventing positions: %j", order => {
    const data = encodeBoardV3(makeBoard());
    const raw = JSON.stringify({ schemaVersion: 3, revision: "bad", board: { ...data, columns: data.columns.map((column, index) => index === 0 ? { ...column, manualOrder: order } : column) } });
    expect(decodeBoard(raw)).toMatchObject({ kind: "order-recovery", affectedColumns: ["todo"] });
  });

  it("rejects invalid core even when order is also damaged; no unsafe board is exposed", () => {
    const data = encodeBoardV3(makeBoard([makeTask({ parentId: "missing" })]));
    data.columns[0].manualOrder = [];
    expect(validateStoredBoard(data, 3).kind).toBe("invalid-core");
    const raw = JSON.stringify({ schemaVersion: 3, revision: "bad", board: data });
    const target = memory(raw);
    const session = new PersistenceSession(() => target);
    expect(decodeBoard(raw).kind).toBe("invalid");
    expect(session.board.columns.flatMap(column => column.tasks)).toEqual([]);
    session.save(makeBoard());
    expect(target.setItem).not.toHaveBeenCalled();
    expect(target.getItem(STORAGE_KEY)).toBe(raw);
  });

  it.each(["{", "null", JSON.stringify({ schemaVersion: 4, board: "future" }), JSON.stringify({ schemaVersion: 2, board: {} }), JSON.stringify({ schemaVersion: 3, revision: "bad", board: {} }), JSON.stringify({ schemaVersion: 1, board: { id: "bad" } })])("never writes invalid, failed or future source %s", raw => {
    const target = memory(raw);
    const session = new PersistenceSession(() => target);
    session.save(session.board);
    expect(target.setItem).not.toHaveBeenCalled();
    expect(target.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("returns typed write failure, retains the original and retries the complete upgraded board", () => {
    const raw = JSON.stringify({ schemaVersion: 2, revision: "v15", board: v15BoardFixture() });
    const target = memory(raw);
    const session = new PersistenceSession(() => target);
    target.setItem.mockImplementationOnce(() => { throw new DOMException("Full", "QuotaExceededError"); });
    expect(saveBoard(session.board, raw, () => target).kind).toBe("save-failed");
    expect(target.getItem(STORAGE_KEY)).toBe(raw);
    target.setItem.mockImplementationOnce(() => { throw new Error("Still full"); });
    session.save(session.board);
    expect(session.notice?.recovery).toBe("retry");
    expect(target.getItem(STORAGE_KEY)).toBe(raw);
    session.save(session.board);
    expect(session.notice?.message).toBe("Your saved board was upgraded to the current format.");
    expect(session.notice?.message).not.toContain("checklist");
    expect(loadBoard(() => target)).toMatchObject({ kind: "current", board: session.board });
  });

  it("blocks migration writeback after a newer tab changes storage", () => {
    const raw = JSON.stringify({ schemaVersion: 2, revision: "v15", board: v15BoardFixture() });
    const target = memory(raw);
    const session = new PersistenceSession(() => target);
    const external = currentBoardRaw(makeBoard([makeTask({ title: "External work" })]), "external");
    target.getItem.mockReturnValue(external);
    session.save(session.board);
    expect(session.notice?.message).toContain("Another tab");
    expect(target.setItem).not.toHaveBeenCalled();
    expect(session.board).toEqual(v15BoardFixture());
  });
});
