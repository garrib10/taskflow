import "./TaskCard.css";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useState, type ReactNode } from "react";
import type { Task } from "../../domain/task/Task";
import { priorityStyles } from "../../domain/task/priorityStyles";
import { categoryStyles } from "../../domain/task/categoryStyles";
import type { TaskContext } from "../Board/boardPresentation";

interface TaskCardProps {
  task: Task;
  stage: string;
  context?: TaskContext;
  excerpt?: string | null;
  manual: boolean;
  selected: boolean;
  dropPosition?: "before" | "after";
  onEdit: (task: Task) => void;
  movementActions: () => ReactNode;
}
export default function TaskCard({ task, stage, context, excerpt, manual, selected, dropPosition, onEdit, movementActions }: TaskCardProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: task.id, data: { status: task.status } });
  const { setNodeRef: setDropRef } = useDroppable({ id: `order-${task.id}`, disabled: !manual, data: { status: task.status, taskId: task.id } });
  const priority = priorityStyles[task.priority];
  const category = categoryStyles[task.category];
  return <article aria-labelledby={`task-heading-${task.id}`} id={`task-${task.id}`} ref={node => { setNodeRef(node); setDropRef(node); }} className={`task-card${isDragging ? " is-dragging" : ""}${selected ? " is-selected" : ""}`} data-drop-position={dropPosition}>
    <div className="task-card-header">
      <div ref={setActivatorNodeRef} id={`move-task-${task.id}`} data-task-drag={task.id} {...listeners} {...attributes} role="group" aria-label={`Move task ${task.title}, ${stage}`} aria-describedby="board-movement-help" className="task-grip">
        <svg width="14" height="22" viewBox="0 0 14 22" aria-hidden="true" fill="currentColor"><circle cx="4" cy="5" r="1.5"/><circle cx="10" cy="5" r="1.5"/><circle cx="4" cy="11" r="1.5"/><circle cx="10" cy="11" r="1.5"/><circle cx="4" cy="17" r="1.5"/><circle cx="10" cy="17" r="1.5"/></svg>
      </div>
      <h3 id={`task-heading-${task.id}`}><button type="button" className="task-title-link" data-task-title aria-label={`Open task ${task.title}`} onClick={() => onEdit(task)}>{task.title}</button></h3>

    </div>
    <div className="task-meta"><span className={`task-priority priority-${task.priority}`}><span aria-hidden="true"/> {priority.label}</span><span className="task-category">{category.label}</span></div>
    {context?.parentTitle && <p className="task-relationship" title={context.parentTitle}><span className="task-relationship-kind">Subtask</span> <span aria-hidden="true">↳</span> <span>Parent: {context.parentTitle}</span></p>}
    {context && context.childCount > 0 && <div className="task-family"><span>Parent · {context.completedChildren} of {context.childCount} subtasks complete</span><div className="task-progress-track" role="progressbar" aria-label={`Subtask completion for ${task.title}`} aria-valuemin={0} aria-valuemax={context.childCount} aria-valuenow={context.completedChildren}><span style={{ width: `${context.completedChildren / context.childCount * 100}%` }}/></div></div>}
    {task.subtasks.length > 0 && <p className="task-relationship">Checklist · {task.subtasks.filter(item => item.completed).length} of {task.subtasks.length} complete</p>}
      <details className="task-movement-actions" onToggle={event => setActionsOpen(event.currentTarget.open)} onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); event.stopPropagation(); } }}>
        <summary aria-label={`Movement actions for ${task.title}`} title="Movement actions"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="currentColor"><circle cx="3" cy="9" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="15" cy="9" r="1.5"/></svg></summary>
        <div className="task-movement-panel" role="group" aria-label={`Move ${task.title}`}>{actionsOpen && movementActions()}</div>
      </details>
    {excerpt && <p className="task-search-excerpt"><span className="visually-hidden">Description match: </span>{excerpt}</p>}
  </article>;
}
