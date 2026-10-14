import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import Board from "../Board/Board";
import type { Task } from "../../domain/task/Task";
import { boardReducer } from "../../domain/board/boardReducer";
import { makeBoard, makeTask } from "../../test/fixtures";

const parent = makeTask({ id: "p", title: "Release plan", description: "First line\nSecond line" });
const child = makeTask({ id: "c", title: "Review release", parentId: parent.id });
function Harness({ large = false, tasks }: { large?: boolean; tasks?: Task[] }) {
  const [board, dispatch] = useState(makeBoard(tasks ?? [parent, ...(large ? Array.from({length:30}, (_,i) => makeTask({id:`c${i}`, title:`Child ${i} ${"x".repeat(130)}`, parentId:parent.id})) : [child])]));
  return <Board board={board} dispatch={action => dispatch(current => boardReducer(current, action))}/>;
}
it("opens read-first details, navigates related work and restores the board opener on close", async () => {
  const user = userEvent.setup(); render(<Harness/>);
  const opener = screen.getByRole("button", { name:"Open task Release plan" });
  await user.click(opener);
  const detail = screen.getByRole("dialog", {name:"Release plan"});
  expect(within(detail).getByRole("heading", {name:"Release plan"})).toHaveFocus();
  expect(within(detail).queryByRole("textbox")).not.toBeInTheDocument();
  expect(detail).toHaveTextContent("First line Second line");
  expect(detail).toHaveTextContent("0 of 1 subtasks complete");
  await user.click(within(detail).getByRole("button", {name:"Open subtask Review release"}));
  const related = screen.getByRole("dialog", {name:"Review release"});
  await user.click(within(related).getByRole("button", {name:"Open parent Release plan"}));
  await user.keyboard("{Escape}");
  expect(opener).toHaveFocus();
});
it("requires deliberate editing and protects drafts, validation and refresh cancellation", async () => {
  const user = userEvent.setup();render(<Harness/>);
  await user.click(screen.getByRole("button",{name:"Open task Release plan"}));
  await user.click(screen.getByRole("button",{name:"Edit task"}));
  const title = screen.getByLabelText("Title");
  await user.clear(title);
  await user.click(screen.getByRole("button",{name:"Save Changes"}));
  expect(title).toHaveFocus();expect(title).toHaveAttribute("aria-invalid","true");
  const leaving = new Event("beforeunload",{cancelable:true}); window.dispatchEvent(leaving);expect(leaving.defaultPrevented).toBe(true);
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button",{name:"Keep Editing"}));expect(title).toHaveValue("");
  await user.keyboard("{Escape}");await user.click(screen.getByRole("button",{name:"Discard"}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Open task Release plan"})).toBeInTheDocument();
  const clean = new Event("beforeunload",{cancelable:true});window.dispatchEvent(clean);expect(clean.defaultPrevented).toBe(false);
});
it("returns child creation to updated details, retains focus and protects relationship drafts", async () => {
  const user=userEvent.setup();render(<Harness/>);
  await user.click(screen.getByRole("button",{name:"Open task Release plan"}));
  await user.click(screen.getByRole("button",{name:"Add SubTask to Release plan"}));
  await user.type(screen.getByLabelText("Title"),"New child");await user.type(screen.getByLabelText("Description"),"Small work");
  await user.click(screen.getByRole("button",{name:"Create SubTask"}));
  expect(screen.getByRole("dialog",{name:"Release plan"})).toHaveTextContent("0 of 2 subtasks complete");
  expect(screen.getByRole("button",{name:"Add SubTask to Release plan"})).toHaveFocus();
  await user.click(screen.getByRole("button",{name:"Open subtask New child"}));
  await user.click(screen.getByRole("button",{name:"Manage parent of New child"}));
  await user.selectOptions(screen.getByLabelText("Parent"),"");await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog",{name:"Discard Relationship Changes?"})).toBeInTheDocument();
  const leaving = new Event("beforeunload",{cancelable:true});window.dispatchEvent(leaving);expect(leaving.defaultPrevented).toBe(true);
  await user.click(screen.getByRole("button",{name:"Keep Editing"}));expect(screen.getByLabelText("Parent")).toHaveValue("");
  await user.click(screen.getByRole("button",{name:"Save Relationship"}));
  expect(screen.getByRole("dialog",{name:"New child"})).toHaveTextContent("Independent task");
});
it("shows the complete long child list without truncating relationship names", async () => {
  const user=userEvent.setup();render(<Harness large/>);
  await user.click(screen.getByRole("button",{name:"Open task Release plan"}));
  const detail=within(screen.getByRole("dialog",{name:"Release plan"}));
  expect(detail.getAllByRole("listitem")).toHaveLength(30);
  expect(detail.getByRole("button",{name:`Open subtask Child 29 ${"x".repeat(130)}`})).toBeInTheDocument();
});

it("changes stages inside details, retains relationship rules and restores completion marks", async () => {
  const user = userEvent.setup();
  render(<Harness tasks={[{...parent, status:"in-review"}, child]}/>);
  await user.click(screen.getByRole("button",{name:"Open task Release plan"}));
  await user.selectOptions(screen.getByLabelText("Stage"),"done");
  expect(screen.getByLabelText("Stage")).toHaveValue("in-review");
  expect(screen.getByRole("dialog",{name:"Release plan"})).toHaveTextContent("Finish these subtasks");
  await user.click(screen.getByRole("button",{name:"Open subtask Review release"}));
  for(const stage of ["in-progress","in-review","done"]) await user.selectOptions(screen.getByLabelText("Stage"),stage);
  expect(screen.getByLabelText("Stage")).toHaveValue("done");
  await user.selectOptions(screen.getByLabelText("Stage"),"todo");
  expect(screen.getByLabelText("Stage")).toHaveValue("done");
  await user.click(screen.getByRole("button",{name:"Open parent Release plan"}));
  expect(screen.getByRole("img",{name:"Completed subtask"})).toHaveClass("is-complete");
  await user.selectOptions(screen.getByLabelText("Stage"),"done");
  expect(screen.getByLabelText("Stage")).toHaveValue("done");
  await user.click(screen.getByRole("button",{name:"Close task details"}));
  expect(screen.getByRole("article",{name:"Review release"}).querySelector(".completion-mark.is-complete")).toBeInTheDocument();
  expect(screen.queryByLabelText("Movement actions for Release plan")).not.toBeInTheDocument();
});
it("the editor × keeps the same safe draft cancellation as Escape", async () => {
  const user=userEvent.setup();render(<Harness/>);
  await user.click(screen.getByRole("button",{name:"Open task Release plan"}));
  await user.click(screen.getByRole("button",{name:"Edit task"}));
  await user.type(screen.getByLabelText("Title")," draft");
  await user.click(screen.getByRole("button",{name:"Close task editor"}));
  await user.click(screen.getByRole("button",{name:"Keep Editing"}));
  expect(screen.getByLabelText("Title")).toHaveValue("Release plan draft");
  await user.click(screen.getByRole("button",{name:"Close task editor"}));
  await user.click(screen.getByRole("button",{name:"Discard"}));
  expect(screen.getByRole("button",{name:"Open task Release plan"})).toHaveFocus();
});
it("detail stage changes cannot bypass capacity when search hides the occupants", async () => {
  const user=userEvent.setup();
  const full=Array.from({length:5},(_,i)=>makeTask({id:`full-${i}`,title:`Occupant ${i}`,status:"in-progress"}));
  render(<Harness tasks={[parent,child,...full]}/>);
  await user.type(screen.getByLabelText("Search:"),"Review release");
  await user.click(screen.getByRole("button",{name:"Open task Review release"}));
  await user.selectOptions(screen.getByLabelText("Stage"),"in-progress");
  expect(screen.getByLabelText("Stage")).toHaveValue("todo");
  expect(screen.getByRole("dialog",{name:"Review release"})).toHaveTextContent("in-progress is full (5-task limit)");
  await user.click(screen.getByRole("button",{name:"Close task details"}));
  expect(screen.getByRole("region",{name:"in-progress (5)"})).toHaveTextContent("0 shown · 5 total");
});
