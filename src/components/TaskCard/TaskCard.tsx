import Badge from "../ui/Badge/Badge";
import "./TaskCard.css";
import { useDraggable } from "@dnd-kit/core";
import type { Task } from "../../domain/task/Task";
import type { Board } from "../../domain/board/Board";
import { getChildProgress } from "../../domain/board/taskRelationships";
import type { BoardAction } from "../../domain/board/boardReducer";
import { priorityStyles } from "../../domain/task/priorityStyles";
import { categoryStyles } from "../../domain/task/categoryStyles";
import SubtaskList from "../SubtaskList/SubtaskList";

interface TaskCardProps {
  task: Task;
  board: Board;
  dispatch: React.Dispatch<BoardAction>;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export default function TaskCard({
  task,
  board,
  dispatch,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { status: task.status },
  });

  const dragStyle = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const priorityStyle = priorityStyles[task.priority];
  const categoryStyle = categoryStyles[task.category];
  const progress = getChildProgress(board, task.id);
  const percentage = progress.total ? Math.round(progress.completed / progress.total * 100) : 0;

  return (
    <div
      id={`task-${task.id}`}
      ref={setNodeRef}
      style={dragStyle}
      className={`task-card ${priorityStyle.borderClass}`}
    >
      {/* Drag Handle Area */}
      <div className="task-card-header" data-task-drag={task.id} {...listeners} {...attributes} role="group" aria-label={`Move task ${task.title}, ${board.columns.find(column => column.id === task.status)?.title}`}>
        <h3>
          <button type="button" className="task-title-link" data-task-title aria-label={`Open task ${task.title}`}
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (!isDragging) onEdit(task);
            }}>
            {task.title}
          </button>
        </h3>
      </div>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      {progress.total > 0 && (
        <div className="task-progress-panel">
          <span className="task-progress-count" aria-label={`${progress.completed} of ${progress.total} subtasks complete`}>
            {progress.completed} / {progress.total}
          </span>
          <div className="task-progress-track" role="progressbar"
            aria-label={`Subtask completion for ${task.title}`}
            aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}
            aria-valuetext={`${progress.completed} of ${progress.total} subtasks complete`}>
            {Array.from({ length: progress.total }, (_, index) => (
              <span key={index} aria-hidden="true" className={`task-progress-segment${index < progress.completed ? " is-complete" : ""}`} />
            ))}
          </div>
          <span className="task-progress-percentage">{percentage}%</span>
        </div>
      )}

      {(task.subtasks ?? []).length > 0 && (
        <details className="subtask-container">
          <summary>Legacy checklist ({task.subtasks.length})</summary>
          <p>Existing checklist items are preserved. Add new subtasks from Edit Task.</p>
          <SubtaskList task={task} dispatch={dispatch} allowCreate={false} />
        </details>
      )}

      <div className="task-footer">
        <div className="task-meta">
          {task.status === "done" ? (
            <Badge className="completed-badge">✔ Done</Badge>
          ) : (
            <Badge className={priorityStyle.badgeClass}>
              {priorityStyle.label}
            </Badge>
          )}

          <Badge className={categoryStyle.badgeClass}>
            {categoryStyle.label}
          </Badge>
        </div>

        <div className="task-actions">
          <button
            type="button"
            className="edit-task-button" aria-label={`Edit ${task.title}`}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              event.currentTarget.focus();
              onEdit(task);
            }}
          >
            Edit
          </button>

          <button
            type="button"
            className="delete-task-button" aria-label={`Delete ${task.title}`}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              event.currentTarget.focus();
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
