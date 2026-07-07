import type { TaskStatus } from "./Task";

/**
 * Defines valid task movement between workflow states.
 * Prevents invalid transitions in the TaskFlow board.
 */

const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in-progress"],
  "in-progress": ["done"],
  done: [],
};

export function canMoveTask(
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
): boolean {
  return allowedTransitions[currentStatus].includes(newStatus);
}
