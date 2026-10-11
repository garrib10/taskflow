import type { Board } from "../domain/board/Board";
import type { Task } from "../domain/task/Task";
import { validateBoard, type ValidationResult } from "./validation";
import { encodeBoardV3, validateStoredBoard, type StoredBoardResult } from "./schema";

/** v0 -> v1 restores workflow columns and deterministic legacy defaults. */
export function migrateV0ToV1(value: unknown): ValidationResult {
  return validateBoard(value, true);
}

/** v1 -> v2 converts checklists without generating new identities or timestamps. */
export function migrateV1ToV2(value: unknown): ValidationResult {
  const v1 = validateBoard(value, true);
  if (!v1.ok) return v1;
  const original = v1.board;
  const tasks = original.columns.flatMap((column) => column.tasks);
  const existing = new Map(tasks.map((task) => [task.id, task]));
  const convertedIds = new Set<string>();
  const children: Task[] = [];
  for (const parent of tasks) {
    if (parent.subtasks.length && parent.parentId !== undefined) {
      return { ok: false, path: `task:${parent.id}.subtasks`, reason: "Checklist conversion would create deeper nesting" };
    }
    for (const entry of parent.subtasks) {
      if (convertedIds.has(entry.id)) return { ok: false, path: `checklist:${entry.id}`, reason: "Conflicting checklist ID" };
      convertedIds.add(entry.id);
      const previous = existing.get(entry.id);
      if (previous) {
        // A repeated/partially converted snapshot may retain an already linked child.
        // Preserve its newer fields instead of duplicating or rolling it back.
        if (previous.parentId === parent.id) continue;
        return { ok: false, path: `checklist:${entry.id}`, reason: "Checklist ID conflicts with an existing task" };
      }
      children.push({ id: entry.id, title: entry.title, parentId: parent.id,
        status: entry.completed ? "done" : "todo", description: "", priority: parent.priority,
        category: parent.category, createdAt: parent.createdAt, subtasks: [] });
    }
  }
  const board: Board = { ...original, columns: original.columns.map((column) => ({ ...column,
    tasks: [...column.tasks.map((task) => ({ ...task, subtasks: [] })), ...children.filter((child) => child.status === column.id)] })) };
  // Done parents with unfinished legacy work reject the whole migration; never reopen/drop work.
  return validateBoard(JSON.parse(JSON.stringify(board)));
}

/** v2 -> v3 preserves valid saved lists and encodes legacy absence as null.
 * Never initialize order, re-convert current checklists, or write storage here.
 */
export function migrateV2ToV3(value: unknown): StoredBoardResult {
  const v2 = validateStoredBoard(value, 2);
  if (v2.kind !== "valid") return v2;
  return validateStoredBoard(encodeBoardV3(v2.board), 3);
}

export function migrateBoard(value: unknown, fromVersion: 0 | 1 | 2): StoredBoardResult {
  if (fromVersion === 2) return migrateV2ToV3(value);
  let source = value;
  if (fromVersion === 0) {
    const v1 = migrateV0ToV1(source);
    if (!v1.ok) return { kind: "invalid-core", path: v1.path, reason: v1.reason };
    source = JSON.parse(JSON.stringify(v1.board));
  }
  const v2 = migrateV1ToV2(source);
  if (!v2.ok) return { kind: "invalid-core", path: v2.path, reason: v2.reason };
  return migrateV2ToV3(JSON.parse(JSON.stringify(v2.board)));
}
