import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import App from "./App";
import { makeBoard, makeTask } from "./test/fixtures";
import { STORAGE_KEY } from "./utils/storage";

afterEach(() => localStorage.clear());

it("keeps criteria and an open draft during an external-storage notice, then hydrates domain only on reload", async () => {
  const initial = JSON.stringify({ schemaVersion: 2, revision: "initial", board: makeBoard() });
  localStorage.setItem(STORAGE_KEY, initial);
  const user = userEvent.setup();
  const view = render(<App />);
  const criteria = within(screen.getByRole("search", { name: "Search and filter tasks" }));
  await user.type(screen.getByLabelText("Search:"), "Build");
  await user.selectOptions(screen.getByLabelText("Priority"), "medium");
  await user.click(screen.getByRole("button", { name: "Open task Build search" }));
  const dialog = within(screen.getByRole("dialog", { name: "Edit Task" }));
  await user.clear(dialog.getByLabelText("Title"));
  await user.type(dialog.getByLabelText("Title"), "Draft title");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(initial);

  const external = JSON.stringify({ schemaVersion: 2, revision: "external", board: makeBoard([makeTask({ title: "External work" })]) });
  localStorage.setItem(STORAGE_KEY, external);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: external })));
  expect(screen.getByRole("dialog", { name: "Edit Task" })).toBeInTheDocument();
  expect(dialog.getByLabelText("Title")).toHaveValue("Draft title");
  expect(screen.getByLabelText("Search:")).toHaveValue("Build");
  expect(criteria.getByLabelText("Priority")).toHaveValue("medium");
  expect(screen.getByRole("region", { name: "Board storage", hidden: true })).toHaveTextContent("Saving is paused");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(external);

  view.unmount();
  render(<App />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Search:")).toHaveValue("");
  expect(screen.getByLabelText("Priority")).toHaveValue("all");
  expect(screen.getByRole("button", { name: "Open task External work" })).toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(external);
});
