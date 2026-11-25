import { test, expect } from '@playwright/test';

const BASE = (process.env.PLAYWRIGHT_BASE_URL || 'https://swipswaps.github.io/foil-cfd-site').replace(/\/$/, '');
const HOME = BASE + '/';

const BENIGN = new RegExp([
  /favicon/i, /manifest/i, /ResizeObserver/i,
  /net::ERR/i, /ERR_BLOCKED/i,
  /loopback address space/i,
  /blocked by CORS policy/i,
  /Failed to load resource/i,
  /WebGL/i,
].map(r => r.source).join('|'));

test.describe('static demo (no backend)', () => {
  test('CFD lab, static VTP and Plotly chart render offline', async ({ page }) => {
    const errs: string[] = [];
    const reqs: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('request', r => reqs.push(r.url()));

    await page.goto(HOME, { waitUntil: 'load' });
    await page.waitForFunction(
      () => /Static demo|Static mode|Backend offline|Backend unavail/i.test(document.body.innerText),
      null,
      { timeout: 15000 },
    );

    await page.getByRole('tab', { name: /3D Lab/i }).first().click();
    await page.locator('#cfd').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: /CFD Laboratory/i }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.cfd-chart svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('.cfd-chart').getByText('Upper').first()).toBeVisible();

    await expect.poll(
      () => reqs.some(u => /\/demo\/surface\.vtp$/.test(u)),
      { timeout: 20000 },
    ).toBeTruthy();

    const vtkStatus = page.locator('.cfd-vtk-head');
    if (await vtkStatus.count()) {
      await expect(vtkStatus).toContainText(/\d+ pts|\d+ cells|WebGL|unavailable/i, { timeout: 20000 });
    } else {
      await expect(page.getByText(/WebGL|3D scene unavailable/i).first()).toBeVisible();
    }

    expect(errs.filter(e => !BENIGN.test(e))).toEqual([]);
  });
});
