import "../../styles/task-dialog.css";
import "./TaskForm.css";
import Button from "../ui/Button/Button";
import Field from "../ui/Field/Field";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import type { Priority, Task, TaskStatus } from "../../domain/task/Task";
import type { Board } from "../../domain/board/Board";
import { findTask, getChildren, getChildProgress, getParent } from "../../domain/board/taskRelationships";
import type { TaskCategory } from "../../domain/task/taskCategory";
import { createTask } from "../../domain/task/taskActions";
import type { BoardAction } from "../../domain/board/boardReducer";
import type { BoardOperationError } from "../../domain/board/boardValidation";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import TaskRelationshipForm from "../TaskRelationshipForm/TaskRelationshipForm";

import Notification from "../Notification/Notification";
import { useNotification } from "../../notifications/useNotification";
import { operationVariant } from "../../notifications/notification";
import { useModalFocus } from "../../accessibility/useModalFocus";
import { priorityStyles } from "../../domain/task/priorityStyles";
import { categoryStyles } from "../../domain/task/categoryStyles";

interface TaskFormProps {
  board: Board;
  task?: Task | null;
  parent?: Task | null;
  onClose: () => void;
  dispatch: (action: BoardAction) => BoardOperationError | null;
  onSuccess: (message: string, taskId?: string) => void;
  onOpenTask: (task: Task) => void;
}

const statusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  "in-review": "In Review",
  done: "Done",
};

export default function TaskForm({
  board,
  task,
  parent,
  onClose,
  dispatch,
  onSuccess,
  onOpenTask,
}: TaskFormProps) {
  const isEditing = Boolean(task);
  const currentTask = task ? findTask(board, task.id) ?? task : null;
  const linkedParent = currentTask ? getParent(board, currentTask) : parent;
  const children = task
    ? getChildren(board, task.id).sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime())
    : [];
  const progress = task ? getChildProgress(board, task.id) : { total: 0, completed: 0 };
  const isSubtask = parent != null || currentTask?.parentId !== undefined;
  const fieldPrefix = useId();
  const [subtaskEditor, setSubtaskEditor] = useState<
    { type: "create" } | { type: "edit"; task: Task } | null
  >(null);
  const [showRelationshipForm, setShowRelationshipForm] = useState(false);
  const [taskToOpen, setTaskToOpen] = useState<Task | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const initialTitle = task?.title ?? "";
  const initialDescription = task?.description ?? "";
  const initialPriority: Priority = task?.priority ?? parent?.priority ?? "medium";
  const initialCategory: TaskCategory = task?.category ?? parent?.category ?? "feature";

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [priority, setPriority] = useState<Priority>(initialPriority);
  const [category, setCategory] = useState<TaskCategory>(initialCategory);
  const [error, setError] = useState("");
  const { notification, show, dismiss } = useNotification();
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);

  const hasUnsavedChanges =
    title !== initialTitle ||
    description !== initialDescription ||
    priority !== initialPriority ||
    category !== initialCategory;

  const handleRequestClose = useCallback(() => {
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }

    setShowDiscardConfirmation(true);
  }, [hasUnsavedChanges, onClose]);

  useModalFocus(dialogRef, handleRequestClose, !subtaskEditor && !showRelationshipForm && !showDiscardConfirmation);
  useLayoutEffect(() => {
    if (error) {
      const target = invalidField ? document.getElementById(`${fieldPrefix}-${invalidField}`) : document.getElementById(`${fieldPrefix}-error`);
      target?.focus();
    }
  }, [error, invalidField, fieldPrefix, validationAttempt]);
  function fail(field: string | null, message: string) { setValidationAttempt(value => value + 1); setInvalidField(field); setError(message); }

  function handleOpenTask(nextTask: Task) {
    if (hasUnsavedChanges) {
      setTaskToOpen(nextTask);
      setShowDiscardConfirmation(true);
      return;
    }
    onOpenTask(nextTask);
  }

  function handleKeepEditing() {
    setShowDiscardConfirmation(false);
    setTaskToOpen(null);
  }

  function handleConfirmDiscard() {
    setShowDiscardConfirmation(false);
    if (taskToOpen) {
      onOpenTask(taskToOpen);
      setTaskToOpen(null);
    } else {
      onClose();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setInvalidField(null);
    if (notification) dismiss(notification.id);

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      fail("title", "Task title is required.");
      return;
    }

    if (trimmedTitle.length < 3) {
      fail("title", "Task title must be at least 3 characters long.");
      return;
    }

    if (trimmedTitle.length > 150) {
      fail("title", "Task title cannot exceed 150 characters.");
      return;
    }

    if (!trimmedDescription) {
      fail("description", "Task description is required.");
      return;
    }

    if (trimmedDescription.length > 300) {
      fail("description", "Task description cannot exceed 300 characters.");
      return;
    }

    if (!Object.hasOwn(priorityStyles, priority)) { fail("priority", "Choose a valid priority."); return; }
    if (!Object.hasOwn(categoryStyles, category)) { fail("category", "Choose a valid category."); return; }

    if (isEditing && task) {
      const failure = dispatch({
        type: "UPDATE_TASK",
        taskId: task.id,
        edits: {
          title: trimmedTitle,
          description: trimmedDescription,
          priority,
          category,
        },
        updatedAt: new Date(),
      });
      if (failure) {
        show(operationVariant(failure), failure.message);
        fail(null, failure.message);
        return;
      }

      onSuccess(`Updated "${trimmedTitle}".`, task.id);
    } else {
      const newTask = createTask(trimmedTitle, trimmedDescription, priority, category);
      const updatedAt = new Date();
      const failure = dispatch(parent
        ? { type: "CREATE_CHILD_TASK", parentId: parent.id, task: newTask, updatedAt }
        : { type: "CREATE_TASK", task: newTask, updatedAt });
      if (failure) {
        show(operationVariant(failure), failure.message);
        fail(null, failure.message);
        return;
      }

      onSuccess(parent ? `Created subtask "${trimmedTitle}" for "${parent.title}".` : `Created "${trimmedTitle}".`, newTask.id);
    }

    setTitle("");
    setDescription("");
    setPriority("medium");
    setCategory("feature");
    setError("");
    setShowDiscardConfirmation(false);

    onClose();
  }

  return (
    <>
      <div hidden={subtaskEditor !== null || showRelationshipForm}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="create-task-modal parent-child-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${fieldPrefix}-form-title`}
      >
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <h2 id={`${fieldPrefix}-form-title`}>
            {isEditing ? isSubtask ? "Edit SubTask" : "Edit Task" : parent ? "Add SubTask" : "Create New Task"}
          </h2>

          {(currentTask || isSubtask) && (
            <div className="task-editor-context">
              <span className={`task-status-pill${currentTask?.status === "done" ? " is-complete" : ""}`}>
                {statusLabels[currentTask?.status ?? "todo"]}
              </span>
              {linkedParent ? (
                <button type="button" className="editor-parent-pill" onClick={() => handleOpenTask(linkedParent)} aria-label={`Open parent ${linkedParent.title}`} title={`Parent: ${linkedParent.title}`}>
                  <svg className={`parent-pill-icon${linkedParent.status === "done" ? " is-complete" : ""}`} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="9" cy="9" r="1.5" fill="currentColor" />
                  </svg>
                  <span>Parent:{" "}</span>
                  <span className="parent-pill-title">{linkedParent.title}</span>
                </button>
              ) : currentTask?.parentId !== undefined && <p>Parent unavailable</p>}
            </div>
          )}

          {error && (notification ? (
            <Notification key={notification.id} notification={notification}
              id={`${fieldPrefix}-error`} messageId={`${fieldPrefix}-error-message`} tabIndex={-1} announce={false}
              onClose={() => { dismiss(notification.id); setError(""); setInvalidField(null); }}
              onFocusLost={() => document.getElementById(`${fieldPrefix}-title`)?.focus()} />
          ) : (
            <p id={`${fieldPrefix}-error`} className="form-error" tabIndex={-1}>
              {error}
            </p>
          ))}

          <Field controlId={`${fieldPrefix}-title`} label="Title">

            <input
              id={`${fieldPrefix}-title`}
              name="title"
              type="text"
              placeholder="Task title"
              maxLength={150}
              value={title}
              data-initial-focus
              required
              aria-invalid={invalidField === "title" || undefined}
              aria-describedby={`${fieldPrefix}-title-count${invalidField === "title" ? ` ${fieldPrefix}-error` : ""}`}
              onChange={(event) => setTitle(event.target.value)}
            />

            <small id={`${fieldPrefix}-title-count`} className="character-count">{title.trim().length}/150</small>
          </Field>

          <Field controlId={`${fieldPrefix}-description`} label="Description">

            <textarea
              id={`${fieldPrefix}-description`}
              name="description"
              required
              aria-invalid={invalidField === "description" || undefined}
              aria-describedby={`${fieldPrefix}-description-count${invalidField === "description" ? ` ${fieldPrefix}-error` : ""}`}
              placeholder="Task description"
              maxLength={300}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />

            <small id={`${fieldPrefix}-description-count`} className="character-count">
              {description.trim().length}/300
            </small>
          </Field>

          <div className="task-form-select-row">
            <div className="task-form-field">
              <label htmlFor={`${fieldPrefix}-priority`}>Priority</label>

              <select
                id={`${fieldPrefix}-priority`}
                aria-invalid={invalidField === "priority" || undefined}
                aria-describedby={invalidField === "priority" ? `${fieldPrefix}-error` : undefined}
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as Priority)
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="task-form-field">
              <label htmlFor={`${fieldPrefix}-category`}>Category</label>

              <select
                id={`${fieldPrefix}-category`}
                aria-invalid={invalidField === "category" || undefined}
                aria-describedby={invalidField === "category" ? `${fieldPrefix}-error` : undefined}
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as TaskCategory)
                }
              >
                <option value="feature">Feature</option>
                <option value="ui">UI</option>
                <option value="bug">Bug</option>
                <option value="testing">Testing</option>
                <option value="refactor">Refactor</option>
                <option value="devops">DevOps</option>
              </select>
            </div>
          </div>

          {currentTask && !isSubtask && (children.length > 0 ? (
            <section className="task-editor-subtasks" aria-label="Subtasks">
              <details open>
                <summary>
                  <span>Subtasks</span>
                  <span className="subtask-progress">{progress.completed} of {progress.total}</span>
                </summary>
                <ul className="editor-subtask-list">
                  {children.map((child) => (
                    <li key={child.id}>
                      <span className={`subtask-status-icon${child.status === "done" ? " is-complete" : ""}`} aria-label={statusLabels[child.status]}>
                        {child.status === "done" ? (
                          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M3 8l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                        )}
                      </span>
                      <button type="button" className="relationship-link subtask-title" onClick={() => setSubtaskEditor({ type: "edit", task: child })} aria-label={`Open subtask ${child.title}`}>
                        {child.title}
                      </button>
                    </li>
                  ))}
                </ul>
                {currentTask.status !== "done" && (
                  <button type="button" id={`${fieldPrefix}-add-subtask`} className="edit-task-button add-editor-subtask" aria-label={`Add SubTask to ${currentTask?.title}`} onClick={() => setSubtaskEditor({ type: "create" })}>
                    Add SubTask
                  </button>
                )}
              </details>
            </section>
          ) : currentTask.status !== "done" ? (
            <button type="button" id={`${fieldPrefix}-add-subtask`} className="edit-task-button add-editor-subtask" aria-label={`Add SubTask to ${currentTask?.title}`} onClick={() => setSubtaskEditor({ type: "create" })}>
              Add SubTask
            </button>
          ) : null)}

          {currentTask && children.length === 0 && (
            <button type="button" className="editor-manage-parent" onClick={() => setShowRelationshipForm(true)} aria-label={`Manage parent of ${currentTask.title}`}>
              Manage Parent
            </button>
          )}

          <div className="create-task-actions">
            <Button variant="secondary" onClick={handleRequestClose}>
              Cancel
            </Button>

            <Button type="submit">
              {isEditing ? "Save Changes" : parent ? "Create SubTask" : "Create Task"}
            </Button>
          </div>
        </form>
      </div>

      {showDiscardConfirmation && (
        <ConfirmModal
          title="Discard Changes?"
          message="You have unsaved changes. Are you sure you want to discard them?"
          confirmText="Discard"
          cancelText="Keep Editing"
          confirmVariant="danger"
          onConfirm={handleConfirmDiscard}
          onCancel={handleKeepEditing}
        />
      )}
      </div>

      {showRelationshipForm && currentTask && (
        <TaskRelationshipForm
          board={board} task={currentTask} dispatch={dispatch} onSuccess={onSuccess}
          onClose={() => setShowRelationshipForm(false)}
        />
      )}

      {subtaskEditor && currentTask && (
        <TaskForm
          key={subtaskEditor.type === "edit" ? subtaskEditor.task.id : "new-subtask"}
          board={board}
          task={subtaskEditor.type === "edit" ? subtaskEditor.task : null}
          parent={subtaskEditor.type === "create" ? currentTask : null}
          dispatch={dispatch}
          onSuccess={onSuccess}
          onClose={() => setSubtaskEditor(null)}
          onOpenTask={(nextTask) => {
            if (nextTask.id === currentTask.id) setSubtaskEditor(null);
            else onOpenTask(nextTask);
          }}
        />
      )}
    </>
  );
}
