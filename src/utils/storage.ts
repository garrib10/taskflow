import type { Board } from "../domain/board/Board";

const STORAGE_KEY = "taskflow-board";

/**
 * Saves the current board to localStorage.
 */
export function saveBoard(board: Board): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
}

/**
 * Loads the saved board from localStorage.
 * Restores serialized date strings as Date objects.
 * Returns null if no valid saved board exists.
 */
export function loadBoard(): Board | null {
  const savedBoard = localStorage.getItem(STORAGE_KEY);

  if (!savedBoard) {
    return null;
  }

  try {
    const parsedBoard = JSON.parse(savedBoard) as Board;

    return {
      ...parsedBoard,

      // Supports older saved boards that do not yet contain lastUpdated.
      lastUpdated: parsedBoard.lastUpdated
        ? new Date(parsedBoard.lastUpdated)
        : new Date(),

      columns: parsedBoard.columns.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          subtasks: task.subtasks ?? [],
        })),
      })),
    };
  } catch (error) {
    console.error("Unable to load the saved TaskFlow board.", error);
    return null;
  }
}
