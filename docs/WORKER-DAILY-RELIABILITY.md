# Daily worker reliability — 21 October 2026, implementation handoff

**Historical handoff below. Superseded operational status:** independently reviewed and deployed on 21 October 2026; notification integration is implemented and verified, including live first/repeat invocation. A real empty single-day supplemental endpoint was found during deployment and corrected by bounded preceding context, without relaxing empty/malformed failure handling. Current evidence and parent-only resume requirements: `WORKER-DAILY-RELEASE.md`. Yahoo's missing close remains missing; this is not a data cure.

**Not deployed, not committed, worker remains paused.** Base HEAD: `bdc3ccbd0f3bd6c691f7b215586b3875c3669440`. No scheduler/job/model/secret configuration changes; weekday analysis at 09:00 and worker at 09:30 Europe/Paris are unchanged. Only separately tagged `investment-radar-worker-daily-preview` images and isolated databases were built/exercised.

**Verdict: daily coverage and truthful collection-state repair verified; Yahoo's missing 20 October Paris closes are NOT repaired.** Do not call this fully green or re-enable the existing failure-notification path unchanged. A notification-contract integration remains for parent review (see below).

## Evidence before editing

Actual clock: `2026-10-21T07:33:10+00:00` (09:33:10 Paris). Production was inspected read-only; no production worker was invoked.

Latest production run `3dd5461e-235a-40a7-9396-58112465347c`, 07:30:57–07:31:41 UTC: `partial`, 45 processed / 50 selected, global 100 signals, 51 eligible / 49 excluded, 20 immature, remaining 50; four new missing-session issues, five unexpected empty-selection failures. Its errors were not the previous material-revision alert category.

| Error | Exact affected listing(s) | Immutable cutoff(s) | Actual unavailable session |
|---|---|---|---|
| Four new `Missing closed trading session` | RMS.PA, KER.PA, TTE.PA, MC.PA | 3 October, 15:45 UTC | 20 October |
| Five `No valid closed bars from provider` | KER.PA, MC.PA, TTE.PA, RMS.PA, AIR.PA | 19 October, 07:00 UTC | 20 October, their first subsequent session |

The four signal IDs are `9eadcfe6-f4b8-4534-846d-67ae8f570a8d`, `ba0eef7b-a9fa-48cf-9f41-5a7d79396262`, `dc28a0d9-6e09-48e6-87c7-93405e978421`, `e9a8e5dd-3670-463c-9737-085cadee2bbb`. The five are `281c89b2-a97a-4fc7-a246-922ad19a7673`, `2ab81101-e553-41e5-9660-f6dcdf710afd`, `7800018e-eba0-4b88-9d4b-2260859aab2c`, `97a84c6c-b91b-4cdb-a06f-281e675226ef`, `9ccb5b90-fdca-457e-9339-143682c22c8b`.

All five archived Paris `range=6mo&interval=1d` responses contain **131 timestamps**, timezone `Europe/Paris`, valid earlier history, timestamp **20 October 07:00 UTC with all four OHLC null**, and a separate live 21 October bar. Exchange calendar closes 20 October at **15:30 UTC**, so it was due after the existing one-hour grace at 16:30 UTC. It was not a weekend, market closure, timezone shift, pagination truncation or an immature 20 October session. The cache entries were freshly fetched at 07:31 UTC, not stale days-old data.

One bounded live diagnostic compared two MC.PA endpoints, archived verbatim in `data/daily-reliability-live-diagnostic.json`:

- Same six-month endpoint reproduced the all-null 20 October row.
- Explicit `period1=1792368000&period2=1792540800` (19 October 00:00 UTC through exclusive 21 October 00:00 UTC) returned two rows. The 20 October row had OPEN `387.1499938964844`, HIGH `388.6499938964844`, LOW `384.45001220703125`, but **CLOSE null**. Those partial fields resembled the live next-day row; this does **not** establish a valid completed historical bar or justify shifting timestamps. A narrower window alone did not recover a usable close.

The raw latest archived responses are preserved in `data/daily-reliability-provider-evidence.json`. No paid/alternate provider was added, and no absent value was replaced with zero, a previous close, a current-session quote or a forced quarantine approval.

## Root causes and corrections

1. **Provider availability versus selection conflated.** `selectBars` correctly omitted null OHLC, but `!bs.length` was treated as a total provider outage even when the full response was populated and only the first due session was unavailable. Now unavailable completed sessions become retryable `pending_data`. A genuinely empty response or entirely null/unusable OHLC history, HTTP/transport failure, missing/truncated OHLC structure, invalid timestamp/number, impossible OHLC or listing/currency error remains unexpected and nonzero on every invocation.
2. **Fifty per invocation was still fifty per day.** A bounded daily snapshot (maximum 10,000 candidates) is processed in batches of 50, exactly once per candidate, under the existing advisory lock. It is ordered by least-recent calculation, then cutoff/id. A 20-minute budget is checked between candidates; a cap/deadline breach reports `partial`, remaining coverage and exit 2. No scheduler repetition or intraday automatic rerun is introduced. One in-flight provider/calendar operation can outlast the budget check by its existing bounded timeout/retries.
3. **Repeated retrieval per cohort.** Run-local promises cache successful AND failed primary fetches by listing, calendars by exchange/cutoff, and supplemental history by listing/window. Shared provider failure remains visible for every affected signal without repeatedly requesting it. New requests are paced at least 300ms apart; existing bounded HTTP retries remain.
4. **No bounded historical recovery attempt.** For an actually absent due session not supplied by a frozen observation, production may make one supplemental explicit-period request per listing/window, with an exclusive end one day after the last due session, bounded to 120 days. Its cache includes the exact source/window, preventing a short history response from poisoning the full-history/minute cache. Only actual complete validated bars fill missing positions. Valid primary bars are not replaced. Listing/currency/split basis is checked. Every appended bar and any revision retain their actual source fetch (including supplemental revision provenance, regression-tested). This is a recovery mechanism, **not evidence that Yahoo's current incomplete Paris close is recoverable**.
5. **Invalid numeric OHLC silently looked absent.** Null/undefined means unavailable; non-null invalid numeric values fail structurally. Daily dates use exchange timezone metadata instead of blindly slicing UTC. Duplicate daily sessions fail closed. Calendar implementation and J0 quote/cutoff policy were already correct and are unchanged.

The entire cutoff session remains excluded, including morning cutoffs: a 19 October signal first evaluates 20 October; a 20 October signal has no subsequent closed session by the morning of 21 October. Thus 40 Tuesday/Wednesday cohorts are correctly immature and perform no market fetch. This change does not reinterpret J0 or invent same-day evaluations.

## Status, eligibility and notification contract

- `ok` / `ok_with_exclusions`, exit 0: completed processing, no collection pending or unexpected failures. Existing material/split exclusions remain explicit, not resolved prices.
- `pending_data`, **exit 2**: daily snapshot coverage is complete, but real completed market data is still unavailable. This is not completed collection or healthy returns. A frozen revision quarantine takes precedence on that signal while its additional collection delay is separately exposed.
- `partial`, **exit 2**: new material/split evidence, any unexpected failure, or incomplete candidate coverage. Unexpected outages remain alertable every invocation.
- `failed`, exit 1: run-level error. Lock skip is not work completed. An empty database now returns partial/nonzero rather than claiming an analysis exists.

Pending details are mutable derived `metrics.collection` and exposed separately as API `collection`: exact `pending_sessions`, `latest_unavailable_sessions`, `historical_gap_sessions`, `expected_close_at`, `checked_at`, `next_retry_at`, primary/supplemental fetch IDs. Retry is next scheduled weekday 09:30 Europe/Paris, DST-aware; it is metadata, not another cron. Pending measurements are excluded from valid performance, charts and aggregates, never 0%.

Append-only `worker_issues` fingerprints use missing sessions and availability class, not fetch/time IDs. A move from latest-unavailable to historical gap is a change; identical evidence is known. `summary.new_pending` and `alert_required` distinguish changed evidence from repeated known pending, while exit 2 and pending status remain honest. `coverage_complete` means every candidate was attempted, not that every return is available. `selected/processed/pending_data/immature/known_exclusions` are invocation counts; `total/eligible/excluded/completed` are whole-cohort counts. `candidate_snapshot` is total candidate scope, `snapshot_loaded` is the bounded selected snapshot, `remaining` counts candidates not attempted. Ineligible/no-baseline and completed signals are not falsely counted as an unprocessed backlog.

**Notification integration blocker:** both `scripts/worker.sh` and external `/home/debian/.hermes/scripts/investment_radar_worker.sh` merely `exec` the worker and propagate exit status. They were inspected and deliberately not changed to convert exit 2 into 0. An existing cron notifier that alerts on every nonzero result will still alert on known pending. The parent must integrate the structured `alert_required` contract into notifications while preserving the nonzero collection result, or explicitly accept repeated pending notices. `prompts/worker-cron.md` documents the new contract but editing that repository prompt does not change the live notifier. No scheduler mutation or unsupported claim of notification de-duplication has been made here.

## Test-first verification and restored production replay

Initial real PostgreSQL RED: 71 passed / 4 failed, no skips: >50 coverage, pending classification/API and invalid numeric OHLC. Additional invalid-window/empty-analysis and actual supplemental-source regressions were demonstrated RED before their changes. Final separately built image: **84 tests passed, zero failures, zero skips**. Tests include >100 candidates with one primary request per shared listing, cap/fair progress, pending idempotence and actual recovery, HTTP/empty-feed outages on repeated invocation, supplemental outages/source provenance, strict input validation, frozen revisions, splits, 30-session maturity, no-fetch immaturity, API auth/eligibility and runtime write denial.

Fresh custom dump: `data/backups/20261021T073955Z.dump`, **16,689,006 bytes**, SHA256 `e5ea6388d104c912bd1c4b4234671caf23f924d5c126de01f1ea12a6da1250f6`. It was genuinely restored into multiple new isolated databases, not just archive-listed. Latest retained preview: `radar_test_daily_preview_20261021080242`, container `investment-radar-daily-preview`, loopback `http://127.0.0.1:17849/dashboard` (existing Basic reader credentials). Previous temporary daily previews were removed; the prior repair preview at 17848 and production services were left alone.

Three invocations per restore at fixed **21 October 07:33 UTC**, authentic archived Yahoo evidence, real exchange calendars, **runtime `radar_app`, table owner `radar_owner`**. Replay is network-free and explicitly disables supplemental fetching: it cannot pretend a fixture fixed today's Yahoo gap.

| Invocation | Status / real exit | Selected / processed | Pending / new pending | Remaining | Alert required |
|---|---|---|---|---|---|
| 1 | pending_data / 2 | 100 / 100 | 15 / 15 | 0 | true |
| 2 | pending_data / 2 | 100 / 100 | 15 / 0 | 0 | false |
| 3 | pending_data / 2 | 100 / 100 | 15 / 0 | 0 | false |

All: two batches, coverage complete, zero unexpected failures, 51 eligible / 49 excluded, 40 immature, zero J30 matured. Derived statuses: 55 active, 34 revision-quarantined, 11 pending-data; four of the quarantined also have pending data, and four active unknown-assessment records are excluded by research policy. These overlapping categories must not be naively summed. **455 original observations preserved; 30 authentic previously unprocessed observations appended in isolation, reaching 485.** Production stayed at 455.

`data/worker-daily-preview.json` records row hashes and every original row comparison: all five reports/payloads, all 100 J0 signals and all 455 original observations unchanged. `data/worker-daily-integrity.json` additionally proves all original **68 revisions, 68 conflicts, 10 issues, 3,379 archived fetches and split audits** remain byte-equivalent under canonical JSON in the replay. Only 15 new pending fingerprints were appended; repeated replays add none. Runtime cannot UPDATE J0/observations, has no owner credential, and deployed preview source SHA256 values match local worker/market/API/measurement and unchanged quote/calendar files.

Browser/API: `node scripts/worker-daily-browser.cjs` passed against the isolated preview: truthful pending banner, 100-cohort coverage, exact dates/next retry, excluded pending performance, zero pending chart elements, J30 unavailable, authenticated routes, desktop/mobile no overflow, zero browser runtime errors. Screenshots: `data/worker-daily-pending-desktop.png`, `data/worker-daily-pending-mobile.png`; report `data/worker-daily-browser.json`. No production browser write or fake intercepted response was used.

## Reproduce without deploying

```sh
npm run build
# Never reuse production image tags for these checks:
docker build -t investment-radar-worker-daily-preview .
python3 scripts/worker-daily-tests.py
# Drop --serve for a disposable restore that cleans itself up:
python3 scripts/worker-daily-preview.py data/backups/20261021T073955Z.dump --at 2026-10-21T07:33:00Z
node scripts/worker-daily-browser.cjs   # requires retained preview on 17849
```

To remove ONLY the retained daily preview after review:

```sh
docker rm -f investment-radar-daily-preview
./scripts/compose.sh exec -T db dropdb -U radar_owner radar_test_daily_preview_20261021080242
```

A first preview readiness attempt failed because an internal-only Docker network does not publish a usable loopback port. That isolated container/database was removed; only the preview API now also uses the existing egress bridge. Replay worker containers stay internal-only. No production networking was changed.

## Parent acceptance / safe re-enable

Review the code and report independently before commit/deployment; no schema migration is needed. Keep the worker paused until the notification-contract issue is reviewed. Before production release take a fresh backup, verify source/image hashes and immutable rows, deploy reviewed API+one-shot worker only, and confirm the API's new pending status/filter/eligibility. The parent alone decides resume and must preserve the exact once-weekday 09:30 schedule and 09:00 analysis job.

**Unresolved external blocker:** an authentic complete 20 October OHLC close for five Paris listings was not available in inspected Yahoo primary or the sampled explicit-period response. A fully healthy data result cannot honestly be promised. The repair safely retries such availability gaps next scheduled day; it neither fabricates them nor silently accepts revisions. Re-enabling the old notifier unchanged is not an end-to-end alert fix.
