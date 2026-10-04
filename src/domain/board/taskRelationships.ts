import type { Board } from "./Board";
import type { Task } from "../task/Task";

/** Ambiguous IDs cannot resolve a safe relationship. */
export function findTask(board: Board, taskId: string): Task | null {
  const matches = board.columns.flatMap((column) =>
    column.tasks.filter((task) => task.id === taskId),
  );
  return matches.length === 1 ? matches[0] ?? null : null;
}

export function getChildren(board: Board, parentId: string): Task[] {
  return board.columns.flatMap((column) =>
    column.tasks.filter((task) => task.parentId === parentId),
  );
}

export function getParent(board: Board, child: Task): Task | null {
  return child.parentId === undefined ? null : findTask(board, child.parentId);
}

export function getChildProgress(board: Board, parentId: string) {
  const children = getChildren(board, parentId);
  return {
    total: children.length,
    completed: children.filter((child) => child.status === "done").length,
  };
}
