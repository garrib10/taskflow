// Portfolio-safe screenshots from a production preview; no personal browser data.
const { chromium, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const { resolve, join } = require('node:path');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const baseURL = process.env.TASKFLOW_QA_URL ?? 'http://127.0.0.1:4189';
const output = resolve(process.env.TASKFLOW_SCREENSHOT_OUTPUT ?? 'screenshots/v2');
let browser;
(async () => {
  const { makeBoard, makeTask, currentBoardRaw } = await import(pathToFileURL(resolve('src/test/fixtures.ts')));
  const board = makeBoard([
    makeTask({ id: 'dashboard', title: 'Build release dashboard', description: 'Bring project metrics and workflow progress into one clear view.', priority: 'high' }),
    makeTask({ id: 'widgets', title: 'Build dashboard widgets', description: 'Add reusable charts and task summaries.', parentId: 'dashboard' }),
    makeTask({ id: 'layout', title: 'Review dashboard layout', description: 'Confirm the layout is ready for implementation.', status: 'done', parentId: 'dashboard', category: 'ui' }),
    makeTask({ id: 'mobile', title: 'Polish mobile navigation', description: 'Keep important actions within easy reach.', category: 'ui' }),
    makeTask({ id: 'tests', title: 'Verify workflow rules', description: 'Check valid moves and rejected transitions.', status: 'in-progress', priority: 'high', category: 'testing' }),
    makeTask({ id: 'storage', title: 'Verify saved board recovery', description: 'Preserve work safely across refresh.', status: 'in-progress', category: 'testing' }),
    makeTask({ id: 'docs', title: 'Review release documentation', description: 'Prepare the release guide and QA evidence.', status: 'in-review', category: 'devops' }),
    makeTask({ id: 'brand', title: 'Finish visual polish', description: 'Apply the warm clay styling consistently.', status: 'done', category: 'ui' }),
  ]);
  board.lastUpdated = new Date('2026-10-15T14:00:00.000Z');
  board.columns.forEach((column, index) => {
    column.title = ['To Do', 'In Progress', 'In Review', 'Done'][index];
    column.tasks.forEach(task => { task.createdAt = new Date('2026-10-14T13:00:00.000Z'); });
  });
  const raw = currentBoardRaw(board), records = [];
  mkdirSync(output, { recursive: true });
  browser = await chromium.launch();
  try {
    for (const mobile of [false, true]) {
      const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
      const prefix = mobile ? 'mobile' : 'desktop';
      const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, timezoneId: 'America/New_York', locale: 'en-US', reducedMotion: 'reduce' });
      await context.addInitScript(value => { localStorage.setItem('taskflow-board', value); localStorage.removeItem('taskflow-view-preferences'); }, raw);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      async function capture(state) {
        await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const file = `${prefix}-${state}.png`;
        await page.screenshot({ path: join(output, file) });
        const bytes = readFileSync(join(output, file));
        records.push({ file, viewport, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
      await page.goto(baseURL);
      await expect(page.getByRole('heading', { name: 'TaskFlow', exact: true })).toBeVisible();
      await expect(page.locator('.toolbar-result-count')).toHaveText('8 tasks on board');
      await capture('board');
      await page.getByRole('button', { name: 'Open task Build release dashboard', exact: true }).click();
      await expect(page.getByRole('dialog').getByText('1 of 2 subtasks complete')).toBeVisible();
      await capture('details');
      if (!mobile) {
        await page.getByRole('button', { name: 'Edit task', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Edit Task', exact: true })).toBeVisible();
        await capture('editor');
        await page.getByRole('button', { name: 'Close task editor', exact: true }).click();
        const query = page.getByRole('searchbox', { name: 'Search tasks' });
        await query.fill('dashboard');
        await page.getByLabel('Category', { exact: true }).selectOption('feature');
        await page.getByLabel('Priority', { exact: true }).selectOption('high');
        await expect(page.locator('.toolbar-result-count')).toHaveText('Showing 1 of 8 tasks');
        await capture('filters');
      }
      expect(errors).toEqual([]);
      await context.close();
    }
    writeFileSync(join(output, 'manifest.json'), JSON.stringify({ date: '2026-10-15', browser: browser.version(), sourceBase: '9df4880', url: baseURL, fixture: 'Eight synthetic tasks; one parent with two children, one completed. Fixed fixture dates, en-US/America/New_York, DPR1, reduced motion. No personal browser profile, CSS injection or image editing.', captures: records }, null, 2) + '\n');
    console.log(`${records.length} screenshots captured and verified`);
  } finally { await browser.close(); }
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
