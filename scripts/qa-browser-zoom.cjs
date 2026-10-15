/* Actual Chromium tab zoom in an isolated profile. Run against a local production preview.
 * Uses chrome.tabs.setZoom, not CSS zoom, root-font emulation or device scale factor.
 * Reference: https://playwright.dev/docs/chrome-extensions
 */
const { chromium, expect } = require('@playwright/test');
const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const baseURL = process.env.TASKFLOW_PREVIEW_URL ?? 'http://127.0.0.1:4175';
const output = resolve(process.env.TASKFLOW_QA_OUTPUT ?? 'test-results/browser-zoom');

(async () => {
  const extension = mkdtempSync(join(tmpdir(), 'taskflow-zoom-'));
  writeFileSync(join(extension, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Local TaskFlow zoom QA', version: '1.0', permissions: ['tabs'], background: { service_worker: 'worker.js' } }));
  writeFileSync(join(extension, 'worker.js'), 'chrome.runtime.onInstalled.addListener(() => {});');
  mkdirSync(output, { recursive: true });
  let context;
  try {
    context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, viewport: null,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1280,900'] });
    context.setDefaultTimeout(20000);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(baseURL);
    const title = 'Release ' + 'x'.repeat(142), date = '2026-01-01T00:00:00.000Z';
    const task = { id: 'zoom-parent', title, description: 'Notes ' + 'y'.repeat(294), category: 'feature', priority: 'high', status: 'todo', createdAt: date, subtasks: [] };
    const children = Array.from({ length: 30 }, (_, index) => ({ ...task, id: `zoom-child-${index}`, title: `Child ${index} ` + 'z'.repeat(130), parentId: task.id }));
    await page.evaluate(raw => localStorage.setItem('taskflow-board', JSON.stringify(raw)), { schemaVersion: 3, revision: 'zoom-qa', board: { id: 'zoom-board', name: 'Zoom QA', lastUpdated: date,
      columns: ['todo', 'in-progress', 'in-review', 'done'].map((id, index) => ({ id, title: ['To Do', 'In Progress', 'In Review', 'Done'][index], tasks: index === 0 ? [task, ...children] : [], manualOrder: null })) } });
    await page.reload();
    const cdp = await context.newCDPSession(page);
    // CDP captures the physical viewport; Playwright's CSS-sized clip is wrong at tab zoom.
    const screenshot = async name => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(output, name), Buffer.from(data, 'base64'));
    };
    const baseline = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
    const evidence = [];
    for (const factor of [1, 2, 4]) {
      const apiZoom = await worker.evaluate(async ({ factor, baseURL }) => {
        const tab = (await chrome.tabs.query({})).find(tab => tab.url?.startsWith(baseURL));
        if (!tab?.id) throw new Error('Local QA tab is unavailable');
        await chrome.tabs.setZoom(tab.id, factor);
        return chrome.tabs.getZoom(tab.id);
      }, { factor, baseURL });
      await page.waitForFunction(({ dpr, factor }) => Math.abs(devicePixelRatio / dpr - factor) < 0.01, { dpr: baseline.dpr, factor });
      const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, overflow: document.documentElement.scrollWidth > innerWidth }));
      expect(apiZoom).toBeCloseTo(factor); expect(Math.abs(metrics.width * factor - baseline.width)).toBeLessThan(factor * 2); expect(metrics.overflow).toBe(false);
      await screenshot(`${factor * 100}-board.png`);
      const opener = page.getByRole('button', { name: `Open task ${title}`, exact: true });
      await opener.focus(); await page.keyboard.press('Enter');
      const details = page.getByRole('dialog', { name: title, exact: true });
      expect(await details.locator('.task-details-content').evaluate(el => { const s = getComputedStyle(el); return el.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom) >= parseFloat(s.lineHeight) * 2; })).toBe(true);
      await details.locator('.task-details-description').scrollIntoViewIfNeeded(); await expect(details.locator('.task-details-description')).toBeInViewport();
      const lastChild = details.getByRole('button', { name: `Open subtask ${children[29].title}`, exact: true });
      await lastChild.focus(); await expect(lastChild).toBeInViewport();
      await screenshot(`${factor * 100}-details.png`);
      await details.getByRole('button', { name: 'Edit task', exact: true }).focus(); await page.keyboard.press('Enter');
      const editor = page.getByRole('dialog', { name: 'Edit Task', exact: true });
      await editor.getByLabel('Stage', { exact: true }).focus(); await expect(editor.getByLabel('Stage', { exact: true })).toBeInViewport();
      expect(await editor.locator('.task-action-footer').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      for (const action of await editor.locator('.task-action-footer button').all()) {
        await action.focus(); await expect(action).toBeInViewport();
      }
      const save = editor.getByRole('button', { name: 'Save Changes', exact: true });
      await save.focus(); await expect(save).toBeInViewport();
      await screenshot(`${factor * 100}-editor.png`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      evidence.push({ browserZoom: apiZoom, ...metrics, descriptionAndLastChildReachable: true, editorStageAndAllFooterActionsReachable: true });
      console.log(`${factor * 100}% browser zoom passed (${metrics.width}×${metrics.height} CSS px)`);
    }
    writeFileSync(join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  } finally { await context?.close(); rmSync(extension, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
