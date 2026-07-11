import { useDroppable } from "@dnd-kit/core";

import type { Column as ColumnType } from "../../domain/board/Board";
import TaskCard from "../TaskCard/TaskCard";

interface ColumnProps {
  column: ColumnType;
}

export default function Column({ column }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div ref={setNodeRef} className="column">
      <h2>{column.title}</h2>

      {column.tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
