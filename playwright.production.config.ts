import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/production",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4175",
    browserName: "chromium",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "node scripts/serve-production.mjs --root dist --port 4175",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
