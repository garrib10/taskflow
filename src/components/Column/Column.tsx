import { useDroppable } from "@dnd-kit/core";

import type { Column as ColumnType } from "../../domain/board/Board";

import { sortTasksByPriority } from "../../domain/task/taskPriority";

import TaskCard from "../TaskCard/TaskCard";

interface ColumnProps {
  column: ColumnType;
}

export default function Column({ column }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const sortedTasks = sortTasksByPriority(column.tasks);

  return (
    <div ref={setNodeRef} className="column">
      <h2>{column.title}</h2>

      {sortedTasks.map((task, index) => (
        <TaskCard key={task.id} task={task} isTopPriority={index === 0} />
      ))}
    </div>
  );
}
