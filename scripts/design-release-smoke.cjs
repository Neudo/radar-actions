/* Read-only release smoke. No writes, external sources, HAR or stored credentials.
 * --injection is loopback-only and substitutes marked hostile text in browser GETs.
 * Optional RADAR_RELEASE_URL selects loopback preview; production is the default. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || '/home/debian/.hermes/node/lib/node_modules/@askjo/camofox-browser/node_modules/playwright-core');
const base = process.env.RADAR_RELEASE_URL || 'https://radar.vitalisite.com';
const local = ['localhost', '127.0.0.1'].includes(new URL(base).hostname);
assert.ok(local || base === 'https://radar.vitalisite.com');
const injection = process.argv.includes('--injection');
assert.ok(!injection || local, 'Injection interception is loopback-only');
const key = fs.readFileSync(process.env.HOME + '/.hermes/.env', 'utf8').split(/\r?\n/).find(l => /^IR_READ_KEY=/.test(l)).split('=').slice(1).join('=').trim().replace(/^(['"])(.*)\1$/, '$2');
const cache = process.env.HOME + '/.cache/ms-playwright';
const dir = fs.readdirSync(cache).find(n => n.startsWith('chromium_headless_shell-'));
const out = 'data/design';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || `${cache}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell`, args: ['--no-sandbox'] });
  const evidence = { target: base, injection, checks: [], screenshots: [], errors: [] };
  try {
    const context = await browser.newContext({ httpCredentials: { username: 'radar', password: key }, locale: 'fr-FR', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', e => evidence.errors.push(e.message));
    page.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text())) evidence.errors.push(m.text()); });
    const get = async path => { const r = await context.request.get(base + path, { headers: { Authorization: 'Bearer ' + key } }); assert.equal(r.status(), 200); return r.json(); };
    const list = await get('/api/v1/radar/signals?limit=50');
    const runs = await get('/api/v1/radar/runs?limit=1');
    const analytics = await get('/api/v1/radar/analytics');
    assert.equal(list.total, 40); assert.equal(runs.total, 2);
    assert.equal(analytics.overall.matured, 0);
    assert.equal(analytics.tracking_counts.quarantined, 22);
    assert.equal(analytics.tracking_counts.active, 18);
    assert.ok(Object.values(analytics.overall.checkpoints).every(c => c.n === 0 && c.mean === null && c.median === null));
    const aapl = list.items.find(s => s.ticker === 'AAPL');
    if (injection) {
      const hostile = '<img src=x onerror="window.__injected=true"><script>window.__injected=true</script> QA HOSTILE TEXT';
      await page.route('**/api/v1/radar/signals/' + aapl.id, async route => {
        const r = await route.fetch({ headers: { ...route.request().headers(), Authorization: 'Bearer ' + key } }); const data = await r.json();
        data.payload.thesis = hostile;
        data.payload.sources = [{ url: 'javascript:window.__injected=true', summary: hostile, published_at: null }];
        await route.fulfill({ response: r, json: data });
      });
      await page.route('**/api/v1/radar/runs/' + aapl.run_id, async route => {
        const r = await route.fetch({ headers: { ...route.request().headers(), Authorization: 'Bearer ' + key } }); const data = await r.json();
        data.raw_report = hostile; data.market_context = hostile;
        await route.fulfill({ response: r, json: data });
      });
      await page.goto(base + '/dashboard/signaux/' + aapl.id, { waitUntil: 'networkidle' });
      await page.locator('.trace summary').click();
      assert.match(await page.locator('#linked-run pre').innerText(), /<img src=x/);
      assert.match(await page.locator('#detail').innerText(), /QA HOSTILE TEXT/);
      assert.equal(await page.locator('#detail img, #detail script, #detail a[href^="javascript:"]').count(), 0);
      assert.equal(await page.evaluate(() => window.__injected), undefined);
      evidence.checks.push('Hostile thesis/source/context/raw_report rendered as inert text; javascript source is not a link');
    } else {
      await page.goto(base + '/dashboard', { waitUntil: 'networkidle' });
      assert.match(await page.locator('#result-summary').innerText(), /40 signaux.*2 analyses.*0 matures J30.*22 en quarantaine/);
      assert.match(await page.locator('#trust-title').innerText(), /Suivi ancien.*dégradé/);
      assert.equal(await page.locator('.quarantine').count(), 22);
      evidence.checks.push('40 signals / 2 runs / 0 mature / 22 quarantined / 18 active; checkpoint n=0 with null means');
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (width !== 320) {
          const p = `${out}/production-${width === 1440 ? 'desktop' : 'mobile'}.png`;
          await page.screenshot({ path: p, fullPage: false }); evidence.screenshots.push(p);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      for (const term of ['NVDA', 'nvda', 'Nvidia']) {
        await page.getByLabel('Rechercher une société ou un ticker').fill(term);
        await page.getByRole('button', { name: 'Appliquer' }).click();
        await page.waitForFunction(() => document.querySelector('#rows').getAttribute('aria-busy') === 'false');
        assert.equal(await page.locator('#rows a[data-signal]').count(), 2);
      }
      await page.locator('#more-filters summary').click();
      await page.locator('select[name=tag]').selectOption('GREEN');
      await page.getByRole('button', { name: 'Appliquer' }).click();
      await page.waitForFunction(() => document.querySelector('#rows').getAttribute('aria-busy') === 'false');
      assert.match(await page.locator('#rows').innerText(), /Aucun signal/);
      await page.locator('#reset').click();
      await page.waitForFunction(() => document.querySelector('#rows').getAttribute('aria-busy') === 'false');
      await page.locator('#limit').selectOption('25');
      await page.waitForFunction(() => document.querySelector('#rows').getAttribute('aria-busy') === 'false');
      await page.locator('#next').click();
      await page.waitForFunction(() => document.querySelector('#rows').getAttribute('aria-busy') === 'false');
      assert.match(await page.locator('#page-summary').innerText(), /26–40 sur 40/);
      await page.locator('#sort').selectOption('company_asc');
      await page.waitForFunction(() => document.querySelector('#rows').getAttribute('aria-busy') === 'false');
      assert.match(await page.locator('#rows a[data-signal]').first().innerText(), /^ABNB/);
      evidence.checks.push('Case-insensitive global search, qualification empty state, paging and global sorting');
      await page.goto(base + '/dashboard/signaux/' + aapl.id, { waitUntil: 'networkidle' });
      assert.match(await page.locator('#detail').innerText(), /Publication non établie/);
      assert.match(await page.locator('#detail').innerText(), /Performance exclue/);
      await page.locator('.trace summary').click();
      assert.ok((await page.locator('#linked-run pre').innerText()).length > 100);
      await page.goto(base + '/dashboard/bilan', { waitUntil: 'networkidle' });
      assert.match(await page.locator('#analytics').innerText(), /Non calculable · n=0/);
      await page.goto(base + '/dashboard/methode', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('#runs details').count(), 2);
      evidence.checks.push('Direct AAPL detail, quarantine, undated source, real report, Bilan and Methode');
    }
    assert.deepEqual(evidence.errors, []);
    const path = `${out}/${injection ? 'qa-injection' : 'production-browser'}.json`;
    fs.writeFileSync(path, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exit(1); });
