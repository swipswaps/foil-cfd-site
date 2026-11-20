import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

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

const roundBox = (box: { x: number; y: number; width: number; height: number }) => ({
  x: Math.max(0, Math.round(box.x)),
  y: Math.max(0, Math.round(box.y)),
  width: Math.max(1, Math.round(box.width)),
  height: Math.max(1, Math.round(box.height)),
});

async function openLab(page) {
  if (!(await page.locator('#cfd').count())) {
    const tab = page.getByRole('tab', { name: /3D Lab/i }).first();
    if (await tab.count()) {
      await tab.click();
    } else {
      await page.getByRole('link', { name: /Open 3D CFD Lab/i }).first().click();
    }
  }
  await expect(page.locator('#cfd')).toBeVisible({ timeout: 15000 });
}

async function waitForLab(page) {
  await openLab(page);
  await page.locator('#cfd').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: /CFD Laboratory/i }).first()).toBeVisible({ timeout: 20000 });
  const canvas = page.locator('.cfd-vtk-canvas canvas').first();
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.cfd-vtk-head')).toContainText(/\d+ pts/, { timeout: 20000 });
  return canvas;
}

async function centerCanvas(page) {
  await page.locator('.cfd-vtk-canvas').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
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
  test('hero CTA opens the lab', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME, { waitUntil: 'load' });
    const cta = page.getByRole('link', { name: /Open 3D CFD Lab/i }).first();
    await expect(cta).toBeVisible({ timeout: 15000 });
    await cta.click();
    await expect(page.locator('#cfd')).toBeInViewport({ timeout: 5000 });
  });

  test('renders, orbits, recolours, charts data, and is responsive', async ({ page }) => {
    test.setTimeout(360_000);
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
    expect(Date.now() - t0).toBeLessThan(25000);
    await expect(page.locator('.cfd-vtk-head')).toContainText(/\d+ pts · \d+ cells/);
    await expect(page.locator('#cfd').getByText(/Sample wing/i).first()).toBeVisible();
    expect(await page.getByRole('button', { name: /Generate synthetic preview|Run simpleFoam/i }).count()).toBe(0);

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

    await centerCanvas(page);
    const b1 = roundBox((await canvas.boundingBox())!);
    const before = await page.screenshot({ clip: b1 });
    writeFileSync('test-results/foil-ux-lab.png', before);
    expect(await nonBackgroundFraction(page, before)).toBeGreaterThan(0.01);

    await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2);
    await page.mouse.down();
    await page.mouse.move(b1.x + b1.width / 2 + 140, b1.y + b1.height / 2 + 50, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    await centerCanvas(page);
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
    const field = page.locator('.cfd-lab-head select').first();
    await expect(field).toBeVisible();
    await field.selectOption('T');
    await expect(page.locator('.cfd-vtk-head')).toContainText(/field=T/, { timeout: 20000 });
    await page.waitForTimeout(800);
    await centerCanvas(page);
    const b3 = roundBox((await canvas.boundingBox())!);
    const afterField = await page.screenshot({ clip: b3 });
    expect(afterField.equals(beforeField)).toBe(false);

    await expect(page.locator('.cfd-vtk-legend')).toBeVisible();
    await expect(page.locator('.cfd-vtk-legend')).toContainText(/\d/);
    const vtpEvt = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export VTP' }).click();
    expect((await vtpEvt).suggestedFilename()).toMatch(/surface\.vtp/);
    const csvEvt = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    expect((await csvEvt).suggestedFilename()).toMatch(/surface\.csv/);

    await page.locator('.cfd-vtk-actions').getByRole('button', { name: 'Reset', exact: true }).click();
    await page.waitForTimeout(600);
    await centerCanvas(page);
    const afterReset = await page.screenshot({ clip: roundBox((await canvas.boundingBox())!) });
    expect(afterReset.equals(afterField)).toBe(false);

    expect(errs.filter(e => !BENIGN.test(e))).toEqual([]);
  });

  test('phone layout stacks without horizontal overflow', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(HOME, { waitUntil: 'load' });
    await openLab(page);
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
  });

  test('selected NACA code drives the lab', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME, { waitUntil: 'load' });
    const burger = page.getByRole('button', { name: /open sidebar/i }).first();
    await burger.scrollIntoViewIfNeeded();
    await burger.click();
    await expect(page.locator('.app-sidebar').first()).toHaveClass(/open/);
    await page.getByLabel('NACA 4-digit code').fill('2412');
    await page.locator('.upload-row').getByRole('button', { name: 'Apply' }).first().click();
    await page.keyboard.press('Escape');
    await openLab(page);
    const lab = page.locator('#cfd');
    await expect(lab.getByText(/NACA 2412/).first()).toBeVisible({ timeout: 15000 });
    await expect(lab.locator('.cfd-vtk-head')).toContainText(/\d+ pts/, { timeout: 20000 });
    await expect(lab.locator('.cfd-vtk-legend')).toBeVisible();
    await expect(lab.locator('.cfd-chart .js-plotly-plot')).toBeVisible({ timeout: 15000 });
  });

  test('uploaded model drives the lab', async ({ page }) => {
    test.setTimeout(150_000);
    const stl = '/tmp/foil-model-test.stl';
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
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME, { waitUntil: 'load' });
    const burger = page.getByRole('button', { name: /open sidebar/i }).first();
    await burger.scrollIntoViewIfNeeded();
    await burger.click();
    await expect(page.locator('.app-sidebar').first()).toHaveClass(/open/);
    await page.locator('input[type="file"]').first().setInputFiles(stl);
    await expect(page.getByText(/Showing: foil-model-test\.stl/)).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
    await openLab(page);
    const lab = page.locator('#cfd');
    await expect(lab.getByText(/foil-model-test\.stl/).first()).toBeVisible({ timeout: 15000 });
    await expect(lab.locator('.cfd-vtk-head')).toContainText(/\d+ pts/, { timeout: 20000 });
    await expect(lab.locator('.cfd-chart-note')).toBeVisible();
  });
});
