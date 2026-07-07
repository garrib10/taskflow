/** type-only imports */
import type { Task, TaskStatus } from "../task/Task";

export interface Column {
  id: TaskStatus;
  title: string;
  tasks: Task[];
}

export interface Board {
  id: string;
  name: string;
  columns: Column[];
}
