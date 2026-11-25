import { test, expect } from '@playwright/test';

const BASE = (process.env.PLAYWRIGHT_BASE_URL || 'https://swipswaps.github.io/foil-cfd-site').replace(/\/$/, '');
const HOME = BASE + '/';
const HYDRO = HOME + 'hydro.html';

const BENIGN = new RegExp([
  /favicon/i, /manifest/i, /ResizeObserver/i,
  /net::ERR/i, /ERR_BLOCKED/i,
  /loopback address space/i, /blocked by CORS policy/i,
  /Failed to load resource/i, /Failed to fetch/i, /WebGL/i,
].map(r => r.source).join('|'));

function collect(page: import('@playwright/test').Page) {
  const e: string[] = [];
  page.on('console', m => { if (m.type() === 'error') e.push(m.text()); });
  page.on('pageerror', x => e.push('pageerror: ' + x.message));
  return e;
}

async function openLab(page: import('@playwright/test').Page) {
  if (!(await page.locator('#cfd').count())) {
    const tab = page.getByRole('tab', { name: /3D Lab/i }).first();
    if (await tab.count()) await tab.click();
    else await page.getByRole('link', { name: /Open 3D CFD Lab/i }).first().click();
  }
  await expect(page.locator('#cfd')).toBeVisible({ timeout: 15_000 });
}

test.describe('shell components', () => {
  test('navbar: brand, links, burger toggles the sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(HOME, { waitUntil: 'load' });
    await expect(page.locator('.nav-bar')).toBeVisible();
    await expect(page.locator('.nav-brand')).toContainText(/FOIL/i);
    expect(await page.locator('.nav-links a').count()).toBeGreaterThanOrEqual(3);
    await expect(page.getByRole('link', { name: /GitHub/i }).first()).toBeVisible();

    const burger = page.locator('.nav-burger').first();
    await expect(burger).toBeVisible();
    await burger.click();
    const sidebar = page.locator('.app-sidebar').first();
    await expect(sidebar).toHaveClass(/open/, { timeout: 5_000 });
    await expect(burger).toHaveAttribute('aria-label', /close sidebar/i);
  });

  test('BackendBadge is a live, non-empty status', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    const badge = page.locator('.backend-badge').first();
    await expect(badge).toBeVisible({ timeout: 20_000 });
    await expect(badge).toHaveAttribute('role', 'status');
    await expect(badge).toContainText(/online|offline|static|unavail|connect/i, { timeout: 20_000 });
  });

  test('hero, projects showcase and README section render', async ({ page }) => {
    const errs = collect(page);
    await page.goto(HOME, { waitUntil: 'load' });
    await expect(page.getByRole('link', { name: /Open 3D CFD Lab/i }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /CFD & 3D Projects/i }).first()).toBeVisible();
    expect(await page.locator('.project-card').count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.project-name').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /README/i }).first()).toBeVisible();
    expect(errs.filter(e => !BENIGN.test(e))).toEqual([]);
  });

  test('sidebar: device, NACA, upload and rotation controls', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    const burger = page.locator('.nav-burger').first();
    if (await burger.count()) await burger.click();
    await expect(page.locator('.app-sidebar').first()).toHaveClass(/open/, { timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Phone', exact: true })).toBeVisible();
    await expect(page.getByLabel('NACA 4-digit code')).toBeVisible();
    expect(await page.locator('.app-sidebar input[type="file"]').count()).toBeGreaterThanOrEqual(1);
    expect(await page.locator('.app-sidebar input[type="range"]').count()).toBeGreaterThanOrEqual(4);
  });
});

test.describe('CFD lab components', () => {
  test('lab chrome: heading, field, freestream, actions, chart, viewer', async ({ page }) => {
    test.setTimeout(120_000);
    const errs = collect(page);
    await page.goto(HOME, { waitUntil: 'load' });
    await openLab(page);
    await page.locator('#cfd').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: /CFD Laboratory/i }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.cfd-lab-field').first()).toBeVisible();
    await expect(page.locator('[aria-label="Free-stream conditions"]')).toBeVisible();
    for (const name of [/Reset/i, /Top/i, /Side/i]) {
      const b = page.getByRole('button', { name }).first();
      if (await b.count()) await expect(b).toBeVisible();
    }
    await expect(page.locator('.cfd-chart svg').first()).toBeVisible({ timeout: 25_000 });
    const head = page.locator('.cfd-vtk-head');
    if (await head.count()) await expect(head).toContainText(/VTK|pts|cells|init|unavailable|WebGL/i, { timeout: 20_000 });
    else await expect(page.getByText(/WebGL|3D scene unavailable/i).first()).toBeVisible();
    expect(errs.filter(e => !BENIGN.test(e))).toEqual([]);
  });

  test('online: synthetic solve yields a terminal job and keeps the lab', async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(HOME, { waitUntil: 'load' });
    await page.waitForFunction(
      () => /Live solver|Backend online|Static demo|Static mode|Backend offline|Backend unavail/i.test(document.body.innerText),
      null, { timeout: 20_000 },
    );
    const online = (await page.getByText(/Live solver|Backend online/i).count()) > 0;
    if (!online) test.skip(true, 'backend offline: online solve needs a build with VITE_BACKEND_URL + a running backend');
    await openLab(page);
    // the solve control lives in the sidebar (onCfdSolve), so open it first
    const burger = page.locator('.nav-burger').first();
    if (await burger.count()) await burger.click();
    await expect(page.locator('.app-sidebar').first()).toHaveClass(/open/, { timeout: 5_000 });
    const solve = page.getByRole('button', { name: /Run live solve|Preview field|Generate synthetic preview|Run simpleFoam/i }).first();
    await expect(solve).toBeVisible({ timeout: 15_000 });
    await solve.click();
    await expect(page.locator('.cfd-job-status')).toContainText(/completed|failed/i, { timeout: 90_000 });
    await expect(page.locator('.cfd-chart svg').first()).toBeVisible({ timeout: 25_000 });
  });
});

test.describe('hydro workbench components', () => {
  test('presets update readouts, cavitation + Cp chart render', async ({ page }) => {
    test.setTimeout(120_000);
    const errs = collect(page);
    await page.goto(HYDRO, { waitUntil: 'load' });
    const preset = page.getByRole('button', { name: /High-Speed Racing T-Foil \(38 kt\)/ }).first();
    await expect(preset).toBeVisible({ timeout: 15_000 });
    await preset.click();
    await expect(page.getByText(/38\.0 kt/).first()).toBeVisible();
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 20_000 });
    expect(errs.filter(e => !BENIGN.test(e))).toEqual([]);
  });
});

test.describe('layout + retry regressions', () => {
  const BE = /\/\/(?:127\.0\.0\.1|localhost):(?:8000|8002)\//;

  test('backend badge never overlaps the hero tabs or the lab header', async ({ page }) => {
    await page.route(BE, r => r.abort('failed'));
    await page.goto(HOME + '#cfd', { waitUntil: 'load' });
    await expect(page.locator('.cfd-lab-head').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(300);
    const box = (sel: string) => page.locator(sel).first().evaluate(el => {
      const r = el.getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom };
    });
    const badge = await box('.backend-badge');
    for (const sel of ['[role="tablist"]', '.cfd-lab-head', '[aria-label="Free-stream conditions"]']) {
      const o = await box(sel).catch(() => null);
      if (!o) continue;
      const area = Math.max(0, Math.min(badge.r, o.r) - Math.max(badge.l, o.l)) *
                   Math.max(0, Math.min(badge.b, o.b) - Math.max(badge.t, o.t));
      expect(area, sel + ' overlaps the backend badge').toBe(0);
    }
  });

  test('Retry flips offline -> online when a loopback backend answers', async ({ page }) => {
    await page.route(BE, r => r.abort('failed'));
    await page.goto(HOME, { waitUntil: 'load' });
    await expect(page.locator('.backend-badge')).toContainText(/Static demo|Static mode|offline|unavail/i, { timeout: 20_000 });
    await openLab(page);
    await page.unroute(BE);
    await page.route('**/api/health', r => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'online', backend: 'test', solver_available: true, blockMesh_available: true, vtk_data_available: true }),
    }));
    await page.locator('.backend-retry').first().click();
    await expect(page.locator('.backend-badge')).toContainText(/Live solver|Backend online/i, { timeout: 20_000 });
    await expect(page.locator('.cfd-lab-status')).toContainText(/Solver ready|OpenFOAM ready/i, { timeout: 20_000 });
  });
});
