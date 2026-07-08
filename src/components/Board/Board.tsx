import type { Board as BoardType } from "../../domain/board/Board";
import Column from "../Column/Column";

interface BoardProps {
  board: BoardType;
}

export default function Board({ board }: BoardProps) {
  return (
    <div>
      <h1>{board.name}</h1>

      <div className="board">
        {board.columns.map((column) => (
          <Column key={column.id} column={column} />
        ))}
      </div>
    </div>
  );
}
