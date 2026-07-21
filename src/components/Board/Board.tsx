import { useEffect, useRef, useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import type { Board as BoardType } from "../../domain/board/Board";
import type { Task, TaskStatus } from "../../domain/task/Task";
import type { BoardAction } from "../../hooks/useBoardReducer";
import { canMoveTask, getMoveErrorMessage } from "../../domain/task/taskRules";
import Column from "../Column/Column";
import Notification from "../Notification/Notification";
import TaskForm from "../TaskForm/TaskForm";

interface BoardProps {
  board: BoardType;
  dispatch: React.Dispatch<BoardAction>;
}

export default function Board({ board, dispatch }: BoardProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }

      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const taskId = active.id.toString();
    const newStatus = over.id.toString() as TaskStatus;

    const currentTask = board.columns
      .flatMap((column) => column.tasks)
      .find((task) => task.id === taskId);

    if (!currentTask) {
      return;
    }

    if (currentTask.status === newStatus) {
      return;
    }

    if (!canMoveTask(currentTask.status, newStatus)) {
      setSuccessMessage(null);
      setErrorMessage(getMoveErrorMessage(currentTask.status, newStatus));

      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }

      errorTimeoutRef.current = window.setTimeout(() => {
        setErrorMessage(null);
      }, 3000);

      return;
    }

    dispatch({
      type: "MOVE_TASK",
      taskId,
      newStatus,
    });

    setErrorMessage(null);
  }

  function handleCreateTask() {
    setTaskToEdit(null);
    setShowTaskForm(true);
  }

  function handleEditTask(task: Task) {
    setTaskToEdit(task);
    setShowTaskForm(true);
  }

  function handleCloseTaskForm() {
    setTaskToEdit(null);
    setShowTaskForm(false);
  }

  function handleTaskSaved(message: string) {
    setErrorMessage(null);
    setSuccessMessage(message);

    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }

    successTimeoutRef.current = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="board-container">
        {errorMessage && <Notification message={errorMessage} type="error" />}

        {successMessage && (
          <Notification message={successMessage} type="success" />
        )}

        <div className="board-header">
          <div>
            <h1>TaskFlow</h1>
            <p>Rule-Based Workflow Board</p>
          </div>

          <button className="create-task-button" onClick={handleCreateTask}>
            + Create Task
          </button>
        </div>

        {showTaskForm && (
          <TaskForm
            task={taskToEdit}
            onClose={handleCloseTaskForm}
            dispatch={dispatch}
            onSuccess={handleTaskSaved}
          />
        )}

        <div className="board">
          {board.columns.map((column) => (
            <Column key={column.id} column={column} onEdit={handleEditTask} />
          ))}
        </div>
      </div>
    </DndContext>
  );
}
