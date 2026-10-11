import { describe, expect, it } from "vitest";
import { COLUMN_CAPACITY, evaluateIncomingCapacity, getColumnCapacity } from "./boardCapacity";
import { boardReducer, type BoardAction } from "./boardReducer";
import { validateBoardAction } from "./boardValidation";
import { filterBoardColumns } from "./boardFilters";
import { selectOrderedTasks } from "./boardOrdering";
import { fixtureDate, freezeDeep, makeBoard, makeTask } from "../../test/fixtures";
import type { TaskStatus } from "../task/Task";
import type { Board } from "./Board";
import { getParent } from "./taskRelationships";

function populated(status: TaskStatus, count: number, source?: TaskStatus) {
  return makeBoard([
    ...Array.from({ length: count }, (_, index) => makeTask({ id: `occupant-${index}`, title: index < 2 ? "Visible work" : "Hidden work", priority: index < 2 ? "high" : "low", status })),
    ...(source ? [makeTask({ id: "incoming", title: "Incoming work", status: source })] : []),
  ]);
}
const move = (taskId: string, newStatus: TaskStatus): BoardAction => ({ type: "MOVE_TASK", taskId, newStatus, updatedAt: fixtureDate });
const initialize = (board: Board) => boardReducer(board, { type: "INITIALIZE_MANUAL_ORDER", updatedAt: fixtureDate });

describe("fixed complete-board capacity", () => {
  it("intentionally configures all statuses and freezes the application policy", () => {
    expect(COLUMN_CAPACITY).toEqual({ todo: null, "in-progress": 5, "in-review": 3, done: null });
    expect(Object.isFrozen(COLUMN_CAPACITY)).toBe(true);
  });
  it.each(["todo", "done"] as const)("derives unlimited totals for %s without near/full states", status => {
    const board = populated(status, 20);
    expect(getColumnCapacity(board, status)).toEqual({ kind: "unlimited", status, count: 20, limit: null, remaining: null, state: "unlimited" });
    expect(evaluateIncomingCapacity(board, status).kind).toBe("allowed");
    if (status === "todo") {
      expect(boardReducer(board, { type: "CREATE_TASK", task: makeTask({ id: "extra" }), updatedAt: fixtureDate })).not.toBe(board);
    } else {
      const withSource = populated(status, 20, "in-review");
      expect(boardReducer(withSource, move("incoming", status))).not.toBe(withSource);
    }
  });
  it.each(["in-progress", "in-review"] as const)("derives available/near/full/over semantics for %s", status => {
    const limit = COLUMN_CAPACITY[status];
    expect(getColumnCapacity(populated(status, 0), status)).toMatchObject({ state: "available", remaining: limit });
    expect(getColumnCapacity(populated(status, limit - 1), status)).toMatchObject({ state: "near", remaining: 1 });
    expect(getColumnCapacity(populated(status, limit), status)).toMatchObject({ state: "full", remaining: 0 });
    expect(getColumnCapacity(populated(status, limit + 1), status)).toMatchObject({ state: "over", remaining: 0 });
  });
  it.each(["in-progress", "in-review"] as const)("allows final slot and blocks full/over arrivals to %s", status => {
    const limit = COLUMN_CAPACITY[status], source = status === "in-progress" ? "todo" : "in-progress";
    const available = populated(status, limit - 1, source);
    const accepted = boardReducer(available, move("incoming", status));
    expect(accepted).not.toBe(available);
    expect(getColumnCapacity(accepted, status)).toMatchObject({ count: limit, state: "full" });
    for (const count of [limit, limit + 2]) {
      const blocked = populated(status, count, source); freezeDeep(blocked);
      const action = move("incoming", status);
      const rejection = validateBoardAction(blocked, action);
      expect(rejection).toMatchObject({ code: "capacity-exceeded", taskId: "incoming", capacity: { kind: "limited", status, count, limit } });
      expect(rejection?.message).toContain(count === limit
        ? `${status} is full (${limit}-task limit).`
        : `${status} is over its ${limit}-task limit (${count} tasks).`);
      expect(boardReducer(blocked, action)).toBe(blocked);
    }
  });
  it("counts hidden search/filter results, parents and children independently of either ordering mode", () => {
    const limit = COLUMN_CAPACITY["in-progress"];
    const base = populated("in-progress", limit, "todo");
    const board = initialize({ ...base, columns: base.columns.map(column => ({ ...column,
      tasks: column.tasks.map(task => task.id === "occupant-1" ? { ...task, parentId: "occupant-0" } : task),
    })) });
    const visible = filterBoardColumns(board, { searchTerm: "Visible", priorityFilter: "high", categoryFilter: "feature", statusFilter: "in-progress" });
    expect(visible.flatMap(column => column.tasks)).toHaveLength(2);
    const fullColumn = board.columns.find(column => column.id === "in-progress");
    if (!fullColumn) throw new Error("Missing column");
    for (const mode of ["priority", "manual"] as const) {
      expect(selectOrderedTasks(fullColumn, mode, visible.flatMap(column => column.tasks.map(task => task.id))).tasks).toHaveLength(2);
      expect(getColumnCapacity(board, "in-progress").count).toBe(limit);
      expect(evaluateIncomingCapacity(board, "in-progress", "todo").kind).toBe("blocked");
    }
    expect(boardReducer(board, move("incoming", "in-progress"))).toBe(board);
    const child = fullColumn.tasks.find(task => task.id === "occupant-1");
    if (!child) throw new Error("Missing child");
    expect(getParent(board, child)?.id).toBe("occupant-0");
  });
  it.each(["pointer", "touch", "keyboard", "explicit"] as const)("rejects %s manual arrival without any status/placement mutation", input => {
    const board = initialize(populated("in-progress", COLUMN_CAPACITY["in-progress"], "todo")); freezeDeep(board);
    const action: BoardAction = { type: "MOVE_TASK", taskId: "incoming", newStatus: "in-progress", ordering: { mode: "manual", filtered: true, input, placement: { type: "bottom" } }, updatedAt: new Date("2026-03-01") };
    expect(validateBoardAction(board, action)?.code).toBe("capacity-exceeded");
    expect(boardReducer(board, action)).toBe(board);
  });
  it.each(["in-progress", "in-review"] as const)("permits same-column reorder and content edits at and above %s capacity", status => {
    for (const count of [COLUMN_CAPACITY[status], COLUMN_CAPACITY[status] + 1]) {
      const old = initialize(populated(status, count));
      expect(evaluateIncomingCapacity(old, status, status)).toMatchObject({ kind: "allowed", addsOccupancy: false });
      const next = boardReducer(old, { type: "REORDER_TASK", taskId: "occupant-0", placement: { type: "bottom" }, mode: "manual", filtered: false, updatedAt: fixtureDate });
      expect(next).not.toBe(old);
      expect(getColumnCapacity(next, status).count).toBe(count);
      const edits = { title: "Edited record", description: "Still here", priority: "high" as const, category: "testing" as const, status: "todo" as const };
      const edited = boardReducer(next, { type: "UPDATE_TASK", taskId: "occupant-0", edits, updatedAt: fixtureDate });
      expect(getColumnCapacity(edited, status).count).toBe(count);
      expect(edited.columns.flatMap(column => column.tasks).find(task => task.id === "occupant-0")?.status).toBe(status);
      expect(edited.columns.find(column => column.id === status)?.manualOrder).toBe(next.columns.find(column => column.id === status)?.manualOrder);
    }
  });
  it.each(["in-progress", "in-review"] as const)("allows eligible exits from full/over %s and frees slots immediately", status => {
    const destination = status === "in-progress" ? "in-review" : "done";
    for (const count of [COLUMN_CAPACITY[status], COLUMN_CAPACITY[status] + 1]) {
      const old = initialize(populated(status, count));
      const next = boardReducer(old, move("occupant-0", destination));
      expect(next).not.toBe(old);
      expect(getColumnCapacity(next, status).count).toBe(count - 1);
      expect(next.columns.find(column => column.id === destination)?.manualOrder?.[0]).toBe("occupant-0");
    }
  });
  it("still checks a full destination when the source is over limit", () => {
    const old = makeBoard([...populated("in-progress", COLUMN_CAPACITY["in-progress"] + 1).columns.flatMap(column => column.tasks), ...populated("in-review", COLUMN_CAPACITY["in-review"]).columns.flatMap(column => column.tasks).map(task => ({ ...task, id: `review-${task.id}` }))]);
    expect(validateBoardAction(old, move("occupant-0", "in-review"))?.code).toBe("capacity-exceeded");
    expect(boardReducer(old, move("occupant-0", "in-review"))).toBe(old);
  });
  it("keeps error precedence deterministic: identity, relationship, workflow/placement, then capacity", () => {
    const old = initialize(populated("in-progress", COLUMN_CAPACITY["in-progress"], "todo"));
    expect(validateBoardAction(old, move("missing", "in-progress"))?.code).toBe("missing-task");
    const reviewFull = populated("in-review", COLUMN_CAPACITY["in-review"], "todo");
    expect(validateBoardAction(reviewFull, move("incoming", "in-review"))?.code).toBe("invalid-transition");
    const badPlacement: BoardAction = { ...move("incoming", "in-progress"), type: "MOVE_TASK", taskId: "incoming", newStatus: "in-progress", ordering: { mode: "manual", filtered: false, input: "pointer", placement: { type: "before", taskId: "gone" } } };
    expect(validateBoardAction(old, badPlacement)?.code).toBe("invalid-placement");
    const orphan = { ...old, columns: old.columns.map(column => ({ ...column, tasks: column.tasks.map(task => task.id === "incoming" ? { ...task, parentId: "gone" } : task) })) };
    expect(validateBoardAction(orphan, move("incoming", "in-progress"))?.code).toBe("missing-parent");
    expect(validateBoardAction(old, move("incoming", "in-progress"))?.code).toBe("capacity-exceeded");
  });
  it("deletes only a parent and keeps detached children counted in their original columns", () => {
    const old = initialize(makeBoard([makeTask({ id: "parent", status: "in-progress" }), makeTask({ id: "child", parentId: "parent", status: "in-progress" })]));
    const next = boardReducer(old, { type: "DELETE_PARENT_TASK", taskId: "parent", updatedAt: fixtureDate });
    expect(getColumnCapacity(next, "in-progress").count).toBe(1);
    expect(next.columns.flatMap(column => column.tasks)).toMatchObject([{ id: "child", parentId: undefined, status: "in-progress" }]);
  });
});
