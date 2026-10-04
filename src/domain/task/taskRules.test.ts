import { describe, expect, it } from "vitest";
import { taskStatuses } from "./Task";
import { canMoveTask } from "./taskRules";
import { isTaskStatus } from "../../utils/typeGuards";

describe("forward-only workflow", () => {
  const valid = new Set(["todo:in-progress", "in-progress:in-review", "in-review:done"]);
  for (const source of taskStatuses) {
    for (const destination of taskStatuses) {
      it(`${source} → ${destination}`, () => {
        expect(canMoveTask(source, destination)).toBe(valid.has(`${source}:${destination}`));
      });
    }
  }
  it.each(taskStatuses)("recognizes %s", (status) => {
    expect(isTaskStatus(status)).toBe(true);
  });
  it.each(["", "review", "all", "TODO", "toString", null, undefined, 1, {}, []])(
    "rejects unknown status %j safely", (status) => {
      expect(isTaskStatus(status)).toBe(false);
      expect(canMoveTask(status, "in-progress")).toBe(false);
      expect(canMoveTask("todo", status)).toBe(false);
    },
  );
});
