import type { TaskStatus } from "./Task";

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

export function getMoveErrorMessage(
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
): string {
  return `Cannot move task from ${currentStatus} to ${newStatus}`;
}
