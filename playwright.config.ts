import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/playwright',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } }],
  webServer: {
    command: 'npm run dev -- --port 3101',
    url: 'http://127.0.0.1:3101',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
