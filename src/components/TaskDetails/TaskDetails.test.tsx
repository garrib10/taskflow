import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import Board from "../Board/Board";
import { boardReducer } from "../../domain/board/boardReducer";
import { makeBoard, makeTask } from "../../test/fixtures";

const parent = makeTask({ id: "p", title: "Release plan", description: "First line\nSecond line" });
const child = makeTask({ id: "c", title: "Review release", parentId: parent.id });
function Harness({ large = false }: { large?: boolean }) {
  const [board, dispatch] = useState(makeBoard([parent, ...(large ? Array.from({length:30}, (_,i) => makeTask({id:`c${i}`, title:`Child ${i} ${"x".repeat(130)}`, parentId:parent.id})) : [child])]));
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
