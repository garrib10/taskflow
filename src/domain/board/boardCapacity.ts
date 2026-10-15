import type { Board } from "./Board.ts";
import type { TaskStatus } from "../task/Task.ts";

/** Fixed application policy, never user preferences or persisted board fields. */
export const COLUMN_CAPACITY = Object.freeze({
  todo: null,
  "in-progress": 5,
  "in-review": 3,
  done: null,
} as const satisfies Readonly<Record<TaskStatus, number | null>>);

export interface LimitedColumnCapacity {
  kind: "limited";
  status: TaskStatus;
  count: number;
  limit: number;
  remaining: number;
  state: "available" | "near" | "full" | "over";
}
export type ColumnCapacity = LimitedColumnCapacity | {
  kind: "unlimited";
  status: TaskStatus;
  count: number;
  limit: null;
  remaining: null;
  state: "unlimited";
};

/** Only complete domain board membership counts; never a rendered or filtered subset. */
export function getColumnCapacity(board: Board, status: TaskStatus): ColumnCapacity {
  const count = board.columns.filter(column => column.id === status).reduce((total, column) => total + column.tasks.length, 0);
  const limit = COLUMN_CAPACITY[status];
  if (limit === null) return { kind: "unlimited", status, count, limit, remaining: null, state: "unlimited" };
  const remaining = Math.max(0, limit - count);
  return { kind: "limited", status, count, limit, remaining,
    state: count > limit ? "over" : count === limit ? "full" : remaining === 1 ? "near" : "available" };
}

export type CapacityDecision =
  | { kind: "allowed"; addsOccupancy: boolean; capacity: ColumnCapacity }
  | { kind: "blocked"; addsOccupancy: true; capacity: LimitedColumnCapacity };

/** One-record arrival policy shared by all mutation entry points.
 * Hydration is not an incoming operation; same-status placement consumes no slot.
 */
export function evaluateIncomingCapacity(board: Board, destination: TaskStatus, source?: TaskStatus): CapacityDecision {
  const capacity = getColumnCapacity(board, destination);
  const addsOccupancy = source !== destination;
  if (addsOccupancy && capacity.kind === "limited" && capacity.count + 1 > capacity.limit) {
    return { kind: "blocked", addsOccupancy, capacity };
  }
  return { kind: "allowed", addsOccupancy, capacity };
}
