import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { BoardAction } from "../../domain/board/boardReducer";
import { boardReducer } from "../../domain/board/boardReducer";
import { validateBoardAction } from "../../domain/board/boardValidation";
import { makeBoard, makeTask } from "../../test/fixtures";
import TaskForm from "./TaskForm";

it("focuses one named warning summary when a parent completes while child creation is open", async () => {
  const parent = makeTask({ id: "parent", title: "Parent work" });
  let board = makeBoard([parent]);
  const user = userEvent.setup();
  const close = vi.fn(), success = vi.fn();
  const dispatch = (action: BoardAction) => {
    const before = board;
    const failure = validateBoardAction(board, action);
    board = boardReducer(board, action);
    expect(board).toBe(before);
    return failure;
  };
  const view = render(<TaskForm board={board} parent={parent} dispatch={dispatch} onClose={close} onSuccess={success} onOpenTask={() => {}} />);
  await user.type(screen.getByLabelText("Title"), "New child");
  await user.type(screen.getByLabelText("Description"), "Child description");
  board = makeBoard([{ ...parent, status: "done" }]);
  view.rerender(<TaskForm board={board} parent={parent} dispatch={dispatch} onClose={close} onSuccess={success} onOpenTask={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Create SubTask" }));
  const warning = screen.getByRole("group", { name: 'Warning: "Parent work" is complete. An unfinished subtask cannot be linked to it.' });
  expect(warning).toHaveFocus();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(close).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: /Dismiss notification/ }));
  expect(screen.getByLabelText("Title")).toHaveFocus();
  expect(screen.getByLabelText("Title")).toHaveValue("New child");
});
