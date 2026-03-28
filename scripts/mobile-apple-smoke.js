const { chromium, devices } = require('playwright');

const BASE = process.env.BASE_URL || 'https://sport-alpha-lake.vercel.app';
const EMAIL = process.env.TEST_EMAIL || 'balalobidudi2@gmail.com';
const PASSWORD = process.env.TEST_PASSWORD || '123456';

const PATHS = [
  '/dashboard/entrainement',
  '/dashboard/profil',
  '/dashboard/reseau',
  '/dashboard/carte',
  '/dashboard/classement',
  '/dashboard/analyse',
  '/dashboard/idees',
  '/dashboard/admin',
];

async function loginToken() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function collectButtons(page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"], input[type="button"]'));
    const visible = nodes.filter((n) => {
      const r = n.getBoundingClientRect();
      const style = window.getComputedStyle(n);
      return r.width > 10 && r.height > 10 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    return visible.slice(0, 30).map((n, idx) => {
      const text = (n.textContent || '').trim().slice(0, 80) || n.getAttribute('aria-label') || n.getAttribute('title') || n.getAttribute('name') || 'btn';
      return { text, idx };
    });
  });
}

async function clickButtonByIndex(page, visibleIndex) {
  return page.evaluate((targetIdx) => {
    const nodes = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"], input[type="button"]'));
    const visible = nodes.filter((n) => {
      const r = n.getBoundingClientRect();
      const style = window.getComputedStyle(n);
      return r.width > 10 && r.height > 10 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    const node = visible[targetIdx];
    if (!node) return false;
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }, visibleIndex);
}

(async () => {
  const auth = await loginToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await context.newPage();

  const logs = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (m) => {
    if (m.type() === 'error') logs.push(m.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText || 'failed'}`));

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token: auth.token, user: auth.user });

  const report = [];

  for (const path of PATHS) {
    const item = { path, url: '', overflow: false, buttons: [], clickErrors: [] };
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1400);

      item.url = page.url();

      const dims = await page.evaluate(() => {
        const vw = window.innerWidth;
        const sw = document.documentElement.scrollWidth;
        const bsw = document.body.scrollWidth;
        return { overflow: sw > vw + 1 || bsw > vw + 1 };
      });
      item.overflow = !!dims.overflow;

      const buttons = await collectButtons(page);
      item.buttons = buttons;

      for (let i = 0; i < Math.min(buttons.length, 12); i++) {
        const label = buttons[i].text;
        try {
          const clicked = await clickButtonByIndex(page, buttons[i].idx);

          if (!clicked) {
            item.clickErrors.push(`button not found on click index ${buttons[i].idx}: ${label}`);
          }
          await page.waitForTimeout(180);
        } catch (err) {
          item.clickErrors.push(`${label}: ${String(err).slice(0, 180)}`);
        }
      }
    } catch (err) {
      item.clickErrors.push(`page error: ${String(err).slice(0, 200)}`);
    }

    report.push(item);
  }

  await browser.close();

  const output = {
    base: BASE,
    checkedAt: new Date().toISOString(),
    pages: report,
    pageErrors,
    consoleErrors: logs,
    failedRequests,
  };

  console.log(JSON.stringify(output, null, 2));
})();
