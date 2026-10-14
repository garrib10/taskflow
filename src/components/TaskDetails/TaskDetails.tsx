import { useId, useRef, useState, type ReactNode } from "react";
import { taskStatuses, type TaskStatus, type Task } from "../../domain/task/Task";
import { findTask, getChildren, getChildProgress, getParent } from "../../domain/board/taskRelationships";
import { useModalFocus } from "../../accessibility/useModalFocus";
import TaskForm, { type TaskFormProps } from "../TaskForm/TaskForm";
import TaskRelationshipForm from "../TaskRelationshipForm/TaskRelationshipForm";
import SubtaskList from "../SubtaskList/SubtaskList";
import Button from "../ui/Button/Button";
import "../TaskForm/TaskForm.css";
import "./TaskDetails.css";
import CloseButton from "../ui/CloseButton/CloseButton";
import CompletionMark from "../ui/CompletionMark/CompletionMark";
import { isTaskStatus } from "../../utils/typeGuards";
import type { BoardOperationError } from "../../domain/board/boardValidation";

const stages = { todo: "To Do", "in-progress": "In Progress", "in-review": "In Review", done: "Done" };
const categories = { feature: "Feature", ui: "UI", bug: "Bug", testing: "Testing", refactor: "Refactor", devops: "DevOps" };
/** Read-first workspace. Draft ownership stays in TaskForm; all writes use existing domain actions. */
export default function TaskDetails(props: TaskFormProps & { task: Task; onChangeStage: (task: Task, status: TaskStatus) => BoardOperationError | null; orderingActions?: (task: Task) => ReactNode }) {
  const { board, onClose, onOpenTask, onDelete, dispatch, onSuccess } = props;
  const task = findTask(board, props.task.id) ?? props.task;
  const [view, setView] = useState<"details" | "edit" | "child" | "parent">("details");
  const [stageError, setStageError] = useState<string | null>(null);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, onClose, view === "details");
  const parent = getParent(board, task);
  const children = getChildren(board, task.id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const progress = getChildProgress(board, task.id);
  return <>
    <div hidden={view !== "details"}>
      <div className="task-details-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div ref={ref} className="task-details-panel" role={view === "details" ? "dialog" : undefined} aria-modal={view === "details" ? true : undefined} aria-labelledby={`${id}-title`} tabIndex={-1}>
          {view === "details" && <><header className="task-details-header">
            <div><p className="board-eyebrow">{parent ? "Subtask details" : "Task details"}</p><h2 id={`${id}-title`} tabIndex={-1} data-initial-focus>{task.title}</h2></div>
            <CloseButton label="Close task details" onClick={onClose}/>
          </header>
          <div className="task-details-content">
            <dl className="task-details-metadata">
              <div><dt><label htmlFor={`${id}-stage`}>Stage</label></dt><dd><select id={`${id}-stage`} className={`detail-stage-select stage-${task.status}`} value={task.status} aria-invalid={!!stageError || undefined} aria-describedby={`${id}-stage-note${stageError ? ` ${id}-stage-error` : ""}`} onChange={event => {
                if (isTaskStatus(event.target.value)) setStageError(props.onChangeStage(task, event.target.value)?.message ?? null);
              }}>{taskStatuses.map(status => <option key={status} value={status}>{stages[status]}</option>)}</select></dd></div>
              <div><dt>Priority</dt><dd className={`detail-priority priority-${task.priority}`}>{task.priority[0].toUpperCase() + task.priority.slice(1)}</dd></div>
              <div><dt>Category</dt><dd>{categories[task.category]}</dd></div>
            </dl>
            <p id={`${id}-stage-note`} className="task-details-muted detail-stage-note">Changes save immediately. Move through stages in order.</p>
            {stageError && <p id={`${id}-stage-error`} className="form-error">{stageError}</p>}
            {props.orderingActions && <section className="detail-order-actions" aria-label="Task order">{props.orderingActions(task)}</section>}
            <section aria-labelledby={`${id}-description`}><h3 id={`${id}-description`}>Description</h3><p className="task-details-description">{task.description}</p></section>
            <section aria-labelledby={`${id}-relationships`}>
              <div className="task-details-section-heading"><h3 id={`${id}-relationships`}>Related work</h3>{children.length === 0 && <Button id={`${id}-parent`} variant="secondary" aria-label={`Manage parent of ${task.title}`} onClick={() => setView("parent")}>Manage Parent</Button>}</div>
              {parent ? <p className="task-details-parent">Parent <button className="relationship-link" onClick={() => onOpenTask(parent)} aria-label={`Open parent ${parent.title}`}>{parent.title}</button></p> : <p className="task-details-muted">{task.parentId ? "Parent unavailable" : "Independent task"}</p>}
              {children.length > 0 && <><p>{progress.completed} of {progress.total} subtasks complete</p><progress aria-label={`Subtask completion for ${task.title}`} value={progress.completed} max={progress.total}/><ul className="task-details-children">{children.map(child => <li key={child.id}><CompletionMark complete={child.status === "done"}/><button className="relationship-link" aria-label={`Open subtask ${child.title}`} onClick={() => onOpenTask(child)}>{child.title}</button><span>{stages[child.status]}</span></li>)}</ul></>}
              {!task.parentId && task.status !== "done" && <Button id={`${id}-child`} variant="secondary" aria-label={`Add SubTask to ${task.title}`} onClick={() => setView("child")}>Add SubTask</Button>}
              {task.status === "done" && !task.parentId && <p className="task-details-muted">Completed tasks cannot accept new subtasks.</p>}
            </section>
            {task.subtasks.length > 0 && <section aria-label="Legacy checklist"><h3>Legacy checklist</h3><SubtaskList task={task} dispatch={dispatch} allowCreate={task.status !== "done"}/></section>}
            <dl className="task-details-dates"><div><dt>Created</dt><dd>{task.createdAt.toLocaleString()}</dd></div></dl>
          </div>
          <footer className="task-details-footer">{onDelete && <Button variant="danger" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task.id)}>Delete task</Button>}<Button id={`${id}-edit`} onClick={() => setView("edit")}>Edit task</Button></footer></>}
        </div>
      </div>
    </div>
    {view === "edit" && <TaskForm {...props} task={task} onClose={onClose}/>}
    {view === "child" && <TaskForm {...props} task={null} parent={task} onClose={() => setView("details")}/>}
    {view === "parent" && <TaskRelationshipForm board={board} task={task} dispatch={dispatch} onSuccess={onSuccess} onClose={() => setView("details")}/>}
  </>;
}
