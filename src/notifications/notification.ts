import type { BoardOperationError } from "../domain/board/boardValidation";

export type NotificationVariant = "success" | "error" | "warning" | "info";
type Content = { id: string; message: string };
export type TaskNotification = Content & (
  | { variant: "success" | "info"; dismissal: "automatic"; durationMs: number }
  | { variant: "error" | "warning"; dismissal: "manual" }
);

export const notificationPresentation = {
  success: { label: "Success", icon: "✓", role: "status" },
  error: { label: "Error", icon: "!", role: "alert" },
  warning: { label: "Warning", icon: "⚠", role: "status" },
  info: { label: "Information", icon: "i", role: "status" },
} as const satisfies Record<NotificationVariant, { label: string; icon: string; role: "status" | "alert" }>;

/** Transient results expire; actionable warnings/errors require dismissal or resolution. */
export function createNotification(variant: NotificationVariant, message: string): TaskNotification {
  const content = { id: crypto.randomUUID(), message };
  return variant === "success" || variant === "info"
    ? { ...content, variant, dismissal: "automatic", durationMs: variant === "success" ? 4000 : 6000 }
    : { ...content, variant, dismissal: "manual" };
}

/** Classify existing domain results; relationship rules remain in boardValidation. */
export function operationVariant(failure: BoardOperationError): "warning" | "error" {
  switch (failure.code) {
    case "self-parent": case "cycle": case "hierarchy-depth": case "missing-parent":
    case "completed-parent": case "unchanged-relationship": case "incomplete-children":
    case "parent-delete-confirmation":
      return "warning";
    default:
      return "error";
  }
}
