import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: { baseURL: "http://localhost:3443" },
  webServer: {
    command: "node e2e/server.mjs",
    url: "http://localhost:3443/r/health",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
