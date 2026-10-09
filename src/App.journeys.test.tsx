import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { makeBoard, makeTask } from "./test/fixtures";
import { createTask, measureColumns, moveTask, savedTasks } from "./test/appJourney";
import { STORAGE_KEY } from "./utils/storage";

beforeEach(() => { localStorage.clear(); measureColumns(); });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it("creates, edits, moves, restores and deletes through the full application", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole("button", { name: "+ Create Task" }));
  expect(screen.getByLabelText("Title")).toHaveFocus();
  await createTask(user, "Journey task");
  const id = savedTasks().find(task => task.title === "Journey task")!.id;
  await user.click(screen.getByRole("button", { name: "Open task Journey task" }));
  const dialog = within(screen.getByRole("dialog", { name: "Edit Task" }));
  await user.clear(dialog.getByLabelText("Title"));
  await user.type(dialog.getByLabelText("Title"), "Edited journey");
  await user.clear(dialog.getByLabelText("Description"));
  await user.type(dialog.getByLabelText("Description"), "Updated description");
  await user.selectOptions(dialog.getByLabelText("Priority"), "high");
  await user.selectOptions(dialog.getByLabelText("Category"), "devops");
  await user.click(dialog.getByRole("button", { name: "Save Changes" }));
  await moveTask(user, "Edited journey");
  await waitFor(() => expect(savedTasks().find(task => task.id === id)).toMatchObject({ title: "Edited journey", description: "Updated description", priority: "high", category: "devops", status: "in-progress" }));
  view.unmount();
  render(<App />);
  expect(screen.getByRole("button", { name: "Open task Edited journey" })).toBeInTheDocument();
  const raw = localStorage.getItem(STORAGE_KEY);
  for (let attempt = 0; attempt < 2; attempt++) {
    await moveTask(user, "Edited journey", "Left");
    await waitFor(() => expect(screen.getByRole("status", { name: "Board updates" })).toHaveTextContent("Cannot move task from in-progress to todo"));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    const dismiss = screen.getByRole("button", { name: /Dismiss notification/ });
    dismiss.focus(); await user.keyboard("{Enter}");
    expect(screen.queryByRole("button", { name: /Dismiss notification/ })).not.toBeInTheDocument();
  }
  await user.click(screen.getByRole("button", { name: "Delete Edited journey" }));
  const confirmation = within(screen.getByRole("dialog", { name: "Delete Task" }));
  expect(confirmation.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.click(confirmation.getByRole("button", { name: "Delete" }));
  expect(savedTasks().some(task => task.id === id)).toBe(false);
  expect(screen.queryByRole("button", { name: "Open task Edited journey" })).not.toBeInTheDocument();
});

it("searches titles and descriptions, combines and resets filters without changing persisted state", async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, revision: "filters", board: makeBoard([
    makeTask({ id: "a", title: "Alpha deployment", description: "Release checklist", priority: "high", category: "devops" }),
    makeTask({ id: "b", title: "Beta", description: "Alpha research", priority: "low", category: "testing", status: "in-review" }),
    makeTask({ id: "c", title: "Gamma", description: "Other work", category: "feature", status: "in-progress" }),
  ]) }));
  const user = userEvent.setup(); render(<App />);
  const raw = localStorage.getItem(STORAGE_KEY);
  await user.type(screen.getByLabelText("Search:"), "alpha");
  expect(screen.getByText("2 tasks found")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Priority"), "high");
  await user.selectOptions(screen.getByLabelText("Category"), "devops");
  await user.selectOptions(screen.getByLabelText("Status"), "todo");
  expect(screen.getByText("1 task found")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open task Alpha deployment" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Reset" }));
  for (const [label, value, title] of [["Priority", "low", "Beta"], ["Category", "feature", "Gamma"], ["Status", "in-review", "Beta"]]) {
    await user.selectOptions(screen.getByLabelText(label), value);
    expect(screen.getByText("1 task found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Open task ${title}` })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset" }));
  }
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});
