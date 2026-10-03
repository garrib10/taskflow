import type { Board } from "./Board";
import type { Subtask, Task, TaskEdits, TaskStatus } from "../task/Task";
import { deleteSubtask, moveTask, toggleSubtask, updateTask } from "../task/taskActions";

export type BoardAction = (
  | { type: "CREATE_TASK"; task: Task }
  | { type: "UPDATE_TASK"; taskId: string; edits: TaskEdits }
  | { type: "DELETE_TASK"; taskId: string }
  | { type: "MOVE_TASK"; taskId: string; newStatus: TaskStatus }
  | { type: "ADD_SUBTASK"; taskId: string; subtask: Subtask }
  | { type: "TOGGLE_SUBTASK"; taskId: string; subtaskId: string }
  | { type: "DELETE_SUBTASK"; taskId: string; subtaskId: string }
) & { updatedAt: Date };

export function boardReducer(state: Board, action: BoardAction): Board {
  if (action.type === "CREATE_TASK") {
    const destination = state.columns.find((column) => column.id === "todo");
    const duplicate = state.columns.some((column) =>
      column.tasks.some((task) => task.id === action.task.id),
    );
    if (!destination || duplicate || action.task.status !== "todo") return state;
    return {
      ...state,
      lastUpdated: action.updatedAt,
      columns: state.columns.map((column) =>
        column === destination
          ? { ...column, tasks: [...column.tasks, action.task] }
          : column,
      ),
    };
  }

  const source = state.columns.find((column) =>
    column.tasks.some((task) => task.id === action.taskId),
  );
  const currentTask = source?.tasks.find((task) => task.id === action.taskId);
  if (!source || !currentTask) return state;

  if (action.type === "MOVE_TASK") {
    const destination = state.columns.find((column) => column.id === action.newStatus);
    const matches = state.columns.flatMap((column) =>
      column.tasks.filter((task) => task.id === action.taskId),
    );
    if (
      !destination || destination === source || currentTask.status !== source.id ||
      matches.length !== 1
    ) return state;
    const updatedTask = moveTask(currentTask, action.newStatus);
    if (!updatedTask) return state;

    return {
      ...state,
      lastUpdated: action.updatedAt,
      columns: state.columns.map((column) => {
        if (column === source) {
          return { ...column, tasks: column.tasks.filter((task) => task.id !== currentTask.id) };
        }
        if (column === destination) {
          return { ...column, tasks: [...column.tasks, updatedTask] };
        }
        return column;
      }),
    };
  }

  if (action.type === "DELETE_TASK") {
    return {
      ...state,
      lastUpdated: action.updatedAt,
      columns: state.columns.map((column) =>
        column === source
          ? { ...column, tasks: column.tasks.filter((task) => task.id !== currentTask.id) }
          : column,
      ),
    };
  }

  let updatedTask: Task;
  switch (action.type) {
    case "UPDATE_TASK":
      updatedTask = updateTask(currentTask, action.edits);
      break;
    case "ADD_SUBTASK": {
      const duplicate = state.columns.some((column) =>
        column.tasks.some((task) =>
          (task.subtasks ?? []).some((subtask) => subtask.id === action.subtask.id),
        ),
      );
      if (duplicate) return state;
      updatedTask = { ...currentTask, subtasks: [...(currentTask.subtasks ?? []), action.subtask] };
      break;
    }
    case "TOGGLE_SUBTASK":
    case "DELETE_SUBTASK": {
      const subtasks = currentTask.subtasks ?? [];
      if (!subtasks.some((subtask) => subtask.id === action.subtaskId)) return state;
      updatedTask = action.type === "DELETE_SUBTASK"
        ? deleteSubtask(currentTask, action.subtaskId)
        : {
            ...currentTask,
            subtasks: subtasks.map((subtask) =>
              subtask.id === action.subtaskId ? toggleSubtask(subtask) : subtask,
            ),
          };
      break;
    }
    default:
      return state;
  }

  return {
    ...state,
    lastUpdated: action.updatedAt,
    columns: state.columns.map((column) =>
      column === source
        ? {
            ...column,
            tasks: column.tasks.map((task) => task === currentTask ? updatedTask : task),
          }
        : column,
    ),
  };
}
