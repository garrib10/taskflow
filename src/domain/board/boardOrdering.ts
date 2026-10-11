import type { Board, Column } from "./Board";
import { taskStatuses, type Task, type TaskStatus } from "../task/Task";
import { sortTasksByPriority } from "../task/taskPriority";
import type { BoardOperationError } from "./boardValidation";

/** A selector/operation policy, never a field on a task or board. */
export type OrderingMode = "priority" | "manual";
export type TaskPlacement = { type: "top" } | { type: "bottom" } | { type: "before"; taskId: Task["id"] } | { type: "after"; taskId: Task["id"] };
export interface MovementOrdering {
  mode: OrderingMode;
  filtered: boolean;
  input: "pointer" | "touch" | "keyboard" | "explicit";
  placement?: TaskPlacement;
}
export type OrderingAction =
  | { type: "INITIALIZE_MANUAL_ORDER" }
  | { type: "REPAIR_MANUAL_ORDER"; status: TaskStatus }
  | { type: "REORDER_TASK"; taskId: Task["id"]; placement: TaskPlacement; mode: OrderingMode; filtered: boolean };

function failure(code: Exclude<BoardOperationError["code"], "capacity-exceeded" | "invalid-task-content">, message: string): BoardOperationError { return { code, message }; }

/** Absence is expected legacy/uninitialized data, not a corrupt saved order. */
export function manualOrderState(column: Column): "uninitialized" | "valid" | "invalid" {
  const ids = column.tasks.map(task => task.id);
  if (new Set(ids).size !== ids.length) return "invalid";
  if (column.manualOrder === undefined) return "uninitialized";
  return column.manualOrder.length === ids.length && new Set(column.manualOrder).size === ids.length &&
    column.manualOrder.every(id => ids.includes(id)) ? "valid" : "invalid";
}

export type OrderedTasksResult =
  | { kind: "ordered"; tasks: Task[] }
  | { kind: "unavailable"; reason: "invalid-manual-order"; tasks: Task[] };

/** Arrival order lives in tasks; manual IDs never break equal-priority ties. */
export function selectOrderedTasks(column: Column, mode: OrderingMode = "priority", visibleTaskIds?: readonly Task["id"][]): OrderedTasksResult {
  const visible = visibleTaskIds === undefined ? null : new Set(visibleTaskIds);
  const project = (tasks: Task[]) => visible ? tasks.filter(task => visible.has(task.id)) : tasks;
  const priority = sortTasksByPriority(column.tasks);
  if (mode === "priority" || manualOrderState(column) === "uninitialized") return { kind: "ordered", tasks: project(priority) };
  if (manualOrderState(column) === "invalid") return { kind: "unavailable", reason: "invalid-manual-order", tasks: project(priority) };
  const tasks = new Map(column.tasks.map(task => [task.id, task]));
  // Membership was checked above; no missing task is fabricated or dropped.
  return { kind: "ordered", tasks: project((column.manualOrder ?? []).flatMap(id => {
    const task = tasks.get(id); return task ? [task] : [];
  })) };
}

/** Explicit initialization/repair only: rebuild invalid order from full priority display.
 * Ordinary reads, filters and movement never silently normalize damaged positions.
 */
export function normalizeManualOrder(column: Column): Column {
  if (manualOrderState(column) === "valid" || new Set(column.tasks.map(task => task.id)).size !== column.tasks.length) return column;
  return { ...column, manualOrder: sortTasksByPriority(column.tasks).map(task => task.id) };
}

export function validatePlacement(column: Column, taskId: string, placement: TaskPlacement): BoardOperationError | null {
  if (placement.type === "top" || placement.type === "bottom") return null;
  if (placement.taskId === taskId || column.tasks.filter(task => task.id === placement.taskId).length !== 1) {
    return failure("invalid-placement", "The ordering target is missing, ambiguous or the task itself.");
  }
  return null;
}

/** Called only after order/membership/placement validation. Removes old occurrence once. */
export function placeTask(order: readonly string[], taskId: string, placement: TaskPlacement): string[] {
  const remaining = order.filter(id => id !== taskId);
  if (placement.type === "top") return [taskId, ...remaining];
  if (placement.type === "bottom") return [...remaining, taskId];
  const index = remaining.indexOf(placement.taskId) + Number(placement.type === "after");
  return [...remaining.slice(0, index), taskId, ...remaining.slice(index)];
}

export function destinationPlacement(ordering?: MovementOrdering): TaskPlacement {
  return ordering?.mode === "manual" && !ordering.filtered &&
    (ordering.input === "pointer" || ordering.input === "touch") ? ordering.placement ?? { type: "top" } : { type: "top" };
}

export function validateManualColumns(columns: readonly Column[], requireInitialized = false): BoardOperationError | null {
  for (const column of columns) {
    const state = manualOrderState(column);
    if (state === "invalid") return failure("invalid-manual-order", "Manual order is invalid. Explicit repair is required before changing positions.");
    if (requireInitialized && state === "uninitialized") return failure("manual-order-uninitialized", "Initialize the complete board's manual order before using Manual mode.");
  }
  return null;
}

export function validateOrderingAction(board: Board, action: OrderingAction): BoardOperationError | null {
  if (new Set(board.columns.map(column => column.id)).size !== board.columns.length || taskStatuses.some(status => !board.columns.some(column => column.id === status))) {
    return failure("missing-column", "Workflow columns must exist exactly once before changing order.");
  }
  if (board.columns.some(column => column.tasks.some(task => task.status !== column.id))) {
    return failure("invalid-transition", "Task status must match its source column before changing order.");
  }
  const ids = board.columns.flatMap(column => column.tasks.map(task => task.id));
  if (new Set(ids).size !== ids.length) return failure("duplicate-id", "Task IDs must be unambiguous before changing order.");
  if (action.type === "INITIALIZE_MANUAL_ORDER") return validateManualColumns(board.columns);
  if (action.type === "REPAIR_MANUAL_ORDER") return board.columns.some(column => column.id === action.status)
    ? null : failure("missing-column", "The column to repair no longer exists.");
  const source = board.columns.find(column => column.tasks.some(task => task.id === action.taskId));
  if (!source) return failure("missing-task", "The task no longer exists.");
  if (action.mode !== "manual") return failure("priority-ordering", "Priority controls display. Select Manual to reorder tasks.");
  if (action.filtered) return failure("filtered-reorder", "Clear search and filters to reorder tasks.");
  return validateManualColumns(board.columns, true) ?? validatePlacement(source, action.taskId, action.placement);
}

/** Maintain an already initialized ID list; leave never-initialized columns absent. */
export function removeManualTask(column: Column, taskId: string): Pick<Column, "manualOrder"> {
  return column.manualOrder === undefined ? {} : { manualOrder: column.manualOrder.filter(id => id !== taskId) };
}
