import "./Board.css";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { DndContext, DragOverlay, closestCenter, pointerWithin, rectIntersection, type CollisionDetection, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type Announcements, type Modifier } from "@dnd-kit/core";
import type { Board as BoardType } from "../../domain/board/Board";
import type { Task } from "../../domain/task/Task";
import { boardReducer, type BoardAction } from "../../domain/board/boardReducer";
import { validateBoardAction, type BoardOperationError } from "../../domain/board/boardValidation";
import { findTask, getChildren } from "../../domain/board/taskRelationships";
import Column from "../Column/Column";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import FilterControls from "../FilterControls/FilterControls";
import AppShell from "../AppShell/AppShell";
import BoardToolbar from "../BoardToolbar/BoardToolbar";
import { filterBoardColumns } from "../../domain/board/boardFilters";
import { useBoardViewPreferences } from "../../hooks/useBoardViewPreferences";
import { taskStatuses, type TaskStatus } from "../../domain/task/Task";
import { getColumnCapacity } from "../../domain/board/boardCapacity";
import { taskContexts } from "./boardPresentation";
import StageDropTarget from "./StageDropTarget";
import type { DropHint } from "../Column/Column";
import Button from "../ui/Button/Button";
import { isTaskStatus } from "../../utils/typeGuards";
import Notification from "../Notification/Notification";
import { useNotification } from "../../notifications/useNotification";
import { operationVariant, type NotificationVariant } from "../../notifications/notification";
import SearchBar from "../SearchBar/SearchBar";
import TaskForm from "../TaskForm/TaskForm";
import Field from "../ui/Field/Field";
import { isOrderingMode } from "../../persistence/viewPreferences";
import { selectOrderedTasks, type OrderingMode } from "../../domain/board/boardOrdering";

import { keyboardCoordinates } from "../../accessibility/keyboardCoordinates";
import { canFocus } from "../../accessibility/useModalFocus";
import { restrictDragToColumns } from "./dragBounds";

interface BoardProps {
  board: BoardType;
  dispatch: React.Dispatch<BoardAction>;
  feedback?: ReactNode;
  overlays?: ReactNode;
  ordering?: { mode: OrderingMode; selectMode: (mode: OrderingMode) => void };
}

export default function Board({ board, dispatch, feedback, overlays, ordering }: BoardProps) {
  const orderingMode = ordering?.mode ?? "priority";
  const [narrow, setNarrow] = useState(() => window.matchMedia?.("(max-width: 600px)").matches ?? false);
  const [activeStage, setActiveStage] = useState<TaskStatus>("todo");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const contexts = taskContexts(board);
  const draggedTask = draggedId ? findTask(board, draggedId) : null;
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 600px)");
    if (!media) return;
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const restrictToBoard: Modifier = ({ transform, draggingNodeRect }) =>
    restrictDragToColumns(transform, draggingNodeRect,
      Array.from(document.querySelectorAll(".column, [data-destination]")).map(column => column.getBoundingClientRect()));
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates, scrollBehavior: "auto", keyboardCodes: { start: ["Space", "Enter"], end: ["Space", "Enter"], cancel: ["Escape", "Tab"] } }),
  );
  const pendingFocus = useRef<string[]>([]);
  const lastDestination = useRef("");
  const lastTaskFocus = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState({ id: 0, message: "" });
  function announce(message: string) { setAnnouncement(previous => ({ id: previous.id + 1, message })); }
  function focusTargets(ids: string[]) {
    for (const id of ids) {
      const target = id.startsWith("move-task-") ? document.getElementById(id) : document.getElementById(id)?.querySelector<HTMLElement>('[data-task-title]') ?? document.getElementById(id);
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

  const { filters, filterCount, isFiltering, setSearchTerm, setPriorityFilter, setCategoryFilter, setStatusFilter, resetCriteria } = useBoardViewPreferences();
  const { searchTerm, priorityFilter, categoryFilter, statusFilter } = filters;
  const filteredColumns = filterBoardColumns(board, filters);

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
    resetCriteria();
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

  function movementFocus(taskId: string, destination: TaskStatus) {
    pendingFocus.current = [`move-task-${taskId}`, `column-${destination}-title`, "workflow-stage", "task-search"];
  }
  function executeMovement(action: BoardAction, task: Task) {
    const failure = tryDispatch(action);
    if (failure) { movementFocus(task.id, task.status); showFailure(failure); return; }
    const next = boardReducer(board, action);
    const moved = findTask(next, task.id);
    if (!moved) return;
    if (narrow) setActiveStage(moved.status);
    movementFocus(task.id, moved.status);
    const column = next.columns.find(current => current.id === moved.status);
    const order = column ? selectOrderedTasks(column, orderingMode).tasks : [];
    const hidden = !filterBoardColumns(next, filters).some(current => current.tasks.some(item => item.id === task.id));
    showFeedback("success", `${action.type === "REORDER_TASK" ? "Reordered" : "Moved"} "${task.title}" ${action.type === "REORDER_TASK" ? "in" : "to"} ${column?.title}, position ${order.findIndex(item => item.id === task.id) + 1} of ${order.length}.${hidden ? " Hidden by the current search or filters." : ""}`);
  }
  function dropAction(event: DragEndEvent | DragOverEvent): { task: Task; action: BoardAction | null; hint: DropHint } | null {
    const task = findTask(board, String(event.active.id));
    const over = event.over;
    if (!task || !over) return null;
    const status = isTaskStatus(over.id) ? over.id : isTaskStatus(over.data.current?.status) ? over.data.current.status : null;
    if (!status) return null;
    const targetId = typeof over.data.current?.taskId === "string" ? over.data.current.taskId : undefined;
    const rect = event.active.rect.current.translated;
    const position = rect && rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2 ? "after" : "before";
    const placement = targetId ? { type: position, taskId: targetId } as const : { type: "top" } as const;
    const same = task.status === status;
    const action: BoardAction | null = same
      ? orderingMode === "manual" && !isFiltering && targetId && targetId !== task.id ? { type: "REORDER_TASK", taskId: task.id, placement, mode: "manual", filtered: isFiltering, updatedAt: new Date() } : null
      : { type: "MOVE_TASK", taskId: task.id, newStatus: status, updatedAt: new Date(), ordering: { mode: orderingMode, filtered: isFiltering, input: event.activatorEvent.type.startsWith("key") ? "keyboard" : event.activatorEvent.type.startsWith("touch") ? "touch" : "pointer", placement } };
    const failure = action ? validateBoardAction(board, action) : null;
    const title = board.columns.find(column => column.id === status)?.title;
    return { task, action, hint: { status, taskId: targetId, position: targetId ? position : undefined, kind: failure ? "invalid" : action ? "valid" : "neutral", label: failure?.message ?? (action ? targetId && orderingMode === "manual" && !isFiltering ? `Place ${position} "${findTask(board, targetId)?.title ?? "task"}"` : `Move to ${title}${orderingMode === "manual" ? " · first position" : ""}` : isFiltering && orderingMode === "manual" ? "Clear search and filters to reorder tasks." : orderingMode === "priority" ? "Priority controls order in this stage." : "Current position") } };
  }
  const collisionDetection: CollisionDetection = args => {
    if (!args.pointerCoordinates) {
      return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter(container => !container.data.current?.taskId) });
    }
    const hits = pointerWithin(args);
    const cardHits = hits.filter(hit => args.droppableContainers.find(container => container.id === hit.id)?.data.current?.taskId);
    return cardHits.length ? cardHits : hits.length ? hits : rectIntersection(args);
  };
  function handleDragOver(event: DragOverEvent) {
    const candidate = dropAction(event);
    setDropHint(candidate?.hint ?? null);
    const message = candidate && (candidate.hint.status !== candidate.task.status || candidate.hint.taskId && candidate.hint.taskId !== candidate.task.id) ? `Destination: ${candidate.hint.label}` : "";
    if (message && message !== lastDestination.current) announce(message);
    lastDestination.current = message;
  }
  function handleDragEnd(event: DragEndEvent) {
    setDraggedId(null); setDropHint(null);
    const candidate = dropAction(event);
    if (candidate?.action) executeMovement(candidate.action, candidate.task);
    else {
      const task = findTask(board, String(event.active.id));
      if (task) movementFocus(task.id, task.status);
      announce(candidate?.hint.label ?? `Dropped "${task?.title ?? "Task"}" outside a destination; nothing changed.`);
    }
  }
  function movementActions(task: Task, index: number, tasks: Task[]) {
    const nextStatus = taskStatuses[taskStatuses.indexOf(task.status) + 1];
    const move: BoardAction | null = nextStatus ? { type: "MOVE_TASK", taskId: task.id, newStatus: nextStatus, updatedAt: new Date(), ordering: { mode: orderingMode, filtered: isFiltering, input: "explicit" } } : null;
    const reason = move ? validateBoardAction(board, move)?.message : "Done is the final stage.";
    return <>
      <p>Move task</p>
      {move && <Button variant="secondary" onClick={() => executeMovement(move, task)}>Move to {board.columns.find(column => column.id === nextStatus)?.title}</Button>}
      {reason && <p className="movement-reason">{reason}</p>}
      {orderingMode === "manual" && <>
        <Button variant="secondary" aria-label={`Move ${task.title} earlier`} disabled={isFiltering || index === 0} onClick={() => { const previous = tasks[index - 1]; if (previous) executeMovement({ type: "REORDER_TASK", taskId: task.id, placement: { type: "before", taskId: previous.id }, mode: orderingMode, filtered: isFiltering, updatedAt: new Date() }, task); }}>Move earlier</Button>
        <Button variant="secondary" aria-label={`Move ${task.title} later`} disabled={isFiltering || index === tasks.length - 1} onClick={() => { const next = tasks[index + 1]; if (next) executeMovement({ type: "REORDER_TASK", taskId: task.id, placement: { type: "after", taskId: next.id }, mode: orderingMode, filtered: isFiltering, updatedAt: new Date() }, task); }}>Move later</Button>
        {isFiltering && <p>Clear search and filters to reorder tasks.</p>}
      </>}
    </>;
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
    const task = findTask(board, taskId);

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

    if (showTaskForm) {
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

  const titleFor = (id: string | number) => findTask(board, String(id))?.title ?? "Task";
  // dnd-kit's default live region is assertive. Route meaningful outcomes through our single polite region.
  const announcements: Announcements = {
    onDragStart: () => undefined, onDragOver: () => undefined,
    onDragEnd: () => undefined, onDragCancel: () => undefined,
  };
  return (
    <DndContext collisionDetection={collisionDetection} sensors={sensors} modifiers={[restrictToBoard]} onDragEnd={handleDragEnd}
      onDragStart={({ active }) => { lastDestination.current = ""; setDraggedId(String(active.id)); announce(`Picked up "${titleFor(active.id)}" from ${board.columns.find(column => column.tasks.some(task => task.id === active.id))?.title}. Use Left and Right to select a column; Space or Enter to drop; Escape or Tab to cancel.`); }}
      onDragOver={handleDragOver}
      onDragCancel={({ active }) => { setDraggedId(null); setDropHint(null); announce(`Movement of "${titleFor(active.id)}" cancelled.`); focusTargets([`move-task-${active.id}`, "task-search"]); }} accessibility={{ restoreFocus: false, announcements, screenReaderInstructions: { draggable: "Press Space or Enter to pick up a task. Use Left and Right to select a workflow column. Press Space or Enter to drop, or Escape or Tab to cancel." } }}>
      <p id="board-movement-help" className="visually-hidden">Drag with the grip, or press Space or Enter, use Left and Right to choose a stage and drop with Space. Escape cancels. Movement actions also offer buttons.</p>
      <div className="visually-hidden" data-live-region role="status" aria-label="Board updates" aria-atomic="true"><span key={announcement.id}>{announcement.message}</span></div>
      <div onFocusCapture={event => { const target = event.target as HTMLElement; const task = target.closest(".task-card"); if (task) lastTaskFocus.current = target.matches("[data-task-drag]") ? target.id : task.id; }}>
        <AppShell lastUpdated={board.lastUpdated} onCreateTask={handleCreateTask}
          feedback={<>
            {feedback}
            {notification && (
              <Notification
                key={notification.id}
                notification={notification}
                onFocusLost={() => focusTargets(lastTaskFocus.current ? [lastTaskFocus.current] : ["task-search"])}
                announce={false}
                onClose={() => { dismissFocus(); dismiss(notification.id); }}
              />
            )}
          </>}
          toolbar={<BoardToolbar
            ordering={ordering && <Field controlId="task-ordering-mode" label="Ordering"><select id="task-ordering-mode" value={orderingMode} onChange={event => { if (isOrderingMode(event.target.value)) ordering.selectMode(event.target.value); }}><option value="priority">Priority</option><option value="manual">Manual</option></select></Field>}
            search={<SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />}
            filters={<FilterControls priorityFilter={priorityFilter} categoryFilter={categoryFilter} statusFilter={statusFilter}
              onPriorityChange={setPriorityFilter} onCategoryChange={setCategoryFilter} onStatusChange={setStatusFilter} />}
            filterCount={filterCount}
            activeCriteria={isFiltering} onReset={handleResetControls}
            resultSummary={isFiltering ? <p aria-live="polite">{matchingTaskCount} {matchingTaskCount === 1 ? "task" : "tasks"} found</p> : null}
          />}
          overlays={<>
            {overlays}
            {showTaskForm && (
              <TaskForm
                key={taskToEdit?.id ?? "new"}
                board={board}
                task={taskToEdit}
                onClose={handleCloseTaskForm}
                dispatch={tryDispatch}
                onSuccess={handleTaskSaved}
                onOpenTask={handleEditTask}
                onDelete={handleDeleteTask}
              />
            )}

            {taskPendingDeletion && (
              <ConfirmModal
                title={pendingChildren.length > 0 ? "Delete Parent Task" : "Delete Task"}
                message={pendingChildren.length > 0
                  ? `Delete "${taskPendingDeletion.title}" and detach its ${pendingChildren.length} ${pendingChildren.length === 1 ? "subtask" : "subtasks"}? All subtasks will be kept as independent tasks. This action cannot be undone. Unsaved editor changes will be discarded.`
                  : `Are you sure you want to delete "${taskPendingDeletion.title}"? This action cannot be undone. Unsaved editor changes will be discarded.`}
                confirmText={pendingChildren.length > 0 ? "Delete Parent and Detach Subtasks" : "Delete"}
                cancelText="Cancel"
                confirmVariant="danger"
                onConfirm={handleConfirmDeleteTask}
                onCancel={handleCancelDeleteTask}
              />
            )}

          </>}
        >
          <div className="board-workflow-header"><div><span className="board-eyebrow">Workflow</span><p>{board.columns.reduce((sum, column) => sum + column.tasks.length, 0)} tasks · {orderingMode === "manual" ? "Manual order" : "Ordered by priority"}</p></div></div>
          {narrow && <Field controlId="workflow-stage" label="Workflow stage"><select id="workflow-stage" value={activeStage} onChange={event => { if (isTaskStatus(event.target.value)) setActiveStage(event.target.value); }}>{filteredColumns.map(column => <option key={column.id} value={column.id}>{column.title} · {column.tasks.length} shown / {getColumnCapacity(board, column.id).count} total</option>)}</select></Field>}
          {narrow && draggedTask && <div className="stage-drop-tray" aria-label="Drag destinations">{board.columns.map(column => <StageDropTarget key={column.id} status={column.id} title={column.title} current={column.id === draggedTask.status} reason={column.id === draggedTask.status ? "Current stage" : validateBoardAction(board, { type: "MOVE_TASK", taskId: draggedTask.id, newStatus: column.id, updatedAt: new Date(), ordering: { mode: orderingMode, filtered: isFiltering, input: "touch" } })?.message ?? null} />)}</div>}
          <p className="board-scroll-hint">Scroll sideways to view all four columns.</p>
          <div className="board" id="taskflow-board" role="region" aria-label="Workflow columns" tabIndex={0}>
            {filteredColumns.filter(column => !narrow || column.id === activeStage).map(column => {
              const full = board.columns.find(current => current.id === column.id) ?? column;
              const tasks = selectOrderedTasks(full, orderingMode, column.tasks.map(task => task.id)).tasks;
              const activeReason = draggedTask && column.id !== draggedTask.status ? validateBoardAction(board, { type: "MOVE_TASK", taskId: draggedTask.id, newStatus: column.id, updatedAt: new Date(), ordering: { mode: orderingMode, filtered: isFiltering, input: "explicit" } }) : null;
              const hint = dropHint?.status === column.id ? dropHint : draggedTask ? { status: column.id, kind: activeReason ? "invalid" as const : "neutral" as const, label: activeReason?.message ?? "Choose a destination" } : null;
              return <Column key={column.id} column={column} tasks={tasks} capacity={getColumnCapacity(board, column.id)} contexts={contexts} search={searchTerm} isFiltering={isFiltering} manual={orderingMode === "manual"} selectedTaskId={taskToEdit?.id} onEdit={handleEditTask} movementActions={movementActions} dropHint={hint} />;
            })}
          </div>
        </AppShell>
      </div>
      <DragOverlay dropAnimation={null}>{draggedTask && <div className="task-drag-overlay"><small>Moving from {board.columns.find(column => column.id === draggedTask.status)?.title}</small><strong>{draggedTask.title}</strong><span>{dropHint?.label ?? "Choose a workflow destination"}</span></div>}</DragOverlay>
    </DndContext>
  );
}
