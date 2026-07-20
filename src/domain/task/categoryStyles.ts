import type { TaskCategory } from "./taskCategory";

export interface CategoryStyle {
  label: string;
  badgeClass: string;
}

export const categoryStyles: Record<TaskCategory, CategoryStyle> = {
  feature: {
    label: "Feature",
    badgeClass: "category-feature",
  },

  ui: {
    label: "UI",
    badgeClass: "category-ui",
  },

  bug: {
    label: "Bug",
    badgeClass: "category-bug",
  },

  testing: {
    label: "Testing",
    badgeClass: "category-testing",
  },

  refactor: {
    label: "Refactor",
    badgeClass: "category-refactor",
  },

  devops: {
    label: "DevOps",
    badgeClass: "category-devops",
  },
};
