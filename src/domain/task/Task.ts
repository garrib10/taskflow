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

  /** Only children own a link; parent progress is derived from board tasks. */
  parentId?: Task["id"];

  // Legacy checklist data stays intact until the versioned migration in #66.
  subtasks: Subtask[];
}

/** Fields that a task form may edit; identity and workflow remain reducer-owned. */
export type TaskEdits = Pick<Task, "title" | "description" | "priority" | "category">;
