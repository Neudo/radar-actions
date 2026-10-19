# Deterministic worker repair — 19 October 2026

## Implementation handoff (historical pre-release snapshot)

**Release update:** subsequently independently reviewed and deployed on 19 October 2026. See `docs/WORKER-REPAIR-RELEASE.md` for fresh backup/restore, production worker results, integrity proof and remaining exclusions. The remaining sections record the implementation handoff before that release.

At handoff, implementation and isolated PostgreSQL verification were complete. **No commit, production migration, production image rebuild, API restart, cron edit, model/provider change or public exposure had been performed.** HEAD was `f4819086d189684909a7fe951deeed2dba4c9b02`.

This repairs the worker's evidence/state/health model; **it does not pretend that Yahoo's material historical revisions have been resolved**. The conservative policy keeps those cohorts excluded. Do not describe this as recovering all quarantined performance.

Authenticated local preview: `http://127.0.0.1:17848/dashboard`, existing Basic user `radar` / local `IR_READ_KEY`. Container `investment-radar-repair-preview`, isolated restored database `radar_test_repair_preview_20261019081303`. Only loopback is published. Runtime DB identity was read back as `radar_app`, table owner `radar_owner`; the preview container has neither `IR_DB_PASSWORD` nor unrelated Hermes/provider credentials. Ports 17846/17847 were already occupied and were left untouched.

## Reproduction and source evidence

Read `src/market.ts`, `src/worker.ts`, `src/db.ts`, `src/core.ts`, API/query/chart adapters, migration/permissions/runbooks and `docs/fix-2026-10-06.md` before changing code.

One execution of the **unchanged deployed worker** against production:

```sh
./scripts/compose.sh run --rm -T worker
```

Run `882be2f4-2243-4240-b600-dfb0eac6b83d`, 19 October 2026, returned exit **2**, `degraded`, **26 processed and 24 errors in the selected batch of 50**. Whole database: **60 signals, 400 observations, 26 active / 34 quarantined**, not an assumed/hardcoded historical “44 errors”. Batch errors are not the whole-cohort count.

Compared actual Yahoo archived fetches (latest timestamps 07:31–07:51 UTC in the production inspection), their listing/currency/events metadata and frozen OHLC. Sanitized detailed local evidence: `data/worker-repair-evidence.json` (58 changed-bar comparisons across 34 signals; includes changes that the existing precision rule accepts).

| Category | Actual evidence | Decision |
|---|---|---|
| Listing / currency | AAPL/AMD/etc `NMS`, TSM ADR `NYQ`/USD, Paris listings `PAR`/EUR; source symbols match the tracked symbols in inspected conflicts | Not an FX/listing conversion. New worker enforces symbol, venue and currency before appending bars. |
| Precision | 5 October NVDA HIGH `240.09829711914062` → `240.10000610351562`; PLTR HIGH `192.6898956298828` → `192.69000244140625`; XOM LOW `161.39320373535156` → `161.38999938964844` | Retain the frozen value, classify strict existing cent-equivalence, archive revised version. No broader tolerance. |
| Material native-unit changes | 5 October BKNG OPEN `158.2899932861328` → `158.6699981689453`; AMD OPEN `630.3400268554688` → `630.6099853515625`; MSFT LOW `521.530029296875` → `521.469970703125` | Exclude. Matching units do **not** prove which value is correct. |
| Precision boundary | AVGO HIGH `363.864990234375` → `363.8699951171875` | Still excluded: crosses the strict rounding boundary; not silently promoted to precision. |
| Later real revisions | 16 October AIR.PA HIGH `200.35000610351562` → `200.39999389648438`; KER.PA HIGH `217.1999969482422` → `217.5` | Material, not a cure from the 6 October tolerance patch. |
| Dividends | JPM has a post-cutoff dividend event of 1.65; its 5 October HIGH/LOW changes are not a common dividend scaling. Other material examples have no post-cutoff dividend | Keep price returns based on `quote` OHLC. Do not mix in `adjclose`, dividends, FX or total return. Event presence is provenance, not correction approval. |
| Splits | No split event in the inspected conflicting source samples | No automatic split approval. New/known split hashes remain excluded until the existing administrative split audit exists. |
| Historical reversion | Archived 5 October NVDA OPEN `236.08999633789062` → `236.07000732421875`, PLTR OPEN `189.4499969482422` → `189.14999389648438`, META OPEN `727.7100219726562` → `727.35498046875`; some later feeds return to original opens | A reverted current response is **not** an audited resolution. Read the original conflict's archived fetch, not just today's feed. |

No independent evidence establishes an authoritative corrected OHLC for the material changes. Uniform split/dividend normalization would be unjustified: changes are field-specific and often leave CLOSE unchanged. Therefore no material-price auto-acceptance or correction CLI was introduced.

## Actual root causes

1. The earlier cent fix handled only precision equivalence; genuine multi-cent OHLC revisions remained.
2. Each identical, already-audited revision threw a fatal worker error again, regardless of novelty.
3. Worse, the old worker looked only at the current response: an old material conflict could disappear from the feed and silently become active again even though its audit remained unresolved.
4. Its exception upsert did not refresh existing metrics, so excluded metrics could stay stale even when genuine subsequent observations had been appended.
5. Eligibility was mostly presentation/status based. There was no versioned revision decision/provenance layer shared with the API, and pre-first-session signals unnecessarily fetched historical prices.

## Explicit accepted-view policy: `frozen-first-v1`

- J0 payload/report/tag/source quote/price remain immutable. Every existing observation and archived fetch stays append-only. No overwrite/delete/truncate/backfill of predictions.
- Accepted measurement inputs are **only the original frozen observations**, in their original native price basis and original session ordinals. A revision is separate evidence, never a replacement row.
- Strict pre-existing cent-equivalence gets `cent_precision` / `retain_frozen`: same supported currency, session/ordinal/basis, same cent, strict delta below half a cent and a recognized decimal/float32-cent endpoint. Original values/hashes still drive calculation.
- Every other reproducible same-unit revision is `material` / `exclude`; unreproducible or unverified legacy evidence is `ambiguous` / `exclude`. Same units alone do not authorize replacement.
- Archived material conflicts remain exclusionary even if the latest response reverts. Legacy conflicts are classified against their **actual archived fetch**, and the reconstructed numeric hash must match the original conflict's `new_hash`.
- New genuine subsequent observations can still be appended for an excluded signal, and unaffected signals continue independently. Excluded metrics are refreshed internally for audit, but API `performance` is null and charts/aggregates omit them.
- Missing individual expected sessions preserve their ordinal, remain explicitly excluded, and recover only when real bars exist. An entirely empty closed-bar feed, malformed OHLC, listing/currency mismatch, HTTP/transport or SQL error is unexpected and remains nonzero on **every** retry.
- Completed 30-session signals stop fetching. A 30-session cohort already quarantined by unresolved revision also stops network collection while retaining its exclusion. Before the first closed session + one hour, no market fetch is needed; metrics remain immature/null.

## Additive schema and permissions

`migrations/002-worker-evidence.sql` is idempotent and additive:

- `price_revisions`: original observation reference, old/new hashes, immutable revised OHLC when reconstructable, fetch reference, classification, decision, policy and event/listing/currency provenance. Unique `(observation_id,new_hash)` prevents retry duplication. Each version links to the unmodified original.
- `worker_issues`: split/missing issue fingerprints and evidence, unique per signal/kind/fingerprint; no per-fetch duplicate alerts.
- `worker_runs.summary`: explicit scope, batch/global counts, eligible/excluded, immature/completed, new/known/unexpected counts.
- UPDATE/DELETE/TRUNCATE rejection triggers protect both new evidence tables; original guards are unchanged. Runtime receives only SELECT/INSERT there, no ownership and no split approval rights. Only performance/worker summaries remain mutable derived state.

`src/migrate.ts` runs the new file and adds runtime grants. **Production `price_revisions` and `worker_issues` were read back as absent after this work**: migration was exercised only in disposable databases.

## Worker/API/UI contract

- `ok`: attempted work succeeded, no exclusions in the whole selected run type.
- `ok_with_exclusions`, exit 0: successful processing **with explicitly counted excluded cohorts**, not a clean-data assertion. Identical known revisions/split issues/gaps do not become new outages.
- `partial`, exit 2: at least one newly recorded material revision/split/gap or unexpected signal failure. Unexpected errors remain nonzero on repeated retries.
- `failed`, exit 1: run-level failure; `skipped` is a lock result, not completed work.
- Errors are new/unexpected items; known exclusions are independently counted, not erased. `processed` means a signal's processing/evidence update completed, **not** that its performance is eligible.
- `summary.total/eligible/excluded/completed` refer to all signals of the run type; selected/processed/known_exclusions/immature refer to this fair batch (limit 50). `remaining` is outside the batch, not a count of unresolved repairs.
- Shared `src/measurement.ts` policy gates filtering, sorting, exposed performance, analytics and worker summary counts. `eligible=false` now genuinely filters excluded records.
- Signal detail exposes `source_data`, `measurement_eligible`, `measurement_policy`, `revisions`, original conflicts and all original observations. Excluded `performance` is null. React labels exclusions, displays revision evidence, and recognizes partial/with-exclusions worker statuses. It does not plot excluded raw observations or present immature J30 as 0%.

Example verified AAPL `source_data`: policy `frozen-first-v1`, accepted view `original frozen observations only`, eligible false, exclusion reason `Provider revised frozen observation; quarantined (unresolved archived evidence)`. API returns `performance: null`, while retaining **10 raw observations and 2 revision versions** for audit. This is transparent exclusion, not a corrected return.

## Tests and real execution

**TDD RED before production code:** added the exact known-quarantine retry assertion to the existing real PostgreSQL/CLI integration test; old worker still exited 2. Suite: 57 pass / 1 fail / 0 skips. Separate chart/format RED tests proved an explicit backend exclusion must suppress even an apparently active signal's curve/return. An empty-feed RED test caught the distinction between a repeat known gap and a genuine empty-feed outage.

**Final GREEN:** `npm run build`; separately tagged Docker image builds; `python3 scripts/worker-repair-tests.py`: **69/69 pass, zero skips**, including original real-calendar/30-session/CLI integration and 11 additional isolated PostgreSQL cases. Cases cover known/novel/reverted and legacy revisions, precision, frozen provenance, dividends/adjusted close isolation, gaps/recovery, repeated HTTP failures, empty feed, currency/listing/invalid OHLC, split audit/retry, pre-first-session immaturity, completed stop-fetch, healthy progress alongside quarantine, migration replay, and non-owner mutation/approval denial. Synthetic OHLC/calendars are explicitly labeled fixtures and exist only in newly created/dropped `radar_test_*` databases.

**Real production-data restore, runtime role, real Yahoo, actual worker CLI** (not fixtures): source backup restored and migrated in `radar_test_repair_preview_20261019081303`; three fair worker batches:

| Run | Result | Exit | Selected/processed | New issues | Unexpected |
|---|---|---:|---:|---:|---:|
| `3bb475d9-dda8-4042-898e-2774084f586e` | partial | 2 | 50 / 50 | 1 | 0 |
| `027cd1a6-0337-46a2-8ec2-865c8253e9f7` | ok_with_exclusions | 0 | 50 / 50 | 0 | 0 |
| `bba81892-eefc-4349-8d78-82b2a568228b` | ok_with_exclusions | 0 | 50 / 50 | 0 | 0 |

The restored backup predates the production reproduction: the first preview batch legitimately discovers one revision not yet present in that snapshot, rather than hiding it. Subsequent identical retries do not create new alerts. Preview contains **68 revision versions: 6 precision / retain-frozen, 62 material / exclude**. Global result: **24 eligible, 36 excluded of 60** = **34 quarantined + 2 unknown-research assessments**. The 24 eligible include **18 today's signals with zero subsequent closed sessions**, so eligibility is not maturity or evidence of return. Six eligible historical signals have ten observed sessions; no signal has 30. All **J30 n=0, means/medians null, target-rate denominator 0 and rates null**. No new market session was due during these morning checks; observation count correctly remains 400. Fixture integration proves actual subsequent-session progress without inventing live data.

Read-back checks: preview health reflects `ok_with_exclusions`; authenticated dashboard/detail/bundle HTTP 200, unauthenticated dashboard/bundle 401. API counts and source-data evidence checked separately. No browser pixel/accessibility audit was claimed; parent can independently review the running UI.

## Backup and immutable-row proof

Before live reproduction: real custom-format dump `data/backups/20261019T075046Z.dump`, 14,345,140 bytes, SHA256 `b0c3b00ec9040a6ac3026e06ca6e258c509d6747f731a8780e128bcbe15a609f`. `scripts/restore-drill.py` actually restored it in an empty isolated DB and verified counts: 3 runs, 60 signals, 400 observations, 3238 source fetches, 60 derived performance rows, 0 split audits, 206 worker runs. This was a restore, not just an archive listing.

Full canonical JSON row SHA256 before/after restoration+migration+worker, also independently matched against production after the one old-worker reproduction:

| Immutable table | Rows | Same SHA256 before = after |
|---|---:|---|
| radar_runs (entire payload/report included) | 3 | `a1a1b91188361b5a815b6997bd4c559f299f59549cae5e8d6b0ebd0d7b4bf4b9` |
| radar_signals (entire row/source/tag/price included) | 60 | `655efa1e6b6fd92a063771ccc2711148f1610b79d4c341029dd3e3deea98f2f5` |
| price_observations (entire original rows) | 400 | `a21b74f82302885e4aa848d9a45b5202256149735e91b0eaa2970d3a69339185` |

The preview script also compares every original row by ID, allowing only genuine additional observation rows, never missing/changed originals. Local, git-ignored evidence: `data/worker-repair-preview.json`, `data/worker-repair-production-integrity.json`, `data/worker-repair-api-verification.json`, `data/worker-repair-evidence.json`.

## Reproduce locally without deploying

```sh
npm run build
docker build -t investment-radar-worker-repair-preview .
python3 scripts/worker-repair-tests.py
# A real backup must exist, with its verified .json checksum manifest:
python3 scripts/worker-repair-preview.py data/backups/20261019T075046Z.dump --serve --port 17848
# Once finished reviewing (removes ONLY the recorded preview container/database):
python3 scripts/worker-repair-preview.py --stop
```

The current preview already occupies 17848. Stop it first before creating another. `--serve` preflights the port before any restore, isolates grants to the preview DB, never changes role passwords, and grants no owner secret to runtime. Initial failed preview attempt encountered occupied 17846; that attempt's temporary DB was subsequently removed. Test cleanup deliberately does not force-drop live connections (FORCE raced Node/pg's socket shutdown during development).

## Parent review and deployment — still pending

1. Independently review policy and SQL/UI boundaries. Explicitly acknowledge that **34 ambiguous material-revision signals remain unresolved**, not repaired prices. Verify `git diff --check` and rerun the isolated suite.
2. Before production additive migration, make a **fresh** backup and real restore drill; capture fresh immutable-row hashes/IDs. The earlier backup is evidence, not authorization to skip a fresh deployment backup.
3. Only after approval: build actual `api`, `worker`, `migrate` service images; run migrations as owner, then restart **only API** with `--no-deps`. Worker is one-shot, not a continuously running service. Read back schema/grants, runtime non-ownership/guards, API policy/counts, original hashes and source reports.
4. Parent owns whether/when to execute the first new production worker. Expect `partial`/exit 2 if a genuinely novel issue appears; do not reset conflicts, approve splits, or manufacture observations to force green.
5. Parent must align the existing monitoring/agent success condition with this status contract. The repository's old `prompts/worker-cron.md` still says “require status=ok” and mentions obsolete every-30m scheduling; it was deliberately **not edited or applied**. Keep actual existing schedules **weekday daily analysis 09:00 and tracking 09:30 Europe/Paris, once each**; no extra cron run or job-state edits were performed here.
6. Material revision acceptance would require a separately reviewed append-only correction decision with independent authoritative evidence, entry-basis validation and recalculated/clearly labeled accepted-view results. It is intentionally **not** an unaudited “use latest Yahoo” switch in this repair.
