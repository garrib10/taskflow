import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 30_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL, browserName: "chromium",
    trace: "retain-on-failure", screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { viewport: { width: 1280, height: 720 } } },
    { name: "mobile-chromium", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: baseURL, reuseExistingServer: !process.env.CI, timeout: 30_000,
  },
});
