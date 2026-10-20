import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  timeout: 45_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', channel: 'chrome', viewport: { width: 1920, height: 1080 } },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
