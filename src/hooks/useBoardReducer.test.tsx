import { StrictMode, type PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { makeBoard, makeTask } from "../test/fixtures";
import * as persistenceBoundary from "../utils/storage";
import { useBoardReducer } from "./useBoardReducer";

afterEach(() => vi.restoreAllMocks());
const strict = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
it("hydrates once per mount and exposes failed saves while reducer work stays usable", () => {
  const initial = JSON.stringify({ schemaVersion: 2, revision: "a", board: makeBoard() });
  const storage = { getItem: vi.fn(() => initial), setItem: vi.fn(() => { throw new DOMException("Full", "QuotaExceededError"); }) };
  vi.spyOn(persistenceBoundary, "browserStorage").mockReturnValue(storage);
  const { result } = renderHook(useBoardReducer, { wrapper: strict });
  const readsAfterMount = storage.getItem.mock.calls.length;
  expect(storage.setItem).not.toHaveBeenCalled();
  act(() => result.current[1]({ type: "CREATE_TASK", task: makeTask({ id: "new-task", title: "Unsaved new task" }), updatedAt: new Date() }));
  expect(result.current[0].columns.flatMap((column) => column.tasks)).toHaveLength(2);
  expect(result.current[2].notice?.canRetry).toBe(true);
  expect(storage.getItem.mock.calls.length).toBe(readsAfterMount + 1);
});
it("pauses for external changes and removes listeners on unmount", () => {
  let current = JSON.stringify({ schemaVersion: 2, revision: "a", board: makeBoard() });
  const storage = { getItem: () => current, setItem: vi.fn() };
  vi.spyOn(persistenceBoundary, "browserStorage").mockReturnValue(storage);
  const remove = vi.spyOn(window, "removeEventListener");
  const { result, unmount } = renderHook(useBoardReducer);
  const local = result.current[0];
  current = JSON.stringify({ schemaVersion: 2, revision: "b", board: makeBoard([makeTask({ title: "External work" })]) });
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: persistenceBoundary.STORAGE_KEY, newValue: current })));
  expect(result.current[0]).toBe(local);
  expect(result.current[2].notice?.message).toContain("Another tab");
  act(() => result.current[1]({ type: "CREATE_TASK", task: makeTask({ id: "new" }), updatedAt: new Date() }));
  expect(result.current[0].columns.flatMap((column) => column.tasks)).toHaveLength(2);
  expect(storage.setItem).not.toHaveBeenCalled();
  unmount();
  expect(remove).toHaveBeenCalledWith("storage", expect.any(Function));
});
