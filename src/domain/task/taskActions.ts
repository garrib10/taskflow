import type { Task, Priority, TaskStatus, Subtask } from "./Task";
import type { TaskCategory } from "./taskCategory";
import { canMoveTask } from "./taskRules";

/**
 * Contains core task operations.
 * Handles creating, editing and updating workflow states.
 * Business rules are validated before changes are applied.
 */

export function createTask(
  title: string,
  description: string,
  priority: Priority,
  category: TaskCategory,
): Task {
  return {
    id: crypto.randomUUID(),
    title,
    description,
    priority,
    category,
    status: "todo",
    createdAt: new Date(),

    // New tasks begin with no subtasks
    subtasks: [],
  };
}

export function updateTask(
  task: Task,
  title: string,
  description: string,
  priority: Priority,
  category: TaskCategory,
): Task {
  return {
    ...task,
    title,
    description,
    priority,
    category,
  };
}

export function moveTask(task: Task, newStatus: TaskStatus): Task | null {
  if (!canMoveTask(task.status, newStatus)) {
    return null;
  }

  return {
    ...task,
    status: newStatus,
  };
}

/**
 * Creates a new subtask.
 */
export function createSubtask(title: string): Subtask {
  return {
    id: crypto.randomUUID(),
    title,
    completed: false,
  };
}

/**
 * Toggles a subtask's completion state.
 */
export function toggleSubtask(subtask: Subtask): Subtask {
  return {
    ...subtask,
    completed: !subtask.completed,
  };
}

/**
 * Removes a subtask from a task.
 */
export function deleteSubtask(task: Task, subtaskId: string): Task {
  return {
    ...task,
    subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId),
  };
}
