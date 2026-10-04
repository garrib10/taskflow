import { useReducer, type PropsWithChildren } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DragEndEvent } from "@dnd-kit/core";
import type { Board as BoardType } from "../../domain/board/Board";
import { boardReducer } from "../../domain/board/boardReducer";
import { makeBoard, makeTask } from "../../test/fixtures";
import Board from "./Board";

// jsdom has no layout: isolate the drag adapter while exercising real board flows.
const drag = vi.hoisted((): { onDragEnd?: (event: DragEndEvent) => void } => ({}));
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: PropsWithChildren<{ onDragEnd: (event: DragEndEvent) => void }>) => {
      drag.onDragEnd = onDragEnd;
      return children;
    },
  };
});

const parent = makeTask({ id: "parent", title: "Parent work", priority: "high", category: "bug" });
const child = makeTask({ id: "child", title: "Child work", parentId: parent.id });
function Harness({ initialBoard = makeBoard([parent]) }: { initialBoard?: BoardType }) {
  const [board, dispatch] = useReducer(boardReducer, initialBoard);
  return <Board board={board} dispatch={dispatch} />;
}
function card(title: string) {
  const element = screen.getByRole("heading", { name: title, level: 3 }).closest<HTMLDivElement>(".task-card");
  if (!element) throw new Error(`Missing card ${title}`);
  return within(element);
}
function simulateDrop(taskId: string, destination: string) {
  act(() => drag.onDragEnd?.({
    active: { id: taskId, data: { current: {} }, rect: { current: { initial: null, translated: null } } },
    over: { id: destination, disabled: false, data: { current: {} }, rect: { top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 } },
    delta: { x: 0, y: 0 }, activatorEvent: new MouseEvent("pointerup"),
    collisions: null,
  }));
}

describe("linked task board interactions", () => {
  it("creates a child from its parent with inherited defaults, independent card, and progress", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("button", { name: "Add child to Parent work" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Create Child Task" })).toHaveTextContent("Parent: Parent work");
    expect(screen.getByLabelText("Priority", { selector: "#task-priority" })).toHaveValue("high");
    expect(screen.getByLabelText("Category", { selector: "#task-category" })).toHaveValue("bug");
    await user.type(screen.getByLabelText("Title"), "New linked child");
    await user.type(screen.getByLabelText("Description"), "Independent child description");
    await user.click(screen.getByRole("button", { name: "Create Child" }));
    expect(card("New linked child").getByRole("button", { name: "Show parent Parent work" })).toBeInTheDocument();
    expect(card("Parent work").getByText("Parent · 0/1 children complete")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("opens and edits a child from the parent list without losing context", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.click(card("Parent work").getByText("Parent · 0/1 children complete"));
    await user.click(screen.getByRole("button", { name: "Edit child Child work" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Edited child");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(card("Edited child").getByRole("button", { name: "Show parent Parent work" })).toBeInTheDocument();
    expect(card("Parent work").getByText("Parent · 0/1 children complete")).toBeInTheDocument();
  });

  it("parent editing preserves linked children", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.click(card("Parent work").getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Renamed parent");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(card("Child work").getByRole("button", { name: "Show parent Renamed parent" })).toBeInTheDocument();
    expect(card("Renamed parent").getByText("Parent · 0/1 children complete")).toBeInTheDocument();
  });

  it("shows completion progress and completed child context", () => {
    render(<Harness initialBoard={makeBoard([parent, { ...child, status: "done" }])} />);
    expect(card("Parent work").getByText("Parent · 1/1 children complete")).toBeInTheDocument();
    expect(card("Child work").getByText("· Complete")).toBeInTheDocument();
  });

  it("requires an explicit parent-delete decision, supports cancel, and preserves children", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.click(card("Parent work").getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete Parent Task" })).toHaveTextContent("All children will be kept as independent tasks");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(card("Child work").getByRole("button", { name: "Show parent Parent work" })).toBeInTheDocument();
    await user.click(card("Parent work").getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete Parent and Detach Children" }));
    expect(screen.queryByRole("heading", { name: "Parent work", level: 3 })).not.toBeInTheDocument();
    expect(card("Child work").queryByText(/Child of:/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });

  it("deleting a child retains its parent and removes derived progress", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.click(card("Child work").getByRole("button", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog", { name: "Delete Task" })).getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("heading", { name: "Child work", level: 3 })).not.toBeInTheDocument();
    expect(card("Parent work").queryByText(/children complete/)).not.toBeInTheDocument();
  });

  it("reassigns and detaches via keyboard-accessible relationship controls", async () => {
    const user = userEvent.setup();
    const other = makeTask({ id: "other", title: "Other parent" });
    render(<Harness initialBoard={makeBoard([parent, child, other])} />);
    const manage = screen.getByRole("button", { name: "Manage parent of Child work" });
    manage.focus();
    await user.keyboard("{Enter}");
    const selector = screen.getByLabelText("Parent", { selector: "select" });
    expect(selector).toHaveFocus();
    await user.selectOptions(selector, other.id);
    const save = screen.getByRole("button", { name: "Save Relationship" });
    save.focus();
    await user.keyboard("{Enter}");
    expect(card("Child work").getByRole("button", { name: "Show parent Other parent" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Manage parent of Child work" }));
    await user.selectOptions(screen.getByLabelText("Parent", { selector: "select" }), "");
    await user.click(screen.getByRole("button", { name: "Save Relationship" }));
    expect(card("Child work").queryByText(/Child of:/)).not.toBeInTheDocument();
  });

  it("shows parent context while filtered and locates the hidden parent without changing relationships", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.type(screen.getByLabelText("Search:"), "Child work");
    expect(screen.queryByRole("heading", { name: "Parent work", level: 3 })).not.toBeInTheDocument();
    const locate = screen.getByRole("button", { name: "Show parent Parent work" });
    locate.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Search:")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Parent work", level: 3 })).toBeInTheDocument();
    expect(card("Child work").getByRole("button", { name: "Show parent Parent work" })).toBeInTheDocument();
  });

  it("reports blocked parent completion with the unfinished child's title", () => {
    render(<Harness initialBoard={makeBoard([{ ...parent, status: "in-review" }, child])} />);
    simulateDrop(parent.id, "done");
    expect(screen.getByRole("alert")).toHaveTextContent('Finish these children before completing "Parent work": Child work.');
    expect(screen.getByRole("heading", { name: "in-review (1)", level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("keeps progress when children are hidden and locates a child from the expanded list", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.type(screen.getByLabelText("Search:"), "Parent work");
    expect(screen.queryByRole("heading", { name: "Child work", level: 3 })).not.toBeInTheDocument();
    await user.click(screen.getByText("Parent · 0/1 children complete"));
    await user.click(screen.getByRole("button", { name: "Show child Child work" }));
    expect(screen.getByLabelText("Search:")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Child work", level: 3 })).toBeInTheDocument();
    expect(card("Child work").getByRole("button", { name: "Child work" })).toHaveFocus();
  });

  it("unknown drag destinations are ignored and a valid child move keeps context", () => {
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    simulateDrop(child.id, "unknown");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    simulateDrop(child.id, "in-progress");
    expect(screen.getByRole("heading", { name: "in-progress (1)", level: 2 })).toBeInTheDocument();
    expect(card("Child work").getByRole("button", { name: "Show parent Parent work" })).toBeInTheDocument();
  });

  it("completed parents offer no child creation and legacy checklist data remains readable", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([{ ...parent, status: "done", subtasks: [{ id: "legacy", title: "Legacy item", completed: true }] }])} />);
    expect(screen.queryByRole("button", { name: "Add child to Parent work" })).not.toBeInTheDocument();
    await user.click(screen.getByText("Legacy checklist (1)"));
    expect(screen.getByText("Legacy item")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.queryByPlaceholderText("Add subtask...")).not.toBeInTheDocument();
  });
});
