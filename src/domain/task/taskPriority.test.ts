import { describe, expect, it } from "vitest";
import { makeTask } from "../../test/fixtures";
import { getPriorityScore, sortTasksByPriority } from "./taskPriority";

describe("priority", () => {
  it("scores high, medium, and low priorities", () => {
    expect(getPriorityScore(makeTask({ priority: "high" }))).toBe(300);
    expect(getPriorityScore(makeTask({ priority: "medium" }))).toBe(200);
    expect(getPriorityScore(makeTask({ priority: "low" }))).toBe(100);
  });
  it("sorts high to low with stable ties and preserves input", () => {
    const tasks = [
      makeTask({ id: "low", priority: "low" }),
      makeTask({ id: "high-first", priority: "high" }),
      makeTask({ id: "medium", priority: "medium" }),
      makeTask({ id: "high-second", priority: "high" }),
    ];
    Object.freeze(tasks);
    expect(sortTasksByPriority(tasks).map((task) => task.id)).toEqual([
      "high-first", "high-second", "medium", "low",
    ]);
    expect(tasks.map((task) => task.id)).toEqual([
      "low", "high-first", "medium", "high-second",
    ]);
  });
});
