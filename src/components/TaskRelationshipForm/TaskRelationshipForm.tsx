import "../../styles/task-dialog.css";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { Board } from "../../domain/board/Board";
import type { Task } from "../../domain/task/Task";
import type { BoardAction } from "../../domain/board/boardReducer";
import { validateParentAssignment, type BoardOperationError } from "../../domain/board/boardValidation";

import { useModalFocus } from "../../accessibility/useModalFocus";

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

  const id = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose);
  useLayoutEffect(() => { if (error) document.getElementById(`${id}-parent`)?.focus(); }, [error, id]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const failure = dispatch({ type: "SET_PARENT", taskId: task.id, parentId: parentId || null, updatedAt: new Date() });
    if (failure) {
      setError(failure.message);
      return;
    }
    onSuccess(parentId ? `Updated parent of "${task.title}" to "${candidates.find(candidate => candidate.id === parentId)?.title}".` : `Detached "${task.title}" as an independent task.`);
    onClose();
  }

  return (
    <div ref={dialogRef} tabIndex={-1} className="create-task-modal parent-child-form" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-task ${id}-description`}>
      <form onSubmit={handleSubmit}>
        <h2 id={`${id}-title`}>Manage Parent</h2>
        <p id={`${id}-task`}>Task: {task.title}</p>
        <p id={`${id}-description`}>Detaching keeps the task and all its work. A child can have one parent.</p>
        {error && <p id={`${id}-error`} className="form-error">{error}</p>}
        <label htmlFor={`${id}-parent`}>Parent</label>
        <select id={`${id}-parent`} data-initial-focus aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : `${id}-description`} value={parentId} onChange={(event) => setParentId(event.target.value)}>
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
