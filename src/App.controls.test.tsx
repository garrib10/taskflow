import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { currentBoardRaw, makeBoard, makeTask } from "./test/fixtures";
import { VIEW_PREFERENCES_KEY } from "./persistence/viewPreferences";
import { STORAGE_KEY } from "./utils/storage";

beforeEach(() => localStorage.clear());
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
function seed() {
  const board = makeBoard([
    makeTask({ id: "a", title: "Alpha release", description: "Launch notes", priority: "high", category: "devops" }),
    makeTask({ id: "b", title: "Beta review", description: "Alpha research", priority: "low", category: "testing", status: "in-review" }),
    makeTask({ id: "c", title: "Gamma design", description: "Visual work", category: "ui", status: "in-progress" }),
  ]);
  board.columns.forEach(column => { column.manualOrder = column.tasks.map(task => task.id); });
  const raw = currentBoardRaw(board);
  localStorage.setItem(STORAGE_KEY, raw);
  return raw;
}
const search = () => screen.getByRole("searchbox", { name: "Search tasks" });
const scope = () => screen.getByRole("search", { name: "Search and filter tasks" });
const summary = (text: string) => within(scope()).getByText(text, { selector: "p" });

it("finds titles and descriptions and clears search without clearing filters or losing focus", async () => {
  seed(); const user = userEvent.setup(); render(<App />);
  fireEvent.change(search(), { target: { value: "ALPHA" } });
  expect(summary("Showing 2 of 3 tasks")).toBeVisible();
  expect(screen.getByRole("button", { name: "Open task Beta review" })).toBeVisible();
  await user.selectOptions(screen.getByLabelText("Category"), "devops");
  expect(summary("Showing 1 of 3 tasks")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Clear search" }));
  expect(search()).toHaveValue(""); expect(search()).toHaveFocus();
  expect(screen.getByLabelText("Category")).toHaveValue("devops");
  expect(screen.getByRole("button", { name: "Remove Category: DevOps" })).toBeVisible();
  expect(screen.queryByRole("button", { name: /^Remove Search:/ })).not.toBeInTheDocument();
});

it("combines all conditions and removes them individually with predictable keyboard focus", async () => {
  const raw = seed(), user = userEvent.setup(); render(<App />);
  fireEvent.change(search(), { target: { value: "Alpha" } });
  await user.selectOptions(screen.getByLabelText("Priority"), "high");
  await user.selectOptions(screen.getByLabelText("Category"), "devops");
  await user.selectOptions(screen.getByLabelText("Status"), "todo");
  const active = screen.getByRole("list", { name: "Active search and filters" });
  expect(within(active).getAllByRole("button")).toHaveLength(4);
  expect(summary("Showing 1 of 3 tasks")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Remove Category: DevOps" }));
  expect(screen.getByRole("button", { name: "Remove Priority: High" })).toHaveFocus();
  expect(screen.getByLabelText("Category")).toHaveValue("all");
  expect(search()).toHaveValue("Alpha"); expect(screen.getByLabelText("Status")).toHaveValue("todo");
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Remove Status: todo" })).toHaveFocus();
  expect(screen.getByLabelText("Priority")).toHaveValue("all");
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Remove Search: “Alpha”" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(search()).toHaveFocus(); expect(search()).toHaveValue("");
  expect(screen.queryByRole("list", { name: "Active search and filters" })).not.toBeInTheDocument();
  expect(summary("3 tasks on board")).toBeVisible();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});

it("clears scope without changing ordering selection, board data or stored manual positions", async () => {
  const raw = seed(), user = userEvent.setup();
  localStorage.setItem(VIEW_PREFERENCES_KEY, '{"schemaVersion":1,"orderingMode":"manual"}');
  const view = render(<App />);
  fireEvent.change(search(), { target: { value: "Alpha" } });
  await user.selectOptions(screen.getByLabelText("Priority"), "high");
  expect(screen.getByLabelText("Ordering")).toHaveAccessibleDescription(/Clear search and filters to reorder/);
  const preference = localStorage.getItem(VIEW_PREFERENCES_KEY);
  await user.click(screen.getByRole("button", { name: "Clear all search and filters" }));
  expect(search()).toHaveFocus(); expect(search()).toHaveValue("");
  expect(screen.getByLabelText("Priority")).toHaveValue("all");
  expect(screen.getByLabelText("Ordering")).toHaveValue("manual");
  expect(screen.getByLabelText("Ordering")).toHaveAccessibleDescription(/Switching modes keeps your positions/);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  expect(localStorage.getItem(VIEW_PREFERENCES_KEY)).toBe(preference);
  view.unmount(); render(<App />);
  expect(screen.getByLabelText("Ordering")).toHaveValue("manual");
  expect(screen.getByRole("button", { name: "Clear all search and filters" })).toBeDisabled();
});

it("offers inline zero-result recovery while preserving all board tasks", async () => {
  const raw = seed(), user = userEvent.setup(); render(<App />);
  fireEvent.change(search(), { target: { value: "missing" } });
  const empty = screen.getByRole("region", { name: "No tasks match your search and filters" });
  expect(summary("Showing 0 of 3 tasks")).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Active search and filters" })).toHaveTextContent("missing");
  await user.click(within(empty).getByRole("button", { name: "Show all tasks" }));
  expect(search()).toHaveFocus(); expect(summary("3 tasks on board")).toBeVisible();
  expect(screen.queryByRole("region", { name: "No tasks match your search and filters" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});

it("keeps a genuinely empty board distinct from filtered zero results", () => {
  localStorage.setItem(STORAGE_KEY, currentBoardRaw(makeBoard([]))); render(<App />);
  expect(summary("0 tasks on board")).toBeVisible();
  fireEvent.change(search(), { target: { value: "missing" } });
  expect(screen.queryByRole("region", { name: "No tasks match your search and filters" })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "todo (0)" })).toHaveTextContent("Create a task to start your workflow.");
});

it("reports matching and complete-board counts separately without reducing hidden capacity", () => {
  const board = makeBoard(Array.from({ length: 5 }, (_, index) => makeTask({ id: `p${index}`, title: `Occupant ${index}`, status: "in-progress" })));
  localStorage.setItem(STORAGE_KEY, currentBoardRaw(board)); render(<App />);
  fireEvent.change(search(), { target: { value: "Occupant 0" } });
  expect(summary("Showing 1 of 5 tasks")).toBeVisible();
  const stage = screen.getByRole("region", { name: "in-progress (5)" });
  expect(stage).toHaveTextContent("5 / 5Full"); expect(stage).toHaveTextContent("1 shown · 5 total");
});

it("exposes native groups, selected ordering and a restrained count status", async () => {
  seed(); render(<App />);
  expect(screen.getByRole("group", { name: "Task filters" })).toBeVisible();
  expect(screen.getByLabelText("Ordering")).toHaveValue("priority");
  expect(screen.getByLabelText("Ordering")).not.toHaveAttribute("aria-describedby");
  fireEvent.change(search(), { target: { value: "missing" } });
  fireEvent.change(search(), { target: { value: "Alpha" } });
  const status = screen.getByRole("status", { name: "Search results" });
  expect(status).toHaveTextContent("3 tasks on board");
  expect(await within(status).findByText("Showing 2 of 3 tasks")).toBeInTheDocument();
  expect(screen.getAllByRole("status", { name: "Search results" })).toHaveLength(1);
});

it("shows active conditions outside collapsed mobile filters and clears within the sheet safely", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  seed(); const user = userEvent.setup(); render(<App />);
  fireEvent.change(search(), { target: { value: "Alpha" } });
  await user.click(screen.getByRole("button", { name: "Filters (0)" }));
  const sheet = screen.getByRole("dialog", { name: "Filter tasks" });
  expect(sheet).toHaveTextContent("Search: “Alpha”");
  await user.selectOptions(within(sheet).getByLabelText("Category"), "devops");
  await user.selectOptions(within(sheet).getByLabelText("Priority"), "high");
  await user.click(within(sheet).getByRole("button", { name: "Done" }));
  expect(screen.getByRole("button", { name: "Filters (2)" })).toHaveFocus();
  expect(screen.getByRole("button", { name: "Remove Category: DevOps" })).toBeVisible();
  expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Remove Priority: High" }));
  expect(screen.getByRole("button", { name: "Filters (1)" })).toHaveAttribute("aria-expanded", "false");
  await user.click(screen.getByRole("button", { name: "Filters (1)" }));
  await user.click(within(screen.getByRole("dialog", { name: "Filter tasks" })).getByRole("button", { name: "Clear all search and filters" }));
  expect(screen.getByLabelText("Priority")).toHaveFocus();
  expect(screen.getAllByRole("status", { name: "Search results" })).toHaveLength(1);
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Filters (0)" })).toHaveFocus();
  expect(search()).toHaveValue("");
});

it("clears focused search on Escape, keeps other conditions, and respects composition input", async () => {
  seed(); const user = userEvent.setup(); render(<App />);
  await user.selectOptions(screen.getByLabelText("Category"), "devops");
  fireEvent.change(search(), { target: { value: "Alpha" } }); search().focus();
  fireEvent.keyDown(search(), { key: "Escape", isComposing: true });
  expect(search()).toHaveValue("Alpha");
  await user.keyboard("{Escape}");
  expect(search()).toHaveValue(""); expect(search()).toHaveFocus();
  expect(screen.getByLabelText("Category")).toHaveValue("devops");
  await user.keyboard("{Escape}"); expect(search()).toHaveFocus();
});

it.each([false, true])("returns the final filter removal to its control (mobile: %s)", async mobile => {
  if (mobile) vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  seed(); const user = userEvent.setup(); render(<App />);
  if (mobile) await user.click(screen.getByRole("button", { name: "Filters (0)" }));
  await user.selectOptions(screen.getByLabelText("Priority"), "high");
  if (mobile) await user.click(screen.getByRole("button", { name: "Done" }));
  await user.click(screen.getByRole("button", { name: "Remove Priority: High" }));
  expect(mobile ? screen.getByRole("button", { name: "Filters (0)" }) : screen.getByLabelText("Priority")).toHaveFocus();
});

it("offers deliberate mobile navigation to matching stages without clearing the current scope", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const raw = seed(), user = userEvent.setup(); render(<App />);
  fireEvent.change(search(), { target: { value: "research" } });
  const notice = screen.getByRole("region", { name: "Matches in other stages" });
  expect(screen.queryByRole("region", { name: "No tasks match your search and filters" })).not.toBeInTheDocument();
  expect(summary("Showing 1 of 3 tasks")).toBeVisible();
  await user.click(within(notice).getByRole("button", { name: "View in-review" }));
  expect(screen.getByLabelText("Workflow stage")).toHaveFocus();
  expect(screen.getByLabelText("Workflow stage")).toHaveValue("in-review");
  expect(screen.getByRole("button", { name: "Open task Beta review" })).toBeVisible();
  expect(search()).toHaveValue("research");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});
