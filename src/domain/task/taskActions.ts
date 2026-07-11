import type { Task, Priority, TaskStatus } from "./Task";
import { canMoveTask } from "./taskRules";

/**
 * Contains core task operations.
 * Handles creating tasks and updating task workflow states.
 * Business rules are validated before changes are applied.
 */

export function createTask(title: string, priority: Priority): Task {
  return {
    id: crypto.randomUUID(),
    title,
    priority,
    status: "todo",
    createdAt: new Date(),
  };
}

export function moveTask(task: Task, newStatus: TaskStatus): Task | null {
  if (!canMoveTask(task.status, newStatus)) {
    return null;
  }

  return {
    ...task,
    status: newStatus,
  };
}
