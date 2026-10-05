import type { Board } from "./Board";
import type { BoardAction } from "./boardReducer";
import type { Task } from "../task/Task";
import { canMoveTask, getMoveErrorMessage } from "../task/taskRules";
import { findTask, getChildren } from "./taskRelationships";

export type BoardErrorCode =
  | "missing-task" | "duplicate-id" | "invalid-creation" | "missing-column"
  | "self-parent" | "cycle" | "hierarchy-depth" | "missing-parent"
  | "completed-parent" | "unchanged-relationship" | "incomplete-children"
  | "parent-delete-confirmation" | "not-parent" | "invalid-transition"
  | "missing-subtask";

export interface BoardOperationError {
  code: BoardErrorCode;
  message: string;
}

function error(code: BoardErrorCode, message: string): BoardOperationError {
  return { code, message };
}

/** Check an intended link using the complete board, never filtered columns. */
export function validateParentAssignment(
  board: Board,
  child: Task,
  parentId: string,
): BoardOperationError | null {
  if (child.id === parentId) return error("self-parent", "A task cannot be its own parent.");
  const parent = findTask(board, parentId);
  if (!parent) return error("missing-parent", "The selected parent no longer exists or has an ambiguous ID.");

  // Walk IDs only to detect corrupt/circular inputs; never build a recursive tree.
  const visited = new Set([child.id]);
  let ancestor: Task | null = parent;
  while (ancestor) {
    if (visited.has(ancestor.id)) return error("cycle", "This relationship would create a cycle.");
    visited.add(ancestor.id);
    ancestor = ancestor.parentId === undefined ? null : findTask(board, ancestor.parentId);
  }
  if (parent.parentId !== undefined || getChildren(board, child.id).length > 0) {
    return error("hierarchy-depth", "Only one parent/subtask level is supported. A subtask cannot also be a parent.");
  }
  if (parent.status === "done" && child.status !== "done") {
    return error("completed-parent", `"${parent.title}" is complete. An unfinished subtask cannot be linked to it.`);
  }
  return null;
}

/** The UI uses these typed errors; the reducer repeats validation before mutation. */
export function validateBoardAction(board: Board, action: BoardAction): BoardOperationError | null {
  if (action.type === "CREATE_TASK" || action.type === "CREATE_CHILD_TASK") {
    if (board.columns.some((column) => column.tasks.some((task) => task.id === action.task.id))) {
      return error("duplicate-id", "A task with that ID already exists.");
    }
    if (action.task.status !== "todo" || action.task.parentId !== undefined) {
      return error("invalid-creation", "New tasks must start in To Do; relationships use a subtask creation action.");
    }
    if (!board.columns.some((column) => column.id === "todo")) {
      return error("missing-column", "The To Do column is unavailable.");
    }
    return action.type === "CREATE_CHILD_TASK"
      ? validateParentAssignment(board, action.task, action.parentId)
      : null;
  }

  const task = findTask(board, action.taskId);
  if (!task) return error("missing-task", "The task no longer exists or has an ambiguous ID.");

  if (action.type === "SET_PARENT") {
    if ((task.parentId ?? null) === action.parentId) {
      return error("unchanged-relationship", "This task already has that relationship.");
    }
    return action.parentId === null ? null : validateParentAssignment(board, task, action.parentId);
  }

  if (task.parentId !== undefined) {
    const relationshipError = validateParentAssignment(board, task, task.parentId);
    if (relationshipError) return relationshipError;
  }

  switch (action.type) {
    case "MOVE_TASK": {
      if (!board.columns.some((column) => column.id === task.status && column.tasks.includes(task))) {
        return error("invalid-transition", "The task status does not match its source column.");
      }
      if (!board.columns.some((column) => column.id === action.newStatus)) {
        return error("missing-column", "The destination column is unavailable.");
      }
      if (!canMoveTask(task.status, action.newStatus)) {
        return error("invalid-transition", getMoveErrorMessage(task.status, action.newStatus));
      }
      const incomplete = getChildren(board, task.id).filter((child) => child.status !== "done");
      if (action.newStatus === "done" && incomplete.length > 0) {
        return error("incomplete-children", `Finish these subtasks before completing "${task.title}": ${incomplete.map((child) => child.title).join(", ")}.`);
      }
      if (task.parentId !== undefined && action.newStatus !== "done" && findTask(board, task.parentId)?.status === "done") {
        return error("completed-parent", "An unfinished subtask cannot belong to a completed parent.");
      }
      return null;
    }
    case "DELETE_TASK":
      return getChildren(board, task.id).length > 0
        ? error("parent-delete-confirmation", "Confirm parent deletion and explicitly detach its subtasks first.")
        : null;
    case "DELETE_PARENT_TASK":
      return getChildren(board, task.id).length === 0
        ? error("not-parent", "This task has no linked subtasks. Use ordinary task deletion.")
        : null;
    case "ADD_SUBTASK":
      return board.columns.some((column) => column.tasks.some((item) =>
        (item.subtasks ?? []).some((subtask) => subtask.id === action.subtask.id),
      )) ? error("duplicate-id", "A checklist item with that ID already exists.") : null;
    case "TOGGLE_SUBTASK":
    case "DELETE_SUBTASK":
      return (task.subtasks ?? []).some((subtask) => subtask.id === action.subtaskId)
        ? null : error("missing-subtask", "The checklist item no longer exists.");
    case "UPDATE_TASK":
      return null;
  }
}
