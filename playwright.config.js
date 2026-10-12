import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  webServer: { command: 'node scripts/serve-test.js', url: 'http://127.0.0.1:4179', reuseExistingServer: false },
  use: { headless: true, channel: 'chrome', viewport: { width: 900, height: 800 } },
});
