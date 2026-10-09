import { describe, expect, it } from "vitest";
import { makeBoard, makeTask, freezeDeep } from "../test/fixtures";
import { validateBoard } from "./validation";
import { migrateBoard, migrateV0ToV1, migrateV1ToV2 } from "./migrations";
import { CURRENT_SCHEMA_VERSION, STORAGE_KEY, decodeBoard, loadBoard, saveBoard, type BoardStorage } from "../utils/storage";

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const encoded = (board: unknown = makeBoard(), revision = "revision-a") => JSON.stringify({ schemaVersion: 2, revision, board });
function memory(raw: string | null = null): BoardStorage {
  const values = new Map<string, string>(raw === null ? [] : [[STORAGE_KEY, raw]]);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
const parent = makeTask({ id: "parent", title: "Parent", subtasks: [
  { id: "finished", title: "Completed checklist", completed: true },
  { id: "unfinished", title: "Open checklist", completed: false },
] });

describe("runtime persisted-board validation", () => {
  it("restores canonical dates and valid linked current data", () => {
    const board = makeBoard([makeTask({ id: "parent" }), makeTask({ id: "child", parentId: "parent" })]);
    expect(validateBoard(json(board))).toEqual({ ok: true, board });
    expect(decodeBoard(encoded(board))).toMatchObject({ kind: "current", board, revision: "revision-a" });
  });
  it.each([null, [], 1, true, "board", {}, { columns: {} }])("rejects unexpected board shapes: %j", (value) => {
    expect(validateBoard(value).ok).toBe(false);
  });
  it.each(["id", "name", "columns", "lastUpdated"])("requires board field %s", (field) => {
    const value: Record<string, unknown> = { ...makeBoard() };
    delete value[field];
    expect(validateBoard(json(value)).ok).toBe(false);
  });
  it.each(["id", "title", "description", "status", "priority", "category", "createdAt", "subtasks"])("requires task field %s", (field) => {
    const task: Record<string, unknown> = { ...makeTask() };
    delete task[field];
    const board = { ...makeBoard(), columns: [{ id: "todo", title: "To Do", tasks: [task] }] };
    expect(validateBoard(json(board), true).ok).toBe(["description", "subtasks"].includes(field));
    expect(validateBoard(json(board)).ok).toBe(false);
  });
  it.each([
    { status: "backlog" }, { priority: "urgent" }, { category: "unknown" },
    { id: "" }, { title: null }, { description: 1 }, { createdAt: "bad-date" },
    { createdAt: "2026-02-30T00:00:00.000Z" }, { createdAt: 123 },
    { parentId: null }, { parentId: 1 }, { parentId: "" }, { subtasks: {} },
    { subtasks: [null] }, { subtasks: [{ id: "x", title: "Title", completed: "yes" }] },
  ])("rejects invalid task values %j", (edits) => {
    const board = makeBoard();
    const value = { ...board, columns: board.columns.map((column) => ({ ...column, tasks: column.tasks.map((task) => ({ ...task, ...edits })) })) };
    expect(validateBoard(json(value)).ok).toBe(false);
  });
  it.each(["unknown", null, 1])("rejects invalid column ID %j", (id) => {
    expect(validateBoard(json({ ...makeBoard(), columns: [{ id, title: "Column", tasks: [] }] })).ok).toBe(false);
  });
  it("rejects missing/duplicate columns, status mismatches and duplicate task IDs", () => {
    const board = makeBoard();
    expect(validateBoard(json({ ...board, columns: board.columns.slice(1) })).ok).toBe(false);
    expect(validateBoard(json({ ...board, columns: [...board.columns, board.columns[0]] })).ok).toBe(false);
    expect(validateBoard(json(makeBoard([makeTask(), makeTask()]))).ok).toBe(false);
    const wrong = { ...board, columns: board.columns.map((column) => ({ ...column, tasks: column.tasks.map((task) => ({ ...task, status: "done" })) })) };
    expect(validateBoard(json(wrong)).ok).toBe(false);
  });
  it.each([
    [makeTask({ parentId: "missing" })],
    [makeTask({ parentId: "task-1" })],
    [makeTask({ id: "a", parentId: "b" }), makeTask({ id: "b", parentId: "a" })],
    [makeTask({ id: "a" }), makeTask({ id: "b", parentId: "a" }), makeTask({ id: "c", parentId: "b" })],
    [makeTask({ id: "a", status: "done" }), makeTask({ id: "b", parentId: "a" })],
  ].map((tasks) => ({ tasks })))("rejects malformed relationships %j", ({ tasks }) => {
    expect(validateBoard(json(makeBoard(tasks))).ok).toBe(false);
  });
  it.each([null, "not-a-date", 4])("rejects invalid board timestamp %j", (lastUpdated) => {
    expect(validateBoard(json({ ...makeBoard(), lastUpdated })).ok).toBe(false);
  });
});

describe("versioned decoding and ordered migrations", () => {
  it("validates each explicit version step before moving to the next", () => {
    const v0 = { ...makeBoard([parent]), columns: [{ id: "todo", title: "To Do", tasks: [parent] }] };
    const v1 = migrateV0ToV1(json(v0));
    if (!v1.ok) throw new Error(v1.reason);
    expect(v1.board.columns).toHaveLength(4);
    expect(v1.board.columns[0]?.tasks[0]?.subtasks).toEqual(parent.subtasks);
    const v2 = migrateV1ToV2(json(v1.board));
    if (!v2.ok) throw new Error(v2.reason);
    expect(v2.board.columns.flatMap((column) => column.tasks)).toHaveLength(3);
    expect(validateBoard(json(v2.board)).ok).toBe(true);
  });
  it("migrates v0 to v1 to v2, preserves parent data and maps checklist status", () => {
    const board = makeBoard([parent]);
    freezeDeep(board);
    const result = decodeBoard(JSON.stringify(board));
    expect(result.kind).toBe("migrated");
    if (result.kind !== "migrated") throw new Error("Expected migration");
    const tasks = result.board.columns.flatMap((column) => column.tasks);
    expect(tasks.find((task) => task.id === parent.id)).toEqual({ ...parent, subtasks: [] });
    expect(tasks.find((task) => task.id === "finished")).toEqual(makeTask({ id: "finished", title: "Completed checklist", status: "done", parentId: parent.id, description: "", priority: parent.priority, category: parent.category, createdAt: parent.createdAt }));
    expect(tasks.find((task) => task.id === "unfinished")?.status).toBe("todo");
    expect(tasks).toHaveLength(3);
    expect(validateBoard(json(result.board)).ok).toBe(true);
    expect(parent.subtasks).toHaveLength(2);
    expect(migrateBoard(json(result.board), 0)).toEqual({ ok: true, board: result.board });
    expect(migrateBoard(json(board), 0)).toEqual(migrateBoard(json(board), 0));
  });
  it("supports v1 to v2, missing columns, legacy defaults and deterministic dates", () => {
    const legacy = { ...makeBoard([parent]), lastUpdated: undefined, columns: [{ id: "todo", title: "Custom todo", tasks: [{ ...parent, description: undefined }] }] };
    const result = decodeBoard(JSON.stringify({ schemaVersion: 1, board: legacy }));
    if (result.kind !== "migrated") throw new Error("Expected migration");
    expect(result.fromVersion).toBe(1);
    expect(result.board.columns).toHaveLength(4);
    expect(result.board.lastUpdated).toEqual(parent.createdAt);
    expect(result.board.columns[0]?.title).toBe("Custom todo");
    expect(validateBoard(json(result.board)).ok).toBe(true);
  });
  it("retains already converted children without duplicating or rolling back edits", () => {
    const converted = makeTask({ id: "finished", title: "Edited converted child", parentId: parent.id, status: "in-review", description: "Preserved child description" });
    const result = migrateBoard(json(makeBoard([parent, converted])), 0);
    if (!result.ok) throw new Error(result.reason);
    const tasks = result.board.columns.flatMap((column) => column.tasks);
    expect(tasks.filter((task) => task.id === "finished")).toEqual([converted]);
    expect(tasks).toHaveLength(3);
  });
  it.each([
    makeBoard([{ ...parent, subtasks: [{ id: "parent", title: "Collision", completed: false }] }]),
    makeBoard([{ ...parent, subtasks: [{ id: "repeat", title: "One", completed: false }, { id: "repeat", title: "Two", completed: true }] }]),
    makeBoard([parent, { ...makeTask({ id: "another" }), subtasks: [{ id: "unfinished", title: "Collision", completed: false }] }]),
    makeBoard([makeTask({ id: "ancestor" }), { ...parent, parentId: "ancestor" }]),
    makeBoard([{ ...parent, status: "done" }]),
  ])("rejects conflicting/deep/incomplete legacy data without a partial result", (board) => {
    expect(migrateBoard(json(board), 0).ok).toBe(false);
  });
  it("never silently drops malformed checklist entries", () => {
    const value = { ...makeBoard(), columns: [{ id: "todo", title: "To Do", tasks: [{ ...parent, subtasks: [{ title: "No ID", completed: false }] }] }] };
    expect(migrateBoard(json(value), 0).ok).toBe(false);
  });
  it("does not migrate current data", () => {
    expect(decodeBoard(encoded())).toMatchObject({ kind: "current", board: makeBoard() });
  });
  it.each([0, -1, 1.5, "2", null])("rejects invalid version %j", (schemaVersion) => {
    expect(decodeBoard(JSON.stringify({ schemaVersion, board: makeBoard() })).kind).toBe("invalid");
  });
  it("recognizes future versions without inspecting or transforming their contents", () => {
    const raw = JSON.stringify({ schemaVersion: 99, board: "future shape" });
    expect(decodeBoard(raw)).toEqual({ kind: "future", raw, version: 99 });
  });
  it.each(["", "{", "null", "42", "true", '"board"', "[]"])("rejects malformed/primitive JSON %j", (raw) => {
    expect(decodeBoard(raw).kind).toBe("invalid");
  });
});

describe("safe storage boundary", () => {
  it("distinguishes missing from empty or invalid values", () => {
    expect(loadBoard(() => memory())).toEqual({ kind: "missing", raw: null });
    expect(loadBoard(() => memory("")).kind).toBe("invalid");
  });
  it("loads without writing and saves a current envelope with supplied revision", () => {
    const target = memory();
    const board = makeBoard();
    expect(saveBoard(board, null, () => target, () => "known-revision").kind).toBe("saved");
    expect(JSON.parse(target.getItem(STORAGE_KEY) ?? "null")).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, revision: "known-revision" });
    expect(loadBoard(() => target)).toMatchObject({ kind: "current", board, revision: "known-revision" });
  });
  it("read failures and unavailable storage return typed failure", () => {
    const unavailable = () => { throw new DOMException("Blocked", "SecurityError"); };
    expect(loadBoard(unavailable).kind).toBe("unavailable");
    expect(saveBoard(makeBoard(), null, unavailable).kind).toBe("unavailable");
    expect(loadBoard(() => ({ getItem: unavailable, setItem: () => {} })).kind).toBe("unavailable");
  });
  it.each([new Error("Write failed"), new DOMException("Full", "QuotaExceededError"), new DOMException("Blocked", "SecurityError")])("write failure preserves saved data and the in-memory board", (error) => {
    const original = encoded();
    const board = makeBoard([makeTask({ title: "Local work" })]);
    freezeDeep(board);
    const target = { getItem: () => original, setItem: () => { throw error; } };
    expect(saveBoard(board, original, () => target).kind).toBe("save-failed");
    expect(target.getItem()).toBe(original);
    expect(board.columns[0]?.tasks[0]?.title).toBe("Local work");
  });
  it("stale expected content cannot overwrite a newer board even with the same revision", () => {
    const stale = encoded();
    const fresh = encoded(makeBoard([makeTask({ title: "Newer work" })]));
    const target = memory(fresh);
    expect(saveBoard(makeBoard(), stale, () => target).kind).toBe("conflict");
    expect(target.getItem(STORAGE_KEY)).toBe(fresh);
  });
  it("rejected data cannot be overwritten even when the caller knows the exact raw value", () => {
    for (const original of ["{", JSON.stringify({ schemaVersion: 99 })]) {
      const target = memory(original);
      expect(saveBoard(makeBoard(), original, () => target).kind).toBe("conflict");
      expect(target.getItem(STORAGE_KEY)).toBe(original);
    }
  });
  it("migration failures and future data remain untouched", () => {
    for (const raw of ["{", JSON.stringify(makeBoard([{ ...parent, status: "done" }])), JSON.stringify({ schemaVersion: 99 })]) {
      const target = memory(raw);
      expect(loadBoard(() => target).kind).not.toBe("current");
      expect(target.getItem(STORAGE_KEY)).toBe(raw);
    }
  });
  it("migration is written only after success, then loading again adds no children", () => {
    const original = JSON.stringify(makeBoard([parent]));
    const target = memory(original);
    const loaded = loadBoard(() => target);
    expect(target.getItem(STORAGE_KEY)).toBe(original);
    if (loaded.kind !== "migrated") throw new Error("Expected migration");
    expect(saveBoard(loaded.board, loaded.raw, () => target).kind).toBe("saved");
    expect(loadBoard(() => target)).toMatchObject({ kind: "current", board: loaded.board });
  });
  it("invalid live data and serialization errors never claim a successful save", () => {
    const target = memory();
    expect(saveBoard({ ...makeBoard(), lastUpdated: new Date("invalid") }, null, () => target).kind).toBe("invalid-board");
    expect(saveBoard(makeBoard(), null, () => target, () => "").kind).toBe("save-failed");
    const unserializable = makeBoard();
    Object.defineProperty(unserializable, "toJSON", { value: () => { throw new Error("Serialization blocked"); } });
    expect(saveBoard(unserializable, null, () => target).kind).toBe("save-failed");
    expect(target.getItem(STORAGE_KEY)).toBeNull();
  });
  it("detects an observable concurrent write after its own write", () => {
    const external = encoded(makeBoard([makeTask({ title: "Concurrent work" })]), "external");
    let raw: string | null = null;
    const target = { getItem: () => raw, setItem: () => { raw = external; } };
    expect(saveBoard(makeBoard(), null, () => target).kind).toBe("conflict");
    expect(raw).toBe(external);
  });
});
