import "./Column.css";
import { useDroppable } from "@dnd-kit/core";
import type { Column as ColumnType } from "../../domain/board/Board";
import type { Board } from "../../domain/board/Board";
import type { Task } from "../../domain/task/Task";
import type { BoardAction } from "../../domain/board/boardReducer";
import { selectOrderedTasks, type OrderingMode, type TaskPlacement } from "../../domain/board/boardOrdering";
import Button from "../ui/Button/Button";
import TaskCard from "../TaskCard/TaskCard";

interface ColumnProps {
  column: ColumnType;
  board: Board;
  dispatch: React.Dispatch<BoardAction>;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  isFiltering: boolean;
  orderingMode?: OrderingMode;
  onReorder?: (task: Task, placement: TaskPlacement) => void;
}

export default function Column({
  column,
  board,
  dispatch,
  onEdit,
  onDelete,
  isFiltering,
  orderingMode = "priority",
  onReorder,
}: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const fullColumn = board.columns.find(full => full.id === column.id) ?? column;
  const sortedTasks = selectOrderedTasks(fullColumn, orderingMode, column.tasks.map(task => task.id)).tasks;

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
        sortedTasks.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            board={board}
            dispatch={dispatch}
            onEdit={onEdit}
            onDelete={onDelete}
            orderingActions={orderingMode === "manual" && onReorder && <div className="task-order-actions">
              <Button variant="secondary" aria-label={`Move ${task.title} earlier`} disabled={isFiltering || index === 0} onClick={() => { const previous = sortedTasks[index - 1]; if (previous) onReorder(task, { type: "before", taskId: previous.id }); }}>Move earlier</Button>
              <Button variant="secondary" aria-label={`Move ${task.title} later`} disabled={isFiltering || index === sortedTasks.length - 1} onClick={() => { const next = sortedTasks[index + 1]; if (next) onReorder(task, { type: "after", taskId: next.id }); }}>Move later</Button>
              {isFiltering && <p>Clear search and filters to reorder tasks.</p>}
            </div>}
          />
        ))
      )}
    </section>
  );
}
