import { useState } from "react";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  expect(within(screen.getByRole("banner")).getByRole("heading", { level: 1, name: "TaskFlow" })).toBeVisible();
  const main = screen.getByRole("main", { name: "Task board" });
  expect(main).toContainElement(screen.getByRole("region", { name: "Workflow columns" }));
  expect(main).toContainElement(screen.getByRole("region", { name: "Board storage" }));
  expect(main).not.toContainElement(screen.getByRole("dialog"));
  await user.click(screen.getByRole("button", { name: "+ Create Task" }));
  expect(create).toHaveBeenCalledOnce();
});

it("restores a pointer-opened modal even when the browser did not focus the clicked button", async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return <AppShell lastUpdated={new Date("2026-01-01")} onCreateTask={() => setOpen(true)} feedback={null} toolbar={null}
      overlays={open && <ConfirmModal title="Focus check" message="Keep the real opener." onCancel={() => setOpen(false)} onConfirm={() => setOpen(false)} />}>
      <p>Board content</p>
    </AppShell>;
  }
  const user = userEvent.setup(); render(<Harness />);
  const opener = screen.getByRole("button", { name: "+ Create Task" });
  expect(opener).not.toHaveFocus();
  // fireEvent, unlike userEvent.click, deliberately supplies no implicit pointer focus.
  fireEvent.click(opener.querySelector("svg")!);
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(opener).toHaveFocus();
});
