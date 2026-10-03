import { describe, expect, it } from "vitest";
import { canMoveTask } from "./taskRules";

describe("task workflow foundation", () => {
  it("allows a task to advance from To Do to In Progress", () => {
    expect(canMoveTask("todo", "in-progress")).toBe(true);
  });

  it("rejects skipping directly from To Do to Done", () => {
    expect(canMoveTask("todo", "done")).toBe(false);
  });
});
