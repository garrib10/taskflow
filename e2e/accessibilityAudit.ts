import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

export async function scan(page: Page, name: string) {
  // Inspect settled colors, rather than an intermediate entrance/hover animation frame.
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation.playState === "running").map(animation => animation.finished.catch(() => {}))); });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  await test.info().attach(`${name}-axe`, { body: JSON.stringify({ violations: result.violations, incomplete: result.incomplete }), contentType: "application/json" });
  expect(result.violations, `${name}: no automatically detectable violations`).toEqual([]);
}
