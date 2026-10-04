import { useEffect, useReducer } from "react";
import { boardReducer } from "../domain/board/boardReducer";
import { initialBoard } from "../utils/mockData";
import { loadBoard, saveBoard } from "../utils/storage";

export function useBoardReducer() {
  const startingBoard = loadBoard() ?? initialBoard;
  const [board, dispatch] = useReducer(boardReducer, startingBoard);

  useEffect(() => {
    saveBoard(board);
  }, [board]);

  return [board, dispatch] as const;
}
