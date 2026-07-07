import type { TaskStatus } from "../domain/task/Task";

/**
 * Type guard that verifies whether a string
 * is a valid TaskStatus.
 */

export function isTaskStatus(value: string): value is TaskStatus {
  return ["todo", "in-progress", "done"].includes(value);
}
