import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { makeBoard, makeTask } from "./test/fixtures";
import { STORAGE_KEY } from "./utils/storage";

const current = (revision = "original", title = "Saved task") => JSON.stringify({ schemaVersion: 2, revision, board: makeBoard([makeTask({ title })]) });
beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
const storageNotice = (text: RegExp) => screen.getAllByRole("status").find(node => text.test(node.textContent ?? ""));

it("communicates an empty fallback accurately and keeps recovery available after dismissing a corrupt-data warning", async () => {
  localStorage.setItem(STORAGE_KEY, "{broken");
  const user = userEvent.setup();
  render(<App />);
  const warning = storageNotice(/saved board is invalid/)!;
  expect(warning).toHaveTextContent("Warning: Your saved board is invalid");
  expect(warning).toHaveTextContent("An empty workspace is open; the original is untouched");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  await user.click(within(warning).getByRole("button", { name: /Dismiss notification/ }));
  expect(storageNotice(/saved board is invalid/)).toBeUndefined();
  expect(screen.getByRole("region", { name: "Board storage" })).toHaveTextContent("saving is paused");
  expect(screen.getByRole("button", { name: "Reload saved board" })).toBeEnabled();
  expect(localStorage.getItem(STORAGE_KEY)).toBe("{broken");
});

it("announces a committed migration once, converts the checklist, and stays silent on the next load", () => {
  const legacy = makeBoard([makeTask({ title: "Legacy parent", subtasks: [{ id: "legacy-child", title: "Legacy child", completed: false }] })]);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
  const view = render(<App />);
  expect(storageNotice(/saved board was upgraded/)).toHaveTextContent("Information:");
  expect(screen.getByRole("button", { name: "Open task Legacy child" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).schemaVersion).toBe(2);
  view.unmount();
  render(<App />);
  expect(storageNotice(/saved board was upgraded/)).toBeUndefined();
  expect(screen.getAllByRole("button", { name: "Open task Legacy child" })).toHaveLength(1);
});

it("reports migration failure without overwriting the original or claiming success", () => {
  const raw = JSON.stringify(makeBoard([makeTask({ status: "done", subtasks: [{ id: "unfinished", title: "Unfinished", completed: false }] })]));
  localStorage.setItem(STORAGE_KEY, raw);
  render(<App />);
  expect(screen.getByRole("alert")).toHaveTextContent("older saved board could not be upgraded safely");
  expect(screen.getByRole("alert")).toHaveTextContent("An empty workspace is open");
  expect(storageNotice(/upgraded to the current/)).toBeUndefined();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});

it("reports an unsupported future version without exposing serialized data", () => {
  const raw = JSON.stringify({ schemaVersion: 99, privateData: "do not show this" });
  localStorage.setItem(STORAGE_KEY, raw);
  render(<App />);
  expect(screen.getByRole("alert")).toHaveTextContent("needs a newer TaskFlow version");
  expect(screen.getByRole("alert")).not.toHaveTextContent("do not show this");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});

it("reports unavailable storage without exposing the raw exception", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("private exception details"); });
  render(<App />);
  expect(screen.getByRole("alert")).toHaveTextContent("Browser storage is unavailable");
  expect(screen.getByRole("alert")).not.toHaveTextContent("private exception details");
  expect(screen.queryByRole("button", { name: "Retry saving" })).not.toBeInTheDocument();
});

it("reports a failed write, preserves the saved board, and only confirms saving after retry succeeds", async () => {
  const raw = current();
  localStorage.setItem(STORAGE_KEY, raw);
  const user = userEvent.setup();
  render(<App />);
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new DOMException("Full", "QuotaExceededError"); });
  await user.click(screen.getByRole("button", { name: "Edit Saved task" }));
  await user.type(screen.getByLabelText("Title"), " updated");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(screen.getByRole("alert")).toHaveTextContent("could not confirm that your changes were saved");
  expect(storageNotice(/Changes in this tab are now saved/)).toBeUndefined();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  expect(screen.getByRole("button", { name: "Open task Saved task updated" })).toBeInTheDocument();
  write.mockRestore();
  await user.click(screen.getByRole("button", { name: "Retry saving" }));
  expect(screen.getByRole("button", { name: "+ Create Task" })).toHaveFocus();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(storageNotice(/Changes in this tab are now saved/)).toHaveTextContent("Success:");
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).board.columns[0].tasks[0].title).toBe("Saved task updated");
});

it("does not announce normal loads or automatic saves", async () => {
  localStorage.setItem(STORAGE_KEY, current());
  const user = userEvent.setup();
  render(<App />);
  expect(screen.queryByRole("button", { name: /Dismiss notification/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Edit Saved task" }));
  await user.type(screen.getByLabelText("Description"), " updated");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(screen.getByRole("status", { name: "Board updates" })).toHaveTextContent('Updated "Saved task".');
  expect(screen.getAllByRole("button", { name: /Dismiss notification/ })).toHaveLength(1);
  expect(screen.queryByRole("region", { name: "Board storage" })).not.toBeInTheDocument();
});

it("keeps a valid external-tab warning available during routine local edits without overwriting either board", async () => {
  localStorage.setItem(STORAGE_KEY, current());
  const user = userEvent.setup();
  render(<App />);
  const external = current("external", "External work");
  localStorage.setItem(STORAGE_KEY, external);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: external, storageArea: localStorage })));
  const warning = storageNotice(/Another tab changed/)!;
  expect(warning).toHaveTextContent("Warning:");
  expect(screen.getByRole("button", { name: "Reload saved board" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Edit Saved task" }));
  await user.type(screen.getByLabelText("Title"), " local");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(warning).toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(external);
  expect(screen.getByRole("button", { name: "Open task Saved task local" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
