// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './test',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  // The owner tests on a phone, and above the 1024px breakpoint the bottom tabbar
  // (css/layout.css) becomes display:none in favor of a separate desktop rail nav —
  // a real device profile keeps this suite on the same nav the app is actually used on.
  use: {
    // Same viewport/touch/UA as devices['iPhone 13'], minus its defaultBrowserType —
    // stay on the already-installed chromium engine rather than pulling in webkit.
    ...(({ defaultBrowserType, ...rest }) => rest)(devices['iPhone 13']),
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node test/server.js`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
  },
});
