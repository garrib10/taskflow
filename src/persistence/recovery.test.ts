import { afterEach, describe, expect, it, vi } from "vitest";
import { currentBoardRaw, fixtureDate, makeBoard, makeTask } from "../test/fixtures";
import { v15BoardFixture } from "../test/migrationFixtures";
import { boardReducer } from "../domain/board/boardReducer";
import { initialBoard } from "../utils/mockData";
import { commitConfirmedRecovery, decodeBoard, loadBoard, STORAGE_KEY } from "../utils/storage";
import * as migrations from "./migrations";
import * as schema from "./schema";
import { PersistenceSession, recoveryDiagnostic } from "./session";

afterEach(() => vi.restoreAllMocks());
function memory(raw: string | null) {
  const values = new Map<string, string>();
  if (raw !== null) values.set(STORAGE_KEY, raw);
  values.set("taskflow-view-preferences", "untouched-preferences");
  const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
  return { values, storage };
}
const failedLegacy = JSON.stringify(makeBoard([makeTask({ status: "done", subtasks: [{ id: "unfinished-private-id", title: "Private task title", completed: false }] })]));

describe("explicit recovery write policy", () => {
  it.each([
    { raw: "{broken", kind: "invalid" },
    { raw: JSON.stringify({ schemaVersion: 3, revision: "bad", board: {} }), kind: "invalid" },
    { raw: JSON.stringify({ schemaVersion: 2, revision: "bad", board: {} }), kind: "invalid" },
    { raw: failedLegacy, kind: "migration-failed" },
    { raw: JSON.stringify({ schemaVersion: 4, privateData: "private" }), kind: "future" },
  ])("preserves $kind until explicit replacement, then saves one starter board without clearing other keys", ({ raw, kind }) => {
    const { storage, values } = memory(raw);
    const session = new PersistenceSession(() => storage);
    const originalNotice = session.notice;
    expect(session.recovery.kind).toBe(kind);
    expect(session.writesEnabled).toBe(false);
    session.save(makeBoard([makeTask({ title: "Temporary work" })]));
    session.retrySave(makeBoard());
    expect(session.notice).toBe(originalNotice);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(values.get(STORAGE_KEY)).toBe(raw);
    expect(session.board.columns.flatMap(column => column.tasks)).toEqual([]);
    const replaced = session.replaceStoredBoard();
    expect(replaced).toEqual(initialBoard);
    expect(session.writesEnabled).toBe(true);
    expect(session.notice).toMatchObject({ variant: "success", recovery: null });
    expect(loadBoard(() => storage)).toMatchObject({ kind: "current", board: initialBoard });
    session.save(replaced!);
    expect(session.replaceStoredBoard()).toBeNull();
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(values.get("taskflow-view-preferences")).toBe("untouched-preferences");
  });
  it("failed replacement preserves original bytes, keeps writes disabled and permits another explicit attempt", () => {
    const { storage, values } = memory("{broken");
    const session = new PersistenceSession(() => storage);
    storage.setItem.mockImplementationOnce(() => { throw new DOMException("Private exception", "QuotaExceededError"); });
    expect(session.replaceStoredBoard()).toBeNull();
    expect(session.recovery.kind).toBe("invalid");
    expect(session.writesEnabled).toBe(false);
    expect(session.notice?.message).toContain("could not confirm");
    expect(session.notice?.message).not.toContain("Private exception");
    session.save(makeBoard());
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(values.get(STORAGE_KEY)).toBe("{broken");
    expect(session.replaceStoredBoard()).toEqual(initialBoard);
    expect(session.writesEnabled).toBe(true);
  });
  it("refuses stale confirmed replacement and preserves another tab's newer board", () => {
    const { storage, values } = memory("{broken");
    const session = new PersistenceSession(() => storage);
    const external = currentBoardRaw(makeBoard([makeTask({ title: "Newer work" })]));
    values.set(STORAGE_KEY, external);
    expect(session.replaceStoredBoard()).toBeNull();
    expect(session.recovery.kind).toBe("conflict");
    expect(values.get(STORAGE_KEY)).toBe(external);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("does not permit replacement of a healthy or unread board", () => {
    const { storage } = memory(currentBoardRaw());
    const session = new PersistenceSession(() => storage);
    expect(session.replaceStoredBoard()).toBeNull();
    expect(commitConfirmedRecovery(makeBoard(), storage.getItem(STORAGE_KEY)!, "replace", () => storage).kind).toBe("conflict");
    const unavailable = new PersistenceSession(() => { throw new Error("Blocked"); });
    expect(unavailable.replaceStoredBoard()).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("suppresses automatic retries after failed saving while retaining the latest work for explicit retry", () => {
    const { storage, values } = memory(currentBoardRaw());
    const session = new PersistenceSession(() => storage);
    storage.setItem.mockImplementationOnce(() => { throw new Error("Quota"); });
    session.save(makeBoard([makeTask({ title: "First unsaved edit" })]));
    expect(session.recovery.kind).toBe("write-failed");
    const problem = session.notice;
    const later = makeBoard([makeTask({ title: "Latest unsaved edit" })]);
    session.save(later); session.save(later);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(session.notice).toBe(problem);
    expect(values.get(STORAGE_KEY)).toBe(currentBoardRaw());
    session.retrySave(later);
    expect(session.recovery.kind).toBe("ready");
    expect(session.notice?.message).toBe("Changes in this tab are now saved.");
    expect(loadBoard(() => storage)).toMatchObject({ kind: "current", board: later });
  });
  it("reports migrated memory as usable when writeback fails and retries without reconversion", () => {
    const original = JSON.stringify(makeBoard([makeTask({ subtasks: [{ id: "child", title: "Converted child", completed: true }] })]));
    const { storage, values } = memory(original);
    const session = new PersistenceSession(() => storage);
    storage.setItem.mockImplementationOnce(() => { throw new Error("Full"); });
    session.save(session.board);
    expect(session.notice?.message).toContain("upgraded board is usable in this tab");
    expect(session.recovery).toEqual({ kind: "write-failed", migrationPending: true });
    expect(values.get(STORAGE_KEY)).toBe(original);
    session.retrySave(session.board);
    expect(session.recovery.kind).toBe("ready");
    expect(session.notice?.variant).toBe("info");
    expect(session.board.columns.flatMap(column => column.tasks)).toHaveLength(2);
  });
});

describe("read retry and sanitized failures", () => {
  it("read retry failure remains paused; successful retry restores current data without rewriting it", () => {
    const { storage, values } = memory(currentBoardRaw());
    const get = storage.getItem.getMockImplementation()!;
    storage.getItem.mockImplementation(() => { throw new Error("Private read exception"); });
    const session = new PersistenceSession(() => storage);
    expect(session.recovery.kind).toBe("read-failed");
    expect(session.retryRead()).toBeNull();
    session.save(makeBoard());
    expect(storage.setItem).not.toHaveBeenCalled();
    storage.getItem.mockImplementation(get);
    expect(session.retryRead()).toEqual(makeBoard());
    expect(session.writesEnabled).toBe(true);
    session.save(session.board);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(values.get(STORAGE_KEY)).toBe(currentBoardRaw());
    expect(session.notice?.message).toContain("restored");
  });
  it("read retry revealing invalid data preserves temporary work and exposes only justified recovery actions", () => {
    const { storage, values } = memory("{broken");
    storage.getItem.mockImplementationOnce(() => { throw new Error("Blocked"); });
    const session = new PersistenceSession(() => storage);
    expect(session.retryRead()).toBeNull();
    expect(session.recovery.kind).toBe("invalid");
    expect(session.notice?.message).toContain("current work");
    expect(session.writesEnabled).toBe(false);
    expect(values.get(STORAGE_KEY)).toBe("{broken");
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("classifies migration exceptions separately from storage failures without exposing exception details", () => {
    vi.spyOn(migrations, "migrateBoard").mockImplementation(() => { throw new Error("Secret exception stack"); });
    const raw = JSON.stringify(makeBoard());
    const { storage } = memory(raw);
    const loaded = loadBoard(() => storage);
    expect(loaded).toMatchObject({ kind: "migration-failed", code: "migration-exception" });
    if (loaded.kind !== "migration-failed") throw new Error("Expected migration failure");
    expect(loaded.reason).not.toContain("Secret");
    const session = new PersistenceSession(() => storage);
    expect(recoveryDiagnostic(session.recovery)).toBe("Recovery code: migration-exception");
    session.save(makeBoard());
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("sanitizes invalid relationship diagnostics and unexpected current-validator exceptions", () => {
    const raw = currentBoardRaw(makeBoard([makeTask({ id: "private-task-id", title: "Private title", parentId: "private-parent-id" })]));
    const loaded = decodeBoard(raw);
    expect(loaded).toMatchObject({ kind: "invalid", code: "invalid-board", reason: "Invalid board content" });
    const { storage } = memory(raw);
    const session = new PersistenceSession(() => storage);
    expect(recoveryDiagnostic(session.recovery)).toBe("Recovery code: invalid-board");
    expect(session.notice?.message).not.toMatch(/private-task|Private title|private-parent/);
    vi.spyOn(schema, "validateStoredBoard").mockImplementation(() => { throw new Error("Private validator stack"); });
    expect(decodeBoard(currentBoardRaw())).toMatchObject({ kind: "invalid", code: "invalid-board" });
  });
});

describe("selective confirmed order repair", () => {
  function damaged() {
    const data = schema.encodeBoardV3(v15BoardFixture());
    data.columns[0].manualOrder = ["parent", "parent"];
    data.columns[1].manualOrder = data.columns[1].tasks.map(task => task.id).reverse();
    data.columns[3].manualOrder = ["child"];
    return JSON.stringify({ schemaVersion: 3, revision: "damaged", board: data });
  }
  it("repairs only damaged columns using full Priority ties, retaining local edits, links, over-capacity work and valid lists", () => {
    const { storage } = memory(damaged());
    const session = new PersistenceSession(() => storage);
    const before = session.board;
    const edited = boardReducer(before, { type: "UPDATE_TASK", taskId: "low", edits: { title: "Local edit", description: "Details", priority: "high", category: "ui" }, updatedAt: fixtureDate });
    const repaired = session.repairOrder(edited);
    if (!repaired) throw new Error("Expected repair");
    expect(repaired.columns[0].manualOrder).toEqual(["parent", "equal-first", "equal-second", "low"]);
    expect(repaired.columns[1].manualOrder).toEqual(before.columns[1].manualOrder);
    expect(repaired.columns[2].manualOrder).toBeUndefined();
    expect(repaired.columns[3].manualOrder).toEqual(["child"]);
    expect(repaired.columns.flatMap(column => column.tasks)).toEqual(edited.columns.flatMap(column => column.tasks));
    expect(repaired.lastUpdated).toEqual(edited.lastUpdated);
    expect(repaired.columns.map(column => column.tasks.length)).toEqual([4, 7, 5, 1]);
    expect(loadBoard(() => storage)).toMatchObject({ kind: "current", board: repaired });
    expect(session.writesEnabled).toBe(true);
    expect(session.orderRecovery).toBeNull();
    session.save(repaired);
    expect(session.repairOrder(repaired)).toBeNull();
    expect(storage.setItem).toHaveBeenCalledOnce();
  });
  it("failed repair and invalid local edits preserve original bytes and do not enable autosave", () => {
    const raw = damaged();
    const { storage, values } = memory(raw);
    const session = new PersistenceSession(() => storage);
    storage.setItem.mockImplementationOnce(() => { throw new Error("Quota"); });
    expect(session.repairOrder(session.board)).toBeNull();
    expect(session.recovery.kind).toBe("order-recovery");
    session.save(session.board);
    expect(values.get(STORAGE_KEY)).toBe(raw);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const invalid = { ...session.board, columns: session.board.columns.map(column => ({ ...column, tasks: column.tasks.map(task => ({ ...task, parentId: "missing" })) })) };
    expect(session.repairOrder(invalid)).toBeNull();
    expect(values.get(STORAGE_KEY)).toBe(raw);
    expect(session.writesEnabled).toBe(false);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(session.repairOrder(session.board)).not.toBeNull();
  });
});
