import { useDroppable } from "@dnd-kit/core";
import type { Column as ColumnType } from "../../domain/board/Board";
import type { Task } from "../../domain/task/Task";
import type { BoardAction } from "../../hooks/useBoardReducer";
import { sortTasksByPriority } from "../../domain/task/taskPriority";
import TaskCard from "../TaskCard/TaskCard";

interface ColumnProps {
  column: ColumnType;
  dispatch: React.Dispatch<BoardAction>;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  isSearching: boolean;
}

export default function Column({
  column,
  dispatch,
  onEdit,
  onDelete,
  isSearching,
}: ColumnProps) {
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
        <div className="empty-column">
          {isSearching ? "No matching tasks" : "No tasks"}
        </div>
      ) : (
        sortedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            dispatch={dispatch}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
}
