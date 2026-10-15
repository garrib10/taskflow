import { test, expect, type Page } from "@playwright/test";
import { currentBoardRaw, makeBoard, makeTask } from "../src/test/fixtures.ts";

async function seed(page: Page) {
  const board = makeBoard([
    makeTask({ id: "a", title: "Alpha release", description: "Launch checklist", priority: "high", category: "devops" }),
    makeTask({ id: "b", title: "Beta review", description: "Alpha research", priority: "low", category: "testing", status: "in-review" }),
    ...Array.from({ length: 5 }, (_, index) => makeTask({ id: `p${index}`, title: `Progress work ${index}`, status: "in-progress" })),
  ]);
  board.columns.forEach((column, index) => { column.title = ["To Do", "In Progress", "In Review", "Done"][index]; column.manualOrder = column.tasks.map(task => task.id); });
  const raw = currentBoardRaw(board);
  await page.goto("/");
  await page.evaluate(value => { localStorage.setItem("taskflow-board", value); localStorage.setItem("taskflow-view-preferences", '{"schemaVersion":1,"orderingMode":"manual"}'); }, raw);
  await page.reload();
  await expect(page.getByRole("heading", { name: "TaskFlow", exact: true })).toBeVisible();
  return raw;
}
async function filters(page: Page) {
  const trigger = page.getByRole("button", { name: /^Filters \(/ });
  if (await trigger.count()) await trigger.click();
  return trigger;
}

test("combined scope, individual removal and clear-all preserve saved Manual data and focus", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const raw = await seed(page);
  const query = page.getByRole("searchbox", { name: "Search tasks" });
  await query.fill("Alpha");
  await expect(page.locator(".toolbar-result-count")).toHaveText("Showing 2 of 7 tasks");
  const trigger = await filters(page);
  await page.getByLabel("Category", { exact: true }).selectOption("devops");
  await page.getByLabel("Priority", { exact: true }).selectOption("high");
  await page.getByLabel("Status", { exact: true }).selectOption("todo");
  if (await trigger.count()) { await page.getByRole("button", { name: "Done", exact: true }).click(); await expect(trigger).toHaveText("Filters (3)"); }
  await expect(page.locator(".toolbar-result-count")).toHaveText("Showing 1 of 7 tasks");
  await expect(page.getByLabel("Ordering", { exact: true })).toHaveAccessibleDescription(/Clear search and filters to reorder/);
  const remove = page.getByRole("button", { name: "Remove Category: DevOps", exact: true });
  await remove.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Remove Priority: High", exact: true })).toBeFocused();
  await expect(query).toHaveValue("Alpha");
  await expect(page.getByRole("button", { name: "Remove Status: To Do", exact: true })).toBeVisible();
  const clear = page.getByRole("button", { name: "Clear all search and filters", exact: true });
  await clear.focus(); await page.keyboard.press("Enter");
  await expect(query).toBeFocused(); await expect(query).toHaveValue("");
  await expect(page.getByLabel("Ordering", { exact: true })).toHaveValue("manual");
  expect(await page.evaluate(() => localStorage.getItem("taskflow-board"))).toBe(raw);
  await page.reload();
  await expect(page.getByLabel("Ordering", { exact: true })).toHaveValue("manual");
  await expect(clear).toBeDisabled();
  expect(errors).toEqual([]);
});

test("zero-result recovery, search clearing and hidden capacity work with keyboard and mobile sheet", async ({ page }) => {
  const raw = await seed(page);
  const query = page.getByRole("searchbox", { name: "Search tasks" });
  await query.fill("missing");
  const empty = page.getByRole("region", { name: "No tasks match your search and filters", exact: true });
  await expect(empty).toBeVisible();
  await expect(page.getByRole("status", { name: "Search results", exact: true })).toHaveText("Showing 0 of 7 tasks");
  const stage = page.getByLabel("Workflow stage", { exact: true });
  if (await stage.count()) await stage.selectOption("in-progress");
  const full = page.getByRole("region", { name: "In Progress (5)", exact: true });
  await expect(full).toContainText("5 / 5"); await expect(full).toContainText("Full");
  await expect(full).toContainText("0 shown · 5 total");
  await empty.getByRole("button", { name: "Show all tasks" }).focus(); await page.keyboard.press("Enter");
  await expect(query).toBeFocused(); await expect(empty).toHaveCount(0);
  await query.fill("Launch checklist");
  await expect(page.locator(".toolbar-result-count")).toHaveText("Showing 1 of 7 tasks");
  await page.getByRole("button", { name: "Clear search", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(query).toBeFocused(); await expect(query).toHaveValue("");
  const trigger = await filters(page);
  if (await trigger.count()) {
    const sheet = page.getByRole("dialog", { name: "Filter tasks" });
    await expect(sheet.getByRole("heading")).toBeFocused();
    await sheet.getByLabel("Category").selectOption("testing");
    await sheet.getByRole("button", { name: "Clear all search and filters", exact: true }).click();
    await expect(sheet.getByLabel("Priority")).toBeFocused();
    await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("taskflow-board"))).toBe(raw);
});
