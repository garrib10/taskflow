import { createNotification, type NotificationVariant, type TaskNotification } from "../notifications/notification";
import type { Board } from "../domain/board/Board";
import { initialBoard } from "../utils/mockData";
import { browserStorage, decodeBoard, loadBoard, saveBoard, STORAGE_KEY, type BoardStorage, type LoadResult } from "../utils/storage";

export type PersistenceNotice = TaskNotification & { recovery: "retry" | "reload" | null };
function notice(variant: NotificationVariant, message: string, recovery: PersistenceNotice["recovery"]): PersistenceNotice {
  return { ...createNotification(variant, message), recovery };
}
function blockedNotice(result: LoadResult): PersistenceNotice {
  if (result.kind === "future") return notice("error", "This saved board needs a newer TaskFlow version. An empty workspace is open; your saved data is untouched. Saving is paused.", "reload");
  if (result.kind === "unavailable") return notice("error", "Browser storage is unavailable. An empty workspace is open. Changes stay in this tab and may be lost when it closes. Saving is paused.", "reload");
  if (result.kind === "migration-failed") return notice("error", "Your older saved board could not be upgraded safely. An empty workspace is open; the original is untouched. Saving is paused.", "reload");
  return notice("warning", "Your saved board is invalid and could not be restored safely. An empty workspace is open; the original is untouched. You can work in this tab, but saving is paused.", "reload");
}

/** No automatic replacement or merge. External changes pause saving until reload.
 * The local board stays usable. Known raw bytes (plus the revision inside them)
 * are compared, so reusing a revision with different data cannot hide a conflict.
 */
export class PersistenceSession {
  readonly board: Board;
  notice: PersistenceNotice | null = null;
  private listeners = new Set<() => void>();
  getSnapshot = () => this.notice;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private notify() { this.listeners.forEach((listener) => listener()); }
  private knownRaw: string | null | undefined;
  private paused = false;
  private lastSavedBoard: Board | null = null;
  private migrationPending = false;

  readonly storage: () => BoardStorage;

  constructor(storage: () => BoardStorage = browserStorage) {
    this.storage = storage;
    const loaded = loadBoard(storage);
    this.board = loaded.kind === "current" || loaded.kind === "migrated" ? loaded.board
      : loaded.kind === "missing" ? initialBoard
      : { id: "board-1", name: "TaskFlow Board", lastUpdated: new Date(0), columns: initialBoard.columns.map((column) => ({ ...column, tasks: [] })) };
    if (loaded.kind === "current" || loaded.kind === "migrated" || loaded.kind === "missing") {
      this.knownRaw = loaded.raw;
      this.migrationPending = loaded.kind === "migrated";
      if (loaded.kind === "current") this.lastSavedBoard = this.board;
    } else {
      this.paused = true;
      this.notice = blockedNotice(loaded);
    }
  }

  save(board: Board): void {
    if (this.paused || this.knownRaw === undefined || this.lastSavedBoard === board) return;
    const result = saveBoard(board, this.knownRaw, this.storage);
    switch (result.kind) {
      case "saved":
        this.knownRaw = result.raw;
        this.lastSavedBoard = board;
        if (this.migrationPending) {
          this.notice = notice("info", "Your saved board was upgraded to the current format. Any legacy checklist items now use linked subtasks.", null);
        } else if (this.notice?.recovery === "retry") {
          this.notice = notice("success", "Changes in this tab are now saved.", null);
        }
        this.migrationPending = false;
        break;
      case "conflict":
        this.pauseForExternal(result.external);
        break;
      case "invalid-board":
        this.paused = true;
        this.notice = notice("error", "This board could not be saved safely. Your previous saved board is untouched. Changes remain in this tab.", "reload");
        break;
      case "unavailable":
      case "save-failed":
        this.notice = notice("error", "TaskFlow could not confirm that your changes were saved. Keep this tab open. Your work remains available here; try saving again.", "retry");
        break;
    }
    this.notify();
  }

  observe(key: string | null, raw: string | null, area: Storage | null): boolean {
    if (key !== STORAGE_KEY && key !== null) return false;
    try { if (area !== null && area !== this.storage()) return false; } catch { /* Storage can become blocked while an event is pending. */ }
    if (raw === this.knownRaw || this.paused) return false;
    this.pauseForExternal(decodeBoard(raw));
    this.notify();
    return true;
  }

  private pauseForExternal(external: LoadResult): void {
    this.paused = true;
    const valid = external.kind === "current" || external.kind === "migrated" || external.kind === "missing";
    this.notice = notice(valid ? "warning" : "error", valid
      ? "Another tab changed or removed the saved board. Your work remains in this tab. Saving is paused; reload the saved board to continue."
      : "The saved board changed and could not be restored safely. Your work remains in this tab and the stored data is untouched. Saving is paused.", "reload");
  }
}

export function listenForBoardChanges(session: PersistenceSession, source: EventTarget, onChange: () => void = () => {}): () => void {
  const listener = (event: Event) => {
    if (event instanceof StorageEvent && session.observe(event.key, event.newValue, event.storageArea)) onChange();
  };
  source.addEventListener("storage", listener);
  return () => source.removeEventListener("storage", listener);
}
