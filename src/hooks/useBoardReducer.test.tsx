import { StrictMode, type PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { currentBoardRaw, fixtureDate, makeBoard, makeTask } from "../test/fixtures";
import { boardReducer } from "../domain/board/boardReducer";
import * as persistenceBoundary from "../utils/storage";
import { useBoardReducer } from "./useBoardReducer";

afterEach(() => vi.restoreAllMocks());
const strict = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
it("does not save rejected multi-field edits or identity collisions, then saves one complete valid edit", () => {
  const seed = boardReducer(makeBoard([
    makeTask({ id: "parent" }),
    makeTask({ id: "child", parentId: "parent", status: "in-progress", subtasks: [{ id: "legacy-entry", title: "Legacy work", completed: true }] }),
  ]), { type: "INITIALIZE_MANUAL_ORDER", updatedAt: fixtureDate });
  let raw = currentBoardRaw(seed);
  const originalRaw = raw;
  const storage = { getItem: () => raw, setItem: vi.fn((_key: string, value: string) => { raw = value; }) };
  vi.spyOn(persistenceBoundary, "browserStorage").mockReturnValue(storage);
  const { result } = renderHook(useBoardReducer, { wrapper: strict });
  const original = result.current[0];
  const edits = { title: "Updated child", description: "Updated description", priority: "high", category: "testing" } as const;
  act(() => result.current[1]({ type: "UPDATE_TASK", taskId: "child", edits: { ...edits, title: "" }, updatedAt: new Date() }));
  act(() => result.current[1]({ type: "CREATE_TASK", task: makeTask({ id: "legacy-entry" }), updatedAt: new Date() }));
  expect(result.current[0]).toBe(original);
  expect(raw).toBe(originalRaw);
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(result.current[2].notice).toBeNull();
  act(() => result.current[1]({ type: "UPDATE_TASK", taskId: "child", edits, updatedAt: new Date() }));
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  const restored = persistenceBoundary.decodeBoard(raw);
  if (restored.kind !== "current") throw new Error("Valid edit did not round-trip");
  expect(restored.board).toEqual(result.current[0]);
  expect(restored.board.columns.flatMap(column => column.tasks).find(task => task.id === "child"))
    .toMatchObject({ ...edits, parentId: "parent", status: "in-progress", subtasks: [{ id: "legacy-entry", completed: true }] });
  expect(restored.board.columns.map(column => column.manualOrder)).toEqual(original.columns.map(column => column.manualOrder));
});
it("hydrates once per mount and exposes failed saves while reducer work stays usable", () => {
  const initial = currentBoardRaw(makeBoard(), "a");
  const storage = { getItem: vi.fn(() => initial), setItem: vi.fn(() => { throw new DOMException("Full", "QuotaExceededError"); }) };
  vi.spyOn(persistenceBoundary, "browserStorage").mockReturnValue(storage);
  const { result } = renderHook(useBoardReducer, { wrapper: strict });
  const readsAfterMount = storage.getItem.mock.calls.length;
  expect(storage.setItem).not.toHaveBeenCalled();
  act(() => result.current[1]({ type: "CREATE_TASK", task: makeTask({ id: "new-task", title: "Unsaved new task" }), updatedAt: new Date() }));
  expect(result.current[0].columns.flatMap((column) => column.tasks)).toHaveLength(2);
  expect(result.current[2].notice?.recovery).toBe("retry");
  expect(storage.getItem.mock.calls.length).toBe(readsAfterMount + 1);
});
it("pauses for external changes and removes listeners on unmount", () => {
  let current = currentBoardRaw(makeBoard(), "a");
  const storage = { getItem: () => current, setItem: vi.fn() };
  vi.spyOn(persistenceBoundary, "browserStorage").mockReturnValue(storage);
  const remove = vi.spyOn(window, "removeEventListener");
  const { result, unmount } = renderHook(useBoardReducer);
  const local = result.current[0];
  current = currentBoardRaw(makeBoard([makeTask({ title: "External work" })]), "b");
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: persistenceBoundary.STORAGE_KEY, newValue: current })));
  expect(result.current[0]).toBe(local);
  expect(result.current[2].notice?.message).toContain("Another tab");
  act(() => result.current[1]({ type: "CREATE_TASK", task: makeTask({ id: "new" }), updatedAt: new Date() }));
  expect(result.current[0].columns.flatMap((column) => column.tasks)).toHaveLength(2);
  expect(storage.setItem).not.toHaveBeenCalled();
  unmount();
  expect(remove).toHaveBeenCalledWith("storage", expect.any(Function));
});
