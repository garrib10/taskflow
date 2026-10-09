import type { Board } from "../domain/board/Board";
import { taskStatuses, type Task } from "../domain/task/Task";
export const fixtureDate = new Date("2026-01-01T00:00:00.000Z");
export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1", title: "Build search", description: "Find tasks by description",
    priority: "medium", category: "feature", status: "todo",
    createdAt: fixtureDate, subtasks: [], ...overrides,
  };
}
export function makeBoard(tasks: Task[] = [makeTask()]): Board {
  return {
    id: "board-1", name: "Test board", lastUpdated: fixtureDate,
    columns: taskStatuses.map((status) => ({
      id: status, title: status, tasks: tasks.filter((task) => task.status === status),
    })),
  };
}
export function freezeDeep(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  Object.values(value).forEach(freezeDeep);
  Object.freeze(value);
}
