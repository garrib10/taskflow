import type { Modifier } from "@dnd-kit/core";

type Transform = Parameters<Modifier>[0]["transform"];
type Rect = Pick<NonNullable<Parameters<Modifier>[0]["draggingNodeRect"]>, "left" | "right" | "top" | "bottom">;

/** Use column bounds: scrollWidth includes the dragged card and can grow indefinitely. */
export function restrictDragToColumns(transform: Transform, card: Rect | null, columns: readonly Rect[]): Transform {
  if (!card || columns.length === 0) return transform;

  const left = Math.min(...columns.map(rect => rect.left));
  const right = Math.max(...columns.map(rect => rect.right));
  const top = Math.min(...columns.map(rect => rect.top));
  const bottom = Math.max(...columns.map(rect => rect.bottom));

  return {
    ...transform,
    x: Math.max(left - card.left, Math.min(right - card.right, transform.x)),
    y: Math.max(top - card.top, Math.min(bottom - card.bottom, transform.y)),
  };
}
