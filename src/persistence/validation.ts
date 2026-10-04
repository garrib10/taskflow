import type { Board, Column } from "../domain/board/Board";
import { taskStatuses, type Priority, type Subtask, type Task } from "../domain/task/Task";
import type { TaskCategory } from "../domain/task/taskCategory";
import { priorityStyles } from "../domain/task/priorityStyles";
import { categoryStyles } from "../domain/task/categoryStyles";
import { isTaskStatus } from "../utils/typeGuards";
import { validateParentAssignment } from "../domain/board/boardValidation";

export type ValidationResult = { ok: true; board: Board } | { ok: false; path: string; reason: string };
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && Object.hasOwn(priorityStyles, value);
}
function isCategory(value: unknown): value is TaskCategory {
  return typeof value === "string" && Object.hasOwn(categoryStyles, value);
}
function date(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? parsed : null;
}
const fail = (path: string, reason: string): ValidationResult => ({ ok: false, path, reason });

/** Only this boundary constructs trusted domain values from unknown JSON. */
export function validateBoard(value: unknown, legacy = false): ValidationResult {
  if (!isRecord(value) || !isId(value.id) || !isId(value.name) || !Array.isArray(value.columns)) {
    return fail("board", "Invalid board structure");
  }
  const columns: Column[] = [];
  const columnIds = new Set<string>();
  const taskIds = new Set<string>();
  const checklistIds = new Set<string>();
  for (const [columnIndex, item] of value.columns.entries()) {
    const path = `board.columns[${columnIndex}]`;
    if (!isRecord(item) || !isTaskStatus(item.id) || !isId(item.title) || !Array.isArray(item.tasks) || columnIds.has(item.id)) {
      return fail(path, "Invalid or duplicate workflow column");
    }
    columnIds.add(item.id);
    const tasks: Task[] = [];
    for (const [taskIndex, candidate] of item.tasks.entries()) {
      const taskPath = `${path}.tasks[${taskIndex}]`;
      if (!isRecord(candidate) || !isId(candidate.id) || taskIds.has(candidate.id) || !isId(candidate.title) ||
          !isTaskStatus(candidate.status) || candidate.status !== item.id || !isPriority(candidate.priority) || !isCategory(candidate.category)) {
        return fail(taskPath, "Invalid task fields, ID, or column/status pairing");
      }
      const createdAt = date(candidate.createdAt);
      const description = legacy && candidate.description === undefined ? "" : candidate.description;
      const entries = legacy && candidate.subtasks === undefined ? [] : candidate.subtasks;
      if (!createdAt || typeof description !== "string" || !Array.isArray(entries) ||
          (candidate.parentId !== undefined && !isId(candidate.parentId))) {
        return fail(taskPath, "Invalid timestamp, description, parent ID, or checklist");
      }
      const subtasks: Subtask[] = [];
      for (const [index, entry] of entries.entries()) {
        if (!isRecord(entry) || !isId(entry.id) || checklistIds.has(entry.id) || !isId(entry.title) || typeof entry.completed !== "boolean") {
          return fail(`${taskPath}.subtasks[${index}]`, "Malformed or duplicate checklist entry");
        }
        checklistIds.add(entry.id);
        subtasks.push({ id: entry.id, title: entry.title, completed: entry.completed });
      }
      taskIds.add(candidate.id);
      tasks.push({ id: candidate.id, title: candidate.title, description, status: candidate.status,
        priority: candidate.priority, category: candidate.category, createdAt, subtasks,
        ...(candidate.parentId === undefined ? {} : { parentId: candidate.parentId }) });
    }
    columns.push({ id: item.id, title: item.title, tasks });
  }
  if (!legacy && taskStatuses.some((status) => !columnIds.has(status))) return fail("board.columns", "Missing workflow column");
  if (legacy) {
    const titles = { todo: "To Do", "in-progress": "In Progress", "in-review": "In Review", done: "Done" };
    for (const status of taskStatuses) if (!columnIds.has(status)) columns.push({ id: status, title: titles[status], tasks: [] });
    columns.sort((first, second) => taskStatuses.indexOf(first.id) - taskStatuses.indexOf(second.id));
  }
  const lastUpdated = legacy && value.lastUpdated === undefined
    ? new Date(columns.flatMap((column) => column.tasks).reduce((latest, task) => Math.max(latest, task.createdAt.getTime()), 0))
    : date(value.lastUpdated);
  if (!lastUpdated) return fail("board.lastUpdated", "Invalid timestamp");
  const board: Board = { id: value.id, name: value.name, columns, lastUpdated };
  for (const task of columns.flatMap((column) => column.tasks)) {
    if (!legacy && task.subtasks.some((entry) => taskIds.has(entry.id))) return fail(`task:${task.id}.subtasks`, "Checklist ID conflicts with a task");
    if (task.parentId !== undefined) {
      const error = validateParentAssignment(board, task, task.parentId);
      if (error) return fail(`task:${task.id}.parentId`, error.code);
    }
  }
  return { ok: true, board };
}
