import { describe, expect, it } from "vitest";
import { fixtureDate, freezeDeep, makeBoard, makeTask } from "../../test/fixtures";
import type { Board } from "./Board";
import { boardReducer, type BoardAction } from "./boardReducer";
import { createDefaultBoardFilters, filterBoardColumns } from "./boardFilters";
import { validateBoardAction } from "./boardValidation";

const updatedAt = new Date("2026-02-01T00:00:00.000Z");
const tasks = (board: Board) => board.columns.flatMap((column) => column.tasks);
const checklistItem = { id: "subtask-1", title: "Check behavior", completed: false };
const edits = { title: "Edited", description: "Required description", priority: "high", category: "testing" } as const;

describe("atomic movement", () => {
  it("moves exactly once, conserves count, and preserves supplied data", () => {
    const task = makeTask({ subtasks: [checklistItem] });
    const other = makeTask({ id: "other", status: "in-progress" });
    const board = makeBoard([task, other]);
    freezeDeep(board);
    const result = boardReducer(board, { type: "MOVE_TASK", taskId: task.id, newStatus: "in-progress", updatedAt });
    expect(tasks(result)).toHaveLength(2);
    expect(tasks(result).filter((item) => item.id === task.id)).toHaveLength(1);
    expect(result.columns.find((column) => column.id === "todo")?.tasks).toEqual([]);
    expect(result.columns.find((column) => column.id === "in-progress")?.tasks).toEqual([other, { ...task, status: "in-progress" }]);
    expect(result.lastUpdated).toBe(updatedAt);
    expect(tasks(result).find((item) => item.id === task.id)?.createdAt).toBe(fixtureDate);
    expect(tasks(board)[0]).toBe(task);
  });
  it("missing destination preserves the original task and state", () => {
    const board = makeBoard();
    board.columns = board.columns.filter((column) => column.id !== "in-progress");
    expect(boardReducer(board, { type: "MOVE_TASK", taskId: "task-1", newStatus: "in-progress", updatedAt })).toBe(board);
    expect(tasks(board)).toEqual([makeTask()]);
  });
  it.each(["todo", "in-review", "done"] as const)("rejects todo to %s unchanged", (newStatus) => {
    const board = makeBoard();
    expect(boardReducer(board, { type: "MOVE_TASK", taskId: "task-1", newStatus, updatedAt })).toBe(board);
  });
  it("rejects inconsistent source status", () => {
    const board = makeBoard();
    const task = tasks(board)[0];
    if (!task) throw new Error("Missing fixture");
    task.status = "in-progress";
    expect(boardReducer(board, { type: "MOVE_TASK", taskId: task.id, newStatus: "in-review", updatedAt })).toBe(board);
  });
  it("rejects ambiguous duplicate task IDs without dropping either copy", () => {
    const board = makeBoard([makeTask(), makeTask()]);
    expect(boardReducer(board, { type: "MOVE_TASK", taskId: "task-1", newStatus: "in-progress", updatedAt })).toBe(board);
    expect(tasks(board)).toHaveLength(2);
  });
});

describe("deterministic actions and immutable updates", () => {
  it.each([
    ["title", "   "], ["title", "ab"], ["title", "x".repeat(151)],
    ["description", ""], ["description", "x".repeat(301)],
    ["priority", "urgent"], ["category", "unknown"],
  ])("rejects invalid %s in a multi-field edit before changing any content, relationships or positions", (field, value) => {
    const initial = makeBoard([makeTask({ id: "parent" }), makeTask({ id: "child", parentId: "parent", status: "in-progress", subtasks: [checklistItem] })]);
    const board = boardReducer(initial, { type: "INITIALIZE_MANUAL_ORDER", updatedAt: fixtureDate });
    freezeDeep(board);
    // Runtime command input can evade the compile-time unions.
    const action: BoardAction = { type: "UPDATE_TASK", taskId: "child", edits: JSON.parse(JSON.stringify({ ...edits, [field]: value })), updatedAt };
    expect(validateBoardAction(board, action)).toMatchObject({ code: "invalid-task-content", field });
    expect(boardReducer(board, action)).toBe(board);
  });
  it("rejects invalid linked creation without inserting a record or manual position", () => {
    const board = boardReducer(makeBoard(), { type: "INITIALIZE_MANUAL_ORDER", updatedAt: fixtureDate });
    const action: BoardAction = { type: "CREATE_CHILD_TASK", parentId: "task-1", task: makeTask({ id: "child", title: "" }), updatedAt };
    expect(validateBoardAction(board, action)).toMatchObject({ code: "invalid-task-content", field: "title" });
    expect(boardReducer(board, action)).toBe(board);
    expect(validateBoardAction(board, { ...action, parentId: "missing" })?.code).toBe("missing-parent");
    expect(validateBoardAction(board, { ...action, task: { ...action.task, id: "task-1" } })?.code).toBe("duplicate-id");
    const invalidEdits = { ...edits, title: "", description: "" };
    expect(validateBoardAction(board, { type: "UPDATE_TASK", taskId: "missing", edits: invalidEdits, updatedAt })?.code).toBe("missing-task");
    expect(validateBoardAction(board, { type: "UPDATE_TASK", taskId: "task-1", edits: invalidEdits, updatedAt })).toMatchObject({ code: "invalid-task-content", field: "title" });
  });
  const actions: BoardAction[] = [
    { type: "CREATE_TASK", task: makeTask({ id: "created" }), updatedAt },
    { type: "UPDATE_TASK", taskId: "task-1", edits, updatedAt },
    { type: "DELETE_TASK", taskId: "task-1", updatedAt },
    { type: "MOVE_TASK", taskId: "task-1", newStatus: "in-progress", updatedAt },
    { type: "ADD_SUBTASK", taskId: "task-1", subtask: { ...checklistItem, id: "new-subtask" }, updatedAt },
    { type: "TOGGLE_SUBTASK", taskId: "task-1", subtaskId: checklistItem.id, updatedAt },
    { type: "DELETE_SUBTASK", taskId: "task-1", subtaskId: checklistItem.id, updatedAt },
  ];
  it.each(actions)("replays $type with identical output and supplied timestamp", (action) => {
    const board = makeBoard([makeTask({ subtasks: [checklistItem] })]);
    const before = structuredClone(board);
    freezeDeep(board);
    freezeDeep(action);
    const result = boardReducer(board, action);
    expect(result).toEqual(boardReducer(board, action));
    expect(result.lastUpdated).toBe(updatedAt);
    expect(board).toEqual(before);
    if (action.type === "CREATE_TASK") expect(tasks(result).find((task) => task.id === "created")).toBe(action.task);
    if (action.type === "ADD_SUBTASK") expect(tasks(result)[0]?.subtasks.at(-1)).toBe(action.subtask);
    if (action.type === "TOGGLE_SUBTASK") expect(tasks(result)[0]?.subtasks[0]?.completed).toBe(true);
    if (action.type === "DELETE_SUBTASK") expect(tasks(result)[0]?.subtasks).toEqual([]);
    if (action.type === "DELETE_TASK") expect(tasks(result)).toEqual([]);
  });
  it.each(actions.filter((action) => action.type !== "CREATE_TASK"))(
    "missing source for $type returns original state", (action) => {
      const board = makeBoard([]);
      expect(boardReducer(board, action)).toBe(board);
    },
  );
  it("rejects duplicate task and checklist IDs", () => {
    const board = makeBoard([makeTask({ subtasks: [checklistItem] })]);
    expect(boardReducer(board, { type: "CREATE_TASK", task: makeTask(), updatedAt })).toBe(board);
    expect(boardReducer(board, { type: "ADD_SUBTASK", taskId: "task-1", subtask: checklistItem, updatedAt })).toBe(board);
    expect(boardReducer(board, { type: "CREATE_TASK", task: makeTask({ id: checklistItem.id }), updatedAt })).toBe(board);
    expect(boardReducer(board, { type: "ADD_SUBTASK", taskId: "task-1", subtask: { ...checklistItem, id: "task-1" }, updatedAt })).toBe(board);
    expect(boardReducer(board, { type: "CREATE_TASK", task: makeTask({ id: "new", subtasks: [checklistItem] }), updatedAt })).toBe(board);
    expect(boardReducer(board, { type: "CREATE_CHILD_TASK", parentId: "task-1", task: makeTask({ id: "new", subtasks: [checklistItem] }), updatedAt })).toBe(board);
    expect(boardReducer(board, { type: "CREATE_TASK", task: makeTask({ id: "new", subtasks: [{ ...checklistItem, id: "new" }] }), updatedAt })).toBe(board);
    expect(boardReducer(board, { type: "CREATE_TASK", task: makeTask({ id: "new", subtasks: [{ ...checklistItem, id: "new-entry" }, { ...checklistItem, id: "new-entry" }] }), updatedAt })).toBe(board);
  });
  it("requires a todo destination and status for creation", () => {
    const board = makeBoard([]);
    expect(boardReducer(board, { type: "CREATE_TASK", task: makeTask({ status: "done" }), updatedAt })).toBe(board);
    board.columns = board.columns.filter((column) => column.id !== "todo");
    expect(boardReducer(board, { type: "CREATE_TASK", task: makeTask(), updatedAt })).toBe(board);
  });
  it.each(["TOGGLE_SUBTASK", "DELETE_SUBTASK"] as const)("missing checklist item for %s returns original state", (type) => {
    const board = makeBoard();
    expect(boardReducer(board, { type, taskId: "task-1", subtaskId: "missing", updatedAt })).toBe(board);
  });
  it("stale edits preserve newer checklist changes and reducer-owned fields", () => {
    const staleTask = makeTask();
    let board = makeBoard([staleTask]);
    board = boardReducer(board, { type: "ADD_SUBTASK", taskId: staleTask.id, subtask: checklistItem, updatedAt });
    board = boardReducer(board, { type: "TOGGLE_SUBTASK", taskId: staleTask.id, subtaskId: checklistItem.id, updatedAt });
    board = boardReducer(board, { type: "MOVE_TASK", taskId: staleTask.id, newStatus: "in-progress", updatedAt });
    // Extra keys on a variable pass structural typing; the merge must ignore them.
    const staleEdits = { ...staleTask, ...edits, id: "untrusted", createdAt: updatedAt };
    const result = boardReducer(board, { type: "UPDATE_TASK", taskId: staleTask.id, edits: staleEdits, updatedAt });
    expect(tasks(result)).toEqual([{
      ...staleTask, ...edits, status: "in-progress", subtasks: [{ ...checklistItem, completed: true }],
    }]);
    expect(tasks(result)[0]?.createdAt).toBe(fixtureDate);
  });
  it("uses the full board when filters hide a task", () => {
    const board = makeBoard([makeTask({ status: "in-review" })]);
    expect(filterBoardColumns(board, { ...createDefaultBoardFilters(), statusFilter: "todo" }).flatMap((column) => column.tasks)).toEqual([]);
    const result = boardReducer(board, { type: "MOVE_TASK", taskId: "task-1", newStatus: "done", updatedAt });
    expect(tasks(result)[0]?.status).toBe("done");
    expect(tasks(result)).toHaveLength(1);
  });
});
