import { useDraggable } from "@dnd-kit/core";

import type { Task } from "../../domain/task/Task";

import {
  getPriorityLabel,
  getPriorityScore,
} from "../../domain/task/taskPriority";

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

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${isTopPriority ? "top-priority" : ""}`}
      {...listeners}
      {...attributes}
    >
      {isTopPriority && (
        <div className="top-priority-badge">⭐ Highest Priority</div>
      )}

      <h3>{task.title}</h3>

      {task.description && <p>{task.description}</p>}

      <p>
        <strong>Priority:</strong> {getPriorityLabel(task.priority)}
      </p>

      <p>
        <strong>Score:</strong> {getPriorityScore(task)}
      </p>
    </div>
  );
}
