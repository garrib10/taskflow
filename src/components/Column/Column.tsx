import { useDroppable } from "@dnd-kit/core";
import type { Column as ColumnType } from "../../domain/board/Board";
import type { Task } from "../../domain/task/Task";
import { sortTasksByPriority } from "../../domain/task/taskPriority";
import TaskCard from "../TaskCard/TaskCard";

interface ColumnProps {
  column: ColumnType;
  onEdit: (task: Task) => void;
}

export default function Column({ column, onEdit }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const sortedTasks = sortTasksByPriority(column.tasks);

  return (
    <div ref={setNodeRef} className="column">
      <div className="column-header">
        <h2>
          {column.title} ({column.tasks.length})
        </h2>
      </div>

      {sortedTasks.length === 0 ? (
        <div className="empty-column">No tasks</div>
      ) : (
        sortedTasks.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            isTopPriority={column.id !== "done" && index === 0}
            onEdit={onEdit}
          />
        ))
      )}
    </div>
  );
}
