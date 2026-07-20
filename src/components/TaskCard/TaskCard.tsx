import { useDraggable } from "@dnd-kit/core";
import type { Task } from "../../domain/task/Task";
import { getPriorityScore } from "../../domain/task/taskPriority";
import { priorityStyles } from "../../domain/task/priorityStyles";
import { categoryStyles } from "../../domain/task/categoryStyles";

interface TaskCardProps {
  task: Task;
  isTopPriority?: boolean;
}

export default function TaskCard({
  task,
  isTopPriority = false,
}: TaskCardProps) {
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
      className={`task-card ${priorityStyle.borderClass} ${
        isTopPriority ? "top-priority" : ""
      }`}
      {...listeners}
      {...attributes}
    >
      {isTopPriority && task.status !== "done" && (
        <div className="top-priority-badge">⭐ Highest Priority</div>
      )}

      <h3>{task.title}</h3>

      <span className={`task-category ${categoryStyle.badgeClass}`}>
        {categoryStyle.label}
      </span>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-footer">
        <span className={priorityStyle.badgeClass}>
          {priorityStyle.icon} {priorityStyle.label}
        </span>

        {task.status === "done" ? (
          <span className="completed-badge">✔ Done</span>
        ) : (
          <span className="task-score">⭐ {getPriorityScore(task)} pts</span>
        )}
      </div>
    </div>
  );
}
