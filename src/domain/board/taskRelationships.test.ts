import { describe, expect, it } from "vitest";
import { fixtureDate, freezeDeep, makeBoard, makeTask } from "../../test/fixtures";
import { boardReducer, type BoardAction } from "./boardReducer";
import { validateBoardAction, validateParentAssignment } from "./boardValidation";
import { findTask, getChildren, getChildProgress, getParent } from "./taskRelationships";
import { createDefaultBoardFilters, filterBoardColumns } from "./boardFilters";

const updatedAt = new Date("2026-03-01T00:00:00.000Z");
const parent = makeTask({ id: "parent", title: "Parent", status: "in-review" });
const child = makeTask({ id: "child", title: "Child", parentId: parent.id });
const secondParent = makeTask({ id: "second-parent", title: "Other parent" });
const allTasks = (board: ReturnType<typeof makeBoard>) => board.columns.flatMap((column) => column.tasks);

describe("one-level relationships", () => {
  it("resolves parent and children across columns and derives progress", () => {
    const completed = makeTask({ id: "completed", status: "done", parentId: parent.id });
    const board = makeBoard([parent, child, completed, secondParent]);
    expect(getParent(board, child)).toBe(parent);
    expect(getParent(board, parent)).toBeNull();
    expect(getChildren(board, parent.id)).toEqual([child, completed]);
    expect(getChildProgress(board, parent.id)).toEqual({ total: 2, completed: 1 });
    expect(getChildProgress(board, secondParent.id)).toEqual({ total: 0, completed: 0 });
  });

  it("accepts an eligible existing parent", () => {
    expect(validateParentAssignment(makeBoard([parent]), makeTask(), parent.id)).toBeNull();
  });

  it("rejects self-parenting", () => {
    expect(validateParentAssignment(makeBoard([parent]), parent, parent.id)?.code).toBe("self-parent");
  });

  it("rejects a cycle", () => {
    expect(validateParentAssignment(makeBoard([parent, child]), parent, child.id)?.code).toBe("cycle");
  });

  it("rejects assigning a new child to a child", () => {
    expect(validateParentAssignment(makeBoard([parent, child]), makeTask(), child.id)?.code).toBe("hierarchy-depth");
  });

  it("rejects turning a parent into a child", () => {
    expect(validateParentAssignment(makeBoard([parent, child, secondParent]), parent, secondParent.id)?.code).toBe("hierarchy-depth");
  });

  it("rejects missing and ambiguous parent IDs", () => {
    expect(validateParentAssignment(makeBoard(), child, "missing")?.code).toBe("missing-parent");
    const board = makeBoard([parent, { ...parent }]);
    expect(findTask(board, parent.id)).toBeNull();
    expect(validateParentAssignment(board, child, parent.id)?.code).toBe("missing-parent");
  });

  it("rejects an already corrupt ancestor cycle without recursing forever", () => {
    const board = makeBoard([
      makeTask({ id: "a", parentId: "b" }), makeTask({ id: "b", parentId: "a" }),
    ]);
    expect(validateParentAssignment(board, child, "a")?.code).toBe("cycle");
  });
});

describe("atomic relationship actions", () => {
  it("creates a real child in todo with supplied identity and metadata", () => {
    const board = makeBoard([parent]);
    const newChild = makeTask({ id: "new-child" });
    freezeDeep(board);
    const result = boardReducer(board, { type: "CREATE_CHILD_TASK", parentId: parent.id, task: newChild, updatedAt });
    expect(allTasks(result)).toHaveLength(2);
    expect(findTask(result, newChild.id)).toEqual({ ...newChild, parentId: parent.id });
    expect(findTask(result, newChild.id)?.createdAt).toBe(fixtureDate);
    expect(result.lastUpdated).toBe(updatedAt);
    expect(allTasks(board)).toEqual([parent]);
  });

  it.each(["missing", "child", "new-child"])("invalid creation under %s leaves every task unchanged", (parentId) => {
    const board = makeBoard([parent, child]);
    const action: BoardAction = { type: "CREATE_CHILD_TASK", parentId, task: makeTask({ id: "new-child" }), updatedAt };
    expect(validateBoardAction(board, action)).not.toBeNull();
    expect(boardReducer(board, action)).toBe(board);
    expect(allTasks(board)).toHaveLength(2);
  });

  it("rejects duplicate child IDs, non-todo children, and ordinary creation with a relationship", () => {
    const board = makeBoard([parent, child]);
    for (const task of [makeTask({ id: child.id }), makeTask({ status: "done" })]) {
      expect(boardReducer(board, { type: "CREATE_CHILD_TASK", parentId: parent.id, task, updatedAt })).toBe(board);
    }
    expect(boardReducer(board, { type: "CREATE_TASK", task: makeTask({ parentId: parent.id }), updatedAt })).toBe(board);
  });

  it("attaches, reassigns, and detaches without changing other task fields or counts", () => {
    const independent = makeTask({ id: "independent" });
    let board = makeBoard([parent, secondParent, independent]);
    for (const parentId of [parent.id, secondParent.id, null]) {
      board = boardReducer(board, { type: "SET_PARENT", taskId: independent.id, parentId, updatedAt });
      expect(allTasks(board)).toHaveLength(3);
      expect(findTask(board, independent.id)).toEqual({ ...independent, parentId: parentId ?? undefined });
    }
    expect(getChildren(board, parent.id)).toEqual([]);
    expect(getChildren(board, secondParent.id)).toEqual([]);
  });

  it.each(["parent", "child", "missing"])("rejected reassignment to %s preserves state", (parentId) => {
    const board = makeBoard([parent, child]);
    expect(boardReducer(board, { type: "SET_PARENT", taskId: child.id, parentId, updatedAt })).toBe(board);
  });

  it("ordinary and stale edits preserve the reducer's current relationship", () => {
    const stale = { ...child, parentId: "untrusted", status: "done", title: "Edited child" };
    let board = makeBoard([parent, child, secondParent]);
    board = boardReducer(board, { type: "SET_PARENT", taskId: child.id, parentId: secondParent.id, updatedAt });
    board = boardReducer(board, { type: "UPDATE_TASK", taskId: child.id, edits: stale, updatedAt });
    expect(findTask(board, child.id)).toEqual({ ...child, title: stale.title, parentId: secondParent.id });
    const parentEdits = { ...parent, title: "Edited parent", parentId: secondParent.id };
    board = boardReducer(board, { type: "UPDATE_TASK", taskId: parent.id, edits: parentEdits, updatedAt });
    expect(findTask(board, parent.id)?.parentId).toBeUndefined();
  });

  it("deletes only a child and recalculates parent progress", () => {
    const otherChild = makeTask({ id: "other-child", parentId: parent.id, status: "done" });
    const board = makeBoard([parent, child, otherChild]);
    const result = boardReducer(board, { type: "DELETE_TASK", taskId: child.id, updatedAt });
    expect(allTasks(result)).toHaveLength(2);
    expect(findTask(result, parent.id)).toBe(parent);
    expect(findTask(result, otherChild.id)).toBe(otherChild);
    expect(getChildProgress(result, parent.id)).toEqual({ total: 1, completed: 1 });
  });

  it("blocks ordinary parent deletion and atomically detaches children on explicit deletion", () => {
    const otherChild = makeTask({ id: "other-child", parentId: parent.id, status: "done" });
    const board = makeBoard([parent, child, otherChild, secondParent]);
    freezeDeep(board);
    expect(boardReducer(board, { type: "DELETE_TASK", taskId: parent.id, updatedAt })).toBe(board);
    const result = boardReducer(board, { type: "DELETE_PARENT_TASK", taskId: parent.id, updatedAt });
    expect(findTask(result, parent.id)).toBeNull();
    expect(allTasks(result)).toHaveLength(3);
    expect(findTask(result, child.id)).toEqual({ ...child, parentId: undefined });
    expect(findTask(result, otherChild.id)).toEqual({ ...otherChild, parentId: undefined });
    expect(findTask(result, secondParent.id)).toBe(secondParent);
  });

  it("rejects missing task relationship/deletion actions and parent deletion of an ordinary task", () => {
    const board = makeBoard([parent]);
    const actions: BoardAction[] = [
      { type: "SET_PARENT", taskId: "missing", parentId: parent.id, updatedAt },
      { type: "DELETE_PARENT_TASK", taskId: "missing", updatedAt },
      { type: "DELETE_PARENT_TASK", taskId: parent.id, updatedAt },
    ];
    for (const action of actions) expect(boardReducer(board, action)).toBe(board);
  });

  it("replays each new action deterministically without mutating input", () => {
    const board = makeBoard([parent, child, secondParent]);
    freezeDeep(board);
    const actions: BoardAction[] = [
      { type: "CREATE_CHILD_TASK", parentId: parent.id, task: makeTask({ id: "supplied-child" }), updatedAt },
      { type: "SET_PARENT", taskId: child.id, parentId: secondParent.id, updatedAt },
      { type: "SET_PARENT", taskId: child.id, parentId: null, updatedAt },
      { type: "DELETE_PARENT_TASK", taskId: parent.id, updatedAt },
    ];
    for (const action of actions) {
      freezeDeep(action);
      const result = boardReducer(board, action);
      expect(result).toEqual(boardReducer(board, action));
      expect(result.lastUpdated).toBe(updatedAt);
    }
    expect(getChildren(board, parent.id)).toEqual([child]);
  });
});

describe("completion and filtering", () => {
  it("blocks completion with unfinished children and names the blocking work", () => {
    const board = makeBoard([parent, child]);
    const action: BoardAction = { type: "MOVE_TASK", taskId: parent.id, newStatus: "done", updatedAt };
    expect(validateBoardAction(board, action)).toEqual({ code: "incomplete-children", message: 'Finish these subtasks before completing "Parent": Child.' });
    expect(boardReducer(board, action)).toBe(board);
  });

  it("moves children independently, then allows the parent to complete", () => {
    let board = makeBoard([parent, child]);
    for (const newStatus of ["in-progress", "in-review", "done"] as const) {
      board = boardReducer(board, { type: "MOVE_TASK", taskId: child.id, newStatus, updatedAt });
      expect(findTask(board, child.id)?.status).toBe(newStatus);
      expect(findTask(board, parent.id)?.status).toBe("in-review");
      expect(allTasks(board)).toHaveLength(2);
    }
    board = boardReducer(board, { type: "MOVE_TASK", taskId: parent.id, newStatus: "done", updatedAt });
    expect(findTask(board, parent.id)?.status).toBe("done");
  });

  it("rejects reopening the parent or child under the existing forward-only workflow", () => {
    const board = makeBoard([{ ...parent, status: "done" }, { ...child, status: "done" }]);
    for (const taskId of [parent.id, child.id]) {
      for (const newStatus of ["todo", "in-progress", "in-review"] as const) {
        expect(boardReducer(board, { type: "MOVE_TASK", taskId, newStatus, updatedAt })).toBe(board);
      }
    }
  });

  it("completed parents reject new or unfinished children but accept completed children", () => {
    const completedParent = { ...parent, status: "done" } as const;
    const board = makeBoard([completedParent, secondParent, child]);
    expect(boardReducer(board, { type: "CREATE_CHILD_TASK", parentId: parent.id, task: makeTask(), updatedAt })).toBe(board);
    // Detach first so the attempted reassignment is a change, not a duplicate link.
    const detached = boardReducer(board, { type: "SET_PARENT", taskId: child.id, parentId: null, updatedAt });
    expect(boardReducer(detached, { type: "SET_PARENT", taskId: child.id, parentId: parent.id, updatedAt })).toBe(detached);
    const finished = makeBoard([completedParent, { ...child, parentId: secondParent.id, status: "done" }, secondParent]);
    expect(findTask(boardReducer(finished, { type: "SET_PARENT", taskId: child.id, parentId: parent.id, updatedAt }), child.id)?.parentId).toBe(parent.id);
  });

  it("editing a completed child preserves its status and parent", () => {
    const board = makeBoard([{ ...parent, status: "done" }, { ...child, status: "done" }]);
    const result = boardReducer(board, { type: "UPDATE_TASK", taskId: child.id, edits: { ...child, title: "Changed title" }, updatedAt });
    expect(findTask(result, child.id)).toMatchObject({ title: "Changed title", status: "done", parentId: parent.id });
  });

  it("invalid child transitions retain all tasks", () => {
    const board = makeBoard([parent, child]);
    expect(boardReducer(board, { type: "MOVE_TASK", taskId: child.id, newStatus: "done", updatedAt })).toBe(board);
  });

  it("filters tasks independently while keeping full-board relationship and completion rules", () => {
    const board = makeBoard([parent, child]);
    freezeDeep(board);
    const visible = filterBoardColumns(board, { ...createDefaultBoardFilters(), searchTerm: "Child" });
    expect(visible.flatMap((column) => column.tasks)).toEqual([child]);
    expect(getParent(board, child)).toBe(parent);
    expect(getChildren(board, parent.id)).toEqual([child]);
    expect(boardReducer(board, { type: "MOVE_TASK", taskId: parent.id, newStatus: "done", updatedAt })).toBe(board);
  });

  it("preserves legacy checklists on ordinary edits and linked-child creation", () => {
    const legacy = { ...parent, subtasks: [{ id: "legacy", title: "Existing work", completed: false }] };
    let board = makeBoard([legacy]);
    board = boardReducer(board, { type: "CREATE_CHILD_TASK", parentId: parent.id, task: makeTask(), updatedAt });
    board = boardReducer(board, { type: "UPDATE_TASK", taskId: parent.id, edits: { ...parent, title: "Edited parent" }, updatedAt });
    expect(findTask(board, parent.id)?.subtasks).toEqual(legacy.subtasks);
    expect(allTasks(board)).toHaveLength(2);
  });
});
