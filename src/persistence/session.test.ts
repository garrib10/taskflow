import { describe, expect, it, vi } from "vitest";
import { makeBoard, makeTask } from "../test/fixtures";
import { boardReducer } from "../domain/board/boardReducer";
import { PersistenceSession, listenForBoardChanges } from "./session";
import { STORAGE_KEY, type BoardStorage } from "../utils/storage";

const raw = (revision = "a", title = "Saved task") => JSON.stringify({ schemaVersion: 2, revision, board: makeBoard([makeTask({ title })]) });
function target(value: string | null = raw()) {
  let current = value;
  const storage: BoardStorage = { getItem: vi.fn(() => current), setItem: vi.fn((_key, next) => { current = next; }) };
  return { storage, external: (next: string | null) => { current = next; } };
}

describe("explicit reload conflict policy", () => {
  it("does not rewrite a current board during initialization, including repeated effects", () => {
    const { storage } = target();
    const session = new PersistenceSession(() => storage);
    session.save(session.board);
    session.save(session.board);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("ignores unrelated keys, other storage areas, and identical known content", () => {
    const { storage } = target();
    const session = new PersistenceSession(() => storage);
    expect(session.observe("other", raw("b"), null)).toBe(false);
    expect(session.observe(STORAGE_KEY, raw("b"), sessionStorage)).toBe(false);
    expect(session.observe(STORAGE_KEY, raw(), null)).toBe(false);
    expect(session.notice).toBeNull();
  });
  it("detects valid external content and retains local work while preventing overwrite", () => {
    const { storage, external } = target();
    const session = new PersistenceSession(() => storage);
    const local = boardReducer(session.board, { type: "UPDATE_TASK", taskId: "task-1", edits: { title: "Local draft", description: "Local description", priority: "medium", category: "feature" }, updatedAt: new Date() });
    external(raw("b", "External work"));
    expect(session.observe(STORAGE_KEY, raw("b", "External work"), null)).toBe(true);
    session.save(local);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(local.columns[0]?.tasks[0]?.title).toBe("Local draft");
    expect(session.notice).toMatchObject({ recovery: "reload", variant: "warning" });
    expect(session.observe(STORAGE_KEY, raw("b", "External work"), null)).toBe(false);
  });
  it.each(["{", JSON.stringify({ schemaVersion: 999 }), null])("rejects invalid/future/removal external state without replacing memory: %j", (external) => {
    const { storage } = target();
    const session = new PersistenceSession(() => storage);
    const before = session.board;
    expect(session.observe(STORAGE_KEY, external, null)).toBe(true);
    expect(session.board).toBe(before);
    session.save(makeBoard());
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("detects reused revisions with different contents", () => {
    const { storage } = target();
    const session = new PersistenceSession(() => storage);
    expect(session.observe(STORAGE_KEY, raw("a", "Different content"), null)).toBe(true);
  });
  it("checks disk before saving even when no event arrived", () => {
    const { storage, external } = target();
    const session = new PersistenceSession(() => storage);
    external(raw("b"));
    session.save(makeBoard());
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(session.notice?.message).toContain("Another tab");
  });
  it("responds to clear events and cleans up the exact listener", () => {
    const { storage } = target();
    const session = new PersistenceSession(() => storage);
    const source = new EventTarget();
    const changed = vi.fn();
    const remove = vi.spyOn(source, "removeEventListener");
    const cleanup = listenForBoardChanges(session, source, changed);
    source.dispatchEvent(new StorageEvent("storage", { key: "unrelated", newValue: raw("b") }));
    expect(changed).not.toHaveBeenCalled();
    source.dispatchEvent(new StorageEvent("storage", { key: null, newValue: null }));
    expect(changed).toHaveBeenCalledOnce();
    cleanup();
    expect(remove).toHaveBeenCalledWith("storage", expect.any(Function));
    source.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: raw("c") }));
    expect(changed).toHaveBeenCalledOnce();
  });
  it("a successful save becomes the known revision, ignoring duplicate events", () => {
    const { storage } = target();
    const session = new PersistenceSession(() => storage);
    session.save(makeBoard());
    expect(session.observe(STORAGE_KEY, storage.getItem(STORAGE_KEY), null)).toBe(false);
    expect(session.notice).toBeNull();
  });
});

describe("recovery without silent data loss", () => {
  it.each(["{", "", JSON.stringify({ schemaVersion: 99 })])("keeps rejected raw data untouched and provides an empty usable workspace: %j", (value) => {
    const { storage } = target(value);
    const session = new PersistenceSession(() => storage);
    expect(session.board.columns.flatMap((column) => column.tasks)).toEqual([]);
    session.save(makeBoard());
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem(STORAGE_KEY)).toBe(value);
    expect(session.notice?.variant).toBe(value.includes("schemaVersion") ? "error" : "warning");
  });
  it("initial read failure never writes sample data", () => {
    const storage = { getItem: () => { throw new Error("Unavailable"); }, setItem: vi.fn() };
    const session = new PersistenceSession(() => storage);
    session.save(makeBoard());
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(session.notice?.recovery).toBe("reload");
  });
  it("missing data uses the initial board, then saves once", () => {
    const { storage } = target(null);
    const session = new PersistenceSession(() => storage);
    session.save(session.board);
    session.save(session.board);
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(session.notice).toBeNull();
  });
  it("a failed save supports retry without losing in-memory edits", () => {
    const { storage } = target();
    const write = vi.spyOn(storage, "setItem");
    const originalWrite = write.getMockImplementation();
    write.mockImplementationOnce(() => { throw new DOMException("Full", "QuotaExceededError"); });
    const session = new PersistenceSession(() => storage);
    const local = makeBoard([makeTask({ title: "Unsaved work" })]);
    session.save(local);
    expect(session.notice?.recovery).toBe("retry");
    write.mockImplementation(originalWrite ?? (() => {}));
    session.save(local);
    expect(session.notice).toMatchObject({ variant: "success", recovery: null, message: "Changes in this tab are now saved." });
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? "null").board.columns[0].tasks[0].title).toBe("Unsaved work");
  });
  it("failed migration write keeps the original for safe deterministic retry", () => {
    const legacy = JSON.stringify(makeBoard([makeTask({ subtasks: [{ id: "legacy", title: "Legacy", completed: true }] })]));
    const { storage } = target(legacy);
    const write = vi.spyOn(storage, "setItem");
    const originalWrite = write.getMockImplementation();
    write.mockImplementationOnce(() => { throw new Error("Failed"); });
    const session = new PersistenceSession(() => storage);
    session.save(session.board);
    expect(storage.getItem(STORAGE_KEY)).toBe(legacy);
    expect(session.notice?.recovery).toBe("retry");
    write.mockImplementation(originalWrite ?? (() => {}));
    session.save(session.board);
    expect(session.notice?.variant).toBe("info");
    const reloaded = new PersistenceSession(() => storage);
    expect(reloaded.board.columns.flatMap((column) => column.tasks)).toHaveLength(2);
  });
  it("keeps a migration notice stable through routine saves so its timer is not reset", () => {
    const { storage } = target(JSON.stringify(makeBoard()));
    const session = new PersistenceSession(() => storage);
    session.save(session.board);
    const migrated = session.notice;
    expect(migrated).toMatchObject({ variant: "info", dismissal: "automatic", durationMs: 6000, recovery: null });
    session.save(makeBoard([makeTask({ title: "Changed after upgrade" })]));
    expect(session.notice).toBe(migrated);
    const reloaded = new PersistenceSession(() => storage);
    reloaded.save(reloaded.board);
    expect(reloaded.notice).toBeNull();
  });
});
