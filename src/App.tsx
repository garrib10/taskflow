import "./styles/controls.css";
import { useLayoutEffect, useRef, useState } from "react";
import Board from "./components/Board/Board";
import ConfirmModal from "./components/ConfirmModal/ConfirmModal";
import Notification from "./components/Notification/Notification";
import { useNotification } from "./notifications/useNotification";
import { useBoardReducer } from "./hooks/useBoardReducer";
import { recoveryDiagnostic } from "./persistence/session";
import Button from "./components/ui/Button/Button";

function App() {
  const [board, dispatch, persistence] = useBoardReducer();
  const [confirmation, setConfirmation] = useState<"reload" | "retry-read" | "replace" | "repair" | null>(null);
  const notice = persistence.notice;
  const recovery = persistence.recovery;
  const { notification, dismiss } = useNotification(notice);
  const retryTrigger = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    const trigger = retryTrigger.current;
    retryTrigger.current = null;
    if (trigger && !trigger.isConnected) document.querySelector<HTMLElement>("[data-focus-fallback]")?.focus();
  }, [notice]);

  return <Board board={board} dispatch={dispatch} feedback={<>
    {notification && <Notification key={notification.id} notification={notification} onClose={() => dismiss(notification.id)} />}
    {recovery.kind !== "ready" && (
      <section className="board-storage" aria-label="Board storage">
        <p>{notice?.message}</p>
        {notice?.recovery === "retry" && <button type="button" className="edit-task-button" onClick={event => { retryTrigger.current = event.currentTarget; persistence.retrySave(); }}>Retry saving</button>}
        {recovery.kind === "read-failed" && <Button variant="secondary" onClick={() => setConfirmation("retry-read")}>Retry reading saved board</Button>}
        {recovery.kind === "order-recovery" && <Button variant="secondary" onClick={() => setConfirmation("repair")}>Repair saved order</Button>}
        {(recovery.kind === "invalid" || recovery.kind === "migration-failed" || recovery.kind === "future") && <Button variant="danger" onClick={() => setConfirmation("replace")}>Replace saved board</Button>}
        <button type="button" className="edit-task-button" onClick={() => setConfirmation("reload")}>Reload saved board</button>
        <details><summary>Troubleshooting details</summary><p>{recoveryDiagnostic(recovery)}</p></details>
      </section>
    )}
    </>} overlays={<>
    {confirmation === "reload" && <ConfirmModal title="Reload Saved Board?"
      message="Reloading discards unsaved work in this tab and tries to restore the saved board. The stored data will not be cleared."
      confirmText="Reload Saved Board" onCancel={() => setConfirmation(null)} onConfirm={() => window.location.reload()} />}
    {confirmation === "retry-read" && <ConfirmModal title="Retry Reading Saved Board?"
      message="If the saved board can be restored, it will replace unsaved work in this tab. Your saved data will not be cleared."
      confirmText="Retry Reading" confirmVariant="primary" onCancel={() => setConfirmation(null)} onConfirm={() => {
        retryTrigger.current = document.querySelector<HTMLButtonElement>('.board-storage button');
        setConfirmation(null); persistence.retryRead();
      }} />}
    {confirmation === "replace" && <ConfirmModal title="Replace Saved Board?"
      message={`This replaces this TaskFlow board's saved tasks in this browser with the starter board and discards unsaved work in this tab. It cannot be undone. Other preferences will be kept.${recovery.kind === "future" ? " Use the newer TaskFlow version instead to keep your saved work." : ""}`}
      confirmText="Replace Saved Board" onCancel={() => setConfirmation(null)} onConfirm={() => {
        retryTrigger.current = document.querySelector<HTMLButtonElement>('.board-storage button');
        setConfirmation(null); persistence.replaceStoredBoard();
      }} />}
    {confirmation === "repair" && <ConfirmModal title="Repair Saved Order?"
      message="Rebuild damaged task order using Priority order. Tasks, relationships and valid saved order will be kept. Changes made in this tab will also be saved."
      confirmText="Repair Saved Order" confirmVariant="primary" onCancel={() => setConfirmation(null)} onConfirm={() => {
        retryTrigger.current = document.querySelector<HTMLButtonElement>('.board-storage button');
        setConfirmation(null); persistence.repairOrder();
      }} />}
  </>} />;
}
export default App;
