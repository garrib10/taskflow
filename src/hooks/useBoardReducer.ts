import { useCallback, useEffect, useReducer, useState, useSyncExternalStore, type Dispatch } from "react";
import { boardReducer, type BoardAction } from "../domain/board/boardReducer";
import type { Board } from "../domain/board/Board";
import { PersistenceSession, listenForBoardChanges } from "../persistence/session";

export function useBoardReducer() {
  // Hydrate once per mount, never on each render. Initialization does not write.
  const [session] = useState(() => new PersistenceSession());
  const [board, apply] = useReducer((state: Board, action: BoardAction | { type: "RESTORE_PERSISTED_BOARD"; board: Board }) =>
    action.type === "RESTORE_PERSISTED_BOARD" ? action.board : boardReducer(state, action), session.board);
  const dispatch = useCallback<Dispatch<BoardAction>>(action => {
    if (session.recovery.kind === "order-recovery" && (action.type === "INITIALIZE_MANUAL_ORDER" || action.type === "REPAIR_MANUAL_ORDER" || action.type === "REORDER_TASK" || (action.type === "MOVE_TASK" && action.ordering?.mode === "manual"))) return;
    apply(action);
  }, [session]);
  const { notice, recovery } = useSyncExternalStore(session.subscribe, session.getSnapshot);

  useEffect(() => {
    session.save(board);
  }, [board, session]);

  useEffect(() => listenForBoardChanges(session, window), [session]);

  function retrySave() {
    session.retrySave(board);
  }
  function restore(restored: Board | null) {
    if (restored) apply({ type: "RESTORE_PERSISTED_BOARD", board: restored });
  }

  return [board, dispatch, { notice, recovery, retrySave,
    retryRead: () => restore(session.retryRead()),
    replaceStoredBoard: () => restore(session.replaceStoredBoard()),
    repairOrder: () => restore(session.repairOrder(board)),
    initializeManual: () => {
      const initialized = session.initializeManual(board);
      restore(initialized);
      return initialized !== null;
    },
  }] as const;
}
