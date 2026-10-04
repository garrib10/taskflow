import { useDraggable } from "@dnd-kit/core";
import type { Task } from "../../domain/task/Task";
import type { Board } from "../../domain/board/Board";
import { getChildren, getChildProgress, getParent } from "../../domain/board/taskRelationships";
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
  onCreateChild: (parent: Task) => void;
  onManageParent: (task: Task) => void;
  onLocateTask: (taskId: string) => void;
}

export default function TaskCard({
  task,
  board,
  dispatch,
  onEdit,
  onDelete,
  onCreateChild,
  onManageParent,
  onLocateTask,
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
  const parent = getParent(board, task);
  const children = getChildren(board, task.id);
  const progress = getChildProgress(board, task.id);

  return (
    <div
      id={`task-${task.id}`}
      ref={setNodeRef}
      style={dragStyle}
      className={`task-card ${priorityStyle.borderClass}`}
    >
      {/* Drag Handle Area */}
      <div className="task-card-header" {...listeners} {...attributes}>
        <h3>{task.title}</h3>
      </div>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-relationships" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        {task.parentId !== undefined && (
          <p className="parent-context">
            Child of: {parent
              ? <button type="button" className="relationship-link" onClick={() => onLocateTask(parent.id)} aria-label={`Show parent ${parent.title}`}>{parent.title}</button>
              : <span>Unavailable parent</span>}
            {task.status === "done" && <span> · Complete</span>}
          </p>
        )}
        {children.length > 0 && (
          <details className="child-task-list">
            <summary>Parent · {progress.completed}/{progress.total} children complete</summary>
            <ul>
              {children.map((child) => (
                <li key={child.id}>
                  <button type="button" className="relationship-link" onClick={() => onLocateTask(child.id)} aria-label={`Show child ${child.title}`}>{child.title}</button>
                  <span> · {child.status === "done" ? "Complete" : child.status}</span>
                  <button type="button" className="edit-task-button" onClick={() => onEdit(child)} aria-label={`Edit child ${child.title}`}>Edit</button>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="relationship-actions">
          {task.parentId === undefined && task.status !== "done" && (
            <button type="button" className="edit-task-button" onClick={() => onCreateChild(task)} aria-label={`Add child to ${task.title}`}>Add Child</button>
          )}
          {children.length === 0 && (
            <button type="button" className="edit-task-button" onClick={() => onManageParent(task)} aria-label={`Manage parent of ${task.title}`}>Manage Parent</button>
          )}
        </div>
      </div>

      {(task.subtasks ?? []).length > 0 && (
        <details className="subtask-container">
          <summary>Legacy checklist ({task.subtasks.length})</summary>
          <p>Existing checklist items are preserved. New child tasks use Add Child.</p>
          <SubtaskList task={task} dispatch={dispatch} allowCreate={false} />
        </details>
      )}

      <div className="task-footer">
        <div className="task-meta">
          {task.status === "done" ? (
            <span className="completed-badge">✔ Done</span>
          ) : (
            <span className={priorityStyle.badgeClass}>
              {priorityStyle.label}
            </span>
          )}

          <span className={`task-category ${categoryStyle.badgeClass}`}>
            {categoryStyle.label}
          </span>
        </div>

        <div className="task-actions">
          <button
            type="button"
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
            type="button"
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
