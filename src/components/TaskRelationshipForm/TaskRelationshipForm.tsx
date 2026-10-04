import "../../styles/task-dialog.css";
import { useEffect, useState } from "react";
import type { Board } from "../../domain/board/Board";
import type { Task } from "../../domain/task/Task";
import type { BoardAction } from "../../domain/board/boardReducer";
import { validateParentAssignment, type BoardOperationError } from "../../domain/board/boardValidation";

interface TaskRelationshipFormProps {
  board: Board;
  task: Task;
  dispatch: (action: BoardAction) => BoardOperationError | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function TaskRelationshipForm({
  board, task, dispatch, onClose, onSuccess,
}: TaskRelationshipFormProps) {
  const [parentId, setParentId] = useState(task.parentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const candidates = board.columns.flatMap((column) => column.tasks)
    .filter((candidate) => !validateParentAssignment(board, task, candidate.id));

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const failure = dispatch({ type: "SET_PARENT", taskId: task.id, parentId: parentId || null, updatedAt: new Date() });
    if (failure) {
      setError(failure.message);
      return;
    }
    onSuccess(parentId ? "Parent relationship updated." : "Child detached as an independent task.");
    onClose();
  }

  return (
    <div className="create-task-modal parent-child-form" role="dialog" aria-modal="true" aria-labelledby="relationship-title">
      <form onSubmit={handleSubmit}>
        <h2 id="relationship-title">Manage Parent</h2>
        <p>Task: {task.title}</p>
        <p>Detaching keeps the task and all its work. A child can have one parent.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label htmlFor="task-parent">Parent</label>
        <select id="task-parent" autoFocus value={parentId} onChange={(event) => setParentId(event.target.value)}>
          <option value="">No parent (independent task)</option>
          {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
        </select>
        <div className="create-task-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={parentId === (task.parentId ?? "")}>Save Relationship</button>
        </div>
      </form>
    </div>
  );
}
