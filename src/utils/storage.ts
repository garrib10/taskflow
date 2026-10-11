import type { Board } from "../domain/board/Board";
import { isId, isRecord, validateBoard } from "../persistence/validation";
import { migrateBoard } from "../persistence/migrations";

export const STORAGE_KEY = "taskflow-board";
export const CURRENT_SCHEMA_VERSION = 2;
export interface BoardStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type LoadResult =
  | { kind: "missing"; raw: null }
  | { kind: "current"; board: Board; raw: string; revision: string }
  | { kind: "migrated"; board: Board; raw: string; fromVersion: 0 | 1 }
  | { kind: "invalid" | "migration-failed"; raw: string; reason: string }
  | { kind: "future"; raw: string; version: number }
  | { kind: "unavailable" };
export type SaveResult =
  | { kind: "saved"; raw: string; revision: string }
  | { kind: "conflict"; external: LoadResult }
  | { kind: "unavailable" | "save-failed" | "invalid-board" };
export const browserStorage = (): BoardStorage => window.localStorage;

/** Pure decoding never writes, including when migration succeeds. */
export function decodeBoard(raw: string | null): LoadResult {
  if (raw === null) return { kind: "missing", raw };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { kind: "invalid", raw, reason: "Malformed JSON" }; }
  if (!isRecord(value)) return { kind: "invalid", raw, reason: "Invalid stored object" };
  if (Object.hasOwn(value, "schemaVersion")) {
    const version = value.schemaVersion;
    if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) {
      return { kind: "invalid", raw, reason: "Invalid schema version" };
    }
    if (version > CURRENT_SCHEMA_VERSION) return { kind: "future", raw, version };
    if (version === CURRENT_SCHEMA_VERSION) {
      if (!isId(value.revision)) return { kind: "invalid", raw, reason: "Missing revision" };
      const result = validateBoard(value.board);
      return result.ok ? { kind: "current", raw, revision: value.revision, board: result.board }
        : { kind: "invalid", raw, reason: `${result.path}: ${result.reason}` };
    }
    const result = migrateBoard(value.board, 1);
    return result.ok ? { kind: "migrated", raw, fromVersion: 1, board: result.board }
      : { kind: "migration-failed", raw, reason: `${result.path}: ${result.reason}` };
  }
  const result = migrateBoard(value, 0);
  return result.ok ? { kind: "migrated", raw, fromVersion: 0, board: result.board }
    : { kind: "migration-failed", raw, reason: `${result.path}: ${result.reason}` };
}
export function loadBoard(storage: () => BoardStorage = browserStorage): LoadResult {
  try { return decodeBoard(storage().getItem(STORAGE_KEY)); } catch { return { kind: "unavailable" }; }
}

/** Optimistic preflight catches stale tabs even when their storage event was missed.
 * LocalStorage has no atomic compare-and-swap: simultaneous writers can still race.
 * A postflight detects observable races, without claiming collaborative consistency.
 */
export function saveBoard(board: Board, expectedRaw: string | null,
  storage: () => BoardStorage = browserStorage, newRevision: () => string = () => crypto.randomUUID()): SaveResult {
  let target: BoardStorage;
  try {
    target = storage();
    const latest = target.getItem(STORAGE_KEY);
    if (latest !== expectedRaw) return { kind: "conflict", external: decodeBoard(latest) };
    const restored = decodeBoard(latest);
    if (restored.kind !== "missing" && restored.kind !== "current" && restored.kind !== "migrated") {
      return { kind: "conflict", external: restored };
    }
  } catch { return { kind: "unavailable" }; }
  let raw: string;
  let revision: string;
  try {
    const data: unknown = JSON.parse(JSON.stringify(board));
    const validated = validateBoard(data);
    if (!validated.ok) return { kind: "invalid-board" };
    revision = newRevision();
    if (!isId(revision)) return { kind: "save-failed" };
    // Serialize the trusted domain projection, not structurally compatible UI extras.
    raw = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, revision, board: validated.board });
    target.setItem(STORAGE_KEY, raw);
  } catch { return { kind: "save-failed" }; }
  try {
    const latest = target.getItem(STORAGE_KEY);
    if (latest !== raw) return { kind: "conflict", external: decodeBoard(latest) };
  } catch { return { kind: "unavailable" }; }
  return { kind: "saved", raw, revision };
}
