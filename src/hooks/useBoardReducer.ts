import { useEffect, useReducer } from "react";

import type { Board } from "../domain/board/Board";
import type { TaskStatus } from "../domain/task/Task";

import { moveTask } from "../domain/task/taskActions";
import { initialBoard } from "../utils/mockData";
import { loadBoard, saveBoard } from "../utils/storage";

type BoardAction = {
  type: "MOVE_TASK";
  taskId: string;
  newStatus: TaskStatus;
};

function boardReducer(state: Board, action: BoardAction): Board {
  switch (action.type) {
    case "MOVE_TASK":
      return {
        ...state,
        columns: state.columns.map((column) => ({
          ...column,
          tasks: column.tasks.map((task) =>
            task.id === action.taskId ? moveTask(task, action.newStatus) : task,
          ),
        })),
      };

    default:
      return state;
  }
}

export function useBoardReducer() {
  const startingBoard = loadBoard() ?? initialBoard;

  const [board, dispatch] = useReducer(boardReducer, startingBoard);

  useEffect(() => {
    saveBoard(board);
  }, [board]);

  return [board, dispatch] as const;
}
