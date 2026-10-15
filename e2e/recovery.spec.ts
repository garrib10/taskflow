import { test, expect, type Page } from "@playwright/test";
import { currentBoardRaw, makeBoard, makeTask } from "../src/test/fixtures.ts";
import { v15BoardFixture } from "../src/test/migrationFixtures.ts";

const saved = (page: Page) => page.evaluate(() => localStorage.getItem("taskflow-board"));
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "TaskFlow", exact: true })).toBeVisible();
});

test("unresolved data survives refresh, keyboard cancellation and failed replacement before confirmed recovery", async ({ page, browserName }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.evaluate(() => {
    localStorage.setItem("taskflow-board", "{broken");
    localStorage.setItem("taskflow-view-preferences", "synthetic-preferences");
  });
  await page.reload();
  const panel = page.getByRole("region", { name: "Board storage" });
  await expect(panel).toContainText("empty workspace");
  await page.reload();
  expect(await saved(page)).toBe("{broken");
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  const replace = panel.getByRole("button", { name: "Replace saved board", exact: true });
  await replace.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Replace Saved Board?" });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(replace).toBeFocused();
  expect(await saved(page)).toBe("{broken");
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "taskflow-board") throw new DOMException("Synthetic quota failure", "QuotaExceededError");
      set.call(this, key, value);
    };
    document.addEventListener("unblock-test-storage", () => { Storage.prototype.setItem = set; }, { once: true });
  });
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  // macOS WebKit's native Tab can skip buttons; Option-Tab includes all controls.
  await page.keyboard.press(browserName === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab");
  await expect(dialog.getByRole("button", { name: "Replace Saved Board", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel).toContainText("could not confirm");
  expect(await saved(page)).toBe("{broken");
  await page.evaluate(() => document.dispatchEvent(new Event("unblock-test-storage")));
  await replace.click();
  await dialog.getByRole("button", { name: "Replace Saved Board", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "+ Create Task", exact: true })).toBeFocused();
  const recovered = await saved(page);
  expect(JSON.parse(recovered!).schemaVersion).toBe(3);
  expect(await page.evaluate(() => localStorage.getItem("taskflow-view-preferences"))).toBe("synthetic-preferences");
  await page.reload();
  expect(await saved(page)).toBe(recovered);
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("selective order repair saves local edits and full-board relationships without resetting valid lists", async ({ page }) => {
  const board = JSON.parse(JSON.stringify(v15BoardFixture()));
  board.columns.forEach((column: { manualOrder: unknown }) => { column.manualOrder = null; });
  board.columns[0].manualOrder = ["parent", "parent"];
  const validOrder = board.columns[1].tasks.map((task: { id: string }) => task.id).reverse();
  board.columns[1].manualOrder = validOrder;
  const original = JSON.stringify({ schemaVersion: 3, revision: "damaged", board });
  await page.evaluate(raw => localStorage.setItem("taskflow-board", raw), original);
  await page.reload();
  const repair = page.getByRole("button", { name: "Repair saved order", exact: true });
  await repair.click();
  await page.getByRole("dialog", { name: "Repair Saved Order?" }).getByRole("button", { name: "Cancel" }).click();
  expect(await saved(page)).toBe(original);
  await expect(repair).toBeFocused();
  await page.getByRole("button", { name: "Open task Low priority arrival", exact: true }).click(); await page.getByRole("button", { name: "Edit task", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit Task" });
  await editor.getByLabel("Title", { exact: true }).fill("Local recovery edit");
  await editor.getByRole("button", { name: "Save Changes" }).click();
  await page.getByRole("searchbox").fill("Local recovery edit");
  expect(await saved(page)).toBe(original);
  await repair.click();
  await page.getByRole("dialog", { name: "Repair Saved Order?" }).getByRole("button", { name: "Repair Saved Order", exact: true }).click();
  await expect(repair).toHaveCount(0);
  const result = JSON.parse((await saved(page))!);
  expect(result.board.columns[0].manualOrder).toEqual(["parent", "equal-first", "equal-second", "low"]);
  expect(result.board.columns[1].manualOrder).toEqual(validOrder);
  expect(result.board.columns[2].manualOrder).toBeNull();
  expect(result.board.columns[3].tasks[0].parentId).toBe("parent");
  expect(result.board.columns.map((column: { tasks: unknown[] }) => column.tasks.length)).toEqual([4, 7, 5, 1]);
  expect(result.board.columns[0].tasks.find((task: { id: string }) => task.id === "low").title).toBe("Local recovery edit");
  const raw = await saved(page);
  await page.reload();
  expect(await saved(page)).toBe(raw);
  await expect(repair).toHaveCount(0);
});

test("transient read restriction stays paused until a confirmed successful retry restores saved work", async ({ page }) => {
  const board = JSON.parse(JSON.stringify(v15BoardFixture()));
  board.columns.forEach((column: { manualOrder: unknown }) => { column.manualOrder = null; });
  const original = JSON.stringify({ schemaVersion: 3, revision: "restricted", board });
  await page.evaluate(raw => {
    localStorage.setItem("taskflow-board", raw);
    sessionStorage.setItem("test-block-read", "yes");
  }, original);
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (this === localStorage && key === "taskflow-board" && get.call(sessionStorage, "test-block-read") === "yes") {
        throw new DOMException("Synthetic read restriction", "SecurityError");
      }
      return get.call(this, key);
    };
  });
  await page.reload();
  const panel = page.getByRole("region", { name: "Board storage" });
  await expect(panel).toContainText("could not be read");
  await expect(panel.getByRole("button", { name: "Replace saved board" })).toHaveCount(0);
  const retry = panel.getByRole("button", { name: "Retry reading saved board" });
  await retry.click();
  const dialog = page.getByRole("dialog", { name: "Retry Reading Saved Board?" });
  await dialog.getByRole("button", { name: "Retry Reading", exact: true }).click();
  await expect(panel).toContainText("could not be read");
  await page.evaluate(() => sessionStorage.removeItem("test-block-read"));
  expect(await saved(page)).toBe(original);
  await retry.click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(retry).toBeFocused();
  await retry.click();
  await dialog.getByRole("button", { name: "Retry Reading", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open task Release checklist", exact: true })).toBeVisible();
  expect(await saved(page)).toBe(original);
  await page.reload();
  expect(await saved(page)).toBe(original);
});

test("native cross-tab changes preserve a local draft and remote bytes until an explicit confirmed reload", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const initial = currentBoardRaw(makeBoard([makeTask({ title: "Shared task" })]));
  await page.evaluate(value => localStorage.setItem("taskflow-board", value), initial);
  await page.reload();
  await page.getByRole("button", { name: "Open task Shared task", exact: true }).click();
  await page.getByRole("button", { name: "Edit task", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Local unsaved draft");
  const writer = await context.newPage();
  writer.on("pageerror", error => errors.push(error.message));
  try {
    await writer.goto("/");
    await writer.getByRole("button", { name: "Open task Shared task", exact: true }).click();
    await writer.getByRole("button", { name: "Edit task", exact: true }).click();
    await writer.getByLabel("Title", { exact: true }).fill("Remote saved task");
    await writer.getByLabel("Description", { exact: true }).fill("Remote saved notes");
    await writer.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(writer.getByRole("button", { name: "Open task Remote saved task", exact: true })).toBeVisible();
    const remote = await saved(writer);
    expect(remote).not.toBe(initial);
    // Both pages share only this isolated context's storage. No synthetic StorageEvent.
    const recovery = page.getByRole("region", { name: "Board storage", includeHidden: true });
    await expect(recovery).toContainText("Another tab changed");
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Local unsaved draft");
    expect(await saved(page)).toBe(remote);
    await page.bringToFront();
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open task Local unsaved draft", exact: true })).toBeVisible();
    await expect(recovery).toContainText("Saving is paused");
    await expect(page.getByRole("status").filter({ hasText: "Another tab changed" })).toContainText("Warning:");
    expect(await saved(page)).toBe(remote);
    expect(await saved(writer)).toBe(remote);
    const reload = page.getByRole("button", { name: "Reload saved board", exact: true });
    await reload.click();
    const confirmation = page.getByRole("dialog", { name: "Reload Saved Board?", exact: true });
    await expect(confirmation.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(reload).toBeFocused();
    await expect(page.getByRole("button", { name: "Open task Local unsaved draft", exact: true })).toBeVisible();
    expect(await saved(page)).toBe(remote);
    await reload.click();
    await confirmation.getByRole("button", { name: "Reload Saved Board", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open task Remote saved task", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open task Local unsaved draft", exact: true })).toHaveCount(0);
    await expect(recovery).toHaveCount(0);
    expect(await saved(page)).toBe(remote);
    expect(await saved(writer)).toBe(remote);
    expect(errors).toEqual([]);
  } finally {
    await writer.close();
  }
});
