import { expect, it } from "vitest";
import { makeBoard, makeTask } from "../test/fixtures";
import { validateBoardAction } from "../domain/board/boardValidation";
import { operationVariant } from "./notification";
import { COLUMN_CAPACITY } from "../domain/board/boardCapacity";

it("classifies a structured capacity rejection as the existing warning variant", () => {
  const board = makeBoard([
    makeTask({ id: "incoming" }),
    ...Array.from({ length: COLUMN_CAPACITY["in-progress"] }, (_, index) => makeTask({ id: `occupied-${index}`, status: "in-progress" })),
  ]);
  const result = validateBoardAction(board, { type: "MOVE_TASK", taskId: "incoming", newStatus: "in-progress", updatedAt: new Date() });
  if (!result || result.code !== "capacity-exceeded") throw new Error("Expected capacity rejection");
  expect(operationVariant(result)).toBe("warning");
  expect(result.capacity).toMatchObject({ status: "in-progress", count: COLUMN_CAPACITY["in-progress"], limit: COLUMN_CAPACITY["in-progress"] });
  expect(result.message).toContain("The task was not moved");
});

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
