# Worker repair — independent review and production release

**Deployed 19 October 2026. Verdict: operational repair passed; unresolved material prices are NOT certified.**

Production worker status is **`ok_with_exclusions`**, not fully healthy market data: **60 signals; 24 eligible, 36 excluded = 34 quarantined for unresolved revisions + 2 unknown research assessments**. Of the 24 eligible, 18 have no subsequent closed session yet and six have ten observed sessions. No J30 result exists. This repairs reliable progression, evidence and alert semantics, not the underlying revised prices.

## Independent review

Loaded Engineering Workflows and its immutable-market-evaluations reference. Reviewed the actual diff, migration 002, original guards/grants, shared measurement policy, worker transactions/CLI, API filtering/detail/analytics, React charts/formatting and tests. No blocking integrity/security regression found; no production logic changes were needed during independent QA.

- Original frozen observations alone drive accepted measurements. Revision OHLC is separate append-only evidence with original observation ID/hash, revised hash, archived fetch, classification, decision, policy and provenance.
- Strict cent equivalence retains frozen values; material/ambiguous revisions exclude. Reconstructed legacy conflicts use their actual archived payload and matching numeric hash. A Yahoo reversion cannot clear an unresolved archived material conflict.
- New material revisions produce `partial`, exit 2. Identical known exclusions do not duplicate alerts. Repeated transport, validation and empty-feed failures stay nonzero, rather than becoming accepted exclusions.
- Genuine subsequent bars can append beside an excluded cohort. No J0, original observation, source payload, report or classification is rewritten. Excluded API performance is null; chart adapters and aggregate/checkpoint denominators exclude it. Raw observations/evidence remain inspectable.
- Migration is additive and replayable. Runtime remains non-owner `radar_app`; owner `radar_owner` owns old and new tables. UPDATE/DELETE/TRUNCATE rejection and restricted grants remain enforced. No correction approval or latest-price switch was added.

## Fresh acceptance evidence

| Check | Actual result |
|---|---|
| `npm run build` | PASS backend/frontend TypeScript and production Vite |
| Separate preview build + `python3 scripts/worker-repair-tests.py` | **69 tests, 69 pass, 0 fail, 0 skipped**, newly created isolated PostgreSQL databases removed afterward |
| Novel/repeat/reversion fixtures | First novel exit 2; exact repeat exit 0 with exclusion; further novel exit 2; reversion stays quarantined |
| True failures | Repeated HTTP/transport and empty-feed failures nonzero; listing/currency/OHLC validation fail closed |
| Progress/immutability fixtures | Healthy cohort progresses beside quarantine; missing-session ordinals preserved; pre-maturity and completed cohorts avoid network; original rows unchanged |
| Restored preview Chromium | Nine check groups PASS; five axe states, zero violations; authentication, actual chart points/source/native units, cohort n and empty J30 checked |
| Production HTTPS Chromium | Same nine groups PASS; five axe states, zero violations; no browser JS/CSP errors; authenticated module/CSS bytes equal reviewed build |
| Production revision UI | AAPL two revision blocks linked to ten original observations, explicit unresolved exclusions and policy, null performance, no admissible chart |
| Production API checks | `eligible=true` 24 / `eligible=false` 36; all excluded performance null; provenance links valid; J30 n=0, means/medians null, rate denominators=0/rates null |
| Runtime live authorization probes | 19 denial checks PASS: UPDATE/DELETE/TRUNCATE of six history/evidence tables and split-approval insert; each probe enclosed in rolled-back transaction |
| Source parity | All 39 files under `src/`, `frontend/`, `migrations/` hash-match inside **each** API/worker/migration image |
| `git diff --check` | PASS |

Screenshots were actually opened: production register with 24/60 eligible and 36 exclusions, empty-J30 Bilan, expanded revision evidence. Auth checks include anonymous/invalid credentials 401 on pages/assets/read APIs; public HTTPS health remains 403. The release harness now selects an eligible **observed** signal for chart tests instead of mistaking a new immature signal for missing chart data.

A supplemental revision-browser harness initially timed out on direct-detail Chromium challenge-auth (API requests 401), then hit an ambiguous selector matching two evidence cards. Ordinary dashboard-first authentication and the precise section selector fixed the harness; the final run passed. No server/auth policy was changed. The full existing HTTPS suite passed independently.

## Mandatory backup/restore and immutable-row proof

Before production migration: fresh custom-format backup `data/backups/20261019T082011Z.dump`, **14,351,597 bytes**, SHA256 **`4ffaf7588cf45ff666b77b18ba7ae5c6b7a44c49df1afce9b705742047a752e9`**. Actual isolated restore `radar_restore_20261019082014` succeeded and was removed: 3 runs, 60 signals, 400 observations, 3240 fetches, 60 derived performance rows, 0 split audits, 207 worker runs.

Full canonical original rows were captured privately before migration and compared **by ID and entire row** afterward, permitting only legitimate additional observations. Results are exactly unchanged:

| Original immutable table | Rows before/after | Canonical JSON SHA256 before = after |
|---|---:|---|
| `radar_runs` | 3 / 3 | `a1a1b91188361b5a815b6997bd4c559f299f59549cae5e8d6b0ebd0d7b4bf4b9` |
| `radar_signals` | 60 / 60 | `655efa1e6b6fd92a063771ccc2711148f1610b79d4c341029dd3e3deea98f2f5` |
| `price_observations` | 400 / 400 | `a21b74f82302885e4aa848d9a45b5202256149735e91b0eaa2970d3a69339185` |

No new closed session was due; zero new live observation rows is correct. Fixture integration demonstrates real append/progression behavior without fabricated production bars.

## Deployment and real worker runs

Executed using the original Compose project/environment and non-destructive runbook:

```sh
./scripts/compose.sh build api worker migrate
./scripts/compose.sh run --rm -T migrate
./scripts/compose.sh up -d --no-deps api
./scripts/compose.sh run --rm -T worker  # first fair batch
./scripts/compose.sh run --rm -T worker  # coverage/repeat batch
```

Migration read-back: both evidence tables owned by `radar_owner`; four immutable/truncate triggers present. Live mutation-denial probes passed as actual API runtime identity `radar_app`.

| Production worker run | Status | Actual exit | Selected/processed | New/unexpected | Known exclusions in batch |
|---|---|---:|---:|---:|---:|
| `b31b8ae7-25b5-48f9-8f68-644f05a137d7` | `ok_with_exclusions` | 0 | 50 / 50 | 0 / 0 | 26 |
| `b13eb7bb-03b7-484e-baff-e582f8585bce` | `ok_with_exclusions` | 0 | 50 / 50 | 0 / 0 | 25 |

All 60 signals have `calculated_at` at/after the first run start, proving whole-cohort coverage across fair batches. Both global summaries: 60 total, 24 eligible, 36 excluded, 0 completed. `remaining=10` means outside a selected batch, **not ten unresolved repairs**. Twenty immature selected signals include the two unknown assessments; eligibility and maturity are distinct.

Production already contained the old worker's archived conflicts, so these new production runs encountered **no novel issue**; do not claim a live first-run exit 2. Novel-first/known-repeat behavior was independently exercised in the fresh PostgreSQL suite, and the restored preview handoff also recorded a real novel issue. Final live evidence: **68 price revisions = 6 cent-precision/retain-frozen + 62 material/exclude; 0 worker issues; 34 quarantined + 26 active derived tracking statuses**. Two of those active statuses are nevertheless excluded unknown assessments by the shared policy.

Local health: HTTP 200, database ok, fresh last worker `ok_with_exclusions`, empty error list, `worker_stale=false`. API and DB Docker health healthy; this does not certify the excluded data.

### Exact deployed image identifiers

- API (also read from running container): `sha256:8eb0aca175db3f39b523a0f6157c4dd176fb163f34c08461796435af5c833c6b`
- Worker: `sha256:3e5623961257c00f7e3949c6dcc827db8c543fae1cd923f552c69895994da601`
- Migration: `sha256:d08cde1b81166fcfd52c0d3f260a1a42c30e35bc22ad79e335d718f79805a150`

Metadata differs between service images; reviewed application-source hashes are identical. No build/restart of DB, Caddy, demo or other services. DB container/start/volume/private ports, API loopback binding, Caddy configuration hash, DNS and complete cron-file/radar-job hashes all match the pre-deployment guard. No model/provider configuration, scheduler, job state or daily report was changed/run. Runtime and restored preview contain no owner/provider credential; actual DB identity is non-elevated `radar_app` in each.

Private ignored evidence: `data/worker-repair-release-{before,after,runs,api,images}.json`, `data/design/react-release-production.json`, production screenshots including `worker-repair-production-revisions.png`. New durable helper: `scripts/worker-repair-release-guard.py`; existing release browser harness received only eligibility/observed-sample selection fixes. No private data, credentials, dumps or screenshots belong in Git.

## Monitoring contract for parent to apply (not changed here)

Keep enabled weekday **09:00 daily analysis and 09:30 tracking, Europe/Paris**, exactly once each. Do not rerun the daily LLM/report, alter model settings, schedules, budget or material-price approval policy.

- Execute deterministic worker once and retain actual CLI exit/result/run ID; verify the exact resulting worker row/health and its freshness.
- Accept `ok` **or** `ok_with_exclusions` with exit 0, finished run, empty `errors`, `new_failures=0`, `unexpected_failures=0`. Report exclusions explicitly; never demand `status=ok` alone or call excluded cohorts repaired.
- `partial`/exit 2 = alert with new vs unexpected counts and evidence IDs. `failed`/exit 1 = failure. `running`, `skipped` or stale last result are not completed-success evidence. Repeated unexpected errors must stay visible/nonzero; no reset or auto-approval to make green.
- Report global total/eligible/excluded/completed separately from batch selected/processed/known exclusions/immature/remaining. Do not interpret `processed` as eligible or `remaining` as a repair backlog.
- Do not add repeated automatic runs merely to clear a novel alert. Confirm new evidence and let the next scheduled run distinguish a stable known exclusion from a recurring unexpected outage.

**Remaining:** 34 materially revised cohorts still need independent authoritative evidence before any separately reviewed append-only correction decision. Eighteen eligible new signals remain immature; all J30 results/rates are unavailable. Browser coverage is Chromium desktop/mobile emulation, not a cross-browser or full accessibility certification. The historical worker-cron prompt still has the obsolete require-`ok` contract: parent owns updating monitoring only, while preserving both enabled Paris schedules.
