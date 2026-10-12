import type { OrderingMode } from "../domain/board/boardOrdering";

export const VIEW_PREFERENCES_KEY = "taskflow-view-preferences";
export const DEFAULT_ORDERING_MODE: OrderingMode = "priority";
export interface PersistedViewPreferencesV1 { schemaVersion: 1; orderingMode: OrderingMode }
export type PreferenceLoadResult =
  | { kind: "missing" }
  | { kind: "valid"; preferences: PersistedViewPreferencesV1 }
  | { kind: "invalid" }
  | { kind: "future"; version: number }
  | { kind: "unavailable" };
export type PreferenceSaveResult = { kind: "saved" } | { kind: "unconfirmed" };
export interface PreferenceStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const preferenceStorage = (): PreferenceStorage => window.localStorage;
export function isOrderingMode(value: unknown): value is OrderingMode { return value === "priority" || value === "manual"; }
function isPreferenceObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Independent of board validation; supported unknown fields are projected away. */
export function decodeViewPreferences(raw: string | null): PreferenceLoadResult {
  if (raw === null) return { kind: "missing" };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { kind: "invalid" }; }
  if (!isPreferenceObject(value) || typeof value.schemaVersion !== "number" || !Number.isSafeInteger(value.schemaVersion) || value.schemaVersion < 1) return { kind: "invalid" };
  if (value.schemaVersion > 1) return { kind: "future", version: value.schemaVersion };
  if (!isOrderingMode(value.orderingMode)) return { kind: "invalid" };
  return { kind: "valid", preferences: { schemaVersion: 1, orderingMode: value.orderingMode } };
}
export function loadViewPreferences(storage: () => PreferenceStorage = preferenceStorage): PreferenceLoadResult {
  try { return decodeViewPreferences(storage().getItem(VIEW_PREFERENCES_KEY)); } catch { return { kind: "unavailable" }; }
}
/** Only an explicit approved selection writes; hydration/fallback never does. */
export function saveViewPreferences(orderingMode: OrderingMode, storage: () => PreferenceStorage = preferenceStorage): PreferenceSaveResult {
  if (!isOrderingMode(orderingMode)) return { kind: "unconfirmed" };
  const raw = JSON.stringify({ schemaVersion: 1, orderingMode } satisfies PersistedViewPreferencesV1);
  try {
    const target = storage();
    if (target.getItem(VIEW_PREFERENCES_KEY) !== raw) target.setItem(VIEW_PREFERENCES_KEY, raw);
    return target.getItem(VIEW_PREFERENCES_KEY) === raw ? { kind: "saved" } : { kind: "unconfirmed" };
  } catch { return { kind: "unconfirmed" }; }
}
