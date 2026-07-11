import { useDraggable } from "@dnd-kit/core";

import type { Task } from "../../domain/task/Task";

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
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
      className="task-card"
      {...listeners}
      {...attributes}
    >
      <h3>{task.title}</h3>

      {task.description && <p>{task.description}</p>}

      <span>Priority: {task.priority}</span>
    </div>
  );
}
