import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import AppShell from "./AppShell";

it("provides one page header/main and named board context with native creation and separate overlays", async () => {
  const create = vi.fn(), user = userEvent.setup();
  render(<AppShell lastUpdated={new Date("2026-10-11T10:00:00Z")} onCreateTask={create}
    feedback={<section aria-label="Board storage">Saving paused</section>}
    toolbar={<div role="search" aria-label="Search and filter tasks" />}
    overlays={<div role="dialog" aria-label="Task details" />}>
    <section aria-label="Workflow columns">A long task title remains board-owned</section>
  </AppShell>);
  expect(within(screen.getByRole("banner")).getByRole("heading", { level: 1 })).toHaveTextContent("TaskFlow");
  const main = screen.getByRole("main", { name: "Task board" });
  expect(main).toContainElement(screen.getByRole("region", { name: "Workflow columns" }));
  expect(main).toContainElement(screen.getByRole("region", { name: "Board storage" }));
  expect(main).not.toContainElement(screen.getByRole("dialog"));
  await user.click(screen.getByRole("button", { name: "+ Create Task" }));
  expect(create).toHaveBeenCalledOnce();
});
