import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = (process.env.PLAYWRIGHT_BASE_URL || 'https://swipswaps.github.io/foil-cfd-site').replace(/\/$/, '');
const HOME = BASE + '/';

interface ViolationLike {
  id: string;
  impact?: string | null;
  nodes: unknown[];
}

function seriousOrCritical(violations: ViolationLike[], url: string): string[] {
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}(${v.nodes.length}) on ${url}`);
}

test.describe('accessibility (axe)', () => {
  test('overview and lab have no serious or critical violations', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME, { waitUntil: 'load' });
    await expect(page.getByRole('link', { name: /Open 3D CFD Lab/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    const overview = await new AxeBuilder({ page }).analyze();
    expect(seriousOrCritical(overview.violations, page.url())).toEqual([]);

    await page.getByRole('tab', { name: /3D Lab/i }).first().click();
    await expect(page.locator('#cfd')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);

    const lab = await new AxeBuilder({ page }).analyze();
    expect(seriousOrCritical(lab.violations, page.url())).toEqual([]);
  });
});
