const { chromium, devices } = require('playwright');
const fs = require('fs');
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
  if (!lr.ok || !ld.token) throw new Error('Login failed');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await context.newPage();

  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token: ld.token, user: ld.user });

  await page.goto(base + '/dashboard/entrainement', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const outDir = 'C:/Users/Admin/sport/tmp/mobile-shots';
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: outDir + '/01-entrainement-mobile.png', fullPage: true });

  const startBtn = page.locator('button', { hasText: 'Démarrer' }).first();
  if (await startBtn.count()) {
    await startBtn.click();
    await page.waitForTimeout(2200);
    await page.screenshot({ path: outDir + '/02-session-mobile.png', fullPage: true });
  }

  await browser.close();
  console.log('Screenshots saved: ' + outDir);
})();
