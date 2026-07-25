import { useEffect, useRef, useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import type { Board as BoardType } from "../../domain/board/Board";
import type { Task, TaskStatus } from "../../domain/task/Task";
import type { BoardAction } from "../../hooks/useBoardReducer";
import { canMoveTask, getMoveErrorMessage } from "../../domain/task/taskRules";
import Column from "../Column/Column";
import Notification from "../Notification/Notification";
import TaskForm from "../TaskForm/TaskForm";
import SearchBar from "../SearchBar/SearchBar";
import FilterControls, {
  type CategoryFilter,
  type PriorityFilter,
  type StatusFilter,
} from "../FilterControls/FilterControls";

interface BoardProps {
  board: BoardType;
  dispatch: React.Dispatch<BoardAction>;
}

export default function Board({ board, dispatch }: BoardProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

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

  const filteredColumns = board.columns.map((column) => ({
    ...column,
    tasks: column.tasks.filter((task) => {
      const titleMatches = task.title
        .toLowerCase()
        .includes(normalizedSearchTerm);

      const descriptionMatches = (task.description ?? "")
        .toLowerCase()
        .includes(normalizedSearchTerm);

      const searchMatches = !isSearching || titleMatches || descriptionMatches;

      const priorityMatches =
        priorityFilter === "all" || task.priority === priorityFilter;

      const categoryMatches =
        categoryFilter === "all" || task.category === categoryFilter;

      const statusMatches =
        statusFilter === "all" || task.status === statusFilter;

      return (
        searchMatches && priorityMatches && categoryMatches && statusMatches
      );
    }),
  }));

  const matchingTaskCount = filteredColumns.reduce(
    (total, column) => total + column.tasks.length,
    0,
  );

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

  function handleClearFilters() {
    setPriorityFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const taskId = active.id.toString();
    const newStatus = over.id.toString() as TaskStatus;

    const currentTask = board.columns
      .flatMap((column) => column.tasks)
      .find((task) => task.id === taskId);

    if (!currentTask) {
      return;
    }

    if (currentTask.status === newStatus) {
      return;
    }

    if (!canMoveTask(currentTask.status, newStatus)) {
      setSuccessMessage(null);
      setErrorMessage(getMoveErrorMessage(currentTask.status, newStatus));

      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }

      errorTimeoutRef.current = window.setTimeout(() => {
        setErrorMessage(null);
      }, 3000);

      return;
    }

    dispatch({
      type: "MOVE_TASK",
      taskId,
      newStatus,
    });

    setErrorMessage(null);
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
    setErrorMessage(null);
    setSuccessMessage(message);

    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }

    successTimeoutRef.current = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  }

  function handleDeleteTask(taskId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this task?",
    );

    if (!confirmed) {
      return;
    }

    if (taskToEdit?.id === taskId) {
      handleCloseTaskForm();
    }

    dispatch({
      type: "DELETE_TASK",
      taskId,
    });

    setErrorMessage(null);
    setSuccessMessage("Task deleted successfully.");

    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }

    successTimeoutRef.current = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="board-container">
        {errorMessage && <Notification message={errorMessage} type="error" />}

        {successMessage && (
          <Notification message={successMessage} type="success" />
        )}

        <div className="board-header">
          <div>
            <h1>TaskFlow</h1>
            <p>Rule-Based Workflow Board</p>
          </div>

          <button
            type="button"
            className="create-task-button"
            onClick={handleCreateTask}
          >
            + Create Task
          </button>
        </div>

        <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />

        <FilterControls
          priorityFilter={priorityFilter}
          categoryFilter={categoryFilter}
          statusFilter={statusFilter}
          onPriorityChange={setPriorityFilter}
          onCategoryChange={setCategoryFilter}
          onStatusChange={setStatusFilter}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {isFiltering && (
          <p className="search-results-count" aria-live="polite">
            {matchingTaskCount} {matchingTaskCount === 1 ? "task" : "tasks"}{" "}
            found
          </p>
        )}

        {showTaskForm && (
          <TaskForm
            task={taskToEdit}
            onClose={handleCloseTaskForm}
            dispatch={dispatch}
            onSuccess={handleTaskSaved}
          />
        )}

        <div className="board">
          {filteredColumns.map((column) => (
            <Column
              key={column.id}
              column={column}
              dispatch={dispatch}
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
