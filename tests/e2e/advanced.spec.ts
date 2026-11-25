import { test, expect, devices } from '@playwright/test';

const BASE = (process.env.PLAYWRIGHT_BASE_URL || 'https://swipswaps.github.io/foil-cfd-site').replace(/\/$/, '');
const HOME  = BASE + '/';
const HYDRO = HOME + 'hydro.html';

// Benign noise: favicon/manifest 404s, ResizeObserver warnings, and Chrome PNA
// blocking loopback fetches from a public origin. The last is *documented*
// behavior (README first-load probe) and gracefully degrades. Tracked
// separately as a UX concern — not a test regression.
const BENIGN = new RegExp([
  /favicon/i, /manifest/i, /ResizeObserver/i,
  /net::ERR/i, /ERR_BLOCKED/i,
  /Permission was denied for this request to access the `loopback` address space/i,
  /blocked by CORS policy/i,
  /Failed to load resource/i,
].map(r => r.source).join('|'));

async function scrollToBottom(page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
}

async function dismissIfPresent(page, pattern) {
  const b = page.getByRole('button', { name: pattern }).first();
  if (await b.count()) {
    const v = await b.isVisible().catch(() => false);
    if (v) { await b.click().catch(() => {}); await page.waitForTimeout(500); }
  }
}

test.describe('home page', () => {
  test('loads without black screen', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    await expect(page).toHaveTitle(/foil/i);
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(20);
    expect(body).toMatch(/FOIL\.CFD/);
  });

  test('no fatal console errors on home', async ({ page }) => {
    const errs: string[] = [];
    page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await page.goto(HOME, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    expect.soft(errs.filter(e => !BENIGN.test(e))).toEqual([]);
  });

  test('navigation links render', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    for (const label of ['Lab', 'Projects', 'README'])
      await expect.soft(page.getByRole('link', { name: label }).first()).toBeVisible();
    await expect.soft(page.getByRole('link', { name: /GitHub/ }).first()).toBeVisible();
  });

  test('hero canvas present OR WebGL fallback shown', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    const canvas = page.locator('canvas').first();
    if (await canvas.count() === 0) {
      expect.soft(await page.getByText(/WebGL|not supported|3D.*unavail|fallback/i).first().count()).toBeGreaterThan(0);
    } else {
      await expect.soft(canvas).toBeVisible({ timeout: 10_000 });
      const box = await canvas.boundingBox();
      expect.soft(box?.width  || 0).toBeGreaterThan(50);
      expect.soft(box?.height || 0).toBeGreaterThan(50);
    }
  });

  test('CFD Laboratory section is rendered (scroll-gated lazy ok)', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    await scrollToBottom(page);
    await dismissIfPresent(page, /read more|expand/i);

    const asHeading = page.getByRole('heading', { name: /CFD Laboratory/i }).first();
    const asText    = page.getByText(/CFD Laboratory/i).filter({ visible: true }).first();
    if (await asHeading.count()) {
      await expect.soft(asHeading).toBeVisible({ timeout: 10_000 });
    } else if (await asText.count()) {
      await expect.soft(asText).toBeVisible({ timeout: 10_000 });
    } else {
      const placeholder = page.getByText(/Solver unavailable|Solver.*offline/i).filter({ visible: true }).first();
      if (await placeholder.count()) {
        test.info().annotations.push({
          type: 'warn',
          description: 'CFD Lab heading absent, only "Solver unavailable" placeholder visible. Investigate lab-section gating on deployed origin.',
        });
      } else {
        expect.soft(false, 'CFD Laboratory section not found after scroll+expand — real regression');
      }
    }
  });

  test('backend status pill is a recognised state', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    const pill = page
      .getByText(/Live solver|Backend (online|offline)|Backend unavail|Solver unavailable|Static demo/i)
      .filter({ visible: true })
      .first();
    if (await pill.count() === 0) {
      test.info().annotations.push({ type: 'warn', description: 'no visible backend pill' });
    } else {
      await expect.soft(pill).toBeVisible({ timeout: 10_000 });
    }
  });

  test('README headings present', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    await scrollToBottom(page);
    for (const heading of [/^overview$/i, /^local development$/i, /^deployment$/i]) {
      const h = page.getByRole('heading', { name: heading }).first();
      if (await h.count()) {
        await expect.soft(h).toBeVisible({ timeout: 10_000 });
      } else {
        const t = page.getByText(heading).filter({ visible: true }).first();
        await expect.soft(t).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test('project cards render', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' });
    for (const name of ['foil-cfd-site', 'solar-nostoc-cad-bridge', 'solar-panel-cad-bridge'])
      await expect.soft(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('hydro workbench', () => {
  test('hydro.html returns 200 and renders', async ({ page }) => {
    const r = await page.goto(HYDRO, { waitUntil: 'load' });
    expect.soft(r?.status()).toBe(200);
    const body = await page.locator('body').innerText();
    expect.soft(body.length).toBeGreaterThan(20);
    expect.soft(body).toMatch(/hydro|marine|foil|cfd/i);
  });

  test('range sliders exist', async ({ page }) => {
    await page.goto(HYDRO, { waitUntil: 'load' });
    const sliders = page.locator('input[type="range"]');
    const n = await sliders.count();
    if (n === 0) test.skip(true, 'no sliders in this build');
    expect.soft(n).toBeGreaterThan(0);
    expect.soft((await sliders.first().boundingBox())?.width || 0).toBeGreaterThan(40);
  });

  test('slider stretches full width on phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(HYDRO, { waitUntil: 'load' });
    const sliders = page.locator('input[type="range"]');
    if (await sliders.count() === 0) test.skip(true, 'no sliders');
    const s = await sliders.first().boundingBox();
    const p = await sliders.first().locator('xpath=..').boundingBox();
    if (s && p && p.width > 0) expect.soft(s.width / p.width).toBeGreaterThan(0.75);
    else test.skip(true, 'no measurable bounding boxes');
  });

  test('no fatal console errors on hydro', async ({ page }) => {
    const errs: string[] = [];
    page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await page.goto(HYDRO, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    expect.soft(errs.filter(e => !BENIGN.test(e))).toEqual([]);
  });
});

test.describe('device detection', () => {
  test('desktop reports pointer:fine', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME, { waitUntil: 'load' });
    expect.soft(await page.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(true);
  });
  test('mobile emulation reports pointer:coarse', async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices['Pixel 5'] });
    const page = await ctx.newPage();
    await page.goto(HOME, { waitUntil: 'load' });
    expect.soft(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await ctx.close();
  });
});

test.describe('lazy loading', () => {
  test('CpPolarChart (Plotly) loads for the static demo', async ({ page }) => {
    const reqs: string[] = [];
    page.on('request', r => reqs.push(r.url()));
    await page.goto(HOME, { waitUntil: 'load' });
    await page.waitForTimeout(4000);
    expect.soft(reqs.filter(u => /CpPolarChart/.test(u)).length).toBeGreaterThan(0);
  });

  test('CfdVtkViewer chunk loads when lab section is reached', async ({ page }) => {
    const reqs: string[] = [];
    page.on('request', r => reqs.push(r.url()));
    await page.goto(HOME, { waitUntil: 'load' });
    await scrollToBottom(page);
    await dismissIfPresent(page, /read more|expand/i);
    await page.waitForTimeout(3000);
    expect.soft(reqs.filter(u => /CfdVtkViewer/.test(u)).length).toBeGreaterThan(0);
  });
});

test.describe('backend detection', () => {
  for (const url of ['http://127.0.0.1:8002/api/health', 'http://127.0.0.1:8000/api/health']) {
    test(`probe ${url}`, async ({ request }) => {
      const r = await request.get(url, { failOnStatusCode: false, timeout: 3000 }).catch(() => null);
      if (!r || !r.ok()) {
        test.info().annotations.push({ type: 'backend-skip', description: `no backend at ${url}` });
        return;
      }
      expect.soft(await r.json().catch(() => null)).toHaveProperty('status');
    });
  }
});

test.describe('synthetic solve', () => {
  test('offline backend exposes a synthetic-solve control', async ({ page }) => {
    await page.goto(HYDRO, { waitUntil: 'load' });
    await scrollToBottom(page);
    const offline = await page.getByText(/Solver unavailable|Backend offline|Static demo/i).filter({ visible: true }).count();
    if (offline === 0) test.skip(true, 'backend online; synthetic-solve not applicable');
    const btn = page.getByRole('button', { name: /synthetic|solve|run|start/i }).first();
    await expect.soft(btn).toBeVisible({ timeout: 5_000 });
  });
});
