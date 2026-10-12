import { test, expect, type Page } from "@playwright/test";
import { v15BoardFixture } from "../src/test/migrationFixtures.ts";
const savedBoard = (page: Page) => page.evaluate(() => localStorage.getItem("taskflow-board"));
const savedPreference = (page: Page) => page.evaluate(() => localStorage.getItem("taskflow-view-preferences"));
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "TaskFlow", exact: true })).toBeVisible();
  const board = JSON.parse(JSON.stringify(v15BoardFixture()));
  board.columns.forEach((column: { manualOrder: unknown }) => { column.manualOrder = null; });
  await page.evaluate(raw => {
    localStorage.setItem("taskflow-board", raw);
    localStorage.removeItem("taskflow-view-preferences");
  }, JSON.stringify({ schemaVersion: 3, revision: "preferences-fixture", board }));
  await page.reload();
});

test("mode and manual positions survive refresh independently of Priority, filters and unfinished interactions", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const mode = page.getByLabel("Ordering", { exact: true });
  const original = await savedBoard(page);
  await expect(mode).toHaveValue("priority");
  expect(await savedPreference(page)).toBeNull();
  expect(await savedBoard(page)).toBe(original);
  await mode.selectOption("manual");
  await expect(mode).toHaveValue("manual");
  const initialized = JSON.parse((await savedBoard(page)) ?? "null");
  expect(initialized.board.columns[0].manualOrder).toEqual(["parent", "equal-first", "equal-second", "low"]);
  expect(JSON.parse((await savedPreference(page)) ?? "null")).toEqual({ schemaVersion: 1, orderingMode: "manual" });
  await page.reload();
  await expect(mode).toHaveValue("manual");
  await page.getByLabel("Movement actions for Release checklist", { exact: true }).click();
  const later = page.getByRole("button", { name: "Move Release checklist later", exact: true });
  await later.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: "Move task Release checklist, To Do", exact: true })).toBeFocused();
  await expect(page.getByRole("status", { name: "Board updates" })).toContainText("position 2 of 4");
  const reorderedRaw = await savedBoard(page);
  const reordered = JSON.parse(reorderedRaw ?? "null");
  expect(reordered.board.columns[0].manualOrder).toEqual(["equal-first", "parent", "equal-second", "low"]);
  expect(reordered.board.columns.map((column: { tasks: unknown[] }) => column.tasks)).toEqual(initialized.board.columns.map((column: { tasks: unknown[] }) => column.tasks));
  await page.reload(); await expect(mode).toHaveValue("manual");
  const todo = page.getByRole("region", { name: "To Do (4)", exact: true });
  await expect(todo.getByRole("heading", { level: 3 })).toHaveText(["First high arrival", "Release checklist", "Second high arrival", "Low priority arrival"]);
  await mode.selectOption("priority"); await page.reload();
  await expect(mode).toHaveValue("priority");
  await expect(todo.getByRole("heading", { level: 3 })).toHaveText(["Release checklist", "First high arrival", "Second high arrival", "Low priority arrival"]);
  expect(await savedBoard(page)).toBe(reorderedRaw);
  await mode.selectOption("manual");
  await expect(todo.getByRole("heading", { level: 3 })).toHaveText(["First high arrival", "Release checklist", "Second high arrival", "Low priority arrival"]);
  expect(await savedBoard(page)).toBe(reorderedRaw);
  await page.getByRole("searchbox").fill("Release checklist");
  await page.getByLabel("Movement actions for Release checklist", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Move Release checklist later", exact: true })).toBeDisabled();
  const filters = page.getByRole("button", { name: /^Filters \(/ });
  if (await filters.count()) await filters.click();
  else {
    await page.getByRole("button", { name: "+ Create Task", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Title", { exact: true }).fill("Unsaved draft");
  }
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(mode).toHaveValue("manual");
  expect(await savedBoard(page)).toBe(reorderedRaw);
  expect(JSON.parse((await savedPreference(page)) ?? "null")).toEqual({ schemaVersion: 1, orderingMode: "manual" });
  expect(errors).toEqual([]);
});

test("invalid/future choices preserve the board; failed preference writes retain session selection", async ({ page }) => {
  const original = await savedBoard(page);
  const mode = page.getByLabel("Ordering", { exact: true });
  for (const raw of ["{broken", '{"schemaVersion":1,"orderingMode":"unsupported"}', '{"schemaVersion":8,"orderingMode":"unknown"}']) {
    await page.evaluate(value => localStorage.setItem("taskflow-view-preferences", value), raw);
    await page.reload();
    await expect(mode).toHaveValue("priority");
    expect(await savedPreference(page)).toBe(raw);
    expect(await savedBoard(page)).toBe(original);
    await expect(page.getByRole("region", { name: "Board storage" })).toHaveCount(0);
  }
  await mode.selectOption("manual"); // Persist valid board initialization first.
  const initialized = await savedBoard(page);
  await mode.selectOption("priority");
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "taskflow-view-preferences") throw new DOMException("Synthetic quota", "QuotaExceededError");
      set.call(this, key, value);
    };
  });
  await mode.selectOption("manual");
  await expect(mode).toHaveValue("manual");
  await expect(page.getByText(/ordering choice could not be saved/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Board storage" })).toHaveCount(0);
  expect(await savedBoard(page)).toBe(initialized);
  expect(JSON.parse((await savedPreference(page)) ?? "null").orderingMode).toBe("priority");
  await page.reload(); await expect(mode).toHaveValue("priority");
  expect(await savedBoard(page)).toBe(initialized);
});
