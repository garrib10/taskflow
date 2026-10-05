import "./Board.css";
import { useLayoutEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent, type Announcements } from "@dnd-kit/core";
import type { Board as BoardType } from "../../domain/board/Board";
import type { Task } from "../../domain/task/Task";
import type { BoardAction } from "../../domain/board/boardReducer";
import { validateBoardAction, type BoardOperationError } from "../../domain/board/boardValidation";
import { getChildren } from "../../domain/board/taskRelationships";
import Column from "../Column/Column";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import FilterControls from "../FilterControls/FilterControls";
import {
  filterBoardColumns,
  createDefaultBoardFilters,
  type CategoryFilter,
  type PriorityFilter,
  type StatusFilter,
} from "../../domain/board/boardFilters";
import { isTaskStatus } from "../../utils/typeGuards";
import Notification from "../Notification/Notification";
import { useNotification } from "../../notifications/useNotification";
import { operationVariant, type NotificationVariant } from "../../notifications/notification";
import SearchBar from "../SearchBar/SearchBar";
import TaskForm from "../TaskForm/TaskForm";

import { keyboardCoordinates } from "../../accessibility/keyboardCoordinates";
import { canFocus } from "../../accessibility/useModalFocus";

interface BoardProps {
  board: BoardType;
  dispatch: React.Dispatch<BoardAction>;
}

export default function Board({ board, dispatch }: BoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates, scrollBehavior: "auto", keyboardCodes: { start: ["Space", "Enter"], end: ["Space", "Enter"], cancel: ["Escape", "Tab"] } }),
  );
  const pendingFocus = useRef<string[]>([]);
  const lastTaskFocus = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState({ id: 0, message: "" });
  function announce(message: string) { setAnnouncement(previous => ({ id: previous.id + 1, message })); }
  function focusTargets(ids: string[]) {
    for (const id of ids) {
      const target = document.getElementById(id)?.querySelector<HTMLElement>('[data-task-title]') ?? document.getElementById(id);
      if (canFocus(target)) { target.focus(); return; }
    }
    document.querySelector<HTMLElement>('[data-focus-fallback]')?.focus();
  }
  useLayoutEffect(() => {
    if (pendingFocus.current.length) { const ids = pendingFocus.current; pendingFocus.current = []; if (!document.querySelector('[role="dialog"]:not([inert])')) focusTargets(ids); }
  });
  function dismissFocus() { pendingFocus.current = lastTaskFocus.current ? [lastTaskFocus.current] : ["task-search"]; }
  const { notification, show, dismiss } = useNotification();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskPendingDeletion, setTaskPendingDeletion] = useState<Task | null>(
    null,
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const isSearching = normalizedSearchTerm.length > 0;

  const hasActiveFilters =
    priorityFilter !== "all" ||
    categoryFilter !== "all" ||
    statusFilter !== "all";

  const isFiltering = isSearching || hasActiveFilters;

  const formattedLastUpdated = board.lastUpdated.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const filteredColumns = filterBoardColumns(board, {
    searchTerm,
    priorityFilter,
    categoryFilter,
    statusFilter,
  });

  const matchingTaskCount = filteredColumns.reduce(
    (total, column) => total + column.tasks.length,
    0,
  );
  const pendingChildren = taskPendingDeletion ? getChildren(board, taskPendingDeletion.id) : [];

  function showFeedback(variant: NotificationVariant, message: string) {
    show(variant, message);
    announce(message);
  }

  function showFailure(failure: BoardOperationError) {
    showFeedback(operationVariant(failure), failure.message);
  }

  function handleResetControls() {
    const defaults = createDefaultBoardFilters();
    setSearchTerm(defaults.searchTerm);
    setPriorityFilter(defaults.priorityFilter);
    setCategoryFilter(defaults.categoryFilter);
    setStatusFilter(defaults.statusFilter);
    pendingFocus.current = ["task-search"];
  }

  function tryDispatch(action: BoardAction): BoardOperationError | null {
    const failure = validateBoardAction(board, action);
    if (failure) {
      return failure;
    }
    dispatch(action);
    return null;
  }

  function dispatchFromCard(action: BoardAction): BoardOperationError | null {
    const failure = tryDispatch(action);
    if (failure) showFailure(failure);
    return failure;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
      announce(`Dropped "${board.columns.flatMap(column => column.tasks).find(task => task.id === String(active.id))?.title ?? "Task"}" without changing its stage.`);
      pendingFocus.current = [`task-${active.id}`, "task-search"];
      return;
    }

    const taskId = active.id.toString();
    if (!isTaskStatus(over.id)) {
      return;
    }
    const newStatus = over.id;

    const currentTask = board.columns
      .flatMap((column) => column.tasks)
      .find((task) => task.id === taskId);

    if (!currentTask) {
      return;
    }

    if (currentTask.status === newStatus) {
      announce(`Dropped "${currentTask.title}" in ${board.columns.find(column => column.id === newStatus)?.title}.`);
      pendingFocus.current = [`task-${taskId}`, "task-search"];
      return;
    }

    const failure = tryDispatch({
      type: "MOVE_TASK",
      taskId,
      newStatus,
      updatedAt: new Date(),
    });

    pendingFocus.current = [`task-${taskId}`, "task-search"];
    if (failure) showFailure(failure);
    else showFeedback("success", `Moved "${currentTask.title}" to ${board.columns.find(column => column.id === newStatus)?.title}.`);
  }

  function handleCreateTask() {
    setTaskToEdit(null);
    setShowTaskForm(true);
  }

  function handleEditTask(task: Task) {
    setTaskToEdit(task);
    setShowTaskForm(true);
  }

  function handleCloseTaskForm() {
    setTaskToEdit(null);
    setShowTaskForm(false);
  }

  function handleTaskSaved(message: string, taskId?: string) {
    if (taskId) pendingFocus.current = [`task-${taskId}`, "task-search"];
    showFeedback("success", message);
  }

  function handleDeleteTask(taskId: string) {
    const task = board.columns
      .flatMap((column) => column.tasks)
      .find((currentTask) => currentTask.id === taskId);

    if (!task) {
      return;
    }

    setTaskPendingDeletion(task);
  }

  function handleCancelDeleteTask() {
    setTaskPendingDeletion(null);
  }

  function handleConfirmDeleteTask() {
    if (!taskPendingDeletion) {
      return;
    }

    if (taskToEdit?.id === taskPendingDeletion.id) {
      handleCloseTaskForm();
    }

    const failure = tryDispatch({
      type: pendingChildren.length > 0 ? "DELETE_PARENT_TASK" : "DELETE_TASK",
      taskId: taskPendingDeletion.id,
      updatedAt: new Date(),
    });
    if (failure) { showFailure(failure); return; }

    const columnElement = document.getElementById(`task-${taskPendingDeletion.id}`)?.closest(".column");
    const cards = Array.from(columnElement?.querySelectorAll<HTMLElement>("[data-task-title]") ?? []).map(node => node.closest(".task-card")?.id).filter((id): id is string => !!id);
    const index = cards.indexOf(`task-${taskPendingDeletion.id}`);
    const column = board.columns.find(column => column.tasks.some(task => task.id === taskPendingDeletion.id));
    pendingFocus.current = [cards[index + 1], cards[index - 1], `column-${column?.id}-title`].filter((id): id is string => !!id);
    setTaskPendingDeletion(null);
    showFeedback("success", pendingChildren.length > 0 ? `Deleted parent "${taskPendingDeletion.title}"; subtasks kept as independent tasks.` : `Deleted "${taskPendingDeletion.title}".`);
  }

  const titleFor = (id: string | number) => board.columns.flatMap(column => column.tasks).find(task => task.id === String(id))?.title ?? "Task";
  // dnd-kit's default live region is assertive. Route meaningful outcomes through our single polite region.
  const announcements: Announcements = {
    onDragStart: () => undefined, onDragOver: () => undefined,
    onDragEnd: () => undefined, onDragCancel: () => undefined,
  };
  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}
      onDragStart={({ active }) => announce(`Picked up "${titleFor(active.id)}". Use Left and Right to select a column; Space or Enter to drop; Escape or Tab to cancel.`)}
      onDragOver={({ active, over }) => { if (over && over.id !== active.data.current?.status) announce(`Destination: ${board.columns.find(column => column.id === over.id)?.title}.`); }}
      onDragCancel={({ active }) => { announce(`Movement of "${titleFor(active.id)}" cancelled.`); focusTargets([`task-${active.id}`, "task-search"]); }} accessibility={{ restoreFocus: false, announcements, screenReaderInstructions: { draggable: "Press Space or Enter to pick up a task. Use Left and Right to select a workflow column. Press Space or Enter to drop, or Escape or Tab to cancel." } }}>
      <div className="visually-hidden" data-live-region role="status" aria-label="Board updates" aria-atomic="true"><span key={announcement.id}>{announcement.message}</span></div>
      <div className="board-container" onFocusCapture={event => { const task = (event.target as HTMLElement).closest(".task-card"); if (task) lastTaskFocus.current = task.id; }}>
        {notification && (
          <Notification
            key={notification.id}
            notification={notification}
            onFocusLost={() => focusTargets(lastTaskFocus.current ? [lastTaskFocus.current] : ["task-search"])}
            announce={false}
            onClose={() => { dismissFocus(); dismiss(notification.id); }}
          />
        )}

        <div className="board-header">
          <div>
            <h1>TaskFlow</h1>
            <p>Rule-Based Workflow Board</p>

            <p className="last-updated">
              Last updated:{" "}
              <time dateTime={board.lastUpdated.toISOString()}>
                {formattedLastUpdated}
              </time>
            </p>
          </div>

          <button
            type="button"
            className="create-task-button" data-focus-fallback
            onClick={handleCreateTask}
          >
            + Create Task
          </button>
        </div>

        <div className="board-controls" role="search" aria-label="Search and filter tasks">
          <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />

          <FilterControls
            priorityFilter={priorityFilter}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
            onPriorityChange={setPriorityFilter}
            onCategoryChange={setCategoryFilter}
            onStatusChange={setStatusFilter}
          />

          <button
            type="button"
            className="reset-controls-button"
            onClick={handleResetControls}
            disabled={!isFiltering}
          >
            Reset
          </button>
        </div>

        {isFiltering && (
          <p className="search-results-count" aria-live="polite">
            {matchingTaskCount} {matchingTaskCount === 1 ? "task" : "tasks"}{" "}
            found
          </p>
        )}

        {showTaskForm && (
          <TaskForm
            key={taskToEdit?.id ?? "new"}
            board={board}
            task={taskToEdit}
            onClose={handleCloseTaskForm}
            dispatch={tryDispatch}
            onSuccess={handleTaskSaved}
            onOpenTask={handleEditTask}
          />
        )}

        {taskPendingDeletion && (
          <ConfirmModal
            title={pendingChildren.length > 0 ? "Delete Parent Task" : "Delete Task"}
            message={pendingChildren.length > 0
              ? `Delete "${taskPendingDeletion.title}" and detach its ${pendingChildren.length} ${pendingChildren.length === 1 ? "subtask" : "subtasks"}? All subtasks will be kept as independent tasks. This action cannot be undone.`
              : `Are you sure you want to delete "${taskPendingDeletion.title}"? This action cannot be undone.`}
            confirmText={pendingChildren.length > 0 ? "Delete Parent and Detach Subtasks" : "Delete"}
            cancelText="Cancel"
            confirmVariant="danger"
            onConfirm={handleConfirmDeleteTask}
            onCancel={handleCancelDeleteTask}
          />
        )}

        <div className="board" id="taskflow-board">
          {filteredColumns.map((column) => (
            <Column
              key={column.id}
              column={column}
              board={board}
              dispatch={dispatchFromCard}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
              isFiltering={isFiltering}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}
