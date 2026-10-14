import type { Task } from "../../domain/task/Task";
import "./TaskParentLink.css";
export default function TaskParentLink({ parent, onOpen }: { parent: Task; onOpen: (task: Task) => void }) {
  return <button type="button" className="editor-parent-pill" onClick={() => onOpen(parent)} aria-label={`Open parent ${parent.title}`} title={`Parent: ${parent.title}`}>
    <svg className={`parent-pill-icon${parent.status === "done" ? " is-complete" : ""}`} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/></svg>
    <span>Parent: </span><span className="parent-pill-title">{parent.title}</span>
  </button>;
}
