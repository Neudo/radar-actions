/* Read-only independent release acceptance. Credentials remain in memory.
 * Production default; --injection requires an explicitly selected loopback URL.
 * No fabricated observations, persisted sessions, HAR or external navigation. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || '/home/debian/.hermes/node/lib/node_modules/@askjo/camofox-browser/node_modules/playwright-core');
const base = process.env.RADAR_RELEASE_URL || 'https://radar.vitalisite.com';
const local = ['127.0.0.1', 'localhost'].includes(new URL(base).hostname);
assert.ok(local || base === 'https://radar.vitalisite.com');
const injection = process.argv.includes('--injection');
assert.ok(!injection || local, 'Hostile fixtures are loopback-only');
const key = fs.readFileSync(process.env.HOME + '/.hermes/.env', 'utf8').split(/\r?\n/).find(l => /^IR_READ_KEY=/.test(l)).split('=').slice(1).join('=').trim().replace(/^(['"])(.*)\1$/, '$2');
const cache = process.env.HOME + '/.cache/ms-playwright';
const dir = fs.readdirSync(cache).find(n => n.startsWith('chromium_headless_shell-'));
const out = 'data/design';
fs.mkdirSync(out, { recursive: true });
const hash = b => createHash('sha256').update(b).digest('hex');
const eligible = s => !['missing', 'quarantined'].includes(s.tracking_status) && s.data_status !== 'missing' && s.payload?.assessment_status !== 'unknown';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || `${cache}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell`, args: ['--no-sandbox'] });
  const report = { target: base, injection, checks: [], assets: [], axe: [], screenshots: [], errors: [] };
  try {
    const context = await browser.newContext({ httpCredentials: { username: 'radar', password: key, send: 'always' }, locale: 'fr-FR', viewport: { width: 1440, height: 1000 }, hasTouch: true });
    const page = await context.newPage();
    // Route interception disables Chromium's cached challenge-auth flow. Keep
    // Basic credentials in harness memory for loopback-only hostile fixtures.
    if (injection) await context.setExtraHTTPHeaders({ Authorization: 'Basic ' + Buffer.from('radar:' + key).toString('base64') });
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text())) report.errors.push(m.text()); });
    const get = async p => { const r = await context.request.get(base + p); assert.equal(r.status(), 200, p); return r.json(); };
    const list = await get('/api/v1/radar/signals?limit=500');
    const active = list.items.find(eligible);
    const excluded = list.items.find(s => s.tracking_status === 'quarantined');
    assert.ok(active && excluded);
    const detail = await get('/api/v1/radar/signals/' + active.id);
    const analytics = await get('/api/v1/radar/analytics');
    const go = async p => page.goto(base + p, { waitUntil: 'networkidle' });
    const check = s => report.checks.push(s);
    const shot = async name => { const p = `${out}/react-production-${name}.png`; await page.screenshot({ path: p }); report.screenshots.push(p); };
    const width = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No document overflow');
    const choose = async (id, name) => { await page.locator('#' + id).click(); await page.getByRole('option', { name, exact: true }).click(); await page.waitForLoadState('networkidle'); };
    const axe = fs.readFileSync(process.env.AXE_PATH || out + '/package/axe.min.js', 'utf8');
    const scan = async name => { await page.evaluate(axe); const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) }))); report.axe.push({ name, violations }); assert.deepEqual(violations, []); };
    if (injection) {
      const hostile = '<img src=x onerror="window.__injected=true"><script>window.__injected=true</script> QA HOSTILE TEXT';
      await page.route('**/api/v1/radar/signals/' + active.id, async route => {
        const r = await route.fetch({ headers: { ...route.request().headers(), Authorization: 'Bearer ' + key } }); const d = await r.json();
        d.payload.thesis = hostile; d.payload.sources = [{ url: 'javascript:window.__injected=true', summary: hostile }];
        await route.fulfill({ response: r, json: d });
      });
      await page.route('**/api/v1/radar/runs/' + active.run_id, async route => {
        const r = await route.fetch({ headers: { ...route.request().headers(), Authorization: 'Bearer ' + key } }); const d = await r.json();
        d.raw_report = hostile; d.market_context = hostile; await route.fulfill({ response: r, json: d });
      });
      await go('/dashboard/signaux/' + active.id);
      await page.locator('summary').filter({ hasText: 'Traçabilité et rapport original' }).click();
      assert.match(await page.locator('#detail pre').last().innerText(), /<img src=x/);
      assert.match(await page.locator('#detail').innerText(), /QA HOSTILE TEXT/);
      assert.equal(await page.locator('#detail img,#detail script,#detail a[href^="javascript:"]').count(), 0);
      assert.equal(await page.evaluate(() => window.__injected), undefined);
      check('Hostile thesis, source, market context and original report remain text; javascript URL rejected');
    } else {
      const files = fs.readdirSync('dist/frontend/assets').filter(n => /\.(js|css)$/.test(n));
      const paths = ['/', '/dashboard', '/dashboard/bilan', '/dashboard/methode', '/dashboard/signaux/' + active.id, '/api/v1/radar/signals', '/api/v1/radar/signals/' + active.id, '/api/v1/radar/analytics', '/api/v1/radar/runs', '/api/v1/radar/status', '/api/v1/radar/filter-options', ...files.map(n => '/dashboard-app/assets/' + n)];
      for (const credentials of [undefined, { username: 'radar', password: 'invalid-release-check', send: 'always' }]) {
        const anon = await browser.newContext(credentials ? { httpCredentials: credentials } : {});
        for (const p of paths) { const r = await anon.request.get(base + p); assert.equal(r.status(), 401, p + ' auth'); }
        await anon.close();
      }
      check('Anonymous and invalid credentials: 401 for all dashboard routes, built assets and sampled read APIs');
      for (const name of files) {
        const r = await context.request.get(base + '/dashboard-app/assets/' + name); assert.equal(r.status(), 200);
        const actual = hash(await r.body()); const expected = hash(fs.readFileSync(path.join('dist/frontend/assets', name)));
        assert.equal(actual, expected, name); report.assets.push({ name, sha256: actual });
      }
      const html = await context.request.get(base + '/dashboard');
      assert.match(await html.text(), /id="root"/);
      assert.equal(html.headers()['content-security-policy'], "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'");
      assert.equal(html.headers()['cache-control'], 'no-store');
      assert.equal((await context.request.get(base + '/dashboard-app/assets/not-built.js')).status(), 404);
      if (!local) assert.equal((await context.request.get(base + '/health')).status(), 403);
      check('Production module/CSS SHA-256 equals local build; unchanged CSP, no-store, unknown asset rejected, public health private');
      await go('/dashboard');
      assert.match(await page.locator('#result-summary').innerText(), new RegExp('^' + list.total + ' signaux'));
      await width(); await scan('desktop register'); await shot('register-desktop');
      await page.getByRole('button', { name: 'État du suivi', exact: true }).click();
      await page.keyboard.press('Tab'); assert.ok(await page.getByRole('dialog').isVisible());
      await page.keyboard.press('Escape');
      assert.ok(await page.getByRole('button', { name: 'État du suivi', exact: true }).evaluate(e => e === document.activeElement));
      for (const term of ['NVDA', 'nvda', 'Nvidia']) {
        await page.getByLabel('Rechercher une société ou un ticker').fill(term); await page.getByRole('button', { name: 'Appliquer' }).click();
        await page.waitForLoadState('networkidle');
        assert.equal(await page.locator('#rows [data-signal]').count(), list.items.filter(s => (s.ticker + ' ' + s.company).toLowerCase().includes(term.toLowerCase())).length);
      }
      await page.getByRole('button', { name: 'Réinitialiser' }).click(); await page.waitForLoadState('networkidle');
      await choose('sort', 'Société A–Z'); assert.match(page.url(), /sort=company_asc/);
      check('Authenticated React UI search case-insensitive, Radix sorting and keyboard dialog restored focus');
      await go('/dashboard/signaux/' + active.id);
      const dots = page.locator('.recharts-line-dots circle');
      assert.equal(await dots.count(), detail.observations.filter(o => o.price !== null).length + (detail.signal_price !== null ? 1 : 0));
      await page.locator('.evolution-chart').scrollIntoViewIfNeeded();
      await dots.last().hover({ force: true }); await page.locator('.chart-tooltip-provenance').waitFor();
      const observation = detail.observations.at(-1);
      const tooltip = await page.locator('.chart-tooltip-provenance').innerText();
      assert.ok(tooltip.includes(observation.source)); assert.ok(tooltip.includes(active.currency));
      assert.ok(tooltip.includes(new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(observation.price))));
      await shot('chart-desktop'); await scan('desktop detail tooltip');
      await page.getByRole('tab', { name: 'Rendement · %' }).click();
      const surface = page.locator('.recharts-surface[tabindex="0"]'); await surface.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
      await page.locator('.chart-tooltip-provenance').waitFor(); assert.match(await page.locator('.chart-tooltip-provenance').innerText(), /%/);
      await page.getByRole('tab', { name: 'Prix · ' + active.currency }).click();
      await page.setViewportSize({ width: 390, height: 844 }); await page.locator('.evolution-chart').scrollIntoViewIfNeeded();
      await dots.first().tap({ force: true }); await page.locator('.chart-tooltip-provenance').waitFor();
      assert.ok(await page.locator('.observation-tooltip').evaluate(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
      await width(); await scan('mobile touch chart'); await shot('chart-mobile');
      report.observations = { ticker: active.ticker, count: detail.observations.length, currency: active.currency };
      check('Actual observation count/value/source, native price/return tabs, keyboard tooltip and mobile touch tooltip');
      await go('/dashboard/signaux/' + excluded.id); assert.equal(await page.locator('[data-slot=chart]').count(), 0);
      assert.match(await page.locator('.exclusion-notice').innerText(), /Performance exclue/);
      check('Quarantined detail never renders admissible chart');
      await page.setViewportSize({ width: 1440, height: 1000 }); await go('/dashboard/bilan');
      assert.equal(await page.locator('.analysis-notice .folio').innerText(), String(analytics.overall.matured).padStart(2, '0'));
      const j30 = Object.values(analytics.by_tag).filter(g => g.checkpoints[30].n > 0);
      assert.equal(await page.locator('.recharts-bar-rectangle path').count(), j30.length);
      if (!j30.length) assert.ok(await page.getByRole('heading', { name: 'Échantillon insuffisant à J30' }).isVisible());
      await scan('desktop Bilan J30'); await shot('bilan-empty-desktop');
      await choose('cohort-checkpoint', 'J5');
      const groups = Object.values(analytics.by_tag).filter(g => g.checkpoints[5].n > 0);
      const bars = page.locator('.recharts-bar-rectangle path'); assert.equal(await bars.count(), groups.length);
      if (groups.length) { await page.locator('.cohort-chart').scrollIntoViewIfNeeded(); await bars.first().hover({ force: true }); await page.locator('.recharts-tooltip-wrapper').filter({ hasText: 'Médiane' }).waitFor(); assert.match(await page.locator('.recharts-tooltip-wrapper').innerText(), new RegExp('n=' + groups[0].checkpoints[5].n)); }
      await shot('bilan-cohort-desktop');
      await page.setViewportSize({ width: 390, height: 844 }); await page.locator('.chart-panel').scrollIntoViewIfNeeded(); await width(); await scan('mobile Bilan J5'); await shot('bilan-mobile');
      check('Bilan matured count, actual cohort bars/checkpoint n/median, empty J30 has no zero bars');
      await go('/dashboard/methode'); await page.locator('#runs summary').first().click(); assert.ok((await page.locator('#runs pre').first().innerText()).length > 100); await width();
      check('Méthode and original report archive available');
      const secretFiles = ['dist/frontend/index.html', ...files.map(n => 'dist/frontend/assets/' + n)];
      assert.ok(secretFiles.every(p => !fs.readFileSync(p).includes(Buffer.from(key))));
      check('Read credential absent from built client assets');
    }
    assert.deepEqual(report.errors, []); check('No browser JS or CSP errors');
  } finally {
    fs.writeFileSync(out + '/react-release-' + (injection ? 'injection' : 'production') + '.json', JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
