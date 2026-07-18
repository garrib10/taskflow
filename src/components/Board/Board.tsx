import { useEffect, useRef, useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";

import type { Board as BoardType } from "../../domain/board/Board";
import type { TaskStatus } from "../../domain/task/Task";
import type { BoardAction } from "../../hooks/useBoardReducer";

import { canMoveTask, getMoveErrorMessage } from "../../domain/task/taskRules";

import Column from "../Column/Column";
import Notification from "../Notification/Notification";

interface BoardProps {
  board: BoardType;
  dispatch: React.Dispatch<BoardAction>;
}

export default function Board({ board, dispatch }: BoardProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const errorTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
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

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="board-container">
        {errorMessage && <Notification message={errorMessage} />}

        <div className="board-header">
          <h1>TaskFlow</h1>
          <p>Rule-Based Workflow Board</p>
        </div>

        <div className="board">
          {board.columns.map((column) => (
            <Column key={column.id} column={column} />
          ))}
        </div>
      </div>
    </DndContext>
  );
}
