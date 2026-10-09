import { expect, it } from "vitest";
import { makeBoard, makeTask } from "../test/fixtures";
import { loadBoard, saveBoard } from "./storage";
import { getChildren, getParent } from "../domain/board/taskRelationships";

it("round-trips linked tasks and legacy checklist data without conversion or loss", () => {
  const previous = localStorage.getItem("taskflow-board");
  const parent = makeTask({ id: "parent", subtasks: [{ id: "legacy-id", title: "Legacy work", completed: true }] });
  const child = makeTask({ id: "child", parentId: parent.id, status: "done" });
  const board = makeBoard([parent, child]);
  try {
    expect(saveBoard(board, previous).kind).toBe("saved");
    const loaded = loadBoard();
    if (loaded.kind !== "current") throw new Error("Board was not restored");
    const restored = loaded.board;
    expect(restored).toEqual(board);
    if (!restored) throw new Error("Board was not restored");
    expect(getParent(restored, child)).toEqual(parent);
    expect(getChildren(restored, parent.id)).toEqual([child]);
    expect(restored.columns.flatMap((column) => column.tasks).find((task) => task.id === parent.id)?.subtasks).toEqual(parent.subtasks);
  } finally {
    if (previous === null) localStorage.removeItem("taskflow-board");
    else localStorage.setItem("taskflow-board", previous);
  }
});
