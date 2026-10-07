import { expect, it } from "vitest";
import { restrictDragToColumns } from "./dragBounds";

const columns = [0, 344, 688, 1032].map(left => ({ left, right: left + 320, top: 100, bottom: 600 }));
const card = { left: 705, right: 991, top: 170, bottom: 370 };
const transform = { x: 100, y: 20, scaleX: 1, scaleY: 1 };

it("preserves movement within the columns without mutating the transform", () => {
  expect(restrictDragToColumns(transform, card, columns)).toEqual(transform);
  expect(transform).toEqual({ x: 100, y: 20, scaleX: 1, scaleY: 1 });
});

it("stops past the last column and before the first column", () => {
  expect(restrictDragToColumns({ ...transform, x: 5000 }, card, columns).x).toBe(361);
  expect(restrictDragToColumns({ ...transform, x: -5000 }, card, columns).x).toBe(-705);
});

it("uses the columns' current scrolled positions rather than an expanding scroll width", () => {
  const scrolled = columns.map(rect => ({ ...rect, left: rect.left - 592, right: rect.right - 592 }));
  expect(restrictDragToColumns({ ...transform, x: 5000 }, card, scrolled).x).toBe(-231);
});

it("allows movement among vertically stacked mobile columns while keeping the card inside the board", () => {
  const stacked = [0, 300, 600, 900].map(top => ({ left: 16, right: 359, top, bottom: top + 280 }));
  const mobileCard = { left: 33, right: 342, top: 620, bottom: 820 };
  expect(restrictDragToColumns({ ...transform, x: 5000, y: 5000 }, mobileCard, stacked)).toEqual({ ...transform, x: 17, y: 360 });
  expect(restrictDragToColumns({ ...transform, x: -5000, y: -5000 }, mobileCard, stacked)).toEqual({ ...transform, x: -17, y: -620 });
});

it("preserves scale feedback and tolerates unavailable measurements", () => {
  const scaled = { ...transform, scaleX: 1.2, scaleY: 0.8 };
  expect(restrictDragToColumns(scaled, card, columns)).toEqual(scaled);
  expect(restrictDragToColumns(scaled, null, columns)).toBe(scaled);
  expect(restrictDragToColumns(scaled, card, [])).toBe(scaled);
});
