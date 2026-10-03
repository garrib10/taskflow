import type { TaskCategory } from "./taskCategory";

/** union type for task priority and status */

export type Priority = "low" | "medium" | "high";

export const taskStatuses = ["todo", "in-progress", "in-review", "done"] as const;

export type TaskStatus = (typeof taskStatuses)[number];

/**
 * Individual checklist item inside a Task
 */
export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

// Restricts tasks to the defined workflow states.
// Prevents invalid states from being introduced into the application
export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  category: TaskCategory;
  status: TaskStatus;
  createdAt: Date;

  // Optional feature:
  // Tasks can have zero or more subtasks
  subtasks: Subtask[];
}

/** Fields that a task form may edit; identity and workflow remain reducer-owned. */
export type TaskEdits = Pick<Task, "title" | "description" | "priority" | "category">;
