import { useDraggable } from "@dnd-kit/core";
import type { Task } from "../../domain/task/Task";
import { priorityStyles } from "../../domain/task/priorityStyles";
import { categoryStyles } from "../../domain/task/categoryStyles";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export default function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
  });

  const dragStyle = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const priorityStyle = priorityStyles[task.priority];
  const categoryStyle = categoryStyles[task.category];

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={`task-card ${priorityStyle.borderClass}`}
      {...listeners}
      {...attributes}
    >
      <h3>{task.title}</h3>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-footer">
        <div className="task-meta">
          {task.status === "done" ? (
            <span className="completed-badge">✔ Done</span>
          ) : (
            <span className={priorityStyle.badgeClass}>
              {priorityStyle.icon} {priorityStyle.label}
            </span>
          )}

          <span className={`task-category ${categoryStyle.badgeClass}`}>
            {categoryStyle.label}
          </span>
        </div>

        <div className="task-actions">
          <button
            className="edit-task-button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(task);
            }}
          >
            Edit
          </button>

          <button
            className="delete-task-button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(task.id);
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
