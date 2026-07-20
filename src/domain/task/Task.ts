import type { TaskCategory } from "./taskCategory";
/** union type for task priority and status */

export type Priority = "low" | "medium" | "high";

export type TaskStatus = "todo" | "in-progress" | "done";

// Restricts tasks to the defined workflow states.
// Prevents invalid states from being introduced into the application
export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  category: TaskCategory;
  status: TaskStatus;
  createdAt: Date;
}
