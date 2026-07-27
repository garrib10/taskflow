import type { Priority } from "./Task";

export interface PriorityStyle {
  label: string;
  borderClass: string;
  badgeClass: string;
}

export const priorityStyles: Record<Priority, PriorityStyle> = {
  high: {
    label: "High",
    borderClass: "priority-high",
    badgeClass: "badge-high",
  },

  medium: {
    label: "Medium",
    borderClass: "priority-medium",
    badgeClass: "badge-medium",
  },

  low: {
    label: "Low",
    borderClass: "priority-low",
    badgeClass: "badge-low",
  },
};
