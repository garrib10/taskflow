import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { makeBoard, makeTask } from "./test/fixtures";
import { createTask, measureColumns, moveTask, savedTasks } from "./test/appJourney";
import { STORAGE_KEY } from "./utils/storage";

beforeEach(() => {
  localStorage.clear(); measureColumns();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, revision: "relationships", board: makeBoard([]) }));
});
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it("creates and edits linked tasks, blocks filtered incomplete children, completes and restores the whole family", async () => {
  const user = userEvent.setup(); const view = render(<App />);
  await user.click(screen.getByRole("button", { name: "+ Create Task" }));
  await createTask(user, "Release parent");
  await user.click(screen.getByRole("button", { name: "Open task Release parent" }));
  for (const title of ["First child", "Second child"]) {
    await user.click(screen.getByRole("button", { name: "Add SubTask to Release parent" }));
    await createTask(user, title, true);
  }
  await user.type(screen.getByLabelText("Title"), " edited");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));
  await user.click(screen.getByRole("button", { name: "Open task First child" }));
  expect(screen.getByRole("button", { name: "Open parent Release parent edited" })).toBeInTheDocument();
  await user.type(screen.getByLabelText("Description"), " updated");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));
  const parentId = savedTasks().find(task => task.title === "Release parent edited")!.id;
  expect(savedTasks().filter(task => task.parentId === parentId)).toHaveLength(2);
  await moveTask(user, "Release parent edited"); await moveTask(user, "Release parent edited");
  await user.type(screen.getByLabelText("Search:"), "Release parent");
  const before = localStorage.getItem(STORAGE_KEY);
  await moveTask(user, "Release parent edited");
  await waitFor(() => expect(screen.getByRole("status", { name: "Board updates" })).toHaveTextContent("Finish these subtasks before completing"));
  expect(screen.getByRole("status", { name: "Board updates" })).toHaveTextContent("First child, Second child");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  await user.click(screen.getByRole("button", { name: "Reset" }));
  for (const title of ["First child", "Second child"]) {
    for (let stage = 0; stage < 3; stage++) await moveTask(user, title);
  }
  expect(screen.getByRole("progressbar", { name: "Subtask completion for Release parent edited" })).toHaveAttribute("aria-valuenow", "2");
  await moveTask(user, "Release parent edited");
  await waitFor(() => expect(savedTasks().every(task => task.status === "done")).toBe(true));
  const completed = localStorage.getItem(STORAGE_KEY);
  await moveTask(user, "Release parent edited", "Left");
  await waitFor(() => expect(screen.getByRole("status", { name: "Board updates" })).toHaveTextContent("Cannot move task from done to in-review"));
  expect(localStorage.getItem(STORAGE_KEY)).toBe(completed);
  view.unmount(); render(<App />);
  expect(savedTasks()).toHaveLength(3);
  expect(savedTasks().filter(task => task.parentId === parentId)).toHaveLength(2);
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
});

it("excludes invalid parents from management and persists valid reassignment without loss", async () => {
  const parent = makeTask({ id: "parent", title: "Parent" });
  const child = makeTask({ id: "child", title: "Child", parentId: parent.id });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, revision: "links", board: makeBoard([
    parent, child, makeTask({ id: "other", title: "Other" }), makeTask({ id: "done", title: "Completed", status: "done" }),
  ]) }));
  const user = userEvent.setup(); render(<App />);
  const original = localStorage.getItem(STORAGE_KEY);
  await user.click(screen.getByRole("button", { name: "Open task Other" }));
  await user.click(screen.getByRole("button", { name: "Manage parent of Other" }));
  const parentSelect = within(screen.getByRole("dialog", { name: "Manage Parent" })).getByLabelText("Parent");
  expect(within(parentSelect).getByRole("option", { name: "Parent" })).toBeInTheDocument();
  expect(within(parentSelect).queryByRole("option", { name: "Child" })).not.toBeInTheDocument();
  expect(within(parentSelect).queryByRole("option", { name: "Other" })).not.toBeInTheDocument();
  await user.keyboard("{Escape}"); await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Open task Child" }));
  await user.click(screen.getByRole("button", { name: "Manage parent of Child" }));
  const dialog = within(screen.getByRole("dialog", { name: "Manage Parent" }));
  const select = dialog.getByLabelText("Parent");
  expect(within(select).queryByRole("option", { name: "Child" })).not.toBeInTheDocument();
  expect(within(select).queryByRole("option", { name: "Completed" })).not.toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
  await user.selectOptions(select, "other");
  await user.click(dialog.getByRole("button", { name: "Save Relationship" }));
  expect(savedTasks().find(task => task.id === "child")?.parentId).toBe("other");
  expect(savedTasks()).toHaveLength(4);
  expect(new Set(savedTasks().map(task => task.id)).size).toBe(4);
});

it("confirms child deletion and parent detachment, restores focus and persists no orphan links", async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, revision: "deletion", board: makeBoard([
    makeTask({ id: "p", title: "Parent" }), makeTask({ id: "a", title: "Child A", parentId: "p" }), makeTask({ id: "b", title: "Child B", parentId: "p" }),
  ]) }));
  const user = userEvent.setup(); const view = render(<App />);
  await user.click(screen.getByRole("button", { name: "Delete Child A" }));
  await user.click(within(screen.getByRole("dialog", { name: "Delete Task" })).getByRole("button", { name: "Delete" }));
  expect(savedTasks()).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Open task Child B" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Delete Parent" }));
  const raw = localStorage.getItem(STORAGE_KEY);
  const confirmation = screen.getByRole("dialog", { name: "Delete Parent Task" });
  expect(confirmation).toHaveAccessibleDescription(/kept as independent tasks/);
  expect(within(confirmation).getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  await user.click(screen.getByRole("button", { name: "Delete Parent" }));
  await user.click(screen.getByRole("button", { name: "Delete Parent and Detach Subtasks" }));
  expect(savedTasks()).toHaveLength(1);
  expect(savedTasks()[0]).toMatchObject({ id: "b", title: "Child B" });
  expect(savedTasks()[0].parentId).toBeUndefined();
  expect(screen.getByRole("button", { name: "Open task Child B" })).toHaveFocus();
  view.unmount(); render(<App />);
  await user.click(screen.getByRole("button", { name: "Open task Child B" }));
  expect(screen.getByRole("dialog", { name: "Edit Task" })).toBeInTheDocument();
});
