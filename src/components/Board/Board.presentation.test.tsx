import { useReducer } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { boardReducer } from "../../domain/board/boardReducer";
import { makeBoard, makeTask } from "../../test/fixtures";
import type { Task } from "../../domain/task/Task";
import Board from "./Board";
import { descriptionMatch, taskContexts } from "./boardPresentation";
function Harness({ tasks = [] }: { tasks?: Task[] }) {
  const [board, dispatch] = useReducer(boardReducer, makeBoard(tasks));
  return <Board board={board} dispatch={dispatch}/>;
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("shows four connected stages, full counts, and meaningful limited/unlimited capacity states", () => {
  render(<Harness tasks={Array.from({length: 6}, (_, index) => makeTask({id: `work-${index}`, status:"in-progress"}))}/>);
  expect(within(screen.getByRole("region", {name:"Workflow columns"})).getAllByRole("heading", {level:2})).toHaveLength(4);
  expect(screen.getByRole("region", {name:"todo (0)"})).toHaveTextContent("No work-in-progress limit");
  expect(screen.getByRole("region", {name:"in-progress (6)"})).toHaveTextContent("6 / 5Over limit");
  expect(screen.getByRole("region", {name:"in-review (0)"})).toHaveTextContent("3 places remaining");
  expect(screen.getByRole("region", {name:"done (0)"})).toHaveTextContent("No work-in-progress limit");
});
it("keeps hidden occupants in counts and distinguishes filtered emptiness from an empty stage", async () => {
  const user=userEvent.setup();
  render(<Harness tasks={Array.from({length:5},(_,index)=>makeTask({id:`occupant-${index}`,status:"in-progress",title:`Occupied ${index}`}))}/>);
  await user.type(screen.getByLabelText("Search:"),"unmatched");
  const full=screen.getByRole("region",{name:"in-progress (5)"});
  expect(full).toHaveTextContent("5 / 5Full");
  expect(full).toHaveTextContent("0 shown · 5 total");
  expect(full).toHaveTextContent("No tasks match these filters");
  expect(screen.getByRole("region",{name:"todo (0)"})).toHaveTextContent("No tasks in this stage");
});
it("keeps cards compact with separate movement/title controls and full relationship context", () => {
  const parent=makeTask({id:"parent",title:"Parent"});
  const child=makeTask({id:"child",title:"Child",parentId:"parent",status:"done"});
  render(<Harness tasks={[parent,child]}/>);
  const card=screen.getByRole("heading",{name:"Parent",level:3}).closest("article")!;
  expect(card).not.toHaveTextContent(parent.description);
  expect(within(card).getByRole("button",{name:"Open task Parent"})).toBeInTheDocument();
  expect(within(card).getByRole("group",{name:"Move task Parent, todo"})).toHaveAccessibleDescription(/Drag with the grip/);
  expect(within(card).queryByRole("button",{name:/Delete|Edit/})).not.toBeInTheDocument();
  expect(card).toHaveTextContent("Parent · 1 of 1 subtasks complete");
  expect(screen.getByRole("region",{name:"done (1)"})).toHaveTextContent("Parent: Parent");
  expect(screen.getByRole("region",{name:"done (1)"})).toHaveTextContent("Medium");
});
it("shows contextual description excerpts only for description-only matches", async () => {
  const user=userEvent.setup();const task=makeTask({title:"Brief title",description:"Context with a unique needle in this description"});
  render(<Harness tasks={[task]}/>);
  expect(screen.queryByText(task.description)).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Search:"),"needle");
  expect(screen.getByText(task.description)).toBeInTheDocument();
  await user.clear(screen.getByLabelText("Search:"));await user.type(screen.getByLabelText("Search:"),"Brief");
  expect(screen.queryByText(task.description)).not.toBeInTheDocument();
  expect(descriptionMatch(task,"Brief")).toBeNull();
});
it("provides a single mobile stage, explicit movement and continued focus without persisting navigation", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  const user=userEvent.setup();render(<Harness tasks={[makeTask({title:"Mobile work"})]}/>);
  expect(within(screen.getByRole("region",{name:"Workflow columns"})).getAllByRole("heading",{level:2})).toHaveLength(1);
  await user.click(screen.getByLabelText("Movement actions for Mobile work"));
  await user.click(screen.getByRole("button",{name:"Move to in-progress"}));
  expect(screen.getByLabelText("Workflow stage")).toHaveValue("in-progress");
  expect(screen.getByRole("group",{name:"Move task Mobile work, in-progress"})).toHaveFocus();
  await user.selectOptions(screen.getByLabelText("Workflow stage"),"done");
  expect(screen.getByRole("region",{name:"done (0)"})).toHaveTextContent("No tasks in this stage");
});
it("indexes relationship summaries once from complete data, including hidden completed children", () => {
  const contexts=taskContexts(makeBoard([makeTask({id:"parent"}),makeTask({id:"child",parentId:"parent",status:"done"})]));
  expect(contexts.get("parent")).toEqual({childCount:1,completedChildren:1});
  expect(contexts.get("child")?.parentTitle).toBe("Build search");
});

it("names near-capacity states without relying on color", () => {
  render(<Harness tasks={[...Array.from({length:4},(_,index)=>makeTask({id:`progress-${index}`,status:"in-progress"})),...Array.from({length:2},(_,index)=>makeTask({id:`review-${index}`,status:"in-review"}))]}/>);
  for(const name of ["in-progress (4)","in-review (2)"]) expect(screen.getByRole("region",{name})).toHaveTextContent("1 place remaining");
});
