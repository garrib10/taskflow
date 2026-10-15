import type { TaskEdits } from "./Task";
import { priorityStyles } from "./priorityStyles";
import { categoryStyles } from "./categoryStyles";

export interface TaskContentError {
  field: keyof TaskEdits;
  message: string;
}

/** Existing form rules, shared by all creation/edit entry points before mutation.
 * This validates intended content, not hydrated legacy records.
 */
export function validateTaskContent(content: TaskEdits): TaskContentError | null {
  if (typeof content.title !== "string" || !content.title.trim()) return { field: "title", message: "Task title is required." };
  if (content.title.trim().length < 3) return { field: "title", message: "Task title must be at least 3 characters long." };
  if (content.title.trim().length > 150) return { field: "title", message: "Task title cannot exceed 150 characters." };
  if (typeof content.description !== "string" || !content.description.trim()) return { field: "description", message: "Task description is required." };
  if (content.description.trim().length > 300) return { field: "description", message: "Task description cannot exceed 300 characters." };
  if (typeof content.priority !== "string" || !Object.hasOwn(priorityStyles, content.priority)) return { field: "priority", message: "Choose a valid priority." };
  if (typeof content.category !== "string" || !Object.hasOwn(categoryStyles, content.category)) return { field: "category", message: "Choose a valid category." };
  return null;
}
