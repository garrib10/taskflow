import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useBoardReducer } from "./useBoardReducer";
import { useBoardViewPreferences } from "./useBoardViewPreferences";
import { createDefaultBoardFilters, filterBoardColumns } from "../domain/board/boardFilters";
import { makeBoard, makeTask } from "../test/fixtures";
import { STORAGE_KEY } from "../utils/storage";

afterEach(() => localStorage.clear());

it("updates independent criteria, derives active state/count, and resets only criteria", () => {
  const { result } = renderHook(useBoardViewPreferences);
  expect(result.current.filters).toEqual(createDefaultBoardFilters());
  act(() => result.current.setSearchTerm("  "));
  expect(result.current.isFiltering).toBe(false);
  act(() => {
    result.current.setSearchTerm("ALPHA");
    result.current.setPriorityFilter("high");
    result.current.setCategoryFilter("devops");
    result.current.setStatusFilter("in-progress");
  });
  expect(result.current.filters).toEqual({ searchTerm: "ALPHA", priorityFilter: "high", categoryFilter: "devops", statusFilter: "in-progress" });
  expect(result.current.isFiltering).toBe(true);
  expect(result.current.filterCount).toBe(3);
  const board = makeBoard([makeTask({ title: "Alpha release", priority: "high", category: "devops", status: "in-progress" }), makeTask({ id: "hidden", title: "Other work" })]);
  expect(filterBoardColumns(board, result.current.filters).flatMap(column => column.tasks)).toHaveLength(1);
  act(() => result.current.resetCriteria());
  expect(result.current.filters).toEqual(createDefaultBoardFilters());
  expect(result.current.isFiltering).toBe(false);
  expect(result.current.filterCount).toBe(0);
  expect(filterBoardColumns(board, result.current.filters).flatMap(column => column.tasks)).toHaveLength(2);
});

it("keeps preferences through domain actions and keeps criterion changes/reset out of saved board data", () => {
  const board = makeBoard();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, revision: "initial", board }));
  const { result } = renderHook(() => ({ domain: useBoardReducer(), view: useBoardViewPreferences() }));
  const originalBoard = result.current.domain[0];
  const originalRaw = localStorage.getItem(STORAGE_KEY);
  act(() => { result.current.view.setSearchTerm("hidden"); result.current.view.setPriorityFilter("low"); });
  expect(result.current.domain[0]).toBe(originalBoard);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(originalRaw);
  const preferences = result.current.view.filters;
  act(() => result.current.domain[1]({ type: "CREATE_TASK", task: makeTask({ id: "new", title: "New work" }), updatedAt: new Date() }));
  expect(result.current.view.filters).toBe(preferences);
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  expect(saved.board.columns.flatMap((column: { tasks: unknown[] }) => column.tasks)).toHaveLength(2);
  expect(Object.keys(saved.board).sort()).toEqual(["columns", "id", "lastUpdated", "name"]);
  const acceptedBoard = result.current.domain[0];
  const acceptedRaw = localStorage.getItem(STORAGE_KEY);
  act(() => result.current.view.resetCriteria());
  expect(result.current.domain[0]).toBe(acceptedBoard);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(acceptedRaw);
});

it("resets preferences on remount while hydrating the same durable board", () => {
  const board = makeBoard();
  const raw = JSON.stringify({ schemaVersion: 2, revision: "initial", board });
  localStorage.setItem(STORAGE_KEY, raw);
  const first = renderHook(() => ({ domain: useBoardReducer(), view: useBoardViewPreferences() }));
  act(() => { first.result.current.view.setSearchTerm("work"); first.result.current.view.setCategoryFilter("testing"); });
  first.unmount();
  const next = renderHook(() => ({ domain: useBoardReducer(), view: useBoardViewPreferences() }));
  expect(next.result.current.view.filters).toEqual(createDefaultBoardFilters());
  expect(next.result.current.domain[0]).toEqual(board);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});
