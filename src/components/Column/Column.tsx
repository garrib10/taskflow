import "./Column.css";
import { useDroppable } from "@dnd-kit/core";
import type { Column as ColumnType } from "../../domain/board/Board";
import type { Board } from "../../domain/board/Board";
import type { Task } from "../../domain/task/Task";
import type { BoardAction } from "../../domain/board/boardReducer";
import { sortTasksByPriority } from "../../domain/task/taskPriority";
import TaskCard from "../TaskCard/TaskCard";

interface ColumnProps {
  column: ColumnType;
  board: Board;
  dispatch: React.Dispatch<BoardAction>;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  isFiltering: boolean;
}

export default function Column({
  column,
  board,
  dispatch,
  onEdit,
  onDelete,
  isFiltering,
}: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const sortedTasks = sortTasksByPriority(column.tasks);

  return (
    <section ref={setNodeRef} className="column" aria-labelledby={`column-${column.id}-title`}>
      <div className="column-header">
        <h2 id={`column-${column.id}-title`} tabIndex={-1}>
          {column.title} ({column.tasks.length})
        </h2>
      </div>

      {sortedTasks.length === 0 ? (
        <div className="empty-column">
          {isFiltering ? "No matching tasks" : "No tasks"}
        </div>
      ) : (
        sortedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            board={board}
            dispatch={dispatch}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}
    </section>
  );
}
