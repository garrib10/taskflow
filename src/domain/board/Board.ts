/** type-only imports */
import type { Task, TaskStatus } from "../task/Task.ts";

export interface Column {
  id: TaskStatus;
  title: string;
  /** Stable per-column arrival order, independent of manual display. */
  tasks: Task[];
  /** Optional until first explicit initialization; every current task ID exactly once. */
  manualOrder?: Task["id"][];
}

export interface Board {
  id: string;
  name: string;
  columns: Column[];
  lastUpdated: Date;
}
