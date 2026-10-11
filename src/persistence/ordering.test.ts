import { expect, it } from "vitest";
import { boardReducer } from "../domain/board/boardReducer";
import { selectOrderedTasks } from "../domain/board/boardOrdering";
import { fixtureDate, makeBoard, makeTask } from "../test/fixtures";
import { CURRENT_SCHEMA_VERSION, STORAGE_KEY, decodeBoard, loadBoard, saveBoard } from "../utils/storage";

it("round-trips optional manual IDs and independent arrival ties without persisting mode", () => {
  const initial = makeBoard([makeTask({ id: "a", priority: "high" }), makeTask({ id: "b", priority: "high" }), makeTask({ id: "low", priority: "low" })]);
  const initialized = boardReducer(initial, { type: "INITIALIZE_MANUAL_ORDER", updatedAt: fixtureDate });
  const reordered = boardReducer(initialized, { type: "REORDER_TASK", taskId: "b", placement: { type: "top" }, mode: "manual", filtered: false, updatedAt: fixtureDate });
  let raw: string | null = null;
  const storage = { getItem: () => raw, setItem: (_: string, value: string) => { raw = value; } };
  expect(saveBoard(reordered, null, () => storage, () => "manual").kind).toBe("saved");
  expect(JSON.parse(raw ?? "null").schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(JSON.parse(raw ?? "null").board.columns[0].manualOrder).toEqual(["b", "a", "low"]);
  const loaded = loadBoard(() => storage);
  expect(loaded.kind).toBe("current");
  if (loaded.kind !== "current") throw new Error("Manual domain data did not restore");
  expect(loaded.board).toEqual(reordered);
  expect(selectOrderedTasks(loaded.board.columns[0], "priority").tasks.map(task => task.id)).toEqual(["a", "b", "low"]);
  expect(selectOrderedTasks(loaded.board.columns[0], "manual").tasks.map(task => task.id)).toEqual(["b", "a", "low"]);
  expect(Object.keys(JSON.parse(raw ?? "null").board).sort()).toEqual(["columns", "id", "lastUpdated", "name"]);
  expect(boardReducer(loaded.board, { type: "INITIALIZE_MANUAL_ORDER", updatedAt: fixtureDate })).toBe(loaded.board);
});

it("migrates existing schema-2 boards without manufacturing manual positions", () => {
  const result = decodeBoard(JSON.stringify({ schemaVersion: 2, revision: "legacy", board: makeBoard() }));
  expect(result.kind).toBe("migrated");
  if (result.kind !== "migrated") throw new Error("Existing board failed to migrate");
  expect(result.board.columns.every(column => column.manualOrder === undefined)).toBe(true);
});

it.each([["task-1", "task-1"], [], ["other"], [12], "not-a-list"].map(manualOrder => ({ manualOrder })))("rejects malformed optional manual data $manualOrder without overwriting its original", ({ manualOrder }) => {
  const initial = makeBoard();
  const mixed = { ...initial, columns: initial.columns.map(column => column.id === "todo" ? { ...column, manualOrder } : column) };
  const raw = JSON.stringify({ schemaVersion: 2, revision: "bad-order", board: mixed });
  const writes: string[] = [];
  const storage = { getItem: (key: string) => key === STORAGE_KEY ? raw : null, setItem: (_: string, value: string) => writes.push(value) };
  expect(loadBoard(() => storage).kind).toBe("order-recovery");
  expect(saveBoard(initial, raw, () => storage).kind).toBe("conflict");
  expect(writes).toEqual([]);
  expect(storage.getItem(STORAGE_KEY)).toBe(raw);
});
