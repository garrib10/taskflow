import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { currentBoardRaw, makeBoard, makeTask } from "./test/fixtures";
import { boardReducer } from "./domain/board/boardReducer";
import { VIEW_PREFERENCES_KEY } from "./persistence/viewPreferences";
import { STORAGE_KEY } from "./utils/storage";

beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
function seed(initialized = true) {
  let board = makeBoard([makeTask({ id: "a", title: "Alpha", priority: "low" }), makeTask({ id: "b", title: "Beta", priority: "high" })]);
  if (initialized) {
    board = boardReducer(board, { type: "INITIALIZE_MANUAL_ORDER", updatedAt: board.lastUpdated });
    board.columns[0].manualOrder = ["a", "b"];
  }
  const raw = currentBoardRaw(board);
  localStorage.setItem(STORAGE_KEY, raw);
  return raw;
}
const titles = () => within(screen.getByRole("region", { name: "todo (2)" })).getAllByRole("heading", { level: 3 }).map(node => node.textContent);

it("restores Manual without hydration writes, preserves independent priority ties and positions across mode switches/remount", async () => {
  const raw = seed();
  localStorage.setItem(VIEW_PREFERENCES_KEY, '{"schemaVersion":1,"orderingMode":"manual"}');
  const write = vi.spyOn(Storage.prototype, "setItem");
  const user = userEvent.setup(); const view = render(<App />);
  expect(screen.getByLabelText("Ordering")).toHaveValue("manual");
  expect(titles()).toEqual(["Alpha", "Beta"]);
  expect(write).not.toHaveBeenCalled();
  await user.selectOptions(screen.getByLabelText("Ordering"), "priority");
  expect(titles()).toEqual(["Beta", "Alpha"]);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  expect(JSON.parse(localStorage.getItem(VIEW_PREFERENCES_KEY) ?? "null")).toEqual({ schemaVersion: 1, orderingMode: "priority" });
  view.unmount(); const next = render(<App />);
  expect(screen.getByLabelText("Ordering")).toHaveValue("priority");
  await user.selectOptions(screen.getByLabelText("Ordering"), "manual");
  expect(titles()).toEqual(["Alpha", "Beta"]);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  next.unmount(); render(<App />);
  expect(screen.getByLabelText("Ordering")).toHaveValue("manual");
  expect(titles()).toEqual(["Alpha", "Beta"]);
});

it.each(["{broken", '{"schemaVersion":1,"orderingMode":"unsupported"}', '{"schemaVersion":9,"private":"future"}'])("invalid/future preferences retain valid board and original preference bytes: %s", raw => {
    const originalBoard = seed(); localStorage.setItem(VIEW_PREFERENCES_KEY, raw);
    const write = vi.spyOn(Storage.prototype, "setItem"); render(<App />);
    expect(screen.getByLabelText("Ordering")).toHaveValue("priority");
    expect(titles()).toEqual(["Beta", "Alpha"]);
    expect(screen.queryByRole("region", { name: "Board storage" })).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(originalBoard);
    expect(localStorage.getItem(VIEW_PREFERENCES_KEY)).toBe(raw);
    expect(write).not.toHaveBeenCalled();
  });

it("saved Manual never initializes missing positions on startup, but explicit selection saves board before preference", async () => {
  const originalBoard = seed(false);
  localStorage.setItem(VIEW_PREFERENCES_KEY, '{"schemaVersion":1,"orderingMode":"manual"}');
  const write = vi.spyOn(Storage.prototype, "setItem"); const user = userEvent.setup(); render(<App />);
  expect(screen.getByLabelText("Ordering")).toHaveValue("priority");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(originalBoard);
  expect(write).not.toHaveBeenCalled();
  await user.selectOptions(screen.getByLabelText("Ordering"), "manual");
  expect(screen.getByLabelText("Ordering")).toHaveValue("manual");
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null").board.columns[0].manualOrder).toEqual(["b", "a"]);
  // The existing Manual preference is already exact; no redundant rewrite.
  expect(write.mock.calls.map(call => call[0])).toEqual([STORAGE_KEY]);
});

it("failed board initialization keeps Priority and source board; does not save a Manual preference", async () => {
  const originalBoard = seed(false);
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota"); });
  const user = userEvent.setup(); render(<App />);
  await user.selectOptions(screen.getByLabelText("Ordering"), "manual");
  expect(screen.getByLabelText("Ordering")).toHaveValue("priority");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(originalBoard);
  expect(localStorage.getItem(VIEW_PREFERENCES_KEY)).toBeNull();
  expect(write.mock.calls.map(call => call[0])).toEqual([STORAGE_KEY]);
});

it("preference-only write failure retains session Manual and permits independently saved task edits", async () => {
  seed();
  const set = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    if (key === VIEW_PREFERENCES_KEY) throw new Error("Private quota");
    set.call(this, key, value);
  });
  const user = userEvent.setup(); const view = render(<App />);
  await user.selectOptions(screen.getByLabelText("Ordering"), "manual");
  expect(screen.getByLabelText("Ordering")).toHaveValue("manual");
  expect(screen.getAllByRole("status").some(node => node.textContent?.includes("ordering choice could not be saved"))).toBe(true);
  expect(screen.queryByRole("region", { name: "Board storage" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Open task Alpha" })); await user.click(screen.getByRole("button", { name: "Edit task" }));
  await user.clear(screen.getByLabelText("Title")); await user.type(screen.getByLabelText("Title"), "Edited Alpha");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null").board.columns[0].tasks[0].title).toBe("Edited Alpha");
  view.unmount(); render(<App />);
  expect(screen.getByLabelText("Ordering")).toHaveValue("priority");
});

it("keeps preference hydration independent of missing/failed boards and never bypasses order recovery", () => {
  localStorage.setItem(VIEW_PREFERENCES_KEY, '{"schemaVersion":1,"orderingMode":"priority"}');
  const view = render(<App />);
  expect(screen.getByLabelText("Ordering")).toHaveValue("priority");
  expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  view.unmount();
  const raw = JSON.parse(seed()); raw.board.columns[0].manualOrder = ["a", "a"];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  localStorage.setItem(VIEW_PREFERENCES_KEY, '{"schemaVersion":1,"orderingMode":"manual"}');
  render(<App />);
  expect(screen.getByLabelText("Ordering")).toHaveValue("priority");
  expect(screen.getByRole("region", { name: "Board storage" })).toHaveTextContent("saving is paused");
});

it("reorders only in Manual, persists positions, keeps filters/drafts outside both envelopes", async () => {
  seed(); const user = userEvent.setup(); const view = render(<App />);
  await user.selectOptions(screen.getByLabelText("Ordering"), "manual");
  await user.click(screen.getByLabelText("Movement actions for Alpha"));
  await user.click(screen.getByRole("button", { name: "Move Alpha later" }));
  expect(titles()).toEqual(["Beta", "Alpha"]);
  await user.type(screen.getByLabelText("Search:"), "Alpha");
  expect(screen.getByRole("button", { name: "Move Alpha earlier" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "+ Create Task" }));
  await user.type(screen.getByLabelText("Title"), "Unsaved draft");
  expect(JSON.parse(localStorage.getItem(VIEW_PREFERENCES_KEY) ?? "null")).toEqual({ schemaVersion: 1, orderingMode: "manual" });
  expect(localStorage.getItem(STORAGE_KEY)).not.toContain("Unsaved draft");
  view.unmount(); render(<App />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Search:")).toHaveValue("");
  expect(screen.getByLabelText("Ordering")).toHaveValue("manual");
  expect(titles()).toEqual(["Beta", "Alpha"]);
});

it("preference read restrictions leave board hydration and saving available", async () => {
  const raw = seed();
  const get = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key) {
    if (key === VIEW_PREFERENCES_KEY) throw new Error("Private read failure");
    return get.call(this, key);
  });
  render(<App />);
  expect(screen.getByLabelText("Ordering")).toHaveValue("priority");
  expect(titles()).toEqual(["Beta", "Alpha"]);
  expect(get.call(localStorage, STORAGE_KEY)).toBe(raw);
  expect(screen.queryByRole("region", { name: "Board storage" })).not.toBeInTheDocument();
});

it("board recovery does not invalidate valid independent preferences or allow Manual initialization", async () => {
  const raw = '{"schemaVersion":99,"private":"future board"}';
  localStorage.setItem(STORAGE_KEY, raw);
  localStorage.setItem(VIEW_PREFERENCES_KEY, '{"schemaVersion":1,"orderingMode":"priority"}');
  const write = vi.spyOn(Storage.prototype, "setItem");
  const user = userEvent.setup(); render(<App />);
  await user.selectOptions(screen.getByLabelText("Ordering"), "manual");
  expect(screen.getByLabelText("Ordering")).toHaveValue("priority");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  expect(localStorage.getItem(VIEW_PREFERENCES_KEY)).toBe('{"schemaVersion":1,"orderingMode":"priority"}');
  expect(write).not.toHaveBeenCalled();
  expect(screen.getByRole("region", { name: "Board storage" })).toHaveTextContent("newer TaskFlow");
});
