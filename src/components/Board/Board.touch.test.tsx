import { useReducer } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { boardReducer } from "../../domain/board/boardReducer";
import { taskStatuses, type Task } from "../../domain/task/Task";
import { makeBoard, makeTask } from "../../test/fixtures";
import Board from "./Board";

// Exercise real sensors; jsdom needs measured geometry supplied separately.
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const column = this.matches(".column") ? this : this.closest<HTMLElement>(".column");
    const index = taskStatuses.findIndex(status => column?.getAttribute("aria-labelledby") === `column-${status}-title`);
    if (this.matches(".column")) return new DOMRect(index * 344, 100, 320, 500);
    if (this.matches(".task-card")) return new DOMRect(index * 344 + 16, 150, 280, 180);
    return new DOMRect(0, 0, 1440, 900);
  });
});
afterEach(async () => {
  await act(async () => { await vi.runOnlyPendingTimersAsync(); });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function Harness({ tasks }: { tasks: Task[] }) {
  const [board, dispatch] = useReducer(boardReducer, makeBoard(tasks));
  return <Board board={board} dispatch={dispatch} />;
}
const task = makeTask({ title: "Touch work" });
const point = (x: number) => ({ identifier: 1, clientX: x, clientY: 190 });
const hold = async () => act(async () => { await vi.advanceTimersByTimeAsync(260); });
const end = async (handle: HTMLElement) => act(async () => {
  fireEvent.touchEnd(handle, { touches: [], changedTouches: [point(444)] });
  await vi.advanceTimersByTimeAsync(100);
});

it("moves a task after a brief touch hold and restores its title focus", async () => {
  render(<Harness tasks={[task]} />);
  const handle = screen.getByRole("group", { name: "Move task Touch work, todo" });
  fireEvent.touchStart(handle, { touches: [point(100)] });
  await hold();
  fireEvent.touchMove(handle, { touches: [point(444)] });
  await end(handle);
  expect(within(screen.getByRole("region", { name: "in-progress (1)" })).getByRole("button", { name: "Open task Touch work" })).toHaveFocus();
  expect(screen.getAllByRole("button", { name: "Open task Touch work" })).toHaveLength(1);
  expect(screen.getByRole("status", { name: "Board updates" })).toHaveTextContent('Moved "Touch work" to in-progress.');
});

it("abandons touch activation when a scrolling gesture starts before the hold", async () => {
  render(<Harness tasks={[task]} />);
  const handle = screen.getByRole("group", { name: "Move task Touch work, todo" });
  fireEvent.touchStart(handle, { touches: [point(100)] });
  fireEvent.touchMove(handle, { touches: [point(125)] });
  await hold();
  await end(handle);
  expect(screen.getByRole("region", { name: "todo (1)" })).toHaveTextContent("Touch work");
  expect(screen.getByRole("status", { name: "Board updates" })).not.toHaveTextContent("Picked up");
});

it("cancels an active touch drag without moving the task", async () => {
  render(<Harness tasks={[task]} />);
  const handle = screen.getByRole("group", { name: "Move task Touch work, todo" });
  fireEvent.touchStart(handle, { touches: [point(100)] });
  await hold();
  fireEvent.touchMove(handle, { touches: [point(444)] });
  fireEvent.touchCancel(handle, { touches: [] });
  expect(screen.getByRole("region", { name: "todo (1)" })).toHaveTextContent("Touch work");
  expect(screen.getByRole("button", { name: "Open task Touch work" })).toHaveFocus();
});

it("leaves multi-touch gestures available rather than starting a drag", async () => {
  render(<Harness tasks={[task]} />);
  const handle = screen.getByRole("group", { name: "Move task Touch work, todo" });
  fireEvent.touchStart(handle, { touches: [point(100), { ...point(150), identifier: 2 }] });
  await hold();
  expect(screen.getByRole("status", { name: "Board updates" })).not.toHaveTextContent("Picked up");
});

it("keeps parent completion rules authoritative for touch drops", async () => {
  const parent = { ...task, status: "in-review" as const };
  render(<Harness tasks={[parent, makeTask({ id: "child", title: "Unfinished subtask", parentId: parent.id })]} />);
  const handle = screen.getByRole("group", { name: "Move task Touch work, in-review" });
  fireEvent.touchStart(handle, { touches: [point(788)] });
  await hold();
  fireEvent.touchMove(handle, { touches: [point(1132)] });
  await end(handle);
  expect(screen.getByRole("region", { name: "in-review (1)" })).toHaveTextContent("Touch work");
  expect(screen.getByRole("status", { name: "Board updates" })).toHaveTextContent("Finish these subtasks");
});
