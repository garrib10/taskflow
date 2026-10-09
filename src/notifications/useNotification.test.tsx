import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, expectTypeOf, it, vi } from "vitest";
import { createNotification, type NotificationVariant, type TaskNotification } from "./notification";
import { useNotification } from "./useNotification";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

it.each(["success", "info"] as const)("expires %s at its documented duration", variant => {
  const { result } = renderHook(() => useNotification());
  act(() => { result.current.show(variant, "Completed"); });
  const duration = variant === "success" ? 4000 : 6000;
  act(() => vi.advanceTimersByTime(duration - 1));
  expect(result.current.notification?.message).toBe("Completed");
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.notification).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["warning", "error"] as const)("keeps %s until manually dismissed", variant => {
  const { result } = renderHook(() => useNotification());
  act(() => { result.current.show(variant, "Needs attention"); });
  act(() => vi.advanceTimersByTime(60000));
  expect(result.current.notification?.dismissal).toBe("manual");
  expect(vi.getTimerCount()).toBe(0);
  act(() => { result.current.dismiss(result.current.notification!.id); });
  expect(result.current.notification).toBeNull();
});

it("replaces timers and prevents an old timeout from dismissing a newer notice", () => {
  const schedule = vi.spyOn(window, "setTimeout");
  const { result } = renderHook(() => useNotification());
  act(() => { result.current.show("success", "First"); });
  const oldCallback = schedule.mock.calls.at(-1)![0] as () => void;
  act(() => vi.advanceTimersByTime(3000));
  act(() => { result.current.show("info", "Second"); });
  expect(vi.getTimerCount()).toBe(1);
  act(oldCallback);
  expect(result.current.notification?.message).toBe("Second");
  act(() => vi.advanceTimersByTime(5999));
  expect(result.current.notification?.message).toBe("Second");
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.notification).toBeNull();
});

it("cleans up on manual dismissal, replacement by a warning, and unmount in StrictMode", () => {
  const { result, unmount } = renderHook(() => useNotification(), { wrapper: StrictMode });
  act(() => { result.current.show("success", "Saved"); });
  act(() => { result.current.dismiss(result.current.notification!.id); });
  expect(vi.getTimerCount()).toBe(0);
  act(() => { result.current.show("info", "Migration"); });
  act(() => { result.current.show("warning", "Conflict"); });
  expect(vi.getTimerCount()).toBe(0);
  act(() => { result.current.show("success", "Recovered"); });
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("assigns repeated equivalent outcomes new IDs and restarts their interval", () => {
  const { result } = renderHook(() => useNotification());
  act(() => { result.current.show("info", "Migration"); });
  const first = result.current.notification!.id;
  act(() => vi.advanceTimersByTime(5000));
  act(() => { result.current.show("info", "Migration"); });
  expect(result.current.notification!.id).not.toBe(first);
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.notification?.message).toBe("Migration");
});

it("dismisses external notices by ID without hiding a replacement or replaying an unchanged source", () => {
  const initial = createNotification("info", "Upgraded");
  const { result, rerender } = renderHook(({ source }: { source: TaskNotification | null }) => useNotification(source), { initialProps: { source: initial } });
  act(() => vi.advanceTimersByTime(6000));
  rerender({ source: initial });
  expect(result.current.notification).toBeNull();
  const warning = createNotification("warning", "Conflict");
  rerender({ source: warning });
  act(() => result.current.dismiss(initial.id));
  expect(result.current.notification).toBe(warning);
  act(() => result.current.dismiss(warning.id));
  act(() => result.current.dismiss(initial.id));
  rerender({ source: warning });
  expect(result.current.notification).toBeNull();
});

it("enforces the supported variants and timing combinations through TypeScript", () => {
  expectTypeOf<NotificationVariant>().toEqualTypeOf<"success" | "error" | "warning" | "info">();
  const error = createNotification("error", "Failure");
  if (error.dismissal === "automatic") expectTypeOf(error.variant).toEqualTypeOf<"success" | "info">();
  // @ts-expect-error Unknown variants cannot be assigned to the notification model.
  const unknown: NotificationVariant = "capacity";
  void unknown;
  // @ts-expect-error An error cannot silently expire.
  const invalid: TaskNotification = { id: "a", message: "Failure", variant: "error", dismissal: "automatic", durationMs: 3000 };
  void invalid;
});
