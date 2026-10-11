import type { Board } from "../domain/board/Board.ts";
import type { Task } from "../domain/task/Task.ts";

// Self-contained historical data shared by unit and browser checks; no current encoder.
function historicalTask(overrides: Partial<Task>): Task {
  return { id: "task-1", title: "Build search", description: "Find tasks by description",
    priority: "medium", category: "feature", status: "todo",
    createdAt: new Date("2026-01-01T00:00:00.000Z"), subtasks: [], ...overrides };
}

/** Synthetic v1.5 data; no personal browser storage or production content. */
export function v15BoardFixture(): Board {
  const tasks = [
    historicalTask({ id: "parent", title: "Release checklist", priority: "high", category: "devops",
      createdAt: new Date("2025-06-01T12:00:00.000Z"),
      subtasks: [{ id: "retained-checklist", title: "Historical checklist", completed: true }] }),
    historicalTask({ id: "equal-first", title: "First high arrival", priority: "high", category: "refactor" }),
    historicalTask({ id: "equal-second", title: "Second high arrival", priority: "high", category: "testing" }),
    historicalTask({ id: "low", title: "Low priority arrival", priority: "low", category: "ui" }),
    historicalTask({ id: "child", title: "Completed linked child", description: "Retain this child", parentId: "parent", status: "done", category: "bug" }),
    ...Array.from({ length: 7 }, (_, index) => historicalTask({ id: `progress-${index}`, title: `Progress work ${index}`, status: "in-progress" })),
    ...Array.from({ length: 5 }, (_, index) => historicalTask({ id: `review-${index}`, title: `Review work ${index}`, status: "in-review" })),
  ];
  const titles = { todo: "To Do", "in-progress": "In Progress", "in-review": "In Review", done: "Done" };
  const statuses = ["todo", "in-progress", "in-review", "done"] as const;
  return { id: "board-1", name: "Test board", lastUpdated: new Date("2026-01-01T00:00:00.000Z"),
    columns: statuses.map(id => ({ id, title: titles[id], tasks: tasks.filter(task => task.status === id) })) };
}

export function legacyChecklistFixture() {
  return {
    id: "legacy-board", name: "Legacy workspace",
    columns: [{ id: "todo", title: "Original To Do", tasks: [{
      id: "parent", title: "Legacy parent", priority: "high", category: "devops", status: "todo",
      createdAt: "2024-05-10T15:30:00.000Z",
      subtasks: [
        { id: "complete", title: "Finished work", completed: true },
        { id: "open", title: "Remaining work", completed: false },
      ],
    }] }],
  };
}
