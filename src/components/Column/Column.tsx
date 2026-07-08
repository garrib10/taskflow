import type { Column as ColumnType } from "../../domain/board/Board";
import TaskCard from "../TaskCard/TaskCard";

interface ColumnProps {
  column: ColumnType;
}

export default function Column({ column }: ColumnProps) {
  return (
    <div className="column">
      <h2>{column.title}</h2>

      {column.tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
