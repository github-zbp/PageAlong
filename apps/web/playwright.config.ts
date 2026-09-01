import { defineConfig, devices } from "@playwright/test";

const webPort = process.env.WEB_PORT || "3000";
const webBaseURL = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./tests",
  expect: {
    timeout: 15_000
  },
  use: {
    baseURL: webBaseURL,
    trace: "on-first-retry"
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${webPort}`,
    url: webBaseURL,
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
