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
  it("lists subtasks oldest first across workflow columns and keeps that order after a move", async () => {
    const user = userEvent.setup();
    const older = makeTask({ id: "older", title: "First created", parentId: parent.id, status: "done", createdAt: new Date("2026-01-01T00:00:00Z") });
    const newer = makeTask({ id: "newer", title: "Second created", parentId: parent.id, createdAt: new Date("2026-01-02T00:00:00Z") });
    render(<Harness initialBoard={makeBoard([parent, newer, older])} />);
    await user.click(card("Parent work").getByRole("button", { name: "Edit" }));
    const section = within(screen.getByRole("region", { name: "Subtasks" }));
    expect(section.getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent))
      .toEqual(["Open subtask First created", "Open subtask Second created", "Add SubTask"]);
    simulateDrop(newer.id, "in-progress");
    expect(section.getAllByRole("listitem").map((row) => row.textContent)).toEqual(["First created", "Second created"]);
    await user.click(section.getByRole("button", { name: "Open subtask Second created" }));
    expect(screen.getByRole("dialog", { name: "Edit SubTask" })).toHaveTextContent("In Progress");
  });

  it("opens independent, parent, and subtask editors from board titles, including keyboard activation", async () => {
    const user = userEvent.setup();
    const independent = makeTask({ id: "independent", title: "Independent work" });
    render(<Harness initialBoard={makeBoard([parent, child, independent])} />);
    for (const title of ["Independent work", "Parent work"]) {
      await user.click(card(title).getByRole("button", { name: `Open task ${title}` }));
      expect(within(screen.getByRole("dialog", { name: "Edit Task" })).getByLabelText("Title")).toHaveValue(title);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
    }
    card("Child work").getByRole("button", { name: "Open task Child work" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Edit SubTask" })).toHaveTextContent("Parent: Parent work");
  });

  it("creates a child from its parent with inherited defaults, independent card, and progress", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(card("Parent work").getByRole("button", { name: "Edit" }));
    screen.getByRole("button", { name: "Add SubTask" }).focus();
    await user.keyboard("{Enter}");
    const subtaskForm = within(screen.getByRole("dialog", { name: "Add SubTask" }));
    expect(screen.getByRole("dialog", { name: "Add SubTask" })).toHaveTextContent("Parent: Parent work");
    expect(subtaskForm.getByLabelText("Priority")).toHaveValue("high");
    expect(subtaskForm.getByLabelText("Category")).toHaveValue("bug");
    await user.type(subtaskForm.getByLabelText("Title"), "New linked child");
    await user.type(subtaskForm.getByLabelText("Description"), "Independent child description");
    await user.click(screen.getByRole("button", { name: "Create SubTask" }));
    expect(card("New linked child").queryByText(/Child of:/)).not.toBeInTheDocument();
    expect(card("New linked child").queryByRole("button", { name: /Manage parent/i })).not.toBeInTheDocument();
    expect(card("Parent work").getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Edit Task" })).toHaveTextContent("New linked child");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("opens and edits a child from the parent list without losing context", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.click(card("Parent work").getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Open subtask Child work" }));
    const editor = within(screen.getByRole("dialog", { name: "Edit SubTask" }));
    expect(editor.getByRole("button", { name: "Open parent Parent work" })).toBeInTheDocument();
    await user.clear(editor.getByLabelText("Title"));
    await user.type(editor.getByLabelText("Title"), "Edited child");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(card("Edited child").getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(card("Parent work").getByRole("progressbar")).toBeInTheDocument();
  });

  it("parent editing preserves linked children", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.click(card("Parent work").getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Renamed parent");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(card("Renamed parent").getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1");
    await user.click(card("Child work").getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Open parent Renamed parent" })).toBeInTheDocument();
  });

  it("shows completion progress and completed child context", () => {
    render(<Harness initialBoard={makeBoard([parent, { ...child, status: "done" }])} />);
    expect(card("Parent work").getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(card("Parent work").getByText("100%")).toBeInTheDocument();
    expect(card("Child work").getByText("✔ Done")).toBeInTheDocument();
    expect(card("Child work").queryByText(/Child of:/)).not.toBeInTheDocument();
    expect(card("Child work").queryByRole("button", { name: /Manage parent/i })).not.toBeInTheDocument();
  });

  it("requires an explicit parent-delete decision, supports cancel, and preserves children", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.click(card("Parent work").getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete Parent Task" })).toHaveTextContent("All children will be kept as independent tasks");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(card("Child work").getByRole("button", { name: "Edit" })).toBeInTheDocument();
    await user.click(card("Parent work").getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete Parent and Detach Children" }));
    expect(screen.queryByRole("heading", { name: "Parent work", level: 3 })).not.toBeInTheDocument();
    expect(card("Child work").queryByText(/Child of:/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    await user.click(card("Child work").getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Edit Task" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open parent/ })).not.toBeInTheDocument();
  });

  it("deleting a child retains its parent and removes derived progress", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.click(card("Child work").getByRole("button", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog", { name: "Delete Task" })).getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("heading", { name: "Child work", level: 3 })).not.toBeInTheDocument();
    expect(card("Parent work").queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("reassigns and detaches via keyboard-accessible relationship controls", async () => {
    const user = userEvent.setup();
    const other = makeTask({ id: "other", title: "Other parent" });
    render(<Harness initialBoard={makeBoard([parent, child, other])} />);
    await user.click(card("Child work").getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Title"), " draft");
    const manage = screen.getByRole("button", { name: "Manage parent of Child work" });
    manage.focus();
    await user.keyboard("{Enter}");
    const selector = screen.getByLabelText("Parent", { selector: "select" });
    expect(selector).toHaveFocus();
    await user.selectOptions(selector, other.id);
    const save = screen.getByRole("button", { name: "Save Relationship" });
    save.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Open parent Other parent" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Child work draft");
    await user.click(screen.getByRole("button", { name: "Manage parent of Child work" }));
    await user.selectOptions(screen.getByLabelText("Parent", { selector: "select" }), "");
    await user.click(screen.getByRole("button", { name: "Save Relationship" }));
    expect(screen.getByRole("dialog", { name: "Edit Task" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open parent/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Child work draft");
  });

  it("opens the hidden parent from the subtask editor while preserving filters", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.type(screen.getByLabelText("Search:"), "Child work");
    expect(screen.queryByRole("heading", { name: "Parent work", level: 3 })).not.toBeInTheDocument();
    await user.click(card("Child work").getByRole("button", { name: "Edit" }));
    const locate = screen.getByRole("button", { name: "Open parent Parent work" });
    locate.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Search:")).toHaveValue("Child work");
    expect(screen.getByRole("dialog", { name: "Edit Task" })).toHaveTextContent("Child work");
    expect(card("Child work").getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("reports blocked parent completion with the unfinished child's title", () => {
    render(<Harness initialBoard={makeBoard([{ ...parent, status: "in-review" }, child])} />);
    simulateDrop(parent.id, "done");
    expect(screen.getByRole("alert")).toHaveTextContent('Finish these children before completing "Parent work": Child work.');
    expect(screen.getByRole("heading", { name: "in-review (1)", level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("keeps progress when children are hidden and opens them from the parent editor", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.type(screen.getByLabelText("Search:"), "Parent work");
    expect(screen.queryByRole("heading", { name: "Child work", level: 3 })).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1");
    await user.click(card("Parent work").getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Open subtask Child work" }));
    expect(screen.getByLabelText("Search:")).toHaveValue("Parent work");
    expect(screen.getByRole("dialog", { name: "Edit SubTask" })).toHaveTextContent("Parent: Parent work");
  });

  it("unknown drag destinations are ignored and a valid child move keeps context", () => {
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    simulateDrop(child.id, "unknown");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    simulateDrop(child.id, "in-progress");
    expect(screen.getByRole("heading", { name: "in-progress (1)", level: 2 })).toBeInTheDocument();
    expect(card("Child work").getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("completed parents offer no child creation and legacy checklist data remains readable", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([{ ...parent, status: "done", subtasks: [{ id: "legacy", title: "Legacy item", completed: true }] }])} />);
    expect(screen.queryByRole("button", { name: "Add child to Parent work" })).not.toBeInTheDocument();
    await user.click(screen.getByText("Legacy checklist (1)"));
    expect(screen.getByText("Legacy item")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.queryByPlaceholderText("Add subtask...")).not.toBeInTheDocument();
    await user.click(card("Parent work").getByRole("button", { name: "Edit" }));
    expect(screen.queryByRole("button", { name: "Add SubTask" })).not.toBeInTheDocument();
  });
  it("preserves an unsaved parent draft while creating and editing subtasks", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(card("Parent work").getByRole("button", { name: "Edit" }));
    const parentForm = within(screen.getByRole("dialog", { name: "Edit Task" }));
    await user.clear(parentForm.getByLabelText("Title"));
    await user.type(parentForm.getByLabelText("Title"), "Unsaved parent draft");
    await user.click(parentForm.getByRole("button", { name: "Add SubTask" }));
    let subtaskForm = within(screen.getByRole("dialog", { name: "Add SubTask" }));
    await user.type(subtaskForm.getByLabelText("Title"), "Subtask created in editor");
    await user.type(subtaskForm.getByLabelText("Description"), "A real linked task");
    await user.click(subtaskForm.getByRole("button", { name: "Create SubTask" }));
    let returnedForm = within(screen.getByRole("dialog", { name: "Edit Task" }));
    expect(returnedForm.getByLabelText("Title")).toHaveValue("Unsaved parent draft");
    expect(returnedForm.getByRole("region", { name: "Subtasks" })).toHaveTextContent("0 of 1");
    await user.click(returnedForm.getByRole("button", { name: "Open subtask Subtask created in editor" }));
    subtaskForm = within(screen.getByRole("dialog", { name: "Edit SubTask" }));
    expect(subtaskForm.getByRole("button", { name: "Open parent Parent work" })).toBeInTheDocument();
    expect(subtaskForm.queryByRole("button", { name: "Add SubTask" })).not.toBeInTheDocument();
    await user.clear(subtaskForm.getByLabelText("Title"));
    await user.type(subtaskForm.getByLabelText("Title"), "Edited subtask from editor");
    await user.click(subtaskForm.getByRole("button", { name: "Save Changes" }));
    returnedForm = within(screen.getByRole("dialog", { name: "Edit Task" }));
    expect(returnedForm.getByLabelText("Title")).toHaveValue("Unsaved parent draft");
    expect(returnedForm.getByRole("button", { name: "Open subtask Edited subtask from editor" })).toBeInTheDocument();
    await user.click(returnedForm.getByRole("button", { name: "Save Changes" }));
    await user.click(card("Edited subtask from editor").getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Open parent Unsaved parent draft" })).toBeInTheDocument();
  });

  it("shows all subtasks and completed progress inside a filtered parent's editor", async () => {
    const user = userEvent.setup();
    const completed = makeTask({ id: "done-child", title: "Completed subtask", parentId: parent.id, status: "done" });
    render(<Harness initialBoard={makeBoard([parent, child, completed])} />);
    await user.type(screen.getByLabelText("Search:"), "Parent work");
    await user.click(card("Parent work").getByRole("button", { name: "Edit" }));
    const editor = within(screen.getByRole("dialog", { name: "Edit Task" }));
    expect(card("Parent work").getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(card("Parent work").getByRole("progressbar")).toHaveAttribute("aria-valuemax", "2");
    expect(card("Parent work").getByText("50%")).toBeInTheDocument();
    expect(editor.getByRole("region", { name: "Subtasks" })).toHaveTextContent("1 of 2");
    expect(editor.getByRole("button", { name: "Open subtask Child work" })).toBeInTheDocument();
    expect(editor.getByRole("button", { name: "Open subtask Completed subtask" })).toBeInTheDocument();
    await user.click(editor.getByRole("button", { name: "Open subtask Completed subtask" }));
    const subtaskEditor = within(screen.getByRole("dialog", { name: "Edit SubTask" }));
    expect(subtaskEditor.getByText("Done")).toBeInTheDocument();
    await user.click(subtaskEditor.getByRole("button", { name: "Open parent Parent work" }));
    expect(screen.getByRole("dialog", { name: "Edit Task" })).toBeInTheDocument();
  });

  it("keeps a saved subtask when the parent draft is discarded", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(card("Parent work").getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Title"), " unsaved");
    await user.click(screen.getByRole("button", { name: "Add SubTask" }));
    const subtaskForm = within(screen.getByRole("dialog", { name: "Add SubTask" }));
    await user.type(subtaskForm.getByLabelText("Title"), "Saved subtask");
    await user.type(subtaskForm.getByLabelText("Description"), "Saved independently");
    await user.click(subtaskForm.getByRole("button", { name: "Create SubTask" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(card("Saved subtask").getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(card("Parent work").getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows a parent link in a directly opened subtask editor and protects unsaved edits on navigation", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.click(card("Child work").getByRole("button", { name: "Edit" }));
    const editor = within(screen.getByRole("dialog", { name: "Edit SubTask" }));
    expect(editor.getByText("To Do")).toBeInTheDocument();
    await user.type(editor.getByLabelText("Title"), " draft");
    await user.click(editor.getByRole("button", { name: "Open parent Parent work" }));
    expect(screen.getByRole("dialog", { name: "Discard Changes?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep Editing" }));
    expect(editor.getByLabelText("Title")).toHaveValue("Child work draft");
    await user.click(editor.getByRole("button", { name: "Open parent Parent work" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("dialog", { name: "Edit Task" })).toHaveTextContent("Subtasks");
  });

  it("cancels subtask creation back to the parent and handles Escape only in the active editor", async () => {
    const user = userEvent.setup();
    render(<Harness initialBoard={makeBoard([parent, child])} />);
    await user.click(card("Parent work").getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Title"), " draft");
    await user.click(screen.getByRole("button", { name: "Add SubTask" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Add SubTask" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Edit Task" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Parent work draft");
    await user.click(screen.getByRole("button", { name: "Open subtask Child work" }));
    await user.type(within(screen.getByRole("dialog", { name: "Edit SubTask" })).getByLabelText("Title"), " draft");
    await user.keyboard("{Escape}");
    expect(screen.getAllByRole("dialog", { name: "Discard Changes?" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("dialog", { name: "Edit Task" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Parent work draft");
    expect(card("Child work").getByRole("heading", { name: "Child work" })).toBeInTheDocument();
  });

});
