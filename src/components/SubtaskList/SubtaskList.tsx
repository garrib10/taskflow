import { useState } from "react";
import type { Task } from "../../domain/task/Task";
import type { BoardAction } from "../../hooks/useBoardReducer";
import SubtaskItem from "../SubtaskItem/SubtaskItem";

interface SubtaskListProps {
  task: Task;
  dispatch: React.Dispatch<BoardAction>;
}

export default function SubtaskList({ task, dispatch }: SubtaskListProps) {
  const [newSubtask, setNewSubtask] = useState("");

  const subtasks = task.subtasks ?? [];

  function handleAddSubtask() {
    const trimmedSubtask = newSubtask.trim();

    if (!trimmedSubtask) {
      return;
    }

    dispatch({
      type: "ADD_SUBTASK",
      taskId: task.id,
      title: trimmedSubtask,
    });

    setNewSubtask("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Prevent drag behavior while typing
    event.stopPropagation();

    if (event.key === "Enter") {
      handleAddSubtask();
    }
  }

  return (
    <div
      className="subtask-list"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {subtasks.length > 0 ? (
        subtasks.map((subtask) => (
          <SubtaskItem
            key={subtask.id}
            taskId={task.id}
            subtask={subtask}
            dispatch={dispatch}
          />
        ))
      ) : (
        <p className="no-subtasks">No subtasks yet.</p>
      )}

      <div className="subtask-input-container">
        <input
          type="text"
          placeholder="Add subtask..."
          value={newSubtask}
          onChange={(event) => setNewSubtask(event.target.value)}
          onKeyDown={handleKeyDown}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        />

        <button
          className="add-subtask-button"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            handleAddSubtask();
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
