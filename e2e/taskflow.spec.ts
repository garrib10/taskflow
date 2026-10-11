import { test, expect, type Page } from "@playwright/test";

const browserFailures = new WeakMap<Page, string[]>();
test.afterEach(async ({ page }) => {
  expect(browserFailures.get(page) ?? [], "No application exceptions or failed core assets").toEqual([]);
});

// Playwright gives every test a fresh browser context and empty origin storage.
// Reloads within a journey deliberately retain that test's saved board.
test.beforeEach(async ({ page }) => {
  const failures: string[] = [];
  browserFailures.set(page, failures);
  page.on("pageerror", error => failures.push(error.message));
  page.on("response", response => {
    if (/\/assets\/.*\.(js|css)(?:\?|$)/.test(response.url()) && response.status() >= 400) {
      failures.push(`Core asset ${response.status()}: ${response.url()}`);
    }
  });
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "TaskFlow", exact: true })).toBeVisible();
});
async function fillTask(page: Page, title: string, child = false) {
  const dialog = page.getByRole("dialog", { name: child ? "Add SubTask" : "Create New Task" });
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  await dialog.getByLabel("Description", { exact: true }).fill("Smoke journey description");
  await dialog.getByRole("button", { name: child ? "Create SubTask" : "Create Task", exact: true }).click();
}
async function move(page: Page, title: string, direction = "ArrowRight") {
  const handle = page.getByRole("group", { name: new RegExp(`^Move task ${title},`) });
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status", { name: "Board updates" })).toContainText(`Picked up "${title}"`);
  // Pickup is announced before dnd-kit attaches its next-key listener and measures
  // columns. Let the browser complete rendering before the next user input.
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.keyboard.press(direction);
  await expect(page.getByRole("status", { name: "Board updates" })).toContainText("Destination:");
  await page.keyboard.press("Space");
}

test("task lifecycle persists, rejects reverse movement, and allows keyboard warning dismissal", async ({ page }) => {
  await page.getByRole("button", { name: "+ Create Task" }).click();
  await fillTask(page, "Smoke task");
  await page.getByRole("button", { name: "Open task Smoke task", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit Task" });
  await editor.getByLabel("Title", { exact: true }).fill("Smoke task edited");
  await editor.getByRole("button", { name: "Save Changes" }).click();
  await move(page, "Smoke task edited");
  await expect(page.getByRole("status", { name: "Board updates" })).toContainText('Moved "Smoke task edited" to In Progress');
  await page.reload();
  await expect(page.getByRole("group", { name: "Move task Smoke task edited, In Progress", exact: true })).toBeVisible();
  await move(page, "Smoke task edited", "ArrowLeft");
  await expect(page.getByRole("status", { name: "Board updates" })).toContainText("Cannot move task from in-progress to todo");
  const dismiss = page.getByRole("button", { name: /Dismiss notification/ });
  await dismiss.focus(); await page.keyboard.press("Enter");
  await expect(dismiss).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open task Smoke task edited", exact: true })).toBeFocused();
});

test("parent and subtask creation survives reload with progress and navigable parent context", async ({ page }) => {
  await page.getByRole("button", { name: "+ Create Task" }).click();
  await fillTask(page, "Smoke parent");
  await page.getByRole("button", { name: "Open task Smoke parent", exact: true }).click();
  await page.getByRole("button", { name: "Add SubTask to Smoke parent" }).click();
  await fillTask(page, "Smoke child", true);
  await page.getByRole("dialog", { name: "Edit Task" }).getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Subtask completion for Smoke parent" })).toHaveAttribute("aria-valuemax", "1");
  await page.getByRole("button", { name: "Open task Smoke child", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit SubTask" })).toBeVisible();
  await page.getByRole("button", { name: "Open parent Smoke parent", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit Task" }).getByLabel("Title", { exact: true })).toHaveValue("Smoke parent");
});

test("keyboard dialogs and primary controls fit the viewport without accidental page overflow", async ({ page }) => {
  const create = page.getByRole("button", { name: "+ Create Task" });
  await create.focus(); await page.keyboard.press("Enter");
  const title = page.getByRole("dialog", { name: "Create New Task" }).getByLabel("Title", { exact: true });
  await expect(title).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(create).toBeFocused();
  await page.getByLabel("Search:", { exact: true }).fill("keyboard");
  const filters = page.getByRole("button", { name: /^Filters \(/ });
  if (await filters.count()) await filters.click();
  await page.getByLabel("Priority", { exact: true }).selectOption("medium");
  await page.getByLabel("Category", { exact: true }).selectOption("feature");
  await page.getByLabel("Status", { exact: true }).selectOption("todo");
  if (await filters.count()) await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByLabel("Search:", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Search:", { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("shell landmarks and responsive filter presentation preserve criteria and reset", async ({ page }) => {
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("main", { name: "Task board" })).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Workflow columns", exact: true })).toBeVisible();
  const trigger = page.getByRole("button", { name: /^Filters \(/ });
  const narrow = await trigger.count() > 0;
  await page.getByLabel("Search:", { exact: true }).fill("authentication");
  if (narrow) {
    await trigger.focus(); await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("dialog", { name: "Filter tasks" }).getByRole("heading")).toBeFocused();
  }
  await page.getByLabel("Priority", { exact: true }).selectOption("high");
  await page.getByLabel("Category", { exact: true }).selectOption("feature");
  if (narrow) {
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(trigger).toHaveText("Filters (2)"); await expect(trigger).toBeFocused();
    await trigger.click(); await expect(page.getByLabel("Priority", { exact: true })).toHaveValue("high");
    await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  await expect(page.getByLabel("Priority", { exact: true })).toHaveValue("high");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByLabel("Search:", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Search:", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Priority", { exact: true })).toHaveValue("all");
});
