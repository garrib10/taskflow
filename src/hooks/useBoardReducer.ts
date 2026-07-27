import { useEffect, useReducer } from "react";
import type { Board } from "../domain/board/Board";
import type { Task, TaskStatus } from "../domain/task/Task";
import {
  createSubtask,
  moveTask,
  toggleSubtask,
  deleteSubtask,
} from "../domain/task/taskActions";
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
    }
  | {
      type: "DELETE_TASK";
      taskId: string;
    }
  | {
      type: "ADD_SUBTASK";
      taskId: string;
      title: string;
    }
  | {
      type: "TOGGLE_SUBTASK";
      taskId: string;
      subtaskId: string;
    }
  | {
      type: "DELETE_SUBTASK";
      taskId: string;
      subtaskId: string;
    };

function withUpdatedTimestamp(board: Board): Board {
  return {
    ...board,
    lastUpdated: new Date(),
  };
}

function boardReducer(state: Board, action: BoardAction): Board {
  switch (action.type) {
    case "CREATE_TASK": {
      const updatedBoard: Board = {
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

      return withUpdatedTimestamp(updatedBoard);
    }

    case "UPDATE_TASK": {
      const taskExists = state.columns.some((column) =>
        column.tasks.some((task) => task.id === action.task.id),
      );

      if (!taskExists) {
        return state;
      }

      const updatedBoard: Board = {
        ...state,
        columns: state.columns.map((column) => ({
          ...column,
          tasks: column.tasks.map((task) =>
            task.id === action.task.id ? action.task : task,
          ),
        })),
      };

      return withUpdatedTimestamp(updatedBoard);
    }

    case "DELETE_TASK": {
      const taskExists = state.columns.some((column) =>
        column.tasks.some((task) => task.id === action.taskId),
      );

      if (!taskExists) {
        return state;
      }

      const updatedBoard: Board = {
        ...state,
        columns: state.columns.map((column) => ({
          ...column,
          tasks: column.tasks.filter((task) => task.id !== action.taskId),
        })),
      };

      return withUpdatedTimestamp(updatedBoard);
    }

    case "ADD_SUBTASK": {
      const taskExists = state.columns.some((column) =>
        column.tasks.some((task) => task.id === action.taskId),
      );

      if (!taskExists) {
        return state;
      }

      const updatedBoard: Board = {
        ...state,
        columns: state.columns.map((column) => ({
          ...column,
          tasks: column.tasks.map((task) =>
            task.id === action.taskId
              ? {
                  ...task,
                  subtasks: [
                    ...(task.subtasks ?? []),
                    createSubtask(action.title),
                  ],
                }
              : task,
          ),
        })),
      };

      return withUpdatedTimestamp(updatedBoard);
    }

    case "TOGGLE_SUBTASK": {
      const subtaskExists = state.columns.some((column) =>
        column.tasks.some(
          (task) =>
            task.id === action.taskId &&
            (task.subtasks ?? []).some(
              (subtask) => subtask.id === action.subtaskId,
            ),
        ),
      );

      if (!subtaskExists) {
        return state;
      }

      const updatedBoard: Board = {
        ...state,
        columns: state.columns.map((column) => ({
          ...column,
          tasks: column.tasks.map((task) =>
            task.id === action.taskId
              ? {
                  ...task,
                  subtasks: (task.subtasks ?? []).map((subtask) =>
                    subtask.id === action.subtaskId
                      ? toggleSubtask(subtask)
                      : subtask,
                  ),
                }
              : task,
          ),
        })),
      };

      return withUpdatedTimestamp(updatedBoard);
    }

    case "DELETE_SUBTASK": {
      const subtaskExists = state.columns.some((column) =>
        column.tasks.some(
          (task) =>
            task.id === action.taskId &&
            (task.subtasks ?? []).some(
              (subtask) => subtask.id === action.subtaskId,
            ),
        ),
      );

      if (!subtaskExists) {
        return state;
      }

      const updatedBoard: Board = {
        ...state,
        columns: state.columns.map((column) => ({
          ...column,
          tasks: column.tasks.map((task) =>
            task.id === action.taskId
              ? deleteSubtask(task, action.subtaskId)
              : task,
          ),
        })),
      };

      return withUpdatedTimestamp(updatedBoard);
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

      const updatedBoard: Board = {
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

      return withUpdatedTimestamp(updatedBoard);
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
