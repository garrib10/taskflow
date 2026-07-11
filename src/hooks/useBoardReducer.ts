import { useEffect, useReducer } from "react";

import type { Board } from "../domain/board/Board";
import type { TaskStatus } from "../domain/task/Task";

import { moveTask } from "../domain/task/taskActions";
import { initialBoard } from "../utils/mockData";
import { loadBoard, saveBoard } from "../utils/storage";

export type BoardAction = {
  type: "MOVE_TASK";
  taskId: string;
  newStatus: TaskStatus;
};

function boardReducer(state: Board, action: BoardAction): Board {
  switch (action.type) {
    case "MOVE_TASK": {
      let movedTask = null;

      // Remove task from its current column
      const columnsWithoutTask = state.columns.map((column) => ({
        ...column,
        tasks: column.tasks.filter((task) => {
          if (task.id === action.taskId) {
            movedTask = task;
            return false;
          }

          return true;
        }),
      }));

      // Task was not found
      if (!movedTask) {
        return state;
      }

      // Validate and update task status
      const updatedTask = moveTask(movedTask, action.newStatus);

      // Add task to the new column
      return {
        ...state,
        columns: columnsWithoutTask.map((column) =>
          column.id === action.newStatus
            ? {
                ...column,
                tasks: [...column.tasks, updatedTask],
              }
            : column,
        ),
      };
    }

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
