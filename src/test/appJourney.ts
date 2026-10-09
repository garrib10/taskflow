import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { vi } from "vitest";
import { taskStatuses, type Task } from "../domain/task/Task";
import { STORAGE_KEY } from "../utils/storage";

// jsdom has no layout. Keep real sensors and mock only browser measurements.
export function measureColumns() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const column = this.matches(".column") ? this : this.closest(".column");
    const index = taskStatuses.findIndex(status => column?.getAttribute("aria-labelledby") === `column-${status}-title`);
    if (this.matches(".column")) return new DOMRect(index * 344, 100, 320, 500);
    if (this.matches(".task-card")) return new DOMRect(index * 344 + 16, 150, 280, 180);
    return new DOMRect(0, 0, 1440, 900);
  });
}
export function savedTasks(): Task[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!).board.columns.flatMap((column: { tasks: Task[] }) => column.tasks);
}
export async function createTask(user: UserEvent, title: string, child = false) {
  const dialog = within(screen.getByRole("dialog", { name: child ? "Add SubTask" : "Create New Task" }));
  await user.type(dialog.getByLabelText("Title"), title);
  await user.type(dialog.getByLabelText("Description"), `${title} description`);
  await user.click(dialog.getByRole("button", { name: child ? "Create SubTask" : "Create Task" }));
}
export async function moveTask(user: UserEvent, title: string, direction: "Right" | "Left" = "Right") {
  screen.getByRole("group", { name: new RegExp(`^Move task ${title},`) }).focus();
  await user.keyboard(` {Arrow${direction}} `);
}
