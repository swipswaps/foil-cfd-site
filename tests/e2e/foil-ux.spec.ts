import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

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

function makeVtp(pointData: string): string {
  return `<?xml version="1.0"?>
<VTKFile type="PolyData" version="0.1" byte_order="LittleEndian">
  <PolyData>
    <Piece NumberOfPoints="6" NumberOfVerts="0" NumberOfLines="0" NumberOfStrips="0" NumberOfPolys="4">
      <PointData Scalars="p">
        ${pointData}
      </PointData>
      <Points>
        <DataArray type="Float32" NumberOfComponents="3" format="ascii">0 0.1 0  0.5 0.1 0  1 0.1 0  0 -0.1 0  0.5 -0.1 0  1 -0.1 0</DataArray>
      </Points>
      <Polys>
        <DataArray type="Int64" Name="connectivity" format="ascii">0 1 4 0 4 3 1 2 5 1 5 4</DataArray>
        <DataArray type="Int64" Name="offsets" format="ascii">3 6 9 12</DataArray>
      </Polys>
    </Piece>
  </PolyData>
</VTKFile>`;
}

const VTP_PUT = `<DataArray type="Float32" Name="p" format="ascii">-0.5 -0.4 -0.2 0.1 0.2 0.3</DataArray>
<DataArray type="Float32" Name="U" NumberOfComponents="3" format="ascii">1 0 0 1 0 0 1 0 0 1 0 0 1 0 0 1 0 0</DataArray>
<DataArray type="Float32" Name="T" format="ascii">300 301 302 303 304 305</DataArray>`;

const VTP_PUK = `<DataArray type="Float32" Name="p" format="ascii">-0.5 -0.4 -0.2 0.1 0.2 0.3</DataArray>
<DataArray type="Float32" Name="U" NumberOfComponents="3" format="ascii">1 0 0 1 0 0 1 0 0 1 0 0 1 0 0 1 0 0</DataArray>
<DataArray type="Float32" Name="k" format="ascii">0.1 0.12 0.14 0.16 0.18 0.2</DataArray>
<DataArray type="Float32" Name="epsilon" format="ascii">0.01 0.02 0.03 0.04 0.05 0.06</DataArray>
<DataArray type="Float32" Name="nut" format="ascii">0.001 0.002 0.003 0.004 0.005 0.006</DataArray>`;

async function mockOnlineHealth(page: import('@playwright/test').Page) {
  await page.route('**/api/health', async (route) => {
    const pageOrigin = new URL(page.url()).origin;
    if (new URL(route.request().url()).origin === pageOrigin) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'online', solver_available: true, blockMesh_available: true }),
      });
      return;
    }
    await route.abort('failed');
  });
}

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

  test('hero tabs are keyboard accessible and sync the URL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME, { waitUntil: 'load' });
    const overview = page.getByRole('tab', { name: 'Overview' });
    const lab = page.getByRole('tab', { name: '3D Lab' });
    await overview.focus();
    await page.keyboard.press('ArrowRight');
    await expect(lab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#cfd')).toBeVisible({ timeout: 15000 });
    expect(new URL(page.url()).hash).toBe('#cfd');
    await page.keyboard.press('ArrowLeft');
    await expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(new URL(page.url()).hash).toBe('');
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
      () => /Static demo|Static mode|Backend offline/i.test(document.body.innerText),
      null,
      { timeout: 20000 },
    );

    const canvas = await waitForLab(page);
    expect(Date.now() - t0).toBeLessThan(25000);
    await expect(page.locator('.cfd-vtk-head')).toContainText(/\d+ pts · \d+ cells/);
    await expect(page.locator('#cfd').getByText(/Sample wing/i).first()).toBeVisible();
    expect(await page.getByRole('button', { name: /Run live solve|Preview field|Generate synthetic preview|Run simpleFoam/i }).count()).toBe(0);

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

  test('lab header shows free-stream conditions and the surface probes p/U/T', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME, { waitUntil: 'load' });
    await waitForLab(page);

    const fs = page.locator('.cfd-lab-freestream');
    await expect(fs).toBeVisible();
    await expect(fs).toContainText(/U∞/);
    await expect(fs).toContainText(/Re\s*[\d.]+×10/);
    await expect(fs).toContainText(/q∞\s*\d+\s*Pa/);
    await expect(fs).toContainText(/T∞\s*\d+\s*K/);
    await expect(fs).toContainText(/Cn\s*0\.76/);

    await centerCanvas(page);
    const canvas = page.locator('.cfd-vtk-surface canvas').first();
    const box = (await canvas.boundingBox())!;
    const spots: [number, number][] = [
      [0.5, 0.5], [0.5, 0.4], [0.45, 0.55], [0.55, 0.45],
      [0.6, 0.5], [0.4, 0.5], [0.5, 0.6],
    ];
    for (const [fx, fy] of spots) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      if (await page.locator('.cfd-probe').count()) break;
      await page.waitForTimeout(150);
    }

    const probe = page.locator('.cfd-probe');
    await expect(probe).toBeVisible();
    await expect(probe.locator('dd')).toHaveCount(3);
    await expect(probe).toContainText(/[−-]?\d+\.\d+/);

    const dotBefore = await page.locator('.cfd-probe-dot').boundingBox();
    const orbit = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.3 };
    await page.mouse.move(orbit.x, orbit.y);
    await page.mouse.down();
    await page.mouse.move(orbit.x + 70, orbit.y + 30, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    const dotAfter = await page.locator('.cfd-probe-dot').boundingBox();
    expect(dotBefore).toBeTruthy();
    expect(dotAfter).toBeTruthy();
    expect(Math.abs(dotAfter!.x - dotBefore!.x) + Math.abs(dotAfter!.y - dotBefore!.y)).toBeGreaterThan(4);

    const csvEvt = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const csv = await csvEvt;
    expect(csv.suggestedFilename()).toMatch(/^surface-p.*\.csv$/);
    const csvPath = await csv.path();
    const firstLine = readFileSync(csvPath!, 'utf8').split('\n')[0];
    expect(firstLine).toMatch(/^# probe x=-?\d+\.\d+ y=-?\d+\.\d+ z=-?\d+\.\d+ p=.* U=.* T=.*/);

    const jsonEvt = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export probe JSON' }).click();
    const json = await jsonEvt;
    expect(json.suggestedFilename()).toBe('probe.json');
    const payload = JSON.parse(readFileSync((await json.path())!, 'utf8'));
    expect(payload.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload.field).toBe('p');
    expect(payload.datasetUrl).toMatch(/surface\.vtp/);
    expect(payload.freeStream.speed).toBe(2);
    expect(payload.freeStream.chord).toBe(1);
    expect(payload.freeStream.temperature).toBeCloseTo(288.15, 2);
    expect(payload.freeStream.reynolds).toBeCloseTo(133333.33, 0);
    expect(payload.freeStream.dynamicPressure).toBeCloseTo(2.45, 2);
    expect(payload.analysis.sectionCn).toBeCloseTo(0.7675, 2);
    expect(Number.isFinite(payload.probe.p)).toBe(true);
    expect(Number.isFinite(payload.probe.U)).toBe(true);
    expect(Number.isFinite(payload.probe.T)).toBe(true);

    await page.getByRole('button', { name: /open sidebar/i }).first().click();
    await expect(page.locator('.app-sidebar').first()).toHaveClass(/open/);
    const last = page.locator('.cfd-sidebar-probe');
    await expect(last).toContainText(/Last probe/);
    await expect(last).toContainText(/\|U\|/);

    await page.locator('.cfd-sidebar-probe-btn').click();
    await expect(page.locator('.app-sidebar').first()).not.toHaveClass(/open/);
    await expect(page.locator('.cfd-vtk-announce')).toContainText(/Centered on probe/);
    await expect(probe).toBeVisible();

    await probe.getByRole('button', { name: /clear probe/i }).click();
    await expect(probe).toHaveCount(0);
    await page.getByRole('button', { name: /open sidebar/i }).first().click();
    await expect(page.locator('.cfd-sidebar-probe')).toContainText(/No probe yet/);
  });

  test('flow vectors overlay toggles and changes the render', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME, { waitUntil: 'load' });
    const canvas = await waitForLab(page);

    await centerCanvas(page);
    const offShot = await page.screenshot({ clip: roundBox((await canvas.boundingBox())!) });

    const btn = page.getByRole('button', { name: 'Flow vectors' });
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.cfd-vtk-announce')).toContainText(/Flow vectors on · \d+ glyphs/);

    await centerCanvas(page);
    await page.waitForTimeout(600);
    const onShot = await page.screenshot({ clip: roundBox((await canvas.boundingBox())!) });
    expect(onShot.equals(offShot)).toBe(false);

    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.cfd-vtk-announce')).toContainText(/Flow vectors off/);
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

  test('primary status and solve controls avoid operator jargon', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME, { waitUntil: 'load' });
    const badge = page.locator('.backend-badge').first();
    await expect(badge).toBeVisible({ timeout: 20000 });
    await expect(badge.locator('.solver-label')).not.toContainText(/docker compose|127\.0\.0\.1|OpenFOAM/i);

    await page.getByRole('button', { name: /open sidebar/i }).first().click();
    const tools = page.locator('.sidebar-section').filter({ hasText: 'Scientific tools' }).first();
    await expect(tools.locator('.sidebar-section-label')).not.toContainText(/docker compose|127\.0\.0\.1|OpenFOAM/i);
    await expect(tools.getByRole('button', { name: /Connect local backend/i })).toBeVisible();

    // The operator command survives, but only inside a secondary disclosure.
    const selfHost = tools.locator('.self-host').first();
    await expect(selfHost).toContainText(/Self-host the solver/i);
    await selfHost.locator('summary').click();
    await expect(selfHost).toContainText(/docker compose/i);
  });

  test('closed sidebar is inert; Escape closes and restores focus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME, { waitUntil: 'load' });
    const aside = page.locator('.app-sidebar').first();
    const inertWhenClosed = await aside.evaluate(
      (el) => (el as HTMLElement).inert === true || el.hasAttribute('inert'),
    );
    expect(inertWhenClosed).toBe(true);

    await page.getByRole('button', { name: /open sidebar/i }).first().click();
    await expect(aside).toHaveClass(/open/);
    expect(await aside.evaluate((el) => (el as HTMLElement).inert)).toBe(false);
    expect(await page.evaluate(() => document.body.classList.contains('sidebar-locked'))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(aside).not.toHaveClass(/open/);
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('nav-burger');
    expect(await page.evaluate(() => document.body.classList.contains('sidebar-locked'))).toBe(false);
  });

  test('probe station and chart summary give a keyboard and text path', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME, { waitUntil: 'load' });
    await waitForLab(page);

    await expect(page.locator('.cfd-chart-summary').first()).toContainText(/Peak suction Cp/);

    const station = page.locator('.cfd-station input[type="range"]').first();
    await station.scrollIntoViewIfNeeded();
    await station.focus();
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');

    const table = page.locator('.cfd-probe-table').first();
    await expect(table).toContainText(/\d+\.\d+/);
    await expect(table.locator('td').first()).not.toHaveText('—');
  });

  test('first-run coach mark appears and dismissal persists', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME, { waitUntil: 'load' });
    await openLab(page);
    const coach = page.locator('.cfd-coach').first();
    await expect(coach).toBeVisible({ timeout: 15000 });
    await coach.getByRole('button', { name: 'Got it' }).click();
    await expect(coach).toHaveCount(0);

    await page.reload({ waitUntil: 'load' });
    await openLab(page);
    await expect(page.locator('.cfd-coach')).toHaveCount(0);
  });

  test('a mocked solve failure surfaces a reason and a retry', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route('**/api/health', async (route) => {
      const pageOrigin = new URL(page.url()).origin;
      if (new URL(route.request().url()).origin === pageOrigin) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'online', solver_available: true, blockMesh_available: true }),
        });
        return;
      }
      await route.abort('failed');
    });
    await page.route('**/api/solve', async (route) => {
      const pageOrigin = new URL(page.url()).origin;
      if (new URL(route.request().url()).origin !== pageOrigin) {
        await route.abort('failed');
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'boom' }),
      });
    });

    await page.goto(HOME, { waitUntil: 'load' });
    await expect(page.locator('.backend-badge')).toContainText(/Live solver ready/i, { timeout: 30000 });

    await page.getByRole('button', { name: /open sidebar/i }).first().click();
    const solve = page.getByRole('button', { name: 'Run live solve' }).first();
    await expect(solve).toBeVisible({ timeout: 10000 });
    await solve.click();

    await expect(page.locator('.upload-error')).toContainText(/HTTP 500|Could not start/i, { timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Run again' })).toBeVisible();
  });

  test('phone controls meet a 44-pixel tap target', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(HOME, { waitUntil: 'load' });
    const burger = page.locator('.nav-burger').first();
    await expect(burger).toBeVisible();
    const b = (await burger.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);

    const tab = page.getByRole('tab', { name: 'Overview' });
    const t = (await tab.boundingBox())!;
    expect(t.height).toBeGreaterThanOrEqual(44);

    await burger.click();
    const close = page.locator('.sidebar-close').first();
    const c = (await close.boundingBox())!;
    expect(c.width).toBeGreaterThanOrEqual(44);
    expect(c.height).toBeGreaterThanOrEqual(44);
  });

  test('field menu is detected from the dataset (adds k/epsilon/nut, drops T)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockOnlineHealth(page);
    await page.route('**/api/jobs/default/surface.vtp', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/octet-stream', body: makeVtp(VTP_PUK) });
    });

    await page.goto(HOME, { waitUntil: 'load' });
    await expect(page.locator('.backend-badge')).toContainText(/Live solver ready/i, { timeout: 30000 });
    await openLab(page);

    const select = page.locator('.cfd-lab-field select').first();
    await expect(select.locator('option[value="k"]')).toHaveCount(1, { timeout: 20000 });
    await expect(select.locator('option[value="epsilon"]')).toHaveCount(1);
    await expect(select.locator('option[value="nut"]')).toHaveCount(1);
    await expect(select.locator('option[value="T"]')).toHaveCount(0);

    await select.selectOption('k');
    await expect(page.locator('.cfd-vtk-head')).toContainText(/field=k/, { timeout: 20000 });
    await expect(page.locator('.cfd-vtk-legend')).toBeVisible();
  });

  test('a completed solve drives the Cp chart and Cn from the surface', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockOnlineHealth(page);
    await page.route('**/api/jobs/default/surface.vtp', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/octet-stream', body: makeVtp(VTP_PUT) });
    });
    await page.route('**/api/solve', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ job_id: 'testjob', status: 'queued' }),
      });
    });
    await page.route('**/api/jobs/testjob/surface.vtp', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/octet-stream', body: makeVtp(VTP_PUK) });
    });
    await page.route('**/api/jobs/testjob', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ job_id: 'testjob', status: 'completed' }),
      });
    });

    await page.goto(HOME, { waitUntil: 'load' });
    await expect(page.locator('.backend-badge')).toContainText(/Live solver ready/i, { timeout: 30000 });
    await openLab(page);
    await page.getByRole('button', { name: /open sidebar/i }).first().click();
    await page.getByRole('button', { name: 'Run live solve' }).click();
    await page.keyboard.press('Escape');

    const select = page.locator('.cfd-lab-field select').first();
    await expect(select.locator('option[value="k"]')).toHaveCount(1, { timeout: 30000 });
    await expect(select.locator('option[value="T"]')).toHaveCount(0);
    await expect(page.locator('.cfd-chart-source')).toContainText(/Solved surface pressure/i);
    await expect(page.locator('.cfd-lab-freestream')).toContainText(/Cn\s*-?\d/);
  });
});
