import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it } from "vitest";
import App from "./App";
import { currentBoardRaw, makeBoard, makeTask } from "./test/fixtures";
import { STORAGE_KEY } from "./utils/storage";
import { VIEW_PREFERENCES_KEY } from "./persistence/viewPreferences";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());
const raw = () => localStorage.getItem(STORAGE_KEY)!;
const saved = () => JSON.parse(raw()).board;

it("keeps an immediately saved stage when invalid content is rejected and its draft is discarded", async () => {
  const task = makeTask({ title: "Saved content", description: "Original notes" });
  localStorage.setItem(STORAGE_KEY, currentBoardRaw(makeBoard([task])));
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole("button", { name: "Open task Saved content" }));
  await user.click(screen.getByRole("button", { name: "Edit task" }));
  const editor = within(screen.getByRole("dialog", { name: "Edit Task" }));
  await user.clear(editor.getByLabelText("Title"));
  await user.type(editor.getByLabelText("Title"), "Uncommitted title");
  await user.clear(editor.getByLabelText("Description"));
  await user.selectOptions(editor.getByLabelText("Priority"), "high");
  await user.selectOptions(editor.getByLabelText("Category"), "bug");
  await user.selectOptions(editor.getByLabelText("Stage"), "in-progress");
  expect(saved().columns.flatMap((column: { tasks: unknown[] }) => column.tasks)).toMatchObject([
    { id: task.id, title: task.title, description: task.description, priority: task.priority, category: task.category, status: "in-progress" },
  ]);
  const committedMove = raw();
  expect(editor.getByLabelText("Title")).toHaveValue("Uncommitted title");
  await user.click(editor.getByRole("button", { name: "Save Changes" }));
  expect(editor.getByLabelText("Description")).toHaveFocus();
  expect(editor.getByLabelText("Description")).toHaveAttribute("aria-invalid", "true");
  expect(editor.getByLabelText("Description")).toHaveAccessibleDescription(/Task description is required/);
  expect(raw()).toBe(committedMove);
  await user.keyboard("{Escape}");
  const confirmation = within(screen.getByRole("dialog", { name: "Discard Changes?" }));
  expect(confirmation.getByRole("button", { name: "Keep Editing" })).toHaveFocus();
  await user.click(confirmation.getByRole("button", { name: "Discard" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open task Saved content" })).toHaveFocus();
  expect(raw()).toBe(committedMove);
  view.unmount();
  render(<App />);
  expect(within(screen.getByRole("region", { name: "in-progress (1)" })).getByRole("button", { name: "Open task Saved content" })).toBeVisible();
  expect(raw()).toBe(committedMove);
});

it("rejects a hidden full stage without saving a metadata draft, then saves all content while retaining the child link and positions", async () => {
  const child = makeTask({ id: "child", title: "Incoming child", parentId: "parent" });
  const board = makeBoard([
    makeTask({ id: "parent", title: "Parent work" }), child,
    ...Array.from({ length: 5 }, (_, index) => makeTask({ id: `occupied-${index}`, title: `Occupant ${index}`, status: "in-progress" })),
  ]);
  board.columns.forEach(column => { column.manualOrder = column.tasks.map(task => task.id); });
  const initial = currentBoardRaw(board);
  const original = JSON.parse(initial).board;
  const preference = '{"schemaVersion":1,"orderingMode":"manual"}';
  localStorage.setItem(STORAGE_KEY, initial);
  localStorage.setItem(VIEW_PREFERENCES_KEY, preference);
  const user = userEvent.setup();
  render(<App />);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), { target: { value: child.title } });
  await user.click(screen.getByRole("button", { name: "Open task Incoming child" }));
  await user.click(screen.getByRole("button", { name: "Edit task" }));
  const editor = within(screen.getByRole("dialog", { name: "Edit SubTask" }));
  await user.clear(editor.getByLabelText("Title"));
  await user.type(editor.getByLabelText("Title"), "Incoming child updated");
  await user.clear(editor.getByLabelText("Description"));
  await user.type(editor.getByLabelText("Description"), "Updated notes");
  await user.selectOptions(editor.getByLabelText("Priority"), "high");
  await user.selectOptions(editor.getByLabelText("Category"), "testing");
  await user.selectOptions(editor.getByLabelText("Stage"), "in-progress");
  const stage = editor.getByLabelText("Stage");
  expect(stage).toHaveValue("todo");
  expect(stage).toHaveFocus();
  expect(stage).toHaveAttribute("aria-invalid", "true");
  expect(stage).toHaveAccessibleDescription(/full.*Tasks hidden by search or filters still count/);
  expect(editor.getByLabelText("Title")).toHaveValue("Incoming child updated");
  expect(editor.getByLabelText("Description")).toHaveValue("Updated notes");
  expect(editor.getByLabelText("Priority")).toHaveValue("high");
  expect(editor.getByLabelText("Category")).toHaveValue("testing");
  expect(raw()).toBe(initial);
  await user.click(editor.getByRole("button", { name: "Save Changes" }));
  const result = saved();
  expect(result.columns[0].tasks).toEqual([original.columns[0].tasks[0], {
    ...original.columns[0].tasks[1], title: "Incoming child updated", description: "Updated notes", priority: "high", category: "testing",
  }]);
  expect(result.columns.slice(1)).toEqual(original.columns.slice(1));
  expect(result.columns.map((column: { manualOrder: string[] }) => column.manualOrder)).toEqual(board.columns.map(column => column.manualOrder));
  expect(localStorage.getItem(VIEW_PREFERENCES_KEY)).toBe(preference);
  expect(screen.getByRole("button", { name: "Open task Incoming child updated" })).toHaveFocus();
  expect(screen.getByRole("region", { name: "in-progress (5)" })).toHaveTextContent("0 shown · 5 total");
});
