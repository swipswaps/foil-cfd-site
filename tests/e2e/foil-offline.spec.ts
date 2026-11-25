import { test, expect } from '@playwright/test';

const BASE = (process.env.PLAYWRIGHT_BASE_URL || 'https://swipswaps.github.io/foil-cfd-site').replace(/\/$/, '');
const HOME = BASE + '/';

// Any loopback / LAN backend origin the page might probe. Aborting all of them
// makes "backend offline" deterministic regardless of how the build was made.
const BACKEND = /\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0|192\.168\.\d{1,3}\.\d{1,3})(?::(?:8000|8002|8090))?\//;

const BENIGN = new RegExp([
  /favicon/i, /manifest/i, /ResizeObserver/i,
  /net::ERR/i, /ERR_BLOCKED/i,
  /loopback address space/i,
  /blocked by CORS policy/i,
  /Failed to load resource/i,
  /Failed to fetch/i,
  /WebGL/i,
].map(r => r.source).join('|'));

async function blockBackend(page: import('@playwright/test').Page) {
  await page.route(BACKEND, r => r.abort('failed'));
}

async function openLab(page: import('@playwright/test').Page) {
  if (!(await page.locator('#cfd').count())) {
    await page.getByRole('tab', { name: /3D Lab/i }).first().click();
  }
  await expect(page.locator('#cfd')).toBeVisible({ timeout: 15_000 });
}

const collectErrors = (page: import('@playwright/test').Page) => {
  const errs: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  return errs;
};

test.describe('backend offline (static mode)', () => {
  test('states the offline condition and still renders the static lab', async ({ page }) => {
    await blockBackend(page);
    const errs = collectErrors(page);

    await page.goto(HOME, { waitUntil: 'load' });
    // offline is stated explicitly, not a perpetual spinner
    await expect(
      page.locator('.backend-badge').first(),
    ).toContainText(/Static demo|Static mode|Backend offline|Backend unavail/i, { timeout: 20_000 });

    await openLab(page);
    await expect(page.getByRole('heading', { name: /CFD Laboratory/i }).first()).toBeVisible({ timeout: 20_000 });
    // field selector (Pressure/Velocity/Temperature) is present and usable
    await expect(page.getByRole('combobox').first()).toBeVisible();
    // the static demo dataset still drives a chart without a backend
    await expect(page.locator('.cfd-chart svg').first()).toBeVisible({ timeout: 25_000 });

    expect(errs.filter(e => !BENIGN.test(e))).toEqual([]);
  });

  test('a failed Connect attempt does not break the page', async ({ page }) => {
    await blockBackend(page);
    const errs = collectErrors(page);

    await page.goto(HOME, { waitUntil: 'load' });
    const connect = page.getByRole('button', { name: /Connect/i }).first();
    if (await connect.count()) {
      await connect.click({ timeout: 5_000 }).catch(() => {});
      // never a blank page / navigation away; the app stays usable and offline
      expect(page.url().startsWith(BASE)).toBeTruthy();
      await expect(page.locator('body')).toContainText(/CFD Laboratory|Static demo|Static mode|Backend offline|Backend unavail/i, { timeout: 20_000 });
    } else {
      test.info().annotations.push({ type: 'note', description: 'no Connect control in this build' });
    }
    expect(errs.filter(e => !BENIGN.test(e))).toEqual([]);
  });
});
