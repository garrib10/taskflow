import type { Board } from "../domain/board/Board";
import { initialBoard } from "../utils/mockData";
import { browserStorage, decodeBoard, loadBoard, saveBoard, STORAGE_KEY, type BoardStorage, type LoadResult } from "../utils/storage";

export interface PersistenceNotice { message: string; type: "error" | "success"; canRetry: boolean }
const blockedMessage = (result: LoadResult): string => {
  if (result.kind === "future") return "This saved board needs a newer TaskFlow version. Your saved data is untouched. Saving is paused.";
  if (result.kind === "unavailable") return "Browser storage is unavailable. Changes stay in this tab and may be lost when it closes. Saving is paused.";
  return "Your saved board could not be restored safely. The original is untouched. You can work in this tab, but saving is paused.";
};

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
      this.notice = { message: blockedMessage(loaded), type: "error", canRetry: false };
    }
  }

  save(board: Board): void {
    if (this.paused || this.knownRaw === undefined || this.lastSavedBoard === board) return;
    const result = saveBoard(board, this.knownRaw, this.storage);
    switch (result.kind) {
      case "saved":
        this.knownRaw = result.raw;
        this.lastSavedBoard = board;
        this.notice = this.migrationPending
          ? { message: "Your saved board was upgraded. Checklist items are now linked subtasks.", type: "success", canRetry: false }
          : null;
        this.migrationPending = false;
        break;
      case "conflict":
        this.pauseForExternal(result.external);
        break;
      case "invalid-board":
        this.paused = true;
        this.notice = { message: "This board could not be saved safely. Your previous saved board is untouched. Changes remain in this tab.", type: "error", canRetry: false };
        break;
      case "unavailable":
      case "save-failed":
        this.notice = { message: "TaskFlow could not confirm that your changes were saved. Keep this tab open. Your work remains available here; try saving again.", type: "error", canRetry: true };
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
    this.notice = { message: valid
      ? "Another tab changed or removed the saved board. Your work remains in this tab. Saving is paused; reload the saved board to continue."
      : "The saved board changed and could not be restored safely. Your work remains in this tab and the stored data is untouched. Saving is paused.",
      type: "error", canRetry: false };
  }
}

export function listenForBoardChanges(session: PersistenceSession, source: EventTarget, onChange: () => void = () => {}): () => void {
  const listener = (event: Event) => {
    if (event instanceof StorageEvent && session.observe(event.key, event.newValue, event.storageArea)) onChange();
  };
  source.addEventListener("storage", listener);
  return () => source.removeEventListener("storage", listener);
}
