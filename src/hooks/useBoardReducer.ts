import { useEffect, useReducer } from "react";
import type { Board } from "../domain/board/Board";
import type { Task, TaskStatus } from "../domain/task/Task";
import { moveTask } from "../domain/task/taskActions";
import { initialBoard } from "../utils/mockData";
import { loadBoard, saveBoard } from "../utils/storage";

export type BoardAction =
  | {
      type: "MOVE_TASK";
      taskId: string;
      newStatus: TaskStatus;
    }
  | {
      type: "CREATE_TASK";
      task: Task;
    }
  | {
      type: "UPDATE_TASK";
      task: Task;
    };

function boardReducer(state: Board, action: BoardAction): Board {
  switch (action.type) {
    case "CREATE_TASK": {
      return {
        ...state,
        columns: state.columns.map((column) =>
          column.id === "todo"
            ? {
                ...column,
                tasks: [...column.tasks, action.task],
              }
            : column,
        ),
      };
    }

    case "UPDATE_TASK": {
      return {
        ...state,
        columns: state.columns.map((column) => ({
          ...column,
          tasks: column.tasks.map((task) =>
            task.id === action.task.id ? action.task : task,
          ),
        })),
      };
    }

    case "MOVE_TASK": {
      let movedTask: Task | null = null;
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

      if (!movedTask) {
        return state;
      }

      const updatedTask = moveTask(movedTask, action.newStatus);

      if (!updatedTask) {
        return state;
      }

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
