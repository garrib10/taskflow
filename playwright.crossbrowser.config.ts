import { defineConfig } from "@playwright/test";
import base from "./playwright.config.ts";

// Optional local engine audit; the main CI suite remains Chromium desktop/mobile.
export default defineConfig({
  ...base,
  workers: 1,
  projects: [
    { name: "firefox-desktop", use: { browserName: "firefox", viewport: { width: 1280, height: 720 } } },
    { name: "webkit-desktop", use: { browserName: "webkit", viewport: { width: 1280, height: 720 } } },
    { name: "webkit-mobile", use: { browserName: "webkit", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
