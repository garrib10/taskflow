import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { makeBoard, makeTask } from "../../test/fixtures";
import { validateBoardAction } from "../../domain/board/boardValidation";
import { boardReducer } from "../../domain/board/boardReducer";
import type { BoardAction } from "../../domain/board/boardReducer";
import TaskRelationshipForm from "./TaskRelationshipForm";

it("uses the domain warning for a parent that became complete, preserves state, and refocuses repeated failures", async () => {
  const child = makeTask({ id: "child", title: "Unfinished child" });
  const parent = makeTask({ id: "parent", title: "Selected parent" });
  let board = makeBoard([child, parent]);
  const user = userEvent.setup();
  const success = vi.fn();
  const dispatch = (action: BoardAction) => {
    const before = board;
    const failure = validateBoardAction(board, action);
    board = boardReducer(board, action);
    expect(board).toBe(before);
    return failure;
  };
  const view = render(<TaskRelationshipForm board={board} task={child} dispatch={dispatch} onClose={() => {}} onSuccess={success} />);
  await user.selectOptions(screen.getByLabelText("Parent"), parent.id);
  // A real stale selection: the parent changed after it was selected.
  board = makeBoard([child, { ...parent, status: "done" }]);
  view.rerender(<TaskRelationshipForm board={board} task={child} dispatch={dispatch} onClose={() => {}} onSuccess={success} />);
  await user.click(screen.getByRole("button", { name: "Save Relationship" }));
  const expected = validateBoardAction(board, { type: "SET_PARENT", taskId: child.id, parentId: parent.id, updatedAt: new Date() })!;
  expect(screen.getByText(`Warning: ${expected.message}`)).toBeInTheDocument();
  expect(screen.getByLabelText("Parent")).toHaveFocus();
  expect(screen.getByLabelText("Parent")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("Parent")).toHaveAccessibleDescription(`Warning: ${expected.message}`);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save Relationship" }));
  expect(screen.getByLabelText("Parent")).toHaveFocus();
  expect(success).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Dismiss notification/ }));
  expect(screen.getByLabelText("Parent")).toHaveFocus();
  expect(screen.getByLabelText("Parent")).not.toHaveAttribute("aria-invalid");
});
