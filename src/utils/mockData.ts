import type { Board } from "../domain/board/Board";

export const initialBoard: Board = {
  id: "board-1",
  name: "TaskFlow Board",
  columns: [
    {
      id: "todo",
      title: "To Do",
      tasks: [],
    },
    {
      id: "in-progress",
      title: "In Progress",
      tasks: [],
    },
    {
      id: "done",
      title: "Done",
      tasks: [],
    },
  ],
};
