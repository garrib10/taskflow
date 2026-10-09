import { useEffect, useReducer, useState, useSyncExternalStore } from "react";
import { boardReducer } from "../domain/board/boardReducer";
import { PersistenceSession, listenForBoardChanges } from "../persistence/session";

export function useBoardReducer() {
  // Hydrate once per mount, never on each render. Initialization does not write.
  const [session] = useState(() => new PersistenceSession());
  const [board, dispatch] = useReducer(boardReducer, session.board);
  const notice = useSyncExternalStore(session.subscribe, session.getSnapshot);

  useEffect(() => {
    session.save(board);
  }, [board, session]);

  useEffect(() => listenForBoardChanges(session, window), [session]);

  function retrySave() {
    session.save(board);
  }

  return [board, dispatch, { notice, retrySave }] as const;
}
