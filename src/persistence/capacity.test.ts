import { expect, it } from "vitest";
import { COLUMN_CAPACITY, getColumnCapacity } from "../domain/board/boardCapacity";
import { boardReducer } from "../domain/board/boardReducer";
import { fixtureDate, makeBoard, makeTask } from "../test/fixtures";
import { decodeBoard, saveBoard } from "../utils/storage";

function overLimit() {
  return makeBoard([
    ...Array.from({ length: COLUMN_CAPACITY["in-progress"] + 2 }, (_, index) => makeTask({ id: `progress-${index}`, status: "in-progress" })),
    ...Array.from({ length: COLUMN_CAPACITY["in-review"] + 2 }, (_, index) => makeTask({ id: `review-${index}`, status: "in-review" })),
  ]);
}
it.each([0, 1, 2])("loads schema %i over-limit data without task loss or forced movement", version => {
  const board = overLimit();
  const raw = JSON.stringify(version === 0 ? board : { schemaVersion: version, revision: "old", board });
  const loaded = decodeBoard(raw);
  expect(loaded.kind).toBe(version === 2 ? "current" : "migrated");
  if (loaded.kind !== "current" && loaded.kind !== "migrated") throw new Error("Over-limit board rejected");
  expect(loaded.board).toEqual(board);
  expect(getColumnCapacity(loaded.board, "in-progress").state).toBe("over");
  expect(getColumnCapacity(loaded.board, "in-review").state).toBe("over");
});
it("saves over-limit recovery/content edits, retains manual data and excludes capacity configuration/counts", () => {
  const board = boardReducer(overLimit(), { type: "INITIALIZE_MANUAL_ORDER", updatedAt: fixtureDate });
  const edited = boardReducer(board, { type: "UPDATE_TASK", taskId: "review-0", edits: { title: "Updated work", description: "Details", priority: "high", category: "testing" }, updatedAt: fixtureDate });
  const mixed = { ...edited, capacity: COLUMN_CAPACITY, columns: edited.columns.map(column => ({ ...column, capacity: getColumnCapacity(edited, column.id) })) };
  let raw: string | null = null;
  const storage = { getItem: () => raw, setItem: (_: string, value: string) => { raw = value; } };
  expect(saveBoard(mixed, null, () => storage, () => "valid-over-limit").kind).toBe("saved");
  const value = JSON.parse(raw ?? "null");
  expect(value.board).toEqual(JSON.parse(JSON.stringify(edited)));
  const restored = decodeBoard(raw);
  expect(restored.kind).toBe("current");
  if (restored.kind !== "current") throw new Error("Recovery edit did not restore");
  expect(restored.board).toEqual(edited);
  expect(boardReducer(restored.board, { type: "MOVE_TASK", taskId: "review-0", newStatus: "done", updatedAt: fixtureDate })).not.toBe(restored.board);
});
