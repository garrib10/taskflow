import type { Subtask } from "../../domain/task/Task";
import type { BoardAction } from "../../hooks/useBoardReducer";

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
    });
  }

  function handleDelete() {
    dispatch({
      type: "DELETE_SUBTASK",
      taskId,
      subtaskId: subtask.id,
    });
  }

  return (
    <div className="subtask-item">
      <label>
        <input
          type="checkbox"
          checked={subtask.completed}
          onChange={handleToggle}
        />

        <span className={subtask.completed ? "completed" : ""}>
          {subtask.title}
        </span>
      </label>

      <button className="subtask-delete-button" onClick={handleDelete}>
        Delete
      </button>
    </div>
  );
}
