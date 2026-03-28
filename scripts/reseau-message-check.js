const { chromium, devices } = require('playwright');

(async () => {
  const base = 'https://sport-alpha-lake.vercel.app';
  const email = 'balalobidudi2@gmail.com';
  const password = '123456';

  const lr = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const ld = await lr.json();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await context.newPage();

  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token: ld.token, user: ld.user });

  await page.goto(base + '/dashboard/reseau', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  const firstMsgBtn = page.locator('button', { hasText: '💬 Message' }).first();
  const count = await firstMsgBtn.count();
  if (count > 0) {
    await firstMsgBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1400);
  }

  const result = await page.evaluate(() => ({
    hasChatInput: !!document.querySelector('input[placeholder="Message..."]'),
    hasMessageHeader: document.body.innerText.includes('Messages'),
    currentPath: location.pathname,
  }));

  console.log(JSON.stringify({ count, result }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
