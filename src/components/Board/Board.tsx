import { useEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
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
import SearchBar from "../SearchBar/SearchBar";
import TaskForm from "../TaskForm/TaskForm";

interface BoardProps {
  board: BoardType;
  dispatch: React.Dispatch<BoardAction>;
}

export default function Board({ board, dispatch }: BoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskPendingDeletion, setTaskPendingDeletion] = useState<Task | null>(
    null,
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const errorTimeoutRef = useRef<number | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }

      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  function handleCloseErrorNotification() {
    setErrorMessage(null);

    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  }

  function handleCloseSuccessNotification() {
    setSuccessMessage(null);

    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }

  function showErrorNotification(message: string) {
    setSuccessMessage(null);
    setErrorMessage(message);

    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }

    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }

    errorTimeoutRef.current = window.setTimeout(() => {
      setErrorMessage(null);
      errorTimeoutRef.current = null;
    }, 3000);
  }

  function showSuccessNotification(message: string) {
    setErrorMessage(null);
    setSuccessMessage(message);

    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }

    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }

    successTimeoutRef.current = window.setTimeout(() => {
      setSuccessMessage(null);
      successTimeoutRef.current = null;
    }, 3000);
  }

  function handleResetControls() {
    const defaults = createDefaultBoardFilters();
    setSearchTerm(defaults.searchTerm);
    setPriorityFilter(defaults.priorityFilter);
    setCategoryFilter(defaults.categoryFilter);
    setStatusFilter(defaults.statusFilter);
  }

  function tryDispatch(action: BoardAction): BoardOperationError | null {
    const failure = validateBoardAction(board, action);
    if (failure) {
      showErrorNotification(failure.message);
      return failure;
    }
    dispatch(action);
    return null;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
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
      return;
    }

    const failure = tryDispatch({
      type: "MOVE_TASK",
      taskId,
      newStatus,
      updatedAt: new Date(),
    });

    if (!failure) handleCloseErrorNotification();
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

  function handleTaskSaved(message: string) {
    showSuccessNotification(message);
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
    if (failure) return;

    setTaskPendingDeletion(null);
    showSuccessNotification(pendingChildren.length > 0 ? "Parent deleted; children kept as independent tasks." : "Task deleted successfully.");
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="board-container">
        {errorMessage && (
          <Notification
            message={errorMessage}
            type="error"
            onClose={handleCloseErrorNotification}
          />
        )}

        {successMessage && (
          <Notification
            message={successMessage}
            type="success"
            onClose={handleCloseSuccessNotification}
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
            className="create-task-button"
            onClick={handleCreateTask}
          >
            + Create Task
          </button>
        </div>

        <div className="board-controls">
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
              ? `Delete "${taskPendingDeletion.title}" and detach its ${pendingChildren.length} children? All children will be kept as independent tasks. This action cannot be undone.`
              : `Are you sure you want to delete "${taskPendingDeletion.title}"? This action cannot be undone.`}
            confirmText={pendingChildren.length > 0 ? "Delete Parent and Detach Children" : "Delete"}
            cancelText="Cancel"
            confirmVariant="danger"
            onConfirm={handleConfirmDeleteTask}
            onCancel={handleCancelDeleteTask}
          />
        )}

        <div className="board">
          {filteredColumns.map((column) => (
            <Column
              key={column.id}
              column={column}
              board={board}
              dispatch={tryDispatch}
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
