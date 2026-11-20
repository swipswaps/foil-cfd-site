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

async function openSidebar(page) {
  const burger = page.getByRole('button', { name: /open sidebar/i }).first();
  if (await burger.count()) {
    await burger.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await burger.click();
  }
  await expect(page.locator('.app-sidebar').first()).toHaveClass(/open/, { timeout: 5000 });
}

async function waitForLab(page) {
  await page.locator('#cfd').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: /CFD Laboratory/i }).first()).toBeVisible({ timeout: 20000 });
  const canvas = page.locator('.cfd-vtk-canvas canvas').first();
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.cfd-vtk-head')).toContainText(/\d+ pts/, { timeout: 20000 });
  return canvas;
}

async function nonBackgroundFraction(page, buffer: Buffer) {
  const b64 = buffer.toString('base64');
  return page.evaluate(async (dataUrl) => {
    const img = new Image();
    img.src = dataUrl as string;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    if (!ctx) return 0;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let hit = 0;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      const diff = Math.abs(data[i] - 11) + Math.abs(data[i + 1] - 18) + Math.abs(data[i + 2] - 26);
      if (diff > 40) hit++;
      total++;
    }
    return hit / total;
  }, `data:image/png;base64,${b64}`);
}

test.describe('3D lab UX (static, no backend)', () => {
  test('renders, orbits, recolours, charts data, and is responsive', async ({ page }) => {
    test.setTimeout(240_000);
    const errs: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    const t0 = Date.now();
    await page.goto(HOME, { waitUntil: 'load' });
    await page.waitForFunction(
      () => /Static mode|Backend offline/i.test(document.body.innerText),
      null,
      { timeout: 20000 },
    );

    const canvas = await waitForLab(page);
    const readyMs = Date.now() - t0;
    expect(readyMs).toBeLessThan(25000);
    await expect(page.locator('.cfd-vtk-head')).toContainText(/\d+ pts · \d+ cells/);

    const canvasBox = await canvas.boundingBox();
    const chartBox = await page.locator('.cfd-chart').first().boundingBox();
    expect(canvasBox?.width || 0).toBeGreaterThan(200);
    expect(canvasBox?.height || 0).toBeGreaterThan(150);
    expect(chartBox?.width || 0).toBeGreaterThan(200);
    const overlap =
      !(chartBox!.x >= canvasBox!.x + canvasBox!.width ||
        chartBox!.x + chartBox!.width <= canvasBox!.x ||
        chartBox!.y >= canvasBox!.y + canvasBox!.height ||
        chartBox!.y + chartBox!.height <= canvasBox!.y);
    expect(overlap).toBe(false);

    const roundBox = (box: { x: number; y: number; width: number; height: number }) => ({
      x: Math.max(0, Math.round(box.x)),
      y: Math.max(0, Math.round(box.y)),
      width: Math.max(1, Math.round(box.width)),
      height: Math.max(1, Math.round(box.height)),
    });

    const before = await page.screenshot({ clip: roundBox(canvasBox!) });
    const frac = await nonBackgroundFraction(page, before);
    expect(frac).toBeGreaterThan(0.01);

    const b = canvasBox!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 140, b.y + b.height / 2 + 50, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    await page.locator('#cfd').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const b2 = roundBox((await canvas.boundingBox())!);
    const afterOrbit = await page.screenshot({ clip: b2 });
    expect(afterOrbit.equals(before)).toBe(false);

    await expect(page.locator('.cfd-chart .js-plotly-plot')).toBeVisible({ timeout: 15000 });
    const plotData = await page.evaluate(() => {
      const el = document.querySelector('.cfd-chart .js-plotly-plot') as
        | (Element & { data?: Array<{ name?: string; x?: unknown[] }> })
        | null;
      return (el?.data ?? []).map((t) => ({ name: t.name ?? '', n: Array.isArray(t.x) ? t.x.length : 0 }));
    });
    expect(plotData.length).toBeGreaterThanOrEqual(2);
    expect(plotData.every((t) => t.n > 0)).toBeTruthy();
    expect(plotData.map((t) => t.name).join(',')).toMatch(/Upper/);

    const beforeField = await page.screenshot({ clip: b2 });
    await openSidebar(page);
    await expect(page.getByText(/Static demo dataset shown/i)).toBeVisible();
    expect(await page.getByRole('button', { name: /Generate synthetic preview|Run simpleFoam/i }).count()).toBe(0);

    const field = page.locator('.cfd-sidebar-row select').first();
    await expect(field).toBeVisible();
    await field.selectOption('T');
    await expect(page.getByRole('link', { name: /Jump to 3D lab/i })).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.app-sidebar').first()).not.toHaveClass(/open/, { timeout: 5000 });
    await page.locator('#cfd').scrollIntoViewIfNeeded();
    await expect(page.locator('.cfd-vtk-head')).toContainText(/field=T/, { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.locator('#cfd').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const b3 = roundBox((await canvas.boundingBox())!);
    const afterField = await page.screenshot({ clip: b3 });
    expect(afterField.equals(beforeField)).toBe(false);
    await page.screenshot({ clip: b3, path: 'test-results/foil-ux-lab.png' });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(HOME, { waitUntil: 'load' });
    await expect(page.locator('.cfd-vtk-canvas canvas').first()).toBeVisible({ timeout: 20000 });
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerW = await page.evaluate(() => window.innerWidth);
    expect(scrollW).toBeLessThanOrEqual(innerW + 2);
    const cBox = await page.locator('.cfd-vtk-canvas').first().boundingBox();
    const chBox = await page.locator('.cfd-chart').first().boundingBox();
    expect(cBox?.width || 0).toBeLessThanOrEqual(375);
    if (cBox && chBox) {
      const overlapMobile =
        !(chBox.x >= cBox.x + cBox.width ||
          chBox.x + chBox.width <= cBox.x ||
          chBox.y >= cBox.y + cBox.height ||
          chBox.y + chBox.height <= cBox.y);
      expect(overlapMobile).toBe(false);
    }

    expect(errs.filter(e => !BENIGN.test(e))).toEqual([]);
  });
});
