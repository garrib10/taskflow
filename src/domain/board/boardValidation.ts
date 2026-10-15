import type { Board } from "./Board";
import type { BoardAction } from "./boardReducer";
import type { Task } from "../task/Task";
import { canMoveTask, getMoveErrorMessage } from "../task/taskRules";
import { validateOrderingAction, validateManualColumns, destinationPlacement, validatePlacement } from "./boardOrdering";
import { evaluateIncomingCapacity, type LimitedColumnCapacity } from "./boardCapacity";
import { findTask, getChildren } from "./taskRelationships";
import { validateTaskContent, type TaskContentError } from "../task/taskContent";

export type BoardErrorCode =
  | "missing-task" | "duplicate-id" | "invalid-creation" | "missing-column"
  | "self-parent" | "cycle" | "hierarchy-depth" | "missing-parent"
  | "completed-parent" | "unchanged-relationship" | "incomplete-children"
  | "parent-delete-confirmation" | "not-parent" | "invalid-transition"
  | "missing-subtask" | "invalid-manual-order" | "manual-order-uninitialized"
  | "priority-ordering" | "filtered-reorder" | "invalid-placement" | "capacity-exceeded" | "invalid-task-content";

export type BoardOperationError =
  | { code: Exclude<BoardErrorCode, "capacity-exceeded" | "invalid-task-content">; message: string }
  | ({ code: "invalid-task-content" } & TaskContentError)
  | { code: "capacity-exceeded"; message: string; taskId: Task["id"]; capacity: LimitedColumnCapacity };

function error(code: Exclude<BoardErrorCode, "capacity-exceeded" | "invalid-task-content">, message: string): BoardOperationError {
  return { code, message };
}

/** Current persistence requires task and legacy checklist identities to be disjoint. */
function boardIdentities(board: Board): Set<string> {
  return new Set(board.columns.flatMap(column => column.tasks.flatMap(task =>
    [task.id, ...(task.subtasks ?? []).map(entry => entry.id)],
  )));
}

/** Capacity is last: invalid workflow, links or placement never masquerade as a full column. */
function incomingCapacityError(board: Board, task: Task, destination: Task["status"], source?: Task["status"]): BoardOperationError | null {
  const decision = evaluateIncomingCapacity(board, destination, source);
  if (decision.kind === "allowed") return null;
  const title = board.columns.find(column => column.id === destination)?.title ?? destination;
  const summary = decision.capacity.state === "over"
    ? `${title} is over its ${decision.capacity.limit}-task limit (${decision.capacity.count} tasks).`
    : `${title} is full (${decision.capacity.limit}-task limit).`;
  return { code: "capacity-exceeded", taskId: task.id, capacity: decision.capacity,
    message: `${summary} "${task.title}" wasn't moved. Move or delete a task from this column, then try again. Tasks hidden by search or filters still count toward the limit.` };
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
  if (action.type === "INITIALIZE_MANUAL_ORDER" || action.type === "REPAIR_MANUAL_ORDER") return validateOrderingAction(board, action);
  if (action.type === "REORDER_TASK") {
    const orderingError = validateOrderingAction(board, action);
    if (orderingError) return orderingError;
  }
  if (action.type === "CREATE_TASK" || action.type === "CREATE_CHILD_TASK") {
    const existingIds = boardIdentities(board);
    const incomingIds = [action.task.id, ...(action.task.subtasks ?? []).map(entry => entry.id)];
    if (new Set(incomingIds).size !== incomingIds.length || incomingIds.some(id => existingIds.has(id))) {
      return error("duplicate-id", "A task or checklist item with that ID already exists.");
    }
    if (action.task.status !== "todo" || action.task.parentId !== undefined) {
      return error("invalid-creation", "New tasks must start in To Do; relationships use a subtask creation action.");
    }
    if (!board.columns.some((column) => column.id === "todo")) {
      return error("missing-column", "The To Do column is unavailable.");
    }
    const orderingError = validateManualColumns(board.columns.filter(column => column.id === "todo"));
    if (orderingError) return orderingError;
    const relationshipError = action.type === "CREATE_CHILD_TASK" ? validateParentAssignment(board, action.task, action.parentId) : null;
    if (relationshipError) return relationshipError;
    const contentError = validateTaskContent(action.task);
    if (contentError) return { code: "invalid-task-content", ...contentError };
    return incomingCapacityError(board, action.task, "todo");
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

  if (action.type === "DELETE_TASK" || action.type === "DELETE_PARENT_TASK") {
    const orderingError = validateManualColumns(board.columns.filter(column => column.tasks.includes(task)));
    if (orderingError) return orderingError;
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
      const affected = board.columns.filter(column => column.id === task.status || column.id === action.newStatus);
      const orderingError = validateManualColumns(action.ordering?.mode === "manual" ? board.columns : affected, action.ordering?.mode === "manual");
      if (orderingError) return orderingError;
      const destination = board.columns.find(column => column.id === action.newStatus);
      const placementError = destination ? validatePlacement(destination, task.id, destinationPlacement(action.ordering)) : null;
      if (placementError) return placementError;
      return incomingCapacityError(board, task, action.newStatus, task.status);
    }
    case "REORDER_TASK": return null;
    case "DELETE_TASK":
      return getChildren(board, task.id).length > 0
        ? error("parent-delete-confirmation", "Confirm parent deletion and explicitly detach its subtasks first.")
        : null;
    case "DELETE_PARENT_TASK":
      return getChildren(board, task.id).length === 0
        ? error("not-parent", "This task has no linked subtasks. Use ordinary task deletion.")
        : null;
    case "ADD_SUBTASK":
      return boardIdentities(board).has(action.subtask.id)
        ? error("duplicate-id", "A task or checklist item with that ID already exists.") : null;
    case "TOGGLE_SUBTASK":
    case "DELETE_SUBTASK":
      return (task.subtasks ?? []).some((subtask) => subtask.id === action.subtaskId)
        ? null : error("missing-subtask", "The checklist item no longer exists.");
    case "UPDATE_TASK": {
      const contentError = validateTaskContent(action.edits);
      return contentError ? { code: "invalid-task-content", ...contentError } : null;
    }
  }
}
