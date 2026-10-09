import type { KeyboardCoordinateGetter } from '@dnd-kit/core';
import { taskStatuses } from '../domain/task/Task';
/** Select workflow columns rather than making users traverse them in 25px increments. */
export const keyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.code)) return;
  const current = context.over?.id ?? context.active?.data.current?.status;
  const index = taskStatuses.findIndex(id => id === current);
  const target = taskStatuses[index + (event.code === 'ArrowRight' ? 1 : -1)];
  const rect = target ? context.droppableRects.get(target) : undefined;
  const collision = context.collisionRect;
  if (!rect || !collision || index < 0) return;
  event.preventDefault();
  return { x: currentCoordinates.x + rect.left + rect.width / 2 - collision.left - collision.width / 2,
    y: currentCoordinates.y + rect.top + Math.min(rect.height / 2, 80) - collision.top - collision.height / 2 };
};
