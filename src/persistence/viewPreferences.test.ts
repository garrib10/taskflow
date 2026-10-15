import { describe, expect, it, vi } from "vitest";
import { decodeViewPreferences, loadViewPreferences, saveViewPreferences, VIEW_PREFERENCES_KEY } from "./viewPreferences";

describe("independent preference boundary", () => {
  it("defaults missing storage and recognizes exact modes without board dependencies", () => {
    expect(decodeViewPreferences(null)).toEqual({ kind: "missing" });
    for (const orderingMode of ["priority", "manual"]) {
      expect(decodeViewPreferences(JSON.stringify({ schemaVersion: 1, orderingMode, ignored: { tasks: [] } })))
        .toEqual({ kind: "valid", preferences: { schemaVersion: 1, orderingMode } });
    }
  });
  it.each(["{broken", "null", "[]", "{}", '{"orderingMode":"manual"}', '{"schemaVersion":0,"orderingMode":"manual"}', '{"schemaVersion":1.5,"orderingMode":"manual"}', '{"schemaVersion":1}', '{"schemaVersion":1,"orderingMode":"Manual"}', '{"schemaVersion":1,"orderingMode":"date"}'])("rejects unsupported shape without coercion: %s", raw => expect(decodeViewPreferences(raw)).toEqual({ kind: "invalid" }));
  it("preserves unknown future classification without interpreting its mode", () => {
    expect(decodeViewPreferences('{"schemaVersion":2,"orderingMode":"unknown"}')).toEqual({ kind: "future", version: 2 });
  });
  it("reports inaccessible reads separately", () => {
    expect(loadViewPreferences(() => { throw new Error("Private exception"); })).toEqual({ kind: "unavailable" });
  });
  it("projects only the preference contract, preserves board bytes and avoids duplicate writes", () => {
    const values = new Map([["taskflow-board", "unchanged-board"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
    expect(saveViewPreferences("manual", () => storage).kind).toBe("saved");
    expect(values.get(VIEW_PREFERENCES_KEY)).toBe('{"schemaVersion":1,"orderingMode":"manual"}');
    expect(values.get("taskflow-board")).toBe("unchanged-board");
    expect(saveViewPreferences("manual", () => storage).kind).toBe("saved");
    expect(storage.setItem).toHaveBeenCalledOnce();
  });
  it("reports quota and unconfirmed postflight without falsely claiming success", () => {
    expect(saveViewPreferences("manual", () => ({ getItem: () => null, setItem: () => { throw new Error("Quota"); } }))).toEqual({ kind: "unconfirmed" });
    expect(saveViewPreferences("manual", () => ({ getItem: () => null, setItem: () => {} }))).toEqual({ kind: "unconfirmed" });
  });
});
