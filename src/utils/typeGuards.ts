import { taskStatuses, type TaskStatus } from "../domain/task/Task";

/** Narrow unknown runtime values before using them in workflow operations. */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return taskStatuses.some((status) => status === value);
}
