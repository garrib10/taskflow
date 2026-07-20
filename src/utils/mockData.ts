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
          title: "Implement User Authentication",
          description:
            "Add secure user authentication including login, logout, and protected routes to allow users to securely access their personal TaskFlow workspace.",
          priority: "high",
          category: "feature",
          status: "todo",
          createdAt: new Date(),
        },
        {
          id: "task-2",
          title: "Build Dashboard Widgets",
          description:
            "Create reusable dashboard widgets that display project metrics, task summaries, and workflow statistics to improve project visibility.",
          priority: "medium",
          category: "ui",
          status: "todo",
          createdAt: new Date(),
        },
        {
          id: "task-3",
          title: "Add Search Functionality",
          description:
            "Implement a search feature that allows users to quickly locate tasks by title or description across the workflow board.",
          priority: "low",
          category: "feature",
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
          id: "task-4",
          title: "Improve Responsive Layout",
          description:
            "Optimize the board layout for tablets and smaller screens while maintaining a consistent user experience across devices.",
          priority: "medium",
          category: "ui",
          status: "in-progress",
          createdAt: new Date(),
        },
        {
          id: "task-5",
          title: "Refactor State Management",
          description:
            "Simplify state management by improving reducer logic, separating business rules, and increasing code maintainability.",
          priority: "high",
          category: "refactor",
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
          id: "task-6",
          title: "Configure Drag & Drop",
          description:
            "Implement drag-and-drop functionality for moving tasks between workflow stages using @dnd-kit.",
          priority: "medium",
          category: "feature",
          status: "done",
          createdAt: new Date(),
        },
        {
          id: "task-7",
          title: "Add Priority Scoring",
          description:
            "Introduce a scoring system that ranks tasks by priority and automatically highlights the highest-priority work.",
          priority: "low",
          category: "feature",
          status: "done",
          createdAt: new Date(),
        },
        {
          id: "task-8",
          title: "Implement Workflow Validation",
          description:
            "Enforce workflow rules that prevent invalid task transitions and display user-friendly notifications when restrictions are violated.",
          priority: "high",
          category: "testing",
          status: "done",
          createdAt: new Date(),
        },
      ],
    },
  ],
};
