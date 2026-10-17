# React / shadcn migration — implementation handoff

Status: implemented and locally verified, **not committed or deployed**. Independent parent review remains required. Base HEAD remains `01cd25c8167f5f29c13866f3c0469b9f7a94a937`.

## Delivered

- Recovered the interrupted Vite/React work rather than replacing the existing morning backend. Genuine React + TypeScript + Tailwind v4, with official shadcn Button, Input, Select, Tabs, Table, Card, Dialog, Badge and Chart sources. Radix supplies the behaviors; Recharts supplies the real charts.
- Warm paper / graphite / citron « Carnet de conviction ». Signaux, Bilan and Méthode remain French, read-only, responsive and URL-addressable.
- Global case-insensitive company/ticker search, all existing filters, server-side sorting, real pagination, essential/checkpoint columns, density, query-preserving signal detail and keyboard return-focus restoration.
- Detail preserves original catalyst/thesis/risks/invalidation, optional immutable setup/listing/support/alert data, sources, frozen report, checkpoint/target/drawdown measures and excluded raw audit history.
- Actual J0 plus stored observations, price/return tabs, straight line segments, explicit null gaps, no smoothing or generated samples. Excluded signals have no chart. Tooltips include original dates, native currency and fetch provenance; keyboard and touch interaction work. Small-screen tooltips are anchored inside the chart to prevent clipping.
- Bilan has real checkpoint mean bars and each cohort's own n/median, with an accessible table of every qualification. Absent cohorts do not become zero bars. J30 defaults to an explicit insufficient-data state when appropriate. EUR/USD remain separately disclosed; percentage averages are not portfolio returns.
- Charts are lazy-loaded: final local build reported initial JS 370.59 kB / 118.20 kB gzip and charts 385.61 kB / 115.74 kB gzip. No chunk-size warning remains. No remote fonts, CDN or paid service.

## Source provenance and security

`frontend/components/ui/PROVENANCE.json` records official `ui.shadcn.com/r/styles/new-york-v4/` registry URLs and SHA-256 digests. All downloaded files were inspected; no remote installer was executed. The original MIT license is retained in `frontend/components/ui/LICENSE.md`.

Declared local vendor adaptations: Dialog button import and French close label; Table scroll-region keyboard access. Project theme is CSS, and the accessible Select wrapper is separate from the vendor source. `python3 scripts/vendor-shadcn.py` verifies every digest and these exact adaptations without overwriting or executing downloaded code. All nine sources passed verification.

The backend serves only built asset names from a preloaded allowlist, behind the existing authentication. CSS is inlined to preserve the exact existing CSP; scripts remain authenticated same-origin modules. No `unsafe-eval` or inline scripts. The only business-query change is a read-only LEFT JOIN adding original observation fetch source/time; immutable tables, metrics, worker and quarantine behavior are unchanged. A failing regression test was recorded before wiring the React asset route and before correcting the provenance join.

No credentials were put into page scripts, URLs, traces or screenshots. Actual configured IR credentials were scanned in 66 source/test/script/build files: no matching file. Production dependency audit: zero reported vulnerabilities. Build before tests is required because server/dashboard tests exercise the built frontend.

## Real verification

| Command | Result |
|---|---|
| `npm run build` | PASS backend TypeScript, frontend strict TypeScript and Vite production build |
| `NODE_ENV=test npm test` | 57 passed, 1 intentionally skipped (DB integration outside isolated DB), 0 failed |
| `./scripts/compose.sh build migrate && ./scripts/integration.sh` | **58 passed, 0 skipped, 0 failed**, real isolated PostgreSQL; final log `data/design/react-integration.log` |
| `node scripts/react-smoke.cjs` | **17 check groups passed**, real authenticated data, 11 document-width checks without overflow, no JS/CSP errors |
| `node scripts/react-accessibility.cjs` | **14 scanned states, 0 axe WCAG A/AA violations**; 19 visible controls at least 44px high; keyboard Select and chart tooltip checked |
| `python3 scripts/vendor-shadcn.py` | 9 official sources/digests/adaptations verified |
| `git diff --check` | PASS |
| `npm audit --omit=dev --audit-level=moderate` | 0 vulnerabilities reported |

Browser checks cover search NVDA/nvda/Nvidia, global sort, pagination without duplicates, quarantined filters and suppressed returns, invalid dates/reset, real line point count, price/return switching, source/date/currency tooltip, mobile touch tooltip bounds, frozen report, quarantined no-chart audit view, actual cohort bars/n/median, absent J30 chart, native-currency tables, method archive, local-only injected 401/400/429/500 plus real retries, and aborted stale requests. Dialog Escape and query-preserving keyboard return focus were exercised.

The current live-data evidence selected AIR automatically and verified ten stored observations plus J0. This is an observation in private evidence, **not an application constant**. Cohort J5 currently has an actual Orange sample; no color comparison was invented. Tests derive counts from authenticated GETs and do not assume historical quarantine totals.

During verification, failures actually reproduced and fixed: malformed partial JSX/import; incorrect nested currency-aggregate shape; missing tab panels for a column toggle (now honest pressed buttons); a non-semantic chart label; non-keyboard-scrollable mobile tables; focusable background during Radix Select; and tooltip overflow on resize. The final evidence files are the passing reruns, not earlier iteration output.

## Preview for independent review

A read-only, loopback-only preview is running on **port 17847**, separate from the older preview on 17846 and production on 17845. Basic username `radar`; existing read key is loaded programmatically from `~/.hermes/.env`, never copied into commands. PostgreSQL sessions enforce `default_transaction_read_only=on`.

Reproduce from the repository:

```sh
npm run build
NODE_ENV=test RADAR_PREVIEW_PORT=17847 npm exec -- tsx scripts/design-preview.ts
```

Open loopback port 17847 at `/dashboard`. Start the command silently in background only for a continuing preview; check `/health` separately. The scripts default to port 17847 and accept `RADAR_PREVIEW_URL`. They use existing cached Playwright/Chromium and the previously extracted ignored `data/design/package/axe.min.js`; environment overrides are supported. No application dependency was added for browser tooling. The smoke deliberately waits one rate-limit window before its error-state phase; do not weaken application protections to shorten it.

## Evidence (private and Git-ignored)

All under `data/design/`:

- `react-browser.json`, `react-accessibility.json`, `react-integration.log`.
- `react-register-desktop.png`, `react-register-mobile.png`.
- `react-chart-tooltip-desktop.png`, `react-detail-mobile.png`.
- `react-bilan-empty-desktop.png`, `react-cohort-bars-desktop.png`.
- `react-bilan-desktop.png`, `react-bilan-mobile.png`, `react-method-mobile.png`.
- Every screenshot also has a `-viewport.png` first-screen/scroll-position companion.

Desktop/mobile register, actual line tooltip, corrected touch tooltip, actual cohort bars and empty-J30 captures were opened visually, not merely generated.

## Files

- New/recovered `frontend/`: entry, application, charts, presentation adapters, accessible Select wrapper, theme, TS config, nine attributed shadcn components and provenance/license.
- `vite.config.ts`, `package.json`, `package-lock.json`, `Dockerfile`: reproducible frontend/runtime build.
- `src/dashboard.ts`, `src/app.ts`: authenticated built frontend and read-only observation provenance.
- `tests/dashboard.test.ts`, `tests/charts.test.ts`, `tests/react-dashboard.test.ts`: server/asset/CSP and chart-data regression tests.
- `scripts/react-smoke.cjs`, `scripts/react-accessibility.cjs`, `scripts/vendor-shadcn.py`: reproducible acceptance/accessibility/provenance checks.
- This handoff. Original design/audit documents remain historical and unchanged. Legacy vanilla dashboard files remain unused except shared `src/dashboard/format.js`; the served dashboard is React, not the legacy renderer.

## Preserved boundaries and remaining checks

- **No deployment, commit, push, production restart, Caddy edit, demo, scheduler change or cron resume.** Morning cutoff effective October 19, 2026, remains intact; old historical cutoffs in original reports remain correct for their dates. No immutable row was altered. The integration database was disposable and cleaned up by the existing script.
- Independent parent code/design review and eventual HTTPS/auth smoke after any separately authorized deployment remain outstanding.
- Not tested: actual screen reader, native browser zoom, Firefox/WebKit. Automated axe and keyboard tests do not certify WCAG conformity.
- Optional support overlays and unknown/missing/no-baseline data adapters are covered by unit/schema tests; the actual historical browser data does not contain all those new optional setup states. No live payload was retrofitted to manufacture them.
- The Select wrapper intentionally makes the application root inert while its portalled menu is open; retain the keyboard/focus and axe regression checks when upgrading Radix.
