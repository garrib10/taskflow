import { describe, expect, it } from "vitest";
import { boardReducer, type BoardAction } from "./boardReducer";
import { validateBoardAction } from "./boardValidation";
import { manualOrderState, normalizeManualOrder, selectOrderedTasks, type MovementOrdering, type TaskPlacement } from "./boardOrdering";
import type { Board, Column } from "./Board";
import { fixtureDate, freezeDeep, makeBoard, makeTask } from "../../test/fixtures";
import { getChildProgress, getParent } from "./taskRelationships";

const ids = (column: Column, mode: "manual" | "priority" = "manual") => selectOrderedTasks(column, mode).tasks.map(task => task.id);
const column = (board: Board, status = "todo") => {
  const found = board.columns.find(item => item.id === status);
  if (!found) throw new Error(`Missing ${status}`);
  return found;
};
const initial = () => makeBoard([
  makeTask({ id: "low", priority: "low" }),
  makeTask({ id: "high-a", priority: "high" }),
  makeTask({ id: "high-b", priority: "high" }),
  makeTask({ id: "medium", priority: "medium" }),
]);
const initialize = (board = initial()) => boardReducer(board, { type: "INITIALIZE_MANUAL_ORDER", updatedAt: fixtureDate });
const reorder = (board: Board, taskId: string, placement: TaskPlacement, filtered = false, mode: "manual" | "priority" = "manual") =>
  boardReducer(board, { type: "REORDER_TASK", taskId, placement, filtered, mode, updatedAt: fixtureDate });

// Each operation enters through the same validated reducer used by all UI inputs.
describe("manual ordering", () => {
  it("initializes full legacy columns from priority display with stable arrival ties, without modifying tasks", () => {
    const old = initial(); freezeDeep(old);
    expect(manualOrderState(column(old))).toBe("uninitialized");
    expect(ids(column(old))).toEqual(["high-a", "high-b", "medium", "low"]);
    const next = initialize(old);
    expect(ids(column(next))).toEqual(["high-a", "high-b", "medium", "low"]);
    expect(column(next).tasks).toBe(column(old).tasks);
    expect(column(next, "done").manualOrder).toEqual([]);
    expect(initialize(next)).toBe(next);
    expect(old.columns.every(item => item.manualOrder === undefined)).toBe(true);
  });

  it("reorders manual IDs immutably while leaving arrival ties, priorities and other columns intact", () => {
    const old = initialize(); freezeDeep(old);
    const next = reorder(old, "high-b", { type: "top" });
    expect(ids(column(next))).toEqual(["high-b", "high-a", "medium", "low"]);
    expect(ids(column(next), "priority")).toEqual(["high-a", "high-b", "medium", "low"]);
    expect(column(next).tasks).toBe(column(old).tasks);
    expect(column(next, "done")).toBe(column(old, "done"));
    expect(reorder(next, "high-b", { type: "top" })).toBe(next);
    expect(ids(column(next))).toEqual(["high-b", "high-a", "medium", "low"]);
  });

  it.each([
    [{ type: "bottom" }, ["high-a", "medium", "low", "high-b"]],
    [{ type: "before", taskId: "low" }, ["high-a", "medium", "high-b", "low"]],
    [{ type: "after", taskId: "medium" }, ["high-a", "medium", "high-b", "low"]],
  ] satisfies [TaskPlacement, string[]][])("supports requested gap %j", (placement, expected) => {
    expect(ids(column(reorder(initialize(), "high-b", placement)))).toEqual(expected);
  });

  it.each([true, false])("rejects active criteria even when all tasks remain visible, mode guard %s", filtered => {
    const old = initialize();
    const action: BoardAction = { type: "REORDER_TASK", taskId: "low", placement: { type: "top" }, mode: filtered ? "manual" : "priority", filtered, updatedAt: fixtureDate };
    expect(validateBoardAction(old, action)?.code).toBe(filtered ? "filtered-reorder" : "priority-ordering");
    expect(boardReducer(old, action)).toBe(old);
  });

  it("rejects missing/stale/self targets and ambiguous IDs without partially changing state", () => {
    const old = initialize();
    expect(reorder(old, "missing", { type: "top" })).toBe(old);
    expect(reorder(old, "low", { type: "before", taskId: "missing" })).toBe(old);
    expect(reorder(old, "low", { type: "after", taskId: "low" })).toBe(old);
    expect(reorder(initial(), "low", { type: "top" })).toEqual(initial());
    const ambiguous = makeBoard([makeTask(), makeTask()]);
    expect(initialize(ambiguous)).toBe(ambiguous);
  });

  it("repairs duplicate/missing/foreign IDs explicitly, repeatably, preserving other valid column orders", () => {
    for (const invalid of [["low", "low"], ["low"], ["unknown", "high-a", "high-b", "medium"]]) {
      const old = initialize();
      const damaged = { ...old, columns: old.columns.map(item => item.id === "todo" ? { ...item, manualOrder: invalid } : item) };
      expect(selectOrderedTasks(column(damaged), "manual").kind).toBe("unavailable");
      expect(initialize(damaged)).toBe(damaged);
      expect(reorder(damaged, "low", { type: "top" })).toBe(damaged);
      const normalized = normalizeManualOrder(column(damaged));
      expect(ids(normalized)).toEqual(["high-a", "high-b", "medium", "low"]);
      expect(normalizeManualOrder(normalized)).toBe(normalized);
      const repaired = boardReducer(damaged, { type: "REPAIR_MANUAL_ORDER", status: "todo", updatedAt: fixtureDate });
      expect(column(repaired, "done")).toBe(column(damaged, "done"));
      expect(column(repaired).tasks).toBe(column(damaged).tasks);
      expect(ids(column(repaired))).toEqual(ids(normalized));
      expect(boardReducer(repaired, { type: "REPAIR_MANUAL_ORDER", status: "todo", updatedAt: fixtureDate })).toBe(repaired);
    }
  });

  it("inserts independent and linked creation at latent manual top while appending priority arrivals", () => {
    let old = initialize();
    old = boardReducer(old, { type: "CREATE_TASK", task: makeTask({ id: "parent", priority: "low" }), updatedAt: fixtureDate });
    const next = boardReducer(old, { type: "CREATE_CHILD_TASK", parentId: "parent", task: makeTask({ id: "child", priority: "low" }), updatedAt: fixtureDate });
    expect(ids(column(next))).toEqual(["child", "parent", "high-a", "high-b", "medium", "low"]);
    expect(ids(column(next), "priority")).toEqual(["high-a", "high-b", "medium", "low", "parent", "child"]);
    expect(getParent(next, column(next).tasks.find(task => task.id === "child") ?? makeTask())?.id).toBe("parent");
    const uninitialized = boardReducer(initial(), { type: "CREATE_TASK", task: makeTask({ id: "new" }), updatedAt: fixtureDate });
    expect(column(uninitialized).manualOrder).toBeUndefined();
  });

  it.each(["pointer", "touch", "keyboard", "explicit"] as const)("uses shared stage movement for %s with approved destination placement", input => {
    const old = initialize(makeBoard([makeTask({ id: "move" }), makeTask({ id: "h", status: "in-progress", priority: "high" }), makeTask({ id: "v", status: "in-progress" })]));
    freezeDeep(old);
    const ordering: MovementOrdering = { mode: "manual", filtered: false, input, placement: { type: "after", taskId: "h" } };
    const next = boardReducer(old, { type: "MOVE_TASK", taskId: "move", newStatus: "in-progress", ordering, updatedAt: fixtureDate });
    expect(ids(column(next, "in-progress"))).toEqual(input === "pointer" || input === "touch" ? ["h", "move", "v"] : ["move", "h", "v"]);
    expect(column(next).manualOrder).toEqual([]);
    expect(column(next, "in-progress").tasks.map(task => task.id)).toEqual(["h", "v", "move"]);
    expect(ids(column(next, "in-progress"), "priority")).toEqual(["h", "v", "move"]);
  });

  it("uses full destination top while filtered or in Priority, including hidden neighbors", () => {
    const old = initialize(makeBoard([makeTask({ id: "x" }), makeTask({ id: "hidden", status: "in-progress" }), makeTask({ id: "visible", status: "in-progress" })]));
    for (const mode of ["manual", "priority"] as const) {
      const next = boardReducer(old, { type: "MOVE_TASK", taskId: "x", newStatus: "in-progress", ordering: { mode, filtered: true, input: "pointer", placement: { type: "after", taskId: "visible" } }, updatedAt: fixtureDate });
      expect(ids(column(next, "in-progress"))).toEqual(["x", "hidden", "visible"]);
    }
    const defaultMove = boardReducer(old, { type: "MOVE_TASK", taskId: "x", newStatus: "in-progress", updatedAt: fixtureDate });
    expect(ids(column(defaultMove, "in-progress"))).toEqual(["x", "hidden", "visible"]);
  });

  it("keeps legacy movement uninitialized and rejects invalid stage/gap/parent completion atomically", () => {
    const old = initialize(makeBoard([makeTask({ id: "parent", status: "in-review" }), makeTask({ id: "child", parentId: "parent" }), makeTask({ id: "move" })]));
    const move: BoardAction = { type: "MOVE_TASK", taskId: "parent", newStatus: "done", updatedAt: fixtureDate };
    expect(validateBoardAction(old, move)?.code).toBe("incomplete-children");
    expect(boardReducer(old, move)).toBe(old);
    expect(boardReducer(old, { type: "MOVE_TASK", taskId: "move", newStatus: "done", updatedAt: fixtureDate })).toBe(old);
    expect(boardReducer(old, { type: "MOVE_TASK", taskId: "move", newStatus: "in-progress", ordering: { mode: "manual", filtered: false, input: "pointer", placement: { type: "after", taskId: "missing" } }, updatedAt: fixtureDate })).toBe(old);
    const legacy = makeBoard();
    expect(boardReducer(legacy, { type: "MOVE_TASK", taskId: "task-1", newStatus: "in-progress", updatedAt: fixtureDate }).columns.every(item => item.manualOrder === undefined)).toBe(true);
  });

  it("deletes only the requested position and detaches surviving children in place", () => {
    const old = initialize(makeBoard([makeTask({ id: "parent" }), makeTask({ id: "child", parentId: "parent" }), makeTask({ id: "other" })]));
    const ordered = reorder(old, "child", { type: "top" });
    const next = boardReducer(ordered, { type: "DELETE_PARENT_TASK", taskId: "parent", updatedAt: fixtureDate });
    expect(ids(column(next))).toEqual(["child", "other"]);
    expect(column(next).tasks.map(task => [task.id, task.parentId])).toEqual([["child", undefined], ["other", undefined]]);
    const deleted = boardReducer(next, { type: "DELETE_TASK", taskId: "other", updatedAt: fixtureDate });
    expect(column(deleted).manualOrder).toEqual(["child"]);
  });

  it("leaves manual placement intact through metadata edits and selector switches", () => {
    const old = reorder(initialize(), "low", { type: "top" });
    const next = boardReducer(old, { type: "UPDATE_TASK", taskId: "high-b", edits: { title: "Edited", description: "Details", priority: "low", category: "testing" }, updatedAt: fixtureDate });
    expect(ids(column(next))).toEqual(["low", "high-a", "high-b", "medium"]);
    expect(ids(column(next), "priority")).toEqual(["high-a", "medium", "low", "high-b"]);
    expect(ids(column(next))).toEqual(ids(column(old)));
    expect(column(next).manualOrder).toBe(column(old).manualOrder);
  });

  it("projects visible tasks after ordering the full column, never overwriting hidden positions", () => {
    const old = reorder(initialize(), "low", { type: "top" });
    expect(selectOrderedTasks(column(old), "manual", ["medium", "low"]).tasks.map(task => task.id)).toEqual(["low", "medium"]);
    expect(selectOrderedTasks(column(old), "priority", ["medium", "low"]).tasks.map(task => task.id)).toEqual(["medium", "low"]);
    expect(selectOrderedTasks(column(old), "manual", []).tasks).toEqual([]);
    expect(ids(column(old))).toEqual(["low", "high-a", "high-b", "medium"]);
  });

  it("maintains valid empty and single-task columns and preserves timestamps for logical no-ops", () => {
    const old = initialize(makeBoard());
    const noOp = boardReducer(old, { type: "REORDER_TASK", taskId: "task-1", placement: { type: "bottom" }, mode: "manual", filtered: false, updatedAt: new Date("2026-02-01") });
    expect(noOp).toBe(old);
    const next = boardReducer(old, { type: "MOVE_TASK", taskId: "task-1", newStatus: "in-progress", ordering: { mode: "manual", filtered: false, input: "pointer" }, updatedAt: fixtureDate });
    expect(column(next).manualOrder).toEqual([]);
    expect(column(next, "in-progress").manualOrder).toEqual(["task-1"]);
    expect(boardReducer(initial(), { type: "MOVE_TASK", taskId: "low", newStatus: "in-progress", ordering: { mode: "manual", filtered: false, input: "keyboard" }, updatedAt: fixtureDate })).toEqual(initial());
  });

  it("allows placement-only reordering in Done without reopening tasks or altering links/progress", () => {
    const old = initialize(makeBoard([makeTask({ id: "parent", status: "done" }), makeTask({ id: "child", parentId: "parent", status: "done" })]));
    const next = reorder(old, "child", { type: "top" });
    expect(ids(column(next, "done"))).toEqual(["child", "parent"]);
    expect(getChildProgress(next, "parent")).toEqual({ total: 1, completed: 1 });
    expect(column(next, "done").tasks).toBe(column(old, "done").tasks);
  });
});
