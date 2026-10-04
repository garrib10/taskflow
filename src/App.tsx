import "./styles/controls.css";
import { useState } from "react";
import Board from "./components/Board/Board";
import ConfirmModal from "./components/ConfirmModal/ConfirmModal";
import Notification from "./components/Notification/Notification";
import { useBoardReducer } from "./hooks/useBoardReducer";

function App() {
  const [board, dispatch, persistence] = useBoardReducer();
  const [showReload, setShowReload] = useState(false);
  const [dismissedNotice, setDismissedNotice] = useState<typeof persistence.notice>(null);
  const notice = persistence.notice;

  return <main>
    {notice && notice !== dismissedNotice && <Notification message={notice.message} type={notice.type} onClose={() => setDismissedNotice(notice)} />}
    {notice?.type === "error" && (
      <section className="board-controls" aria-label="Board storage">
        <p>{notice.message}</p>
        {notice.canRetry && <button type="button" className="edit-task-button" onClick={persistence.retrySave}>Retry saving</button>}
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
