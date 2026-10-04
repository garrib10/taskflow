import "./styles/controls.css";
import { useLayoutEffect, useRef, useState } from "react";
import Board from "./components/Board/Board";
import ConfirmModal from "./components/ConfirmModal/ConfirmModal";
import Notification from "./components/Notification/Notification";
import { useNotification } from "./notifications/useNotification";
import { useBoardReducer } from "./hooks/useBoardReducer";

function App() {
  const [board, dispatch, persistence] = useBoardReducer();
  const [showReload, setShowReload] = useState(false);
  const notice = persistence.notice;
  const { notification, dismiss } = useNotification(notice);
  const retryTrigger = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    const trigger = retryTrigger.current;
    retryTrigger.current = null;
    if (trigger && !trigger.isConnected) document.querySelector<HTMLElement>("[data-focus-fallback]")?.focus();
  }, [notice]);

  return <main>
    {notification && <Notification key={notification.id} notification={notification} onClose={() => dismiss(notification.id)} />}
    {notice?.recovery && (
      <section className="board-controls" aria-label="Board storage">
        <p>{notice.message}</p>
        {notice.recovery === "retry" && <button type="button" className="edit-task-button" onClick={event => { retryTrigger.current = event.currentTarget; persistence.retrySave(); }}>Retry saving</button>}
        <button type="button" className="edit-task-button" onClick={() => setShowReload(true)}>Reload saved board</button>
      </section>
    )}
    <Board board={board} dispatch={dispatch} />
    {showReload && <ConfirmModal title="Reload Saved Board?"
      message="Reloading discards unsaved work in this tab and tries to restore the saved board. The stored data will not be cleared."
      confirmText="Reload Saved Board" onCancel={() => setShowReload(false)} onConfirm={() => window.location.reload()} />}
  </main>;
}
export default App;
