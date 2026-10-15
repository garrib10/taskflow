import type { Board, Column } from "../domain/board/Board";
import { manualOrderState } from "../domain/board/boardOrdering";
import type { Task, TaskStatus } from "../domain/task/Task";
import { isId, isRecord, validateBoard } from "./validation";

export const CURRENT_SCHEMA_VERSION = 3;
export type PersistedTaskV3 = Omit<Task, "createdAt"> & { createdAt: string };
export type PersistedColumnV3 = Omit<Column, "tasks" | "manualOrder"> & {
  tasks: PersistedTaskV3[];
  manualOrder: string[] | null;
};
export type PersistedBoardV3 = Omit<Board, "columns" | "lastUpdated"> & {
  columns: PersistedColumnV3[];
  lastUpdated: string;
};
export interface PersistedEnvelopeV3 {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  revision: string;
  board: PersistedBoardV3;
}
export type StoredBoardResult =
  | { kind: "valid"; board: Board }
  | { kind: "invalid-core"; path: string; reason: string }
  | { kind: "order-recovery"; board: Board; affectedColumns: TaskStatus[] };

/** Encode only a trusted domain projection. Null is a DTO marker, never domain state. */
export function encodeBoardV3(board: Board): PersistedBoardV3 {
  return {
    id: board.id, name: board.name, lastUpdated: board.lastUpdated.toISOString(),
    columns: board.columns.map(column => ({
      id: column.id, title: column.title,
      manualOrder: column.manualOrder === undefined ? null : [...column.manualOrder],
      tasks: column.tasks.map(task => ({
        id: task.id, title: task.title, description: task.description,
        priority: task.priority, category: task.category, status: task.status,
        createdAt: task.createdAt.toISOString(),
        subtasks: task.subtasks.map(entry => ({ id: entry.id, title: entry.title, completed: entry.completed })),
        ...(task.parentId === undefined ? {} : { parentId: task.parentId }),
      })),
    })),
  };
}

/** Validate the complete core before inspecting positions; never guess damaged order. */
export function validateStoredBoard(value: unknown, version: 2 | 3): StoredBoardResult {
  const core = validateBoard(value, false, true);
  if (!core.ok) return { kind: "invalid-core", path: core.path, reason: core.reason };
  // Core validation established these containers, but keep the unknown boundary explicit.
  if (!isRecord(value) || !Array.isArray(value.columns)) {
    return { kind: "invalid-core", path: "board", reason: "Invalid board structure" };
  }
  const storedColumns = value.columns;
  const affectedColumns: TaskStatus[] = [];
  const board: Board = { ...core.board, columns: core.board.columns.map((column, index) => {
    const stored: unknown = storedColumns[index];
    if (isRecord(stored)) {
      if ((version === 2 && !Object.hasOwn(stored, "manualOrder")) ||
          (version === 3 && Object.hasOwn(stored, "manualOrder") && stored.manualOrder === null)) return column;
      if (Array.isArray(stored.manualOrder) && stored.manualOrder.every(isId)) {
        const initialized = { ...column, manualOrder: [...stored.manualOrder] };
        if (manualOrderState(initialized) === "valid") return initialized;
      }
    }
    affectedColumns.push(column.id);
    return column;
  }) };
  return affectedColumns.length ? { kind: "order-recovery", board, affectedColumns } : { kind: "valid", board };
}
