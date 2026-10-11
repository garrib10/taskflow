import { createNotification, type NotificationVariant, type TaskNotification } from "../notifications/notification";
import type { Board } from "../domain/board/Board";
import { sortTasksByPriority } from "../domain/task/taskPriority";
import { initialBoard } from "../utils/mockData";
import { browserStorage, commitConfirmedRecovery, decodeBoard, loadBoard, saveBoard, STORAGE_KEY, type BoardStorage, type LoadResult, type SaveResult } from "../utils/storage";

export type RecoveryState =
  | { kind: "ready" }
  | { kind: "read-failed" }
  | { kind: "invalid"; source: Extract<LoadResult, { kind: "invalid" }> }
  | { kind: "migration-failed"; source: Extract<LoadResult, { kind: "migration-failed" }> }
  | { kind: "future"; source: Extract<LoadResult, { kind: "future" }> }
  | { kind: "order-recovery"; source: Extract<LoadResult, { kind: "order-recovery" }> }
  | { kind: "write-failed"; migrationPending: boolean }
  | { kind: "conflict" }
  | { kind: "invalid-board" };
export type PersistenceNotice = TaskNotification & { recovery: "retry" | "reload" | null };
export interface PersistenceSnapshot { notice: PersistenceNotice | null; recovery: RecoveryState }
const ready: RecoveryState = { kind: "ready" };
function notice(variant: NotificationVariant, message: string, recovery: PersistenceNotice["recovery"]): PersistenceNotice {
  return { ...createNotification(variant, message), recovery };
}
function blockedNotice(result: LoadResult, initial = true): PersistenceNotice {
  if (result.kind === "order-recovery") return notice("warning", "Your tasks were restored in Priority order, but saved manual order needs repair. Your saved data is untouched. Changes stay in this tab; saving is paused.", "reload");
  const workspace = initial ? "An empty workspace is open; your saved data is untouched. " : "Your current work and the saved data are untouched. ";
  if (result.kind === "future") return notice("error", `This saved board needs a newer TaskFlow version. ${workspace}Saving is paused. Use the newer version to keep your saved work.`, "reload");
  if (result.kind === "unavailable") return notice("error", "Browser storage is unavailable. Your saved board could not be read. Changes stay in this tab and may be lost when it closes. Saving is paused. Try reading it again.", "reload");
  if (result.kind === "migration-failed") return notice("error", `Your older saved board could not be upgraded safely. ${initial ? "An empty workspace is open; the original is untouched. " : "Your current work and the original saved data are untouched. "}Saving is paused.`, "reload");
  return notice("error", `Your saved board is invalid and could not be restored safely. ${initial ? "An empty workspace is open; the original is untouched. " : "Your current work and the original saved data are untouched. "}You can work in this tab, but saving is paused.`, "reload");
}
function recoveryFor(loaded: LoadResult): RecoveryState {
  switch (loaded.kind) {
    case "current": case "migrated": case "missing": return ready;
    case "unavailable": return { kind: "read-failed" };
    case "invalid": return { kind: "invalid", source: loaded };
    case "migration-failed": return { kind: "migration-failed", source: loaded };
    case "future": return { kind: "future", source: loaded };
    case "order-recovery": return { kind: "order-recovery", source: loaded };
  }
}
/** Safe troubleshooting codes only: no payload, identities, content or exception text. */
export function recoveryDiagnostic(state: RecoveryState): string {
  switch (state.kind) {
    case "invalid": case "migration-failed": return `Recovery code: ${state.source.code}`;
    case "future": return `Recovery code: newer-version; saved format: ${state.source.version}`;
    case "order-recovery": return `Recovery code: damaged-order; saved format: ${state.source.version}; affected columns: ${state.source.affectedColumns.length}`;
    case "write-failed": return state.migrationPending ? "Recovery code: upgrade-write-unconfirmed" : "Recovery code: write-unconfirmed";
    case "read-failed": return "Recovery code: read-unavailable";
    case "conflict": return "Recovery code: external-change";
    case "invalid-board": return "Recovery code: invalid-local-board";
    case "ready": return "";
  }
}

/** Session-owned write policy. Notifications never enable writes or resolve recovery. */
export class PersistenceSession {
  private hydratedBoard: Board;
  get board() { return this.hydratedBoard; }
  get orderRecovery() { return this.recovery.kind === "order-recovery" ? this.recovery.source : null; }
  private snapshot: PersistenceSnapshot = { notice: null, recovery: ready };
  get notice() { return this.snapshot.notice; }
  get recovery() { return this.snapshot.recovery; }
  get writesEnabled() { return this.recovery.kind === "ready"; }
  getSnapshot = () => this.snapshot;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(recovery: RecoveryState, notice: PersistenceNotice | null) {
    if (this.snapshot.recovery === recovery && this.notice === notice) return;
    this.snapshot = { recovery, notice };
    this.listeners.forEach(listener => listener());
  }
  private knownRaw: string | null | undefined;
  private lastSavedBoard: Board | null = null;
  private migrationPending = false;
  readonly storage: () => BoardStorage;

  constructor(storage: () => BoardStorage = browserStorage) {
    this.storage = storage;
    const loaded = loadBoard(storage);
    this.hydratedBoard = loaded.kind === "current" || loaded.kind === "migrated" || loaded.kind === "order-recovery" ? loaded.board
      : loaded.kind === "missing" ? initialBoard
      : { id: "board-1", name: "TaskFlow Board", lastUpdated: new Date(0), columns: initialBoard.columns.map(column => ({ ...column, tasks: [] })) };
    this.acceptLoad(loaded);
    if (!this.writesEnabled) this.publish(this.recovery, blockedNotice(loaded));
  }
  private acceptLoad(loaded: LoadResult) {
    this.knownRaw = loaded.kind === "unavailable" ? undefined : loaded.raw;
    this.migrationPending = loaded.kind === "migrated";
    this.lastSavedBoard = loaded.kind === "current" ? loaded.board : null;
    this.publish(recoveryFor(loaded), null);
  }
  save(board: Board): void {
    if (!this.writesEnabled || this.knownRaw === undefined || this.lastSavedBoard === board) return;
    this.finishSave(saveBoard(board, this.knownRaw, this.storage), board);
  }
  retrySave(board: Board): void {
    if (this.recovery.kind !== "write-failed" || this.knownRaw === undefined) return;
    this.finishSave(saveBoard(board, this.knownRaw, this.storage), board);
  }
  private finishSave(result: SaveResult, board: Board) {
    switch (result.kind) {
      case "saved": {
        const wasRetry = this.recovery.kind === "write-failed";
        this.knownRaw = result.raw;
        this.lastSavedBoard = board;
        const message = this.migrationPending ? notice("info", "Your saved board was upgraded to the current format.", null)
          : wasRetry ? notice("success", "Changes in this tab are now saved.", null) : this.notice;
        this.migrationPending = false;
        this.publish(ready, message);
        break;
      }
      case "conflict": this.pauseForExternal(result.external); break;
      case "invalid-board":
        this.publish({ kind: "invalid-board" }, notice("error", "This board could not be saved safely. Your previous saved board is untouched. Changes remain in this tab.", "reload"));
        break;
      case "unavailable": case "save-failed":
        this.publish({ kind: "write-failed", migrationPending: this.migrationPending }, notice("error",
          this.migrationPending ? "Your upgraded board is usable in this tab, but TaskFlow could not confirm that it was saved. Keep this tab open and retry saving."
          : "TaskFlow could not confirm that your changes were saved. Keep this tab open. Your work remains available here; try saving again.", "retry"));
        break;
    }
  }
  /** The UI confirms discarding temporary work before applying a successfully read board. */
  retryRead(): Board | null {
    if (this.recovery.kind !== "read-failed") return null;
    const loaded = loadBoard(this.storage);
    if (loaded.kind === "unavailable" || loaded.kind === "invalid" || loaded.kind === "migration-failed" || loaded.kind === "future") {
      this.acceptLoad(loaded);
      this.publish(this.recovery, blockedNotice(loaded, false));
      return null;
    }
    this.hydratedBoard = loaded.kind === "missing" ? initialBoard : loaded.board;
    this.acceptLoad(loaded);
    if (loaded.kind === "order-recovery") this.publish(this.recovery, blockedNotice(loaded));
    else if (loaded.kind === "current") this.publish(ready, notice("success", "Your saved board was restored. Saving is available again.", null));
    else {
      this.save(this.board);
      if (loaded.kind === "missing" && this.writesEnabled) this.publish(ready, notice("success", "Browser storage is available again. This board is now saved.", null));
    }
    return this.board;
  }
  /** Called only by the explicit destructive confirmation handler. */
  replaceStoredBoard(): Board | null {
    const state = this.recovery;
    if (state.kind !== "invalid" && state.kind !== "migration-failed" && state.kind !== "future") return null;
    return this.finishRecovery(commitConfirmedRecovery(initialBoard, state.source.raw, "replace", this.storage), initialBoard, "replace");
  }
  /** Rebuild only damaged columns using the full current Priority order, never a filtered view. */
  repairOrder(board: Board): Board | null {
    const state = this.recovery;
    if (state.kind !== "order-recovery") return null;
    const affected = new Set(state.source.affectedColumns);
    const repaired = { ...board, columns: board.columns.map(column => affected.has(column.id)
      ? { ...column, manualOrder: sortTasksByPriority(column.tasks).map(task => task.id) } : column) };
    return this.finishRecovery(commitConfirmedRecovery(repaired, state.source.raw, "repair", this.storage), repaired, "repair");
  }
  private finishRecovery(result: SaveResult, board: Board, action: "replace" | "repair"): Board | null {
    switch (result.kind) {
      case "saved":
        this.knownRaw = result.raw;
        this.lastSavedBoard = board;
        this.migrationPending = false;
        this.hydratedBoard = board;
        this.publish(ready, notice("success", action === "replace" ? "The saved board was replaced with the starter board. Saving is available again." : "Saved manual order was repaired. Your tasks were kept and changes in this tab are now saved.", null));
        return board;
      case "conflict": this.pauseForExternal(result.external); break;
      case "invalid-board":
        this.publish(this.recovery, notice("error", "Recovery could not be completed safely. Your saved data is untouched; your work remains in this tab. Saving is paused.", "reload"));
        break;
      case "unavailable": case "save-failed":
        this.publish(this.recovery, notice("error", action === "replace" ? "TaskFlow could not confirm that the replacement was saved. Keep this tab open and try again. Saving is paused." : "TaskFlow could not confirm that the repaired order was saved. Your work remains in this tab. Saving is paused; try repairing again.", "reload"));
        break;
    }
    return null;
  }
  observe(key: string | null, raw: string | null, area: Storage | null): boolean {
    if (key !== STORAGE_KEY && key !== null) return false;
    try { if (area !== null && area !== this.storage()) return false; } catch { /* Access may become blocked while an event is pending. */ }
    if (raw === this.knownRaw || (this.recovery.kind !== "ready" && this.recovery.kind !== "write-failed")) return false;
    this.pauseForExternal(decodeBoard(raw));
    return true;
  }
  private pauseForExternal(external: LoadResult): void {
    const valid = external.kind === "current" || external.kind === "migrated" || external.kind === "missing";
    this.publish({ kind: "conflict" }, notice(valid ? "warning" : "error", valid
      ? "Another tab changed or removed the saved board. Your work remains in this tab. Saving is paused; reload the saved board to continue."
      : "The saved board changed and could not be restored safely. Your work remains in this tab and the stored data is untouched. Saving is paused.", "reload"));
  }
}

export function listenForBoardChanges(session: PersistenceSession, source: EventTarget, onChange: () => void = () => {}): () => void {
  const listener = (event: Event) => {
    if (event instanceof StorageEvent && session.observe(event.key, event.newValue, event.storageArea)) onChange();
  };
  source.addEventListener("storage", listener);
  return () => source.removeEventListener("storage", listener);
}
