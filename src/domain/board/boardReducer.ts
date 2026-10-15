import type { Board } from "./Board";
import type { Subtask, Task, TaskEdits, TaskStatus } from "../task/Task";
import { deleteSubtask, moveTask, toggleSubtask, updateTask } from "../task/taskActions";
import { normalizeManualOrder, placeTask, destinationPlacement, removeManualTask, type OrderingAction, type MovementOrdering } from "./boardOrdering";
import { validateBoardAction } from "./boardValidation";

export type BoardAction = (
  | OrderingAction
  | { type: "CREATE_TASK"; task: Task }
  | { type: "CREATE_CHILD_TASK"; parentId: string; task: Task }
  | { type: "SET_PARENT"; taskId: string; parentId: string | null }
  | { type: "DELETE_PARENT_TASK"; taskId: string }
  | { type: "UPDATE_TASK"; taskId: string; edits: TaskEdits }
  | { type: "DELETE_TASK"; taskId: string }
  | { type: "MOVE_TASK"; taskId: string; newStatus: TaskStatus; ordering?: MovementOrdering }
  | { type: "ADD_SUBTASK"; taskId: string; subtask: Subtask }
  | { type: "TOGGLE_SUBTASK"; taskId: string; subtaskId: string }
  | { type: "DELETE_SUBTASK"; taskId: string; subtaskId: string }
) & { updatedAt: Date };

export function boardReducer(state: Board, action: BoardAction): Board {
  if (validateBoardAction(state, action)) return state;

  if (action.type === "INITIALIZE_MANUAL_ORDER" || action.type === "REPAIR_MANUAL_ORDER") {
    const columns = state.columns.map(column => action.type === "INITIALIZE_MANUAL_ORDER" || column.id === action.status
      ? normalizeManualOrder(column) : column);
    return columns.every((column, index) => column === state.columns[index]) ? state : { ...state, columns, lastUpdated: action.updatedAt };
  }
  if (action.type === "REORDER_TASK") {
    const source = state.columns.find(column => column.tasks.some(task => task.id === action.taskId));
    if (!source?.manualOrder) return state;
    const manualOrder = placeTask(source.manualOrder, action.taskId, action.placement);
    if (manualOrder.every((id, index) => id === source.manualOrder?.[index])) return state;
    return { ...state, lastUpdated: action.updatedAt, columns: state.columns.map(column => column === source ? { ...column, manualOrder } : column) };
  }

  if (action.type === "CREATE_TASK" || action.type === "CREATE_CHILD_TASK") {
    const destination = state.columns.find((column) => column.id === "todo");
    const duplicate = state.columns.some((column) =>
      column.tasks.some((task) => task.id === action.task.id),
    );
    if (!destination || duplicate || action.task.status !== "todo") return state;
    const task = action.type === "CREATE_CHILD_TASK"
      ? { ...action.task, parentId: action.parentId }
      : action.task;
    return {
      ...state,
      lastUpdated: action.updatedAt,
      columns: state.columns.map((column) =>
        column === destination
          ? { ...column, tasks: [...column.tasks, task], ...(column.manualOrder === undefined ? {} : { manualOrder: [task.id, ...column.manualOrder] }) }
          : column,
      ),
    };
  }

  const source = state.columns.find((column) =>
    column.tasks.some((task) => task.id === action.taskId),
  );
  const currentTask = source?.tasks.find((task) => task.id === action.taskId);
  if (!source || !currentTask) return state;

  if (action.type === "DELETE_PARENT_TASK") {
    return {
      ...state,
      lastUpdated: action.updatedAt,
      columns: state.columns.map((column) => ({
        ...column,
        ...removeManualTask(column, action.taskId),
        tasks: column.tasks
          .filter((task) => task.id !== action.taskId)
          .map((task) => task.parentId === action.taskId
            ? { ...task, parentId: undefined }
            : task),
      })),
    };
  }

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
          return { ...column, ...removeManualTask(column, currentTask.id), tasks: column.tasks.filter((task) => task.id !== currentTask.id) };
        }
        if (column === destination) {
          return { ...column, tasks: [...column.tasks, updatedTask], ...(column.manualOrder === undefined ? {} : { manualOrder: placeTask(column.manualOrder, currentTask.id, destinationPlacement(action.ordering)) }) };
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
          ? { ...column, ...removeManualTask(column, currentTask.id), tasks: column.tasks.filter((task) => task.id !== currentTask.id) }
          : column,
      ),
    };
  }

  let updatedTask: Task;
  switch (action.type) {
    case "SET_PARENT":
      updatedTask = { ...currentTask, parentId: action.parentId ?? undefined };
      break;
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
