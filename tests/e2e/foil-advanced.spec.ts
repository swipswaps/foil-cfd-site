import { test, expect } from '@playwright/test';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = (process.env.PLAYWRIGHT_BASE_URL || 'https://swipswaps.github.io/foil-cfd-site').replace(/\/$/, '');
const HOME = BASE + '/';
const HYDRO = HOME + 'hydro.html';
const API = (process.env.FOIL_API || 'http://192.168.4.24:8002').replace(/\/$/, '');

const BENIGN = new RegExp([
  /favicon/i, /manifest/i, /ResizeObserver/i,
  /net::ERR/i, /ERR_BLOCKED/i,
  /loopback address space/i,
  /blocked by CORS policy/i,
  /WebGL/i,
].map(r => r.source).join('|'));

async function openLab(page) {
  if (!(await page.locator('#cfd').count())) {
    await page.getByRole('tab', { name: /3D Lab/i }).first().click();
  }
  await expect(page.locator('#cfd')).toBeVisible({ timeout: 15_000 });
}

async function openSidebar(page) {
  const burger = page.getByRole('button', { name: /open sidebar/i }).first();
  if (await burger.count()) await burger.click();
  await expect(page.locator('.app-sidebar').first()).toHaveClass(/open/, { timeout: 5_000 });
}

async function captureErrors(page) {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  return errs;
}

test.describe('advanced: home + sidebar', () => {
  test('sidebar exposes device, NACA, STL and rotation controls', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    await openSidebar(page);
    await expect(page.getByRole('button', { name: 'Phone', exact: true })).toBeVisible();
    await expect(page.getByLabel('NACA 4-digit code')).toBeVisible();
    await expect(page.locator('input[type="file"]').first()).toHaveCount(1);
    const ranges = page.locator('.app-sidebar input[type="range"]');
    expect(await ranges.count()).toBeGreaterThanOrEqual(4);
  });

  test('NACA apply updates the scene status', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    await openSidebar(page);
    const input = page.getByLabel('NACA 4-digit code');
    await input.fill('2412');
    await page.locator('.upload-row').getByRole('button', { name: 'Apply' }).first().click();
    await expect(page.getByText('Showing: NACA 2412')).toBeVisible({ timeout: 10_000 });
  });

  test('STL upload loads a model', async ({ page }) => {
    const stl = '/tmp/foil-advanced-test.stl';
    writeFileSync(stl, [
      'solid test',
      '  facet normal 0 0 1',
      '    outer loop',
      '      vertex 0 0 0',
      '      vertex 1 0 0',
      '      vertex 0 1 0',
      '    endloop',
      '  endfacet',
      'endsolid test',
      '',
    ].join('\n'));
    await page.goto(HOME, { waitUntil: 'load' });
    await openSidebar(page);
    await page.locator('input[type="file"]').first().setInputFiles(stl);
    await expect(page.getByText(/Showing: foil-advanced-test\.stl/)).toBeVisible({ timeout: 15_000 });
  });

  test('CFD Laboratory renders the Plotly Cp chart when backend is online', async ({ page }) => {
    const errs = await captureErrors(page);
    await page.goto(HOME, { waitUntil: 'load' });
    await page.waitForFunction(() => /Backend online|Backend offline|Static mode/.test(document.body.innerText), null, { timeout: 15000 });
    if (!(await page.getByText(/Backend online/).count())) {
      test.skip(true, 'backend not online; chart is gated on backendOnline && datasetUrl');
    }
    await openLab(page);
    await page.locator('#cfd').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: /CFD Laboratory/i }).first()).toBeVisible({ timeout: 20_000 });
    const chart = page.locator('.cfd-chart svg').first();
    await expect(chart).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('.cfd-chart').getByText('Upper').first()).toBeVisible();
    await expect(page.locator('.cfd-chart').getByText('Lower').first()).toBeVisible();
    expect(errs.filter(e => !BENIGN.test(e))).toEqual([]);
  });

  test('synthetic solve creates a job and keeps the lab rendered', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    await page.waitForFunction(() => /Backend online|Backend offline|Static mode/.test(document.body.innerText), null, { timeout: 15000 });
    if (!(await page.getByText(/Backend online/).count())) {
      test.skip(true, 'backend not online');
    }
    await openLab(page);
    await openSidebar(page);
    const solve = page.getByRole('button', { name: /Generate synthetic preview|Run simpleFoam/i }).first();
    await expect(solve).toBeVisible({ timeout: 10_000 });
    await solve.click();
    await expect(page.locator('.cfd-job-status')).toContainText(/completed|failed/i, { timeout: 45_000 });
    await expect(page.locator('.cfd-chart svg').first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('advanced: hydro workbench', () => {
  test('presets update speed and depth readouts', async ({ page }) => {
    await page.goto(HYDRO, { waitUntil: 'load' });
    await page.getByRole('button', { name: /High-Speed Racing T-Foil \(38 kt\)/ }).click();
    await expect(page.getByText(/38\.0 kt/).first()).toBeVisible();
    await page.getByRole('button', { name: /Subsea AUV Hydroplane \(15 m depth\)/ }).click();
    await expect(page.getByText(/15\.00 m/).first()).toBeVisible();
  });

  test('cavitation banner and Cp chart render', async ({ page }) => {
    await page.goto(HYDRO, { waitUntil: 'load' });
    await expect(page.getByText(/CAVITATION-FREE ENVELOPE|CAVITATION INCEPTION DETECTED/).first()).toBeVisible();
    await expect(page.getByText('Leading Edge (x/c = 0)').first()).toBeVisible();
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('speed slider recalculates to max', async ({ page }) => {
    await page.goto(HYDRO, { waitUntil: 'load' });
    const slider = page.locator('input[type="range"]').first();
    await slider.evaluate((el) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, '48');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.getByText(/48\.0 kt/).first()).toBeVisible();
  });
});

test.describe('advanced: backend API', () => {
  test('default surface, solve, analysis and job surface', async ({ request }) => {
    const def = await request.get(`${API}/api/jobs/default/surface.vtp`, { failOnStatusCode: false });
    if (!def.ok()) test.skip(true, `backend not reachable at ${API}`);
    expect(def.status()).toBe(200);
    expect(await def.text()).toContain('VTKFile');

    const solve = await request.post(`${API}/api/solve`, { data: { case_id: 'naca0012' } });
    expect(solve.ok()).toBeTruthy();
    const { job_id } = await solve.json();
    expect(job_id).toBeTruthy();

    let status = '';
    for (let i = 0; i < 20; i++) {
      const r = await request.get(`${API}/api/jobs/${job_id}`);
      status = (await r.json()).status;
      if (status === 'completed' || status === 'failed') break;
      await new Promise(r => setTimeout(r, 500));
    }
    expect(status).toBe('completed');

    const analysis = await request.get(`${API}/api/jobs/${job_id}/analysis`);
    expect(analysis.status()).toBe(200);
    expect((await analysis.json()).n_points).toBeGreaterThan(0);

    const surface = await request.get(`${API}/api/jobs/${job_id}/surface.vtp`);
    expect(surface.status()).toBe(200);
    expect(await surface.text()).toContain('VTKFile');
  });

  test('job retention keeps backend/jobs bounded', async ({ request }) => {
    const jobsDir = resolve('backend/jobs');
    if (!existsSync(jobsDir)) test.skip(true, 'backend/jobs not visible from the test runner');
    const count = () =>
      readdirSync(jobsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
    const max = Number(process.env.FOIL_MAX_JOBS || 32);

    for (let i = 0; i < max + 3; i++) {
      const r = await request.post(`${API}/api/solve`, { data: { case_id: 'naca0012' } });
      expect(r.ok()).toBeTruthy();
    }
    await new Promise((r) => setTimeout(r, 1500));

    expect(count()).toBeLessThanOrEqual(max + 2);
    const def = await request.get(`${API}/api/jobs/default/surface.vtp`);
    expect(def.status()).toBe(200);
    expect(await def.text()).toContain('VTKFile');
  });
});

test.describe('advanced: rendering', () => {
  test('hero canvas present or explicit WebGL fallback', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    const canvas = page.locator('canvas').first();
    if (await canvas.count()) {
      await expect(canvas).toBeVisible({ timeout: 15_000 });
      const box = await canvas.boundingBox();
      expect(box?.width || 0).toBeGreaterThan(50);
      expect(box?.height || 0).toBeGreaterThan(50);
    } else {
      await expect(page.getByText(/WebGL|3D scene unavailable|not supported/i).first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
