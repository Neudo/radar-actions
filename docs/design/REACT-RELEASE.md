# React / shadcn release — independent verification

**Verdict: PASS FOR STATED SCOPE. Deployed on 17 October 2026.**

Production: `https://radar.vitalisite.com/dashboard` (existing Basic access, user `radar`). Credentials remain exclusively in the configured secret store and harness memory. This report is not a financial validation or a WCAG certification.

## Independent review

A separate reviewing agent loaded the Agency Reality Checker and Accessibility Auditor references plus Engineering Workflows, read the implementation handoff, inspected the actual working-tree diff, React components, presentation adapters, server authentication/asset routes, tests, build configuration and upstream provenance verifier. Results below are fresh executions, not copied approval from the implementation handoff. No application blocker was found; no aesthetic rewrite was performed.

- **React / TypeScript / Tailwind / shadcn: PASS.** Vite builds the genuine React application, with strict frontend TypeScript and Tailwind v4. Nine checked-in shadcn components retain attribution and MIT license. `python3 scripts/vendor-shadcn.py` fetched every official registry source and verified its pinned registry digest and exact declared local adaptations. No installer or downloaded code was executed. The attribution header, French Dialog close label/import mapping and keyboard-scrollable Table region are accounted for. The accessible Select wrapper is separate from vendored source.
- **Authentication / CSP / assets: PASS.** Application-wide request authentication precedes all new routes. Assets are a filename-to-buffer allowlist loaded from the production build, not a user-controlled filesystem path. Anonymous and invalid Basic credentials returned 401 on all three built assets, root, dashboard/direct views/detail and six sampled read APIs. Authorized assets were 200, unknown asset 404, HTTPS health 403. Existing no-store and CSP remain exact; no `unsafe-eval` or inline script was introduced. Styles are inlined server-side under the existing policy.
- **XSS / secrets: PASS in sampled paths.** Signal thesis, source summary, market context and raw original report render through React text nodes; source URLs reject non-HTTP(S) and userinfo URLs. Loopback-only interception inserted hostile HTML/script and a javascript source URL without touching the database: all remained inert text, no hostile DOM element/link or execution flag. The vendor Chart's `dangerouslySetInnerHTML` is limited to locally constructed chart CSS with constant keys/colors and React-generated identifier, not report/market text. Actual configured credentials were scanned before staging; no value is published in the changed code/docs/build assets.
- **Graph inputs: PASS.** Frozen J0 plus stored observations only; explicit missing-session nulls, straight lines, `connectNulls=false`, no synthetic future samples/smoothing. Quarantine/missing/unknown are excluded from admissible curves/aggregates. Price and return tabs retain native units, source, original session/observation and fetch provenance. Exact listing identifier/venue/currency gates support overlays. Missing setup levels are stated, not reconstructed.
- **Cohorts: PASS.** Actual backend checkpoint means, medians and checkpoint-specific n; absent samples are not zero bars. J30 maturity and empty labels agree with authenticated analytics. Currency cohorts remain distinct; percentages are not presented as portfolio returns. Actual release data selected AIR dynamically and rendered ten observations plus J0; J5 had an admissible Orange cohort. These are private snapshot observations, not application constants or assumed historical quarantine counts.
- **Journeys / design: PASS for tested Chromium scope.** Case-insensitive company/ticker search, filters/quarantine, global sorting, nonduplicating pagination, controlled reset/date validation, essential/checkpoint columns, full-page detail and query-preserving focus return, original report/sources, Bilan, Méthode/archive, Dialog/Select keyboard access, chart keyboard tooltip and mobile touch tooltip were exercised. French paper/graphite/citron theme retained. Tables deliberately scroll horizontally inside labelled, keyboard-focusable regions; the document itself does not overflow at tested widths. Desktop/mobile production captures were actually opened visually, including chart units/provenance and Bilan bars/n.

## Commands and actual results

| Command / scope | Fresh result |
|---|---|
| `npm run build` | PASS backend TS, strict frontend TS, production Vite; 2,622 modules transformed |
| `./scripts/compose.sh build migrate && ./scripts/integration.sh` | **58 tests, 58 pass, 0 fail, 0 skipped**; disposable PostgreSQL database created and removed; `data/design/react-release-integration.log` |
| `python3 scripts/vendor-shadcn.py` | **9 official registry digests and declared adaptations verified** |
| `node scripts/react-smoke.cjs` against loopback 17847 | **17 check groups passed**, 11 document-width checks, no JS/CSP errors; real GET data; injected HTTP failures are local-only |
| `node scripts/react-accessibility.cjs` against loopback 17847 | **14 scanned states, 0 axe WCAG A/AA violations**, 19 visible controls at least 44px high; Select/chart keyboard checks passed |
| `RADAR_RELEASE_URL=http://127.0.0.1:17847 node scripts/react-release-smoke.cjs --injection` | PASS inert hostile thesis/source/context/report and rejected javascript URL; no JS/CSP errors |
| `npm audit --omit=dev --audit-level=moderate` | 0 reported vulnerabilities |
| `node scripts/react-release-smoke.cjs` against real HTTPS | **9 check groups passed**, five further axe states with **0 violations**, real browser chart/tooltip/tab/touch and Bilan interaction, all built-asset SHA-256 matches; `data/design/react-release-production.json` |
| `python3 scripts/react-release-snapshot.py before` / `after` | **Exact equality** of all eight public-table sorted JSONB row fingerprints and counts, DB identity/start/volume/ports, API binding, Caddy hash, DNS IPv4 and complete cron-file/radar-job hashes |
| `git diff --check` | PASS |

The first two loopback hostile-fixture harness runs timed out: Playwright interception disabled cached browser challenge-auth for an unintercepted API request (observed 401). The harness now explicitly supplies Basic only in its in-memory loopback context; the final run passed. No server authentication was weakened. There was no production startup/auth failure during the successful release smoke.

## Deployment and boundaries

Executed only:

```sh
./scripts/compose.sh build api
./scripts/compose.sh up -d --no-deps api
```

No production migration, worker, cron change, data rewrite, Caddy reload/edit, DNS change, demo edit or database restart was performed. The isolated integration test wrote only to its disposable test database. Production API remains bound to `127.0.0.1:17845`; PostgreSQL exposes **no host port**. API and DB Docker health are healthy. Local health returned HTTP 200 / database ok; the latest worker status remains **degraded**, with `worker_stale=false` at the release check. Healthy API is not a claim that quarantined historical data became valid.

The protected October 19 morning backend, compose, existing proxy template and morning schedule documentation have no diff from base `01cd25c8167f5f29c13866f3c0469b9f7a94a937`. Daily and worker remain paused; the existing one-time Monday 19 October 2026 08:55 Europe/Paris resume helper and weekday 09:00 / 09:30 schedules are untouched. Backup/restore jobs are untouched. Before/after guard evidence is private under `data/design/react-release-{before,after}.json`.

Deployed image: `sha256:c277f02951ac94bef503862ac2c1d88828a794b23fec52abc6160453cf13a05e`.

### Built assets verified over authenticated HTTPS

| Asset | SHA-256 (local source build = deployed bytes) |
|---|---|
| `index-JNSGFmyn.js` | `325f2275a46d1bf78416092050ed5b16453543396440c4b284e71c4d3b0144bb` |
| `charts-DnidwJxd.js` | `7a93c66e9d928230dcdee0c7295d3a5fa9decc73cf1d0e58826162d1799f40af` |
| `index-DAmlEa3S.css` | `f3a8f1673fed7d6a7e80bdaf75670013d4e56261975d304da91ea616503c9448` |

Initial JS: 370.59 kB / 118.20 kB gzip; lazy chart chunk: 385.61 kB / 115.74 kB gzip. No external font/CDN/service dependency was added.

## Production screenshots, private and Git-ignored

Captured from authenticated HTTPS at 1440×1000 desktop and 390×844 touch/mobile, without credential UI, traces or session export:

- `data/design/react-production-register-desktop.png`
- `data/design/react-production-chart-desktop.png`
- `data/design/react-production-chart-mobile.png`
- `data/design/react-production-bilan-empty-desktop.png`
- `data/design/react-production-bilan-cohort-desktop.png`
- `data/design/react-production-bilan-mobile.png`

The four desktop/mobile chart and cohort-Bilan captures were opened with vision. No clipping/security/financial-label blocker was seen; mobile tooltip stays within viewport and native EUR / percentages and explicit sample labels remain legible.

## Explicit limitations

- Actual screen reader, Firefox/WebKit, native browser zoom, forced-colors and hardware-device testing **NOT TESTED**. Automated axe plus Chromium keyboard/touch emulation does not establish site-wide WCAG conformance.
- Current historical production data lacks some optional setup/support states. Exact-instrument support overlays and missing/unknown/no-baseline adapters have unit/schema evidence, not manufactured production examples.
- Browser acceptance deliberately fails if the selected live dataset no longer supplies the historical sample states it needs; it derives counts/values from GETs, not hardcoded quarantine totals. More than 500 signals would require paginated fixture discovery in the browser harness.
- Existing worker degradation/quarantines are not repaired or hidden by this UI release. No live worker was run to create visual evidence.
