import type { Board, Column } from "./Board";
import type { Priority, TaskStatus } from "../task/Task";
import type { TaskCategory } from "../task/taskCategory";

export type PriorityFilter = "all" | Priority;
export type CategoryFilter = "all" | TaskCategory;
export type StatusFilter = "all" | TaskStatus;

export interface BoardFilters {
  searchTerm: string;
  priorityFilter: PriorityFilter;
  categoryFilter: CategoryFilter;
  statusFilter: StatusFilter;
}

export function createDefaultBoardFilters(): BoardFilters {
  return {
    searchTerm: "",
    priorityFilter: "all",
    categoryFilter: "all",
    statusFilter: "all",
  };
}

/** Derive visible columns without changing the board used by reducer operations. */
export function filterBoardColumns(board: Board, filters: BoardFilters): Column[] {
  const search = filters.searchTerm.trim().toLowerCase();
  return board.columns.map((column) => ({
    ...column,
    tasks: column.tasks.filter((task) => {
      const searchMatches =
        !search ||
        task.title.toLowerCase().includes(search) ||
        (task.description ?? "").toLowerCase().includes(search);
      return (
        searchMatches &&
        (filters.priorityFilter === "all" || task.priority === filters.priorityFilter) &&
        (filters.categoryFilter === "all" || task.category === filters.categoryFilter) &&
        (filters.statusFilter === "all" || task.status === filters.statusFilter)
      );
    }),
  }));
}
