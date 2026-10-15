import { test, expect, type Page } from "@playwright/test";
import { legacyChecklistFixture, v15BoardFixture } from "../src/test/migrationFixtures.ts";

async function seed(page: Page, raw: string) {
  await page.evaluate(value => localStorage.setItem("taskflow-board", value), raw);
  await page.reload();
  await expect(page.getByRole("heading", { name: "TaskFlow", exact: true })).toBeVisible();
}
async function stage(page: Page, value: string) {
  const selector = page.getByLabel("Workflow stage", { exact: true });
  if (await selector.count()) await selector.selectOption(value);
}
async function snapshot(page: Page) {
  return page.evaluate(() => localStorage.getItem("taskflow-board"));
}
const browserErrors = new WeakMap<Page, string[]>();
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? [], "No application exceptions").toEqual([]);
});
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "TaskFlow", exact: true })).toBeVisible();
  await expect.poll(() => snapshot(page)).not.toBeNull();
});

test("fresh storage and v1.5 upgrade preserve full board, independent ordering and parent navigation after refresh", async ({ page }) => {
  const fresh = JSON.parse((await snapshot(page))!);
  expect(fresh.schemaVersion).toBe(3);
  expect(fresh.board.columns.every((column: { manualOrder: unknown }) => column.manualOrder === null)).toBe(true);
  const board = v15BoardFixture();
  board.columns[0].manualOrder = ["low", "equal-second", "parent", "equal-first"];
  const original = JSON.stringify({ schemaVersion: 2, revision: "v15", board });
  await seed(page, original);
  await expect(page.getByText("Information: Your saved board was upgraded to the current format.", { exact: true })).toBeVisible();
  const raw = (await snapshot(page))!;
  const saved = JSON.parse(raw);
  expect(saved.schemaVersion).toBe(3);
  expect(saved.revision).not.toBe("v15");
  const expected = JSON.parse(JSON.stringify(board));
  expected.columns.forEach((column: { manualOrder?: string[] | null }) => { column.manualOrder ??= null; });
  expect(saved.board).toEqual(expected);
  await stage(page, "in-progress");
  await expect(page.getByRole("heading", { name: "In Progress (7)", exact: true })).toBeVisible();
  await stage(page, "in-review");
  await expect(page.getByRole("heading", { name: "In Review (5)", exact: true })).toBeVisible();
  await stage(page, "todo");
  const toDo = page.getByRole("region", { name: "To Do (4)", exact: true });
  await expect(toDo.getByRole("heading", { level: 3 })).toHaveText(["Release checklist", "First high arrival", "Second high arrival", "Low priority arrival"]);
  await page.reload();
  expect(await snapshot(page)).toBe(raw);
  await expect(page.getByText(/Your saved board was upgraded/)).toHaveCount(0);
  await stage(page, "done");
  await page.getByRole("button", { name: "Open task Completed linked child", exact: true }).click(); await page.getByRole("button", { name: "Edit task", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit SubTask" })).toBeVisible();
  await page.getByRole("button", { name: "Open parent Release checklist", exact: true }).click();
  await page.getByRole("button", { name: "Edit task", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit Task" }).getByLabel("Title", { exact: true })).toHaveValue("Release checklist");
  expect(await snapshot(page)).toBe(raw);
});

test("legacy checklist conversion is repeat-safe and incomplete children still block parent completion", async ({ page }) => {
  const board = legacyChecklistFixture();
  board.columns[0].id = "in-review";
  board.columns[0].title = "In Review";
  board.columns[0].tasks[0].status = "in-review";
  await seed(page, JSON.stringify({ schemaVersion: 1, board }));
  const raw = (await snapshot(page))!;
  expect(JSON.parse(raw).schemaVersion).toBe(3);
  await page.reload();
  expect(await snapshot(page)).toBe(raw);
  await stage(page, "todo");
  await expect(page.getByRole("button", { name: "Open task Remaining work", exact: true })).toHaveCount(1);
  await stage(page, "done");
  await expect(page.getByRole("button", { name: "Open task Finished work", exact: true })).toHaveCount(1);
  await stage(page, "in-review");
  const handle = page.getByRole("button", { name: "Move task Legacy parent, In Review", exact: true });
  await handle.focus(); await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status", { name: "Board updates" })).toContainText("Destination:");
  await page.keyboard.press("Space");
  await expect(page.getByRole("status", { name: "Board updates" })).toContainText("subtask");
  await expect(page.getByRole("button", { name: "Move task Legacy parent, In Review", exact: true })).toBeVisible();
  expect(await snapshot(page)).toBe(raw);
});

test("damaged order retains safe tasks and local edits without overwriting saved bytes; invalid and future data remain untouched", async ({ page }) => {
  const board = JSON.parse(JSON.stringify(v15BoardFixture()));
  board.columns.forEach((column: Record<string, unknown>) => { column.manualOrder = null; });
  board.columns[0].manualOrder = ["parent", "parent"];
  const raw = JSON.stringify({ schemaVersion: 3, revision: "damaged", board });
  await seed(page, raw);
  await expect(page.getByRole("region", { name: "Board storage" })).toContainText("saving is paused");
  await expect(page.getByRole("button", { name: "Open task Release checklist", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open task Low priority arrival", exact: true }).click(); await page.getByRole("button", { name: "Edit task", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit Task" });
  await editor.getByLabel("Title", { exact: true }).fill("Local unsaved edit");
  await editor.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("button", { name: "Open task Local unsaved edit", exact: true })).toBeVisible();
  expect(await snapshot(page)).toBe(raw);
  await page.reload();
  await expect(page.getByRole("button", { name: "Open task Low priority arrival", exact: true })).toBeVisible();
  for (const invalid of ["{broken", JSON.stringify({ schemaVersion: 4, privateData: "synthetic future data" })]) {
    await seed(page, invalid);
    await expect(page.getByRole("region", { name: "Board storage" })).toContainText(/saving is paused/i);
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(0);
    expect(await snapshot(page)).toBe(invalid);
  }
});
