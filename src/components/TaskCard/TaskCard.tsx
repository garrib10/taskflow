import type { Task } from "../../domain/task/Task";

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
  return (
    <div className="task-card">
      <h3>{task.title}</h3>

      {task.description && <p>{task.description}</p>}

      <span>Priority: {task.priority}</span>
    </div>
  );
}
