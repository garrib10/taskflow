import { describe, expect, it } from "vitest";
import { freezeDeep, makeBoard, makeTask } from "../../test/fixtures";
import { taskStatuses } from "../task/Task";
import { createDefaultBoardFilters, filterBoardColumns, type BoardFilters } from "./boardFilters";

describe("board search and filters", () => {
  const board = makeBoard([
    makeTask({ id: "title", title: "SEARCH UI", description: "Design", priority: "high", category: "ui" }),
    makeTask({ id: "description", title: "Fix bug", description: "Search descriptions", priority: "low", category: "bug", status: "in-review" }),
    makeTask({ id: "progress", status: "in-progress" }),
    makeTask({ id: "done", status: "done" }),
  ]);
  freezeDeep(board);
  const visible = (overrides: Partial<BoardFilters> = {}) =>
    filterBoardColumns(board, { ...createDefaultBoardFilters(), ...overrides })
      .flatMap((column) => column.tasks.map((task) => task.id));
  it("searches titles case-insensitively and trims whitespace", () => {
    expect(visible({ searchTerm: "  search ui  " })).toEqual(["title"]);
  });
  it("searches descriptions", () => {
    expect(visible({ searchTerm: "DESCRIPTIONS" })).toEqual(["description"]);
  });
  it("filters priority", () => {
    expect(visible({ priorityFilter: "high" })).toEqual(["title"]);
    expect(visible({ priorityFilter: "low" })).toEqual(["description"]);
    expect(visible({ priorityFilter: "medium" })).toEqual(["progress", "done"]);
  });
  it("filters category", () => {
    expect(visible({ categoryFilter: "ui" })).toEqual(["title"]);
    expect(visible({ categoryFilter: "bug" })).toEqual(["description"]);
  });
  it.each(taskStatuses)("filters status %s", (status) => {
    const result = filterBoardColumns(board, { ...createDefaultBoardFilters(), statusFilter: status });
    expect(result.flatMap((column) => column.tasks)).toEqual(
      board.columns.flatMap((column) => column.tasks).filter((task) => task.status === status),
    );
  });
  it("combines every criterion with AND semantics", () => {
    expect(visible({ searchTerm: "search", priorityFilter: "low", categoryFilter: "bug", statusFilter: "in-review" })).toEqual(["description"]);
    expect(visible({ searchTerm: "search", priorityFilter: "high", categoryFilter: "bug" })).toEqual([]);
  });
  it("reset restores all tasks without changing domain state", () => {
    const before = structuredClone(board);
    expect(visible({ searchTerm: "no results", statusFilter: "done" })).toEqual([]);
    expect(createDefaultBoardFilters()).toEqual({ searchTerm: "", priorityFilter: "all", categoryFilter: "all", statusFilter: "all" });
    expect(filterBoardColumns(board, createDefaultBoardFilters())).toEqual(board.columns);
    expect(board).toEqual(before);
  });
});
