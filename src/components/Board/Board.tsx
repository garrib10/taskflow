import { DndContext, type DragEndEvent } from "@dnd-kit/core";

import type { Board as BoardType } from "../../domain/board/Board";
import type { TaskStatus } from "../../domain/task/Task";
import type { BoardAction } from "../../hooks/useBoardReducer";

import Column from "../Column/Column";

interface BoardProps {
  board: BoardType;
  dispatch: React.Dispatch<BoardAction>;
}

export default function Board({ board, dispatch }: BoardProps) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const taskId = active.id.toString();
    const newStatus = over.id.toString() as TaskStatus;

    const currentStatus = board.columns
      .flatMap((column) => column.tasks)
      .find((task) => task.id === taskId)?.status;

    if (!currentStatus || currentStatus === newStatus) {
      return;
    }

    dispatch({
      type: "MOVE_TASK",
      taskId,
      newStatus,
    });
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div>
        <h1>{board.name}</h1>

        <div className="board">
          {board.columns.map((column) => (
            <Column key={column.id} column={column} />
          ))}
        </div>
      </div>
    </DndContext>
  );
}
