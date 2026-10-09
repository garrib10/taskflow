import type { Subtask } from "../../domain/task/Task";
import type { BoardAction } from "../../domain/board/boardReducer";

interface SubtaskItemProps {
  taskId: string;
  subtask: Subtask;
  dispatch: React.Dispatch<BoardAction>;
}

export default function SubtaskItem({
  taskId,
  subtask,
  dispatch,
}: SubtaskItemProps) {
  function handleToggle() {
    dispatch({
      type: "TOGGLE_SUBTASK",
      taskId,
      subtaskId: subtask.id,
      updatedAt: new Date(),
    });
  }

  function handleDelete() {
    dispatch({
      type: "DELETE_SUBTASK",
      taskId,
      subtaskId: subtask.id,
      updatedAt: new Date(),
    });
  }

  return (
    <div className="subtask-item">
      <label htmlFor={`subtask-${taskId}-${subtask.id}`} className="subtask-item-left">
        <input
          id={`subtask-${taskId}-${subtask.id}`}
          type="checkbox"
          checked={subtask.completed}
          onChange={handleToggle}
        />

        <span className={subtask.completed ? "completed" : ""}>
          {subtask.title}
        </span>
      </label>

      <button
        type="button"
        className="subtask-delete-button" aria-label={`Delete checklist item ${subtask.title}`}
        onClick={handleDelete}
      >
        Delete
      </button>
    </div>
  );
}
