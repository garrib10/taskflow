import { test, expect, type Page, type Locator } from "@playwright/test";
import { scan } from "./accessibilityAudit.ts";
import { currentBoardRaw, makeBoard, makeTask } from "../src/test/fixtures.ts";
import { representativeBoard } from "./boardFixtures.ts";

async function seed(page: Page, raw = currentBoardRaw(representativeBoard())) {
  await page.goto("/");
  await page.evaluate(value => localStorage.setItem("taskflow-board", value), raw);
  await page.reload();
  await expect(page.getByRole("heading", { name: "TaskFlow", exact: true })).toBeVisible();
}
async function activate(page: Page, button: Locator) { await button.focus(); await page.keyboard.press("Enter"); }


test("board, focused keyboard movement and search scope have accessible semantics", async ({ page }) => {
  await seed(page, currentBoardRaw(makeBoard([makeTask({ title: "Keyboard audit" })])));
  await scan(page, "board");
  const grip = page.getByRole("button", { name: "Move task Keyboard audit, todo", exact: true });
  await grip.focus();
  await expect(page.locator("#board-movement-help")).toBeVisible();
  await expect(grip).toHaveAccessibleDescription(/Left and Right/);
  await page.keyboard.press("Space");
  await expect(grip).toHaveAttribute("aria-pressed", "true");
  await scan(page, "keyboard-pickup");
  await page.keyboard.press("Escape"); await expect(grip).toBeFocused();
  await page.keyboard.press("Space");
  await expect(grip).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status", { name: "Board updates", exact: true })).toContainText("Destination:");
  await page.keyboard.press("Space");
  const moved = page.getByRole("button", { name: "Move task Keyboard audit, in-progress", exact: true });
  await expect(moved).toBeFocused();
  await expect(page.getByRole("status", { name: "Board updates", exact: true })).toContainText('Moved "Keyboard audit"');
  await page.keyboard.press("Space"); await expect(moved).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("status", { name: "Board updates", exact: true })).toContainText("Cannot move task");
  await page.keyboard.press("Space"); await expect(moved).toBeFocused();
  await page.getByRole("searchbox", { name: "Search tasks" }).fill("no matching task");
  await expect(page.getByRole("region", { name: "No tasks match your search and filters" })).toBeVisible();
  await scan(page, "zero-results");
});

test("creation, validation, nested discard and confirmation retain named modal semantics", async ({ page }) => {
  await seed(page);
  await activate(page, page.getByRole("button", { name: "+ Create Task", exact: true }));
  let dialog = page.getByRole("dialog", { name: "Create New Task", exact: true });
  await expect(dialog.getByLabel("Title", { exact: true })).toBeFocused();
  await scan(page, "creation");
  await activate(page, dialog.getByRole("button", { name: "Create Task", exact: true }));
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await scan(page, "validation");
  await page.keyboard.type("Unsaved keyboard draft");
  await page.keyboard.press("Escape");
  dialog = page.getByRole("dialog", { name: "Discard Changes?", exact: true });
  await expect(dialog.getByRole("button", { name: "Keep Editing", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(dialog.getByRole("button", { name: "Discard", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(dialog.getByRole("button", { name: "Keep Editing", exact: true })).toBeFocused();
  await scan(page, "discard-confirmation");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Unsaved keyboard draft");
});

test("keyboard CRUD and relationships retain focus alongside validated native stage selection", async ({ page }) => {
  const parent = makeTask({ id: "parent", title: "Keyboard parent" });
  await seed(page, currentBoardRaw(makeBoard([parent])));
  const opener = page.getByRole("button", { name: "Open task Keyboard parent", exact: true });
  await activate(page, opener);
  const details = page.getByRole("dialog", { name: "Keyboard parent", exact: true });
  await scan(page, "details");
  await activate(page, details.getByRole("button", { name: "Add SubTask to Keyboard parent", exact: true }));
  let form = page.getByRole("dialog", { name: "Add SubTask", exact: true });
  await expect(form.getByLabel("Title", { exact: true })).toBeFocused();
  await page.keyboard.type("Keyboard child"); await page.keyboard.press("Tab"); await page.keyboard.type("Created without pointer actions");
  await activate(page, form.getByRole("button", { name: "Create SubTask", exact: true }));
  await expect(page.getByRole("button", { name: "Add SubTask to Keyboard parent", exact: true })).toBeFocused();
  await activate(page, page.getByRole("button", { name: "Open subtask Keyboard child", exact: true }));
  await activate(page, page.getByRole("button", { name: "Edit task", exact: true }));
  form = page.getByRole("dialog", { name: "Edit SubTask", exact: true });
  await scan(page, "subtask-editor");
  await activate(page, form.getByRole("button", { name: "Change parent of Keyboard child", exact: true }));
  const relationship = page.getByRole("dialog", { name: "Manage Parent", exact: true });
  await expect(relationship.getByLabel("Parent", { exact: true })).toBeFocused();
  await scan(page, "relationship");
  await page.keyboard.press("Escape");
  await expect(form.getByRole("button", { name: "Change parent of Keyboard child", exact: true })).toBeFocused();
  // Native picker popups differ by engine/platform; keyboard movement itself is exercised above.
  await form.getByLabel("Stage", { exact: true }).selectOption("in-progress");
  await expect(form.getByLabel("Stage", { exact: true })).toHaveValue("in-progress");
  await activate(page, form.getByRole("button", { name: "Close task editor", exact: true }));
  // The existing explicit movement uses the same validator as keyboard dragging.
  const stage = page.getByLabel("Workflow stage", { exact: true });
  if (await stage.count()) await stage.selectOption("in-progress");
  const child = page.getByRole("button", { name: "Open task Keyboard child", exact: true });
  await activate(page, child);
  await activate(page, page.getByRole("button", { name: "Delete task Keyboard child", exact: true }));
  const confirmation = page.getByRole("dialog", { name: "Delete Task", exact: true });
  await expect(confirmation.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await scan(page, "delete-confirmation");
  await activate(page, confirmation.getByRole("button", { name: "Delete", exact: true }));
  await expect(child).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Board updates", exact: true })).toContainText('Deleted "Keyboard child"');
  expect(await page.evaluate(() => document.activeElement !== document.body && !document.activeElement?.closest("[inert]"))).toBe(true);
});

test("touch landscape retains one-stage navigation and a focused filter sheet", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const page = await context.newPage();
  await seed(page);
  await expect(page.getByLabel("Workflow stage", { exact: true })).toBeVisible();
  await expect(page.locator(".column")).toHaveCount(1);
  await page.getByLabel("Workflow stage", { exact: true }).selectOption("in-progress");
  await expect(page.locator(".column")).toContainText("5 / 5");
  await activate(page, page.getByRole("button", { name: "Filters (0)", exact: true }));
  const sheet = page.getByRole("dialog", { name: "Filter tasks", exact: true });
  await expect(sheet.getByRole("heading")).toBeFocused();
  await scan(page, "landscape-filters");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Filters (0)", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});

test("enlarged long content keeps description, final child and wrapped actions readable", async ({ page }) => {
  const title = "Release " + "x".repeat(142);
  const parent = makeTask({ id: "parent", title, description: "Notes " + "y".repeat(294) });
  const children = Array.from({ length: 30 }, (_, index) => makeTask({ id: `child-${index}`, parentId: parent.id, title: `Child ${index} ` + "z".repeat(130) }));
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page, currentBoardRaw(makeBoard([parent, ...children])));
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await activate(page, page.getByRole("button", { name: `Open task ${title}`, exact: true }));
  const detail = page.getByRole("dialog", { name: title, exact: true });
  expect(await detail.locator(".task-details-content").evaluate(el => {
    const s = getComputedStyle(el);
    return el.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom) >= parseFloat(s.lineHeight) * 2;
  })).toBe(true);
  await detail.locator(".task-details-description").scrollIntoViewIfNeeded();
  await expect(detail.locator(".task-details-description")).toBeInViewport();
  await detail.getByRole("button", { name: `Open subtask ${children[29].title}`, exact: true }).scrollIntoViewIfNeeded();
  await expect(detail.getByRole("button", { name: `Open subtask ${children[29].title}`, exact: true })).toBeInViewport();
  await activate(page, detail.getByRole("button", { name: "Edit task", exact: true }));
  const editor = page.getByRole("dialog", { name: "Edit Task", exact: true });
  await editor.getByLabel("Stage", { exact: true }).focus(); await expect(editor.getByLabel("Stage", { exact: true })).toBeInViewport();
  const actions = editor.locator(".task-action-footer");
  expect(await actions.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await activate(page, editor.getByRole("button", { name: "Save Changes", exact: true }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("persistent recovery messages and confirmations retain accessible roles and keyboard escape", async ({ page }) => {
  await page.goto("/"); await page.evaluate(() => localStorage.setItem("taskflow-board", "invalid")); await page.reload();
  await expect(page.getByRole("alert")).toContainText("saved board is invalid");
  await scan(page, "recovery");
  const reload = page.getByRole("button", { name: "Reload saved board", exact: true });
  await activate(page, reload);
  const confirmation = page.getByRole("dialog", { name: "Reload Saved Board?", exact: true });
  await expect(confirmation.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await scan(page, "recovery-confirmation");
  await page.keyboard.press("Escape"); await expect(reload).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem("taskflow-board"))).toBe("invalid");
});

test("retained checklist controls have usable hit areas and native keyboard toggling", async ({ page }) => {
  const task = makeTask({ title: "Checklist audit", subtasks: [{ id: "legacy", title: "Legacy entry", completed: false }] });
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, currentBoardRaw(makeBoard([task])));
  await activate(page, page.getByRole("button", { name: "Open task Checklist audit", exact: true }));
  const details = page.getByRole("dialog", { name: "Checklist audit", exact: true });
  const checkbox = details.getByRole("checkbox", { name: "Legacy entry", exact: true });
  await checkbox.focus(); await page.keyboard.press("Space"); await expect(checkbox).toBeChecked();
  const targets = details.locator(".subtask-item-left, .subtask-delete-button, .add-subtask-button");
  expect(await targets.evaluateAll(nodes => nodes.every(node => { const rect = node.getBoundingClientRect(); return rect.height >= 44 && rect.width >= 44; }))).toBe(true);
  await scan(page, "legacy-checklist");
});

test("consecutive keyboard moves retain the grip and filtered moves use a meaningful fallback", async ({ page }) => {
  await seed(page, currentBoardRaw(makeBoard([makeTask({ title: "Consecutive work" })])));
  const grip = (stage: string) => page.getByRole("button", { name: `Move task Consecutive work, ${stage}`, exact: true });
  await grip("todo").focus();
  for (const [from, to] of [["todo", "in-progress"], ["in-progress", "in-review"]]) {
    await expect(grip(from)).toBeFocused();
    await page.keyboard.press("Space"); await expect(grip(from)).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("status", { name: "Board updates", exact: true })).toContainText("Destination:");
    await page.keyboard.press("Space"); await expect(grip(to)).toBeFocused();
  }
  const filters = page.getByRole("button", { name: /^Filters \(/ });
  if (await filters.count()) await activate(page, filters);
  await page.getByLabel("Status", { exact: true }).selectOption("in-review");
  if (await filters.count()) await activate(page, page.getByRole("button", { name: "Done", exact: true }));
  await grip("in-review").focus(); await page.keyboard.press("Space");
  await expect(grip("in-review")).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status", { name: "Board updates", exact: true })).toContainText("Destination:");
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "done (1)", exact: true })).toBeFocused();
  await expect(page.getByRole("status", { name: "Board updates", exact: true })).toContainText("Hidden by the current search or filters.");
});

test("pointer-opened discard, delete and filter modals restore their actual invokers", async ({ page }) => {
  await seed(page, currentBoardRaw(makeBoard([makeTask({ title: "Pointer focus" })])));
  const create = page.getByRole("button", { name: "+ Create Task", exact: true });
  await create.click(); await page.getByLabel("Title", { exact: true }).fill("Dirty draft");
  let close = page.getByRole("button", { name: "Close task creation", exact: true });
  await close.click(); await page.getByRole("button", { name: "Keep Editing", exact: true }).click();
  await expect(close).toBeFocused();
  await close.click(); await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(create).toBeFocused();
  const opener = page.getByRole("button", { name: "Open task Pointer focus", exact: true });
  await opener.click();
  const remove = page.getByRole("button", { name: "Delete task Pointer focus", exact: true });
  await remove.click(); await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(remove).toBeFocused();
  close = page.getByRole("button", { name: "Close task details", exact: true });
  await close.click(); await expect(opener).toBeFocused();
  const filters = page.getByRole("button", { name: /^Filters \(/ });
  if (await filters.count()) { await filters.click(); await page.keyboard.press("Escape"); await expect(filters).toBeFocused(); }
});
