import type { Task, Priority, TaskStatus } from "./Task";

import type { TaskCategory } from "./taskCategory";

import { canMoveTask } from "./taskRules";

/**
 * Contains core task operations.
 * Handles creating tasks and updating task workflow states.
 * Business rules are validated before changes are applied.
 */

export function createTask(
  title: string,
  description: string,
  priority: Priority,
  category: TaskCategory,
): Task {
  return {
    id: crypto.randomUUID(),
    title,
    description,
    priority,
    category,
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
