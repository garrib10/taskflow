import type { Priority } from "./Task";

export interface PriorityStyle {
  label: string;
  icon: string;
  borderClass: string;
  badgeClass: string;
}

export const priorityStyles: Record<Priority, PriorityStyle> = {
  high: {
    label: "High",
    icon: "🔴",
    borderClass: "priority-high",
    badgeClass: "badge-high",
  },

  medium: {
    label: "Medium",
    icon: "🟡",
    borderClass: "priority-medium",
    badgeClass: "badge-medium",
  },

  low: {
    label: "Low",
    icon: "🟢",
    borderClass: "priority-low",
    badgeClass: "badge-low",
  },
};
