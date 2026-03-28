const { chromium, devices } = require('playwright');

(async () => {
  const base = 'https://sport-alpha-lake.vercel.app';
  const email = 'balalobidudi2@gmail.com';
  const password = '123456';

  const loginRes = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) {
    console.log(JSON.stringify({ ok: false, step: 'login', status: loginRes.status, loginData }, null, 2));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await context.newPage();

  const report = {
    apiFailures: [],
    errors: [],
    checks: {},
  };

  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(`console:${m.text()}`);
  });
  page.on('pageerror', (e) => report.errors.push(`pageerror:${String(e)}`));
  page.on('response', async (res) => {
    if (!res.url().includes('/api/')) return;
    if (res.status() < 400) return;
    let body = '';
    try { body = await res.text(); } catch {}
    report.apiFailures.push({ status: res.status(), method: res.request().method(), url: res.url(), body: body.slice(0, 200) });
  });

  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token: loginData.token, user: loginData.user });

  await page.goto(base + '/dashboard/social', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const tabNames = ['Actualités', 'Messages', 'Amis', 'Performances', 'Défis', 'Jeux'];
  report.checks.tabs = [];
  for (const tab of tabNames) {
    const btn = page.locator('button', { hasText: tab }).first();
    const exists = (await btn.count()) > 0;
    if (exists) {
      await btn.click();
      await page.waitForTimeout(800);
    }
    const snap = await page.evaluate((name) => {
      const t = document.body.innerText;
      return {
        tab: name,
        existsInUI: t.includes(name) || name === 'Performances',
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1,
        loadingVisible: t.includes('Chargement...'),
      };
    }, tab);
    report.checks.tabs.push({ existsButton: exists, ...snap });
  }

  // Amis -> Message
  const amisTab = page.locator('button', { hasText: 'Amis' }).first();
  if (await amisTab.count()) {
    await amisTab.click();
    await page.waitForTimeout(600);
  }
  const msgBtn = page.locator('button', { hasText: /^Message$/ }).first();
  const hasMsgBtn = (await msgBtn.count()) > 0;
  if (hasMsgBtn) {
    await msgBtn.click();
    await page.waitForTimeout(1000);
  }
  report.checks.friendsToMessage = await page.evaluate(() => ({
    path: location.pathname,
    hasChatInput: !!document.querySelector('input[placeholder="Message..."]'),
    hasMessagesTitle: document.body.innerText.includes('Messages'),
  }));

  // Send message test
  const firstConv = page.locator('div.cursor-pointer').first();
  if (await firstConv.count()) {
    await firstConv.click();
    await page.waitForTimeout(900);
  }
  const payload = 'BALALO_AUDIT_' + Date.now();
  const msgInput = page.locator('input[placeholder="Message..."]').first();
  const sendBtn = page.locator('button', { hasText: /Envoyer|Envoi/ }).first();
  if (await msgInput.count()) {
    await msgInput.fill(payload);
    await sendBtn.click();
    await page.waitForTimeout(1200);
  }
  report.checks.sendMessage = await page.evaluate((needle) => ({
    hasError: document.body.innerText.includes('Envoi impossible') || document.body.innerText.includes('Erreur réseau'),
    messageShown: document.body.innerText.includes(needle),
  }), payload);

  // Games deep-link checks
  const gameCases = [
    ['duel', 'Duel 1v1'],
    ['topsemaine', 'Top Semaine'],
    ['defiami', 'Défi Ami'],
    ['rush', 'Rush Classement'],
    ['roulette', 'Roulette'],
    ['chrono', 'Défi Chrono'],
  ];
  report.checks.games = [];
  for (const [key, expected] of gameCases) {
    await page.goto(base + `/dashboard/mini-jeux?game=${encodeURIComponent(key)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const result = await page.evaluate((exp) => {
      const t = document.body.innerText;
      return {
        hasExpected: t.includes(exp),
        landedOnCatalog: t.includes('Mini Jeux') && t.includes('Solo / Offline'),
      };
    }, expected);
    report.checks.games.push({ key, expected, ...result });
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
})();
