import "../../styles/task-dialog.css";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { Board } from "../../domain/board/Board";
import type { Task } from "../../domain/task/Task";
import type { BoardAction } from "../../domain/board/boardReducer";
import { validateParentAssignment, type BoardOperationError } from "../../domain/board/boardValidation";

import Notification from "../Notification/Notification";
import { useNotification } from "../../notifications/useNotification";
import { operationVariant } from "../../notifications/notification";
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
  const { notification, show, dismiss } = useNotification();
  const candidates = board.columns.flatMap((column) => column.tasks)
    .filter((candidate) => !validateParentAssignment(board, task, candidate.id));

  const id = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose);
  useLayoutEffect(() => { if (notification) document.getElementById(`${id}-parent`)?.focus(); }, [notification, id]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const failure = dispatch({ type: "SET_PARENT", taskId: task.id, parentId: parentId || null, updatedAt: new Date() });
    if (failure) {
      show(operationVariant(failure), failure.message);
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
        <p id={`${id}-description`}>Detaching keeps the task and all its work. A subtask can have one parent.</p>
        {notification && <Notification key={notification.id} notification={notification}
          messageId={`${id}-error`} announce={false} onClose={() => dismiss(notification.id)}
          onFocusLost={() => document.getElementById(`${id}-parent`)?.focus()} />}
        <label htmlFor={`${id}-parent`}>Parent</label>
        <select id={`${id}-parent`} data-initial-focus aria-invalid={!!notification || undefined} aria-describedby={notification ? `${id}-error` : `${id}-description`} value={parentId} onChange={(event) => setParentId(event.target.value)}>
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
