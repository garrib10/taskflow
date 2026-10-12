import type { Board } from "../domain/board/Board";
import { isId, isRecord, validateBoard } from "../persistence/validation";
import { migrateBoard } from "../persistence/migrations";
import { CURRENT_SCHEMA_VERSION, encodeBoardV3, validateStoredBoard, type PersistedEnvelopeV3 } from "../persistence/schema";
import type { TaskStatus } from "../domain/task/Task";
export { CURRENT_SCHEMA_VERSION } from "../persistence/schema";

export const STORAGE_KEY = "taskflow-board";
export interface BoardStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type LoadResult =
  | { kind: "missing"; raw: null }
  | { kind: "current"; board: Board; raw: string; revision: string }
  | { kind: "migrated"; board: Board; raw: string; fromVersion: 0 | 1 | 2 }
  | { kind: "order-recovery"; board: Board; raw: string; version: 2 | 3; affectedColumns: TaskStatus[] }
  | { kind: "invalid"; raw: string; reason: string; code: "invalid-json" | "invalid-envelope" | "invalid-version" | "missing-revision" | "invalid-board" }
  | { kind: "migration-failed"; raw: string; reason: string; code: "conversion-failed" | "migration-exception" }
  | { kind: "future"; raw: string; version: number }
  | { kind: "unavailable" };
export type SaveResult =
  | { kind: "saved"; raw: string; revision: string }
  | { kind: "conflict"; external: LoadResult }
  | { kind: "unavailable" | "save-failed" | "invalid-board" };
export const browserStorage = (): BoardStorage => window.localStorage;

/** Pure decoding never writes. Recovery diagnostics contain no user fields or exceptions. */
export function decodeBoard(raw: string | null): LoadResult {
  if (raw === null) return { kind: "missing", raw };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { kind: "invalid", raw, code: "invalid-json", reason: "Malformed JSON" }; }
  if (!isRecord(value)) return { kind: "invalid", raw, code: "invalid-envelope", reason: "Invalid stored object" };
  if (!Object.hasOwn(value, "schemaVersion")) return migrateSafely(value, 0, raw);
  const version = value.schemaVersion;
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) {
    return { kind: "invalid", raw, code: "invalid-version", reason: "Invalid schema version" };
  }
  if (version > CURRENT_SCHEMA_VERSION) return { kind: "future", raw, version };
  if (version === 1) return migrateSafely(value.board, 1, raw);
  if (!isId(value.revision)) return { kind: "invalid", raw, code: "missing-revision", reason: "Missing revision" };
  if (version === 2) return migrateSafely(value.board, 2, raw);
  try {
    const result = validateStoredBoard(value.board, 3);
    if (result.kind === "order-recovery") return { ...result, raw, version: 3 };
    if (result.kind === "valid") return { kind: "current", raw, revision: value.revision, board: result.board };
  } catch { /* An unexpected validator exception must not be reported as a storage read failure. */ }
  return { kind: "invalid", raw, code: "invalid-board", reason: "Invalid board content" };
}
function migrateSafely(value: unknown, fromVersion: 0 | 1 | 2, raw: string): LoadResult {
  try {
    const result = migrateBoard(value, fromVersion);
    if (result.kind === "valid") return { kind: "migrated", raw, fromVersion, board: result.board };
    if (fromVersion === 2) {
      if (result.kind === "order-recovery") return { ...result, raw, version: 2 };
      return { kind: "invalid", raw, code: "invalid-board", reason: "Invalid board content" };
    }
    return { kind: "migration-failed", raw, code: "conversion-failed", reason: "Legacy conversion failed" };
  } catch {
    return { kind: "migration-failed", raw, code: "migration-exception", reason: "Migration could not be completed" };
  }
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
  return commitBoard(board, expectedRaw, storage, newRevision, "normal");
}

/** Only explicit, confirmed session recovery may replace rejected original bytes. */
export function commitConfirmedRecovery(board: Board, expectedRaw: string, action: "replace" | "repair",
  storage: () => BoardStorage = browserStorage, newRevision: () => string = () => crypto.randomUUID()): SaveResult {
  return commitBoard(board, expectedRaw, storage, newRevision, action);
}

function commitBoard(board: Board, expectedRaw: string | null,
  storage: () => BoardStorage, newRevision: () => string, policy: "normal" | "replace" | "repair"): SaveResult {
  let target: BoardStorage;
  try {
    target = storage();
    const latest = target.getItem(STORAGE_KEY);
    if (latest !== expectedRaw) return { kind: "conflict", external: decodeBoard(latest) };
    const restored = decodeBoard(latest);
    const permitted = policy === "normal"
      ? restored.kind === "missing" || restored.kind === "current" || restored.kind === "migrated"
      : policy === "repair" ? restored.kind === "order-recovery"
      : restored.kind === "invalid" || restored.kind === "migration-failed" || restored.kind === "future";
    if (!permitted) return { kind: "conflict", external: restored };
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
    const envelope: PersistedEnvelopeV3 = { schemaVersion: CURRENT_SCHEMA_VERSION, revision, board: encodeBoardV3(validated.board) };
    if (validateStoredBoard(envelope.board, 3).kind !== "valid") return { kind: "invalid-board" };
    raw = JSON.stringify(envelope);
    target.setItem(STORAGE_KEY, raw);
  } catch { return { kind: "save-failed" }; }
  try {
    const latest = target.getItem(STORAGE_KEY);
    if (latest !== raw) return { kind: "conflict", external: decodeBoard(latest) };
  } catch { return { kind: "unavailable" }; }
  return { kind: "saved", raw, revision };
}
