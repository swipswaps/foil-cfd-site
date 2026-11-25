import { defineConfig, devices } from '@playwright/test';

// The host closeout gate runs on a synced Documents tree, where Playwright's
// trace/video recorder can lose its temp file at browser-context close
// (ENOENT). Gate mode disables the recorders; the gate also writes artifacts to
// /tmp via --output. CI and local runs keep the diagnostic artifacts.
const gate = process.env.PLAYWRIGHT_GATE === '1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 1,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: gate ? 'off' : 'retain-on-failure',
    screenshot: gate ? 'off' : 'only-on-failure',
    video: gate ? 'off' : 'retain-on-failure',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
  ],
});
