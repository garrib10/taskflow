import type { Board } from "../domain/board/Board";

const STORAGE_KEY = "taskflow-board";

/**
 *  Saves the current board to localStorage.
 */
export function saveBoard(board: Board): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
}

/**
 * Loads the saved board from localStorage.
 * Returns null if no saved board exists.
 */
export function loadBoard(): Board | null {
  const savedBoard = localStorage.getItem(STORAGE_KEY);

  if (!savedBoard) {
    return null;
  }

  return JSON.parse(savedBoard) as Board;
}
