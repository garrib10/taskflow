import type { Task, Priority } from "./Task";

/**
 * Utility functions for calculating and sorting task priorities.
 * Keeps priority-related business logic separate from the UI.
 */

const priorityScores: Record<Priority, number> = {
  high: 300,
  medium: 200,
  low: 100,
};

export function getPriorityScore(task: Task): number {
  return priorityScores[task.priority];
}

const priorityLabels: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function getPriorityLabel(priority: Priority): string {
  return priorityLabels[priority];
}

export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
}
