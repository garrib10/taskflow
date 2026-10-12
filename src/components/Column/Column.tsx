import "./Column.css";
import { useDroppable } from "@dnd-kit/core";
import type { Column as ColumnType } from "../../domain/board/Board";
import type { Task } from "../../domain/task/Task";
import type { ColumnCapacity } from "../../domain/board/boardCapacity";
import type { TaskContext } from "../Board/boardPresentation";
import { descriptionMatch } from "../Board/boardPresentation";
import TaskCard from "../TaskCard/TaskCard";
import type { ReactNode } from "react";

export interface DropHint { status: string; kind: "valid" | "invalid" | "neutral"; label: string; taskId?: string; position?: "before" | "after" }
interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  capacity: ColumnCapacity;
  contexts: Map<string, TaskContext>;
  search: string;
  isFiltering: boolean;
  manual: boolean;
  selectedTaskId?: string;
  dropHint?: DropHint | null;
  onEdit: (task: Task) => void;
  movementActions: (task: Task, index: number, tasks: Task[]) => ReactNode;
}
export default function Column({ column, tasks, capacity, contexts, search, isFiltering, manual, selectedTaskId, dropHint, onEdit, movementActions }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: column.id, data: { status: column.id } });
  const capacityText = capacity.kind === "unlimited" ? "No work-in-progress limit"
    : capacity.state === "over" ? "Over limit · move or finish work to recover"
    : capacity.state === "full" ? "Full · finish work before adding more"
    : capacity.state === "near" ? "1 place remaining" : `${capacity.remaining} places remaining`;
  return <section ref={setNodeRef} className={`column stage-${column.id}`} aria-labelledby={`column-${column.id}-title`} data-capacity={capacity.state} data-drop-state={dropHint?.kind}>
    <header className="column-header">
      <div className="column-heading"><span className="stage-marker" aria-hidden="true"/><h2 id={`column-${column.id}-title`} tabIndex={-1}>{column.title} ({capacity.count})</h2>{capacity.kind === "limited" && <span className="column-limit" aria-label={`${capacity.count} of ${capacity.limit} tasks; ${capacity.state === "near" ? "near capacity" : capacity.state}`}>{capacity.count} / {capacity.limit}</span>}</div>
      <p className="column-capacity">{capacityText}</p>
      {isFiltering && <p className="column-visible-count">{tasks.length} shown · {capacity.count} total</p>}
    </header>
    {dropHint && <p className="column-drop-feedback">{dropHint.kind === "valid" ? "✓ " : dropHint.kind === "invalid" ? "× " : ""}{dropHint.label}</p>}
    <div className="column-tasks">
      {tasks.length === 0 ? <div className="empty-column"><span aria-hidden="true">—</span><p>{capacity.count === 0 ? "No tasks in this stage" : "No tasks match these filters"}</p>{capacity.count === 0 && <small>{column.id === "todo" ? "Create a task to start your workflow." : "Move eligible work here when it is ready."}</small>}</div>
      : tasks.map((task, index) => <TaskCard key={task.id} task={task} stage={column.title} context={contexts.get(task.id)} excerpt={descriptionMatch(task, search)} manual={manual && !isFiltering} selected={selectedTaskId === task.id} onEdit={onEdit} movementActions={() => movementActions(task, index, tasks)} dropPosition={dropHint?.kind === "valid" && dropHint.taskId === task.id ? dropHint.position : undefined} />)}
    </div>
  </section>;
}
