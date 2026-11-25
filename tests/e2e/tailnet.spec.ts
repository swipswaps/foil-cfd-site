import { test, expect } from '@playwright/test';

const RAW_APP_URL = (process.env.TAILNET_APP_URL || '').trim();
const CONFIGURED = RAW_APP_URL.length > 0;

const BENIGN = new RegExp([
  /favicon/i, /manifest/i, /ResizeObserver/i,
  /net::ERR/i, /ERR_BLOCKED/i,
  /WebGL/i,
].map((r) => r.source).join('|'));

function appHome(): string {
  if (!CONFIGURED) throw new Error('TAILNET_APP_URL is required for the tailnet suite');
  let parsed: URL;
  try {
    parsed = new URL(RAW_APP_URL);
  } catch {
    throw new Error(`TAILNET_APP_URL is not a valid absolute URL: ${RAW_APP_URL}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`TAILNET_APP_URL must be http(s), got ${parsed.protocol}`);
  }
  return parsed.href.endsWith('/') ? parsed.href : `${parsed.href}/`;
}

const collectErrors = (page: import('@playwright/test').Page) => {
  const errs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  return errs;
};

test.describe('tailnet same-origin app', () => {
  test.skip(!CONFIGURED, 'TAILNET_APP_URL not set; tailnet e2e is opt-in');

  test('auto-connects the backend without a Connect click', async ({ page }) => {
    const errs = collectErrors(page);
    await page.goto(appHome(), { waitUntil: 'load' });

    const badge = page.locator('.backend-badge').first();
    await expect(badge).toBeVisible({ timeout: 20_000 });
    await expect(badge).toContainText(/Live solver|Backend online/i, { timeout: 30_000 });
    await expect(badge).not.toContainText(/permission|allow this site/i);
    await expect(page.getByRole('button', { name: /Connect local backend/i })).toHaveCount(0);

    expect(errs.filter((e) => !BENIGN.test(e))).toEqual([]);
  });

  test('serves /api/health on the page origin', async ({ page }) => {
    await page.goto(appHome(), { waitUntil: 'load' });

    const health = await page.evaluate(async () => {
      const res = await fetch('/api/health', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const body = res.ok ? await res.json() : null;
      return { ok: res.ok, status: res.status, body };
    });

    expect(health.ok, `GET /api/health -> HTTP ${health.status}`).toBe(true);
    expect(typeof health.body?.solver_available).toBe('boolean');
    expect(new URL(page.url()).origin).toBe(new URL(appHome()).origin);
  });
});
