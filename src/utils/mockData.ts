import type { Board } from "../domain/board/Board";

export const initialBoard: Board = {
  id: "board-1",
  name: "TaskFlow Board",
  columns: [
    {
      id: "todo",
      title: "To Do",
      tasks: [
        {
          id: "task-1",
          title: "Create TaskFlow UI",
          description: "Build the board layout.",
          priority: "high",
          status: "todo",
          createdAt: new Date(),
        },
        {
          id: "task-2",
          title: "Style columns",
          priority: "medium",
          status: "todo",
          createdAt: new Date(),
        },
      ],
    },
    {
      id: "in-progress",
      title: "In Progress",
      tasks: [
        {
          id: "task-3",
          title: "Create Task model",
          priority: "high",
          status: "in-progress",
          createdAt: new Date(),
        },
      ],
    },
    {
      id: "done",
      title: "Done",
      tasks: [
        {
          id: "task-4",
          title: "Initialize Vite project",
          priority: "low",
          status: "done",
          createdAt: new Date(),
        },
      ],
    },
  ],
};
