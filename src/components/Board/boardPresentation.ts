import type { Board } from "../../domain/board/Board";
import type { Task } from "../../domain/task/Task";

export interface TaskContext { parentTitle?: string; childCount: number; completedChildren: number }
/** Build all card summaries together from complete data, including hidden relatives. */
export function taskContexts(board: Board): Map<string, TaskContext> {
  const tasks = board.columns.flatMap(column => column.tasks);
  const byId = new Map(tasks.map(task => [task.id, task]));
  const contexts = new Map<string, TaskContext>();
  for (const task of tasks) contexts.set(task.id, { childCount: 0, completedChildren: 0, parentTitle: task.parentId ? byId.get(task.parentId)?.title : undefined });
  for (const task of tasks) {
    const parent = task.parentId ? contexts.get(task.parentId) : undefined;
    if (parent) { parent.childCount++; parent.completedChildren += Number(task.status === "done"); }
  }
  return contexts;
}
export function descriptionMatch(task: Task, search: string): string | null {
  const query = search.trim().toLowerCase();
  if (!query || task.title.toLowerCase().includes(query)) return null;
  const index = task.description.toLowerCase().indexOf(query);
  if (index < 0) return null;
  const start = Math.max(0, index - 35);
  const excerpt = task.description.slice(start, start + Math.max(150, query.length));
  return `${start ? "…" : ""}${excerpt}${start + excerpt.length < task.description.length ? "…" : ""}`;
}
