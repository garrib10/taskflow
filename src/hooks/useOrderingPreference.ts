import { useState } from "react";
import type { Board } from "../domain/board/Board";
import { manualOrderState, type OrderingMode } from "../domain/board/boardOrdering";
import { createNotification, type TaskNotification } from "../notifications/notification";
import { DEFAULT_ORDERING_MODE, loadViewPreferences, saveViewPreferences } from "../persistence/viewPreferences";
import type { RecoveryState } from "../persistence/session";

export function hasCompleteManualOrder(board: Board): boolean {
  return board.columns.every(column => manualOrderState(column) === "valid");
}

/** Hydrate after the board, once per mount. No default-writing effect. */
export function useOrderingPreference(board: Board, recovery: RecoveryState, initializeManual: () => boolean) {
  const [selection, setSelection] = useState<{ mode: OrderingMode; notice: TaskNotification | null }>(() => {
    const loaded = loadViewPreferences();
    const saved = loaded.kind === "valid" ? loaded.preferences.orderingMode : DEFAULT_ORDERING_MODE;
    const mode = saved === "manual" && (!hasCompleteManualOrder(board) || recovery.kind === "order-recovery") ? "priority" : saved;
    const message = loaded.kind === "invalid" || loaded.kind === "future" ? "Your saved ordering choice could not be used. Priority is selected; your tasks and saved task order are unchanged."
      : loaded.kind === "unavailable" ? "Your ordering choice could not be read. Priority is selected; your tasks are unaffected."
      : mode !== saved ? "Priority is selected because saved manual task order is not ready. Select Manual after saving or repairing the board."
      : null;
    return { mode, notice: message ? createNotification("warning", message) : null };
  });
  const mode: OrderingMode = selection.mode === "manual" && hasCompleteManualOrder(board) && recovery.kind !== "order-recovery" ? "manual" : "priority";
  function selectMode(next: OrderingMode) {
    if (next === "manual" && (!hasCompleteManualOrder(board) || recovery.kind === "order-recovery") && !initializeManual()) return;
    const result = saveViewPreferences(next);
    setSelection({ mode: next, notice: result.kind === "unconfirmed"
      ? createNotification("warning", "Your ordering choice could not be saved. You can use it in this tab, but it may not survive refresh. Your board saving is separate.")
      : selection.notice ? createNotification("success", "Your ordering choice is now saved.") : null });
  }
  return { mode, selectMode, notice: selection.notice };
}
