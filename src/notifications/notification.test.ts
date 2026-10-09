import { expect, it } from "vitest";
import { makeBoard, makeTask } from "../test/fixtures";
import { validateBoardAction } from "../domain/board/boardValidation";
import { operationVariant } from "./notification";

it.each(["self", "cycle", "depth", "completed", "missing"] as const)("classifies the real %s relationship rejection as a warning", scenario => {
  const parent = makeTask({ id: "parent", title: "Parent" });
  const child = makeTask({ id: "child", title: "Child", parentId: "parent" });
  const board = makeBoard([parent, child, makeTask({ id: "done", title: "Done", status: "done" }), makeTask({ id: "other", title: "Other" })]);
  const parentId = scenario === "self" ? parent.id : scenario === "cycle" || scenario === "depth" ? child.id : scenario === "completed" ? "done" : "missing";
  const taskId = scenario === "depth" || scenario === "completed" ? "other" : parent.id;
  const result = validateBoardAction(board, { type: "SET_PARENT", taskId, parentId, updatedAt: new Date() });
  expect(result).not.toBeNull();
  expect(operationVariant(result!)).toBe("warning");
  expect(result!.message.length).toBeGreaterThan(20);
});
