import type { TaskStatus } from "./Task";
import { isTaskStatus } from "../../utils/typeGuards";

const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in-progress"],

  "in-progress": ["in-review"],

  "in-review": ["done"],

  done: [],
};

export function canMoveTask(
  currentStatus: unknown,
  newStatus: unknown,
): boolean {
  return (
    isTaskStatus(currentStatus) &&
    isTaskStatus(newStatus) &&
    allowedTransitions[currentStatus].includes(newStatus)
  );
}

export function getMoveErrorMessage(
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
): string {
  return `Cannot move task from ${currentStatus} to ${newStatus}. `;
}
