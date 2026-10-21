/* Read-only browser/API acceptance of isolated restored preview; no fabricated data. */
const fs=require('node:fs');const assert=require('node:assert/strict');
const {chromium}=require('/home/debian/.hermes/node/lib/node_modules/@askjo/camofox-browser/node_modules/playwright-core');
const root=process.cwd(),base=process.env.RADAR_BROWSER_BASE||'http://127.0.0.1:17849';
const prefix=base.includes(':17845')?'worker-daily-production':'worker-daily';
const key=fs.readFileSync(process.env.HOME+'/.hermes/.env','utf8').split(/\r?\n/).find(l=>/^IR_READ_KEY=/.test(l)).split('=').slice(1).join('=').trim().replace(/^(['"])(.*)\1$/,'$2');
const cache=process.env.HOME+'/.cache/ms-playwright';const dir=fs.readdirSync(cache).find(n=>n.startsWith('chromium_headless_shell-'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:`${cache}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell`,args:['--no-sandbox']});
 const report={target:base,checks:[],errors:[],screenshots:[]};
 try {
  const ctx=await browser.newContext({httpCredentials:{username:'radar',password:key,send:'always'},viewport:{width:1440,height:1000},locale:'fr-FR'});
  const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const get=async p=>{const r=await ctx.request.get(base+p);assert.equal(r.status(),200);return r.json()};
  const status=await get('/api/v1/radar/status');assert.equal(status.last_worker.status,'pending_data');assert.equal(status.last_worker.summary.remaining,0);assert.equal(status.last_worker.summary.coverage_complete,true);
  const pending=await get('/api/v1/radar/signals?tracking=pending_data&limit=500');assert.ok(pending.total>0);
  for(const s of pending.items){assert.equal(s.measurement_eligible,false);assert.equal(s.performance,null);assert.ok(s.collection.next_retry_at);assert.ok(s.collection.pending_sessions.includes('2026-10-20'))}
  const analytics=await get('/api/v1/radar/analytics');assert.equal(analytics.measurement_counts.excluded,49);assert.ok(analytics.tracking_counts.pending_data>0);assert.equal(analytics.overall.matured,0);
  report.checks.push('API reports pending without false eligible return; complete 100-cohort coverage; unchanged J30 absence');
  await page.goto(base+'/dashboard',{waitUntil:'networkidle'});
  assert.match(await page.locator('#trust-title').innerText(),/données fournisseur en attente/);
  await page.goto(base+'/dashboard?tracking=pending_data',{waitUntil:'networkidle'});
  assert.match(await page.locator('body').innerText(),/Données fournisseur en attente/);
  assert.match(await page.locator('body').innerText(),/prochaine tentative/);
  let shot=`data/${prefix}-pending-desktop.png`;await page.screenshot({path:shot});report.screenshots.push(shot);
  await page.goto(base+'/dashboard/signaux/'+pending.items[0].id,{waitUntil:'networkidle'});
  assert.match(await page.locator('body').innerText(),/Données fournisseur en attente/);
  const curve=await page.locator('[data-chart]').count();report.pending_detail_charts=curve;assert.equal(curve,0);
  const active=await get('/api/v1/radar/signals?eligible=true&limit=500');
  const observed=active.items.find(x=>x.last_observed_at);assert.ok(observed);
  await page.goto(base+'/dashboard/signaux/'+observed.id,{waitUntil:'networkidle'});
  await page.locator('[data-chart]').first().waitFor();
  report.actual_observed_chart_signal=observed.id;
  report.checks.push('Real eligible observed signal renders a chart; pending detail renders none');
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/dashboard?tracking=pending_data',{waitUntil:'networkidle'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  shot=`data/${prefix}-pending-mobile.png`;await page.screenshot({path:shot});report.screenshots.push(shot);
  report.checks.push('Desktop/mobile browser pending label, truthful trust banner, next retry metadata, no document overflow');
  const anon=await browser.newContext();assert.equal((await anon.request.get(base+'/dashboard')).status(),401);assert.equal((await anon.request.get(base+'/api/v1/radar/status')).status(),401);await anon.close();
  report.checks.push('Dashboard and status remain authenticated');assert.deepEqual(report.errors,[]);
  fs.writeFileSync(root+`/data/${prefix}-browser.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
