import { useState } from "react";
import { createDefaultBoardFilters, type CategoryFilter, type PriorityFilter, type StatusFilter } from "../domain/board/boardFilters";

/** Mount-local presentation choices. No board actions, URL writes or persistence. */
export function useBoardViewPreferences() {
  const [filters, setFilters] = useState(createDefaultBoardFilters);
  const filterCount = Number(filters.priorityFilter !== "all") +
    Number(filters.categoryFilter !== "all") + Number(filters.statusFilter !== "all");
  const isFiltering = filters.searchTerm.trim().length > 0 || filterCount > 0;

  function setSearchTerm(searchTerm: string) { setFilters(previous => ({ ...previous, searchTerm })); }
  function setPriorityFilter(priorityFilter: PriorityFilter) { setFilters(previous => ({ ...previous, priorityFilter })); }
  function setCategoryFilter(categoryFilter: CategoryFilter) { setFilters(previous => ({ ...previous, categoryFilter })); }
  function setStatusFilter(statusFilter: StatusFilter) { setFilters(previous => ({ ...previous, statusFilter })); }
  function resetCriteria() { setFilters(createDefaultBoardFilters()); }

  return { filters, filterCount, isFiltering, setSearchTerm, setPriorityFilter, setCategoryFilter, setStatusFilter, resetCriteria };
}
