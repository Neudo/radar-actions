# Daily worker reliability — production release, 21 October 2026

## Outcome

**Deployed and exercised. Worker cron remains paused; no job was edited or resumed.** API and one-shot worker use the reviewed additive patch. The transport adapter now de-duplicates known provider-pending incidents without changing the CLI's business exit 2 or presenting missing data as healthy. Actual production first/repeat runs both verified **100 selected / 100 processed, two batches, remaining 0, 15 pending, zero unexpected failures**. First stdout: one compact French warning; repeat stdout: empty. API/UI still say `pending_data`, not green.

**External limitation remains:** Yahoo does not supply a complete 20 October close for AIR.PA, KER.PA, MC.PA, RMS.PA and TTE.PA in inspected responses. No price was invented, moved from a different session, rounded into existence or copied forward. Existing material-revision exclusions remain excluded.

## Independent review and the additional live defect

Reviewed worker/market/API/measurement/UI changes, candidate selection and bounds, append-only provenance, existing wrappers and the installed Hermes runner. Official cron documentation was fetched successfully (HTTP 200); local capture: `data/hermes-cron-doc-release.html`. Installed source is decisive:

- `~/.hermes/hermes-agent/cron/scheduler.py:1553–1605`: no_agent nonzero/timeout always becomes a failure alert; successful empty stdout is silent; nonempty stdout is delivered. An application `alert_required=false` alone cannot suppress the global failure path.
- `cron/scheduler_script.py:323–365`: scripts must resolve under the active profile's `~/.hermes/scripts`, including absolute paths.
- Installed script timeout defaults to **3600 seconds**, not the old three-minute skill summary. Adapter timeout is 1500 seconds, worker's checked budget 20 minutes. No timeout/model/provider setting changed.
- Hermes config already specifies `timezone: Europe/Paris`; the installed clock and cron parser use that configured timezone. Do not add an invented per-job timezone field.

The first real post-deployment run correctly failed closed: five one-day supplemental Yahoo windows returned no timestamp/OHLC arrays, while primary six-month histories were populated with null 20 October bars. This was **not suppressed or called pending**. Captured evidence: `data/worker-daily-release-initial-unexpected.json`; API recorded partial, 100 attempted / 95 processed, five unexpected structural errors. A regression was demonstrated RED (83 pass / 1 fail) before correcting the **request window**, not the validator: supplemental windows now include a bounded preceding week of actual provider context. All five short ranges then returned six timestamps; selection still excludes all pre-cutoff sessions, and 20 October remains pending. Empty, malformed and HTTP responses still fail and alert on every retry. No extra fallback provider or fetch loop was added.

## Notification contract and deployment artifacts

- Raw CLI: `scripts/worker.sh`, actual worker JSON and exit 0/1/2 unchanged; Compose `--quiet --no-deps` was probed to retain child stdout without normal lifecycle stderr.
- Runtime entrypoint: **`/home/debian/.hermes/scripts/investment_radar_worker.sh`**, byte-identical repository mirror `scripts/investment_radar_worker.sh`.
- Adapter: `scripts/worker-notify.py`, standard library only, no LLM. Validates business/process exit agreement, recognized status, full coverage/counter consistency, no errors/new failures/unexpected failures, structured pending listings/classes/session evidence. Any unexpected stderr, malformed JSON, crash, timeout, corrupt state or incomplete coverage remains nonzero.
- Atomic private state: `state/worker-notification.json`, lock over worker plus transition, fsync/rename, mode 0600. Stores full last result, `business_status`, `worker_exit_code`, initial incident time and escalation levels. This is runtime state, not committed code.
- Novelty is by listing/availability class, not today's date, signal count or per-signal issue novelty. First/change/resolution alerts; known repeats silent. Persistent age triggers one escalation after 72 hours and another after seven days, without resetting age when cohorts/dates change.
- **Transport exit 0 means accepted/persisted result, never necessarily business healthy.** The CLI, database and API retain `pending_data` / business exit 2. Existing quarantines and pending returns remain excluded from valid aggregates/charts.

Real production evidence (`data/worker-daily-release-manual.json`):

| Invocation | Worker run | Business status / exit | Transport exit | Coverage | Pending / new | Unexpected | Stdout |
|---|---|---|---|---|---|---|---|
| First accepted | `9dc9221b-3c4a-409d-bbb8-11734d796c15` | pending_data / 2 | 0 | 100/100 | 15 / 5 | 0 | 259 characters |
| Repeat | `74abb95d-4e29-47a4-828b-cf041590189a` | pending_data / 2 | 0 | 100/100 | 15 / 0 | 0 | empty |

The first accepted run's new count is five, not fifteen: ten pending issues had already been honestly appended by the preceding partial run. No history was cleared to manufacture a pristine first run.

Actual emitted notification:

> ⚠ Données fournisseur en attente — AIR.PA, KER.PA, MC.PA, RMS.PA, TTE.PA ; séances 2026-10-20. 15 suivis concernés ; couverture 100/100. Statut métier pending_data (CLI 2), rendements concernés exclus. Nouvelle tentative au prochain jour ouvré à 09:30 Paris.

This warning was emitted by the manual wrapper test, **not delivered by a resumed cron**. The live job still has `deliver=local`. The parent must convey the outstanding initial warning when changing delivery; do not clear incident age to force a resend. The next planned retry is 22 October 2026 at 09:30 Europe/Paris (07:30 UTC).

## Verification performed

- Full TypeScript/frontend build passed, including final local build.
- **85 PostgreSQL/TypeScript tests passed, zero failures/skips**, in a fresh isolated database with separately tagged image. Final log `data/worker-daily-release-tests.log`. The additional empty-supplemental-history regression was observed RED (84 pass / 1 fail) before adding its explicit rejection guard; it remains an outage on every retry.
- **Six additional Python subprocess test cases passed** (91 total named tests): first/change/repeat/recovery, date/count jitter, added listing, both age thresholds, HTTP/structural/new failure/incomplete coverage, malformed output, crash/nonzero/stderr, corrupt state, no false recovery. All subprocess fixtures explicitly labeled synthetic and never represented as market evidence.
- Fresh backup `data/backups/20261021T081049Z.dump`: 16,689,006 bytes, SHA256 `948f979d8c10759b0cf38730cda47df2162a745e47c9e67e12ac2746b154751f`. Truly restored and replayed three times using archived authentic Yahoo and exchange calendars, non-owner runtime: each 100/100, pending 15, exit 2, unexpected 0, remaining 0; novelty true/false/false. Replay cannot claim supplemental recovery. Evidence `data/worker-daily-preview.json`, `data/worker-daily-release-replay.log`.
- A further pre-final-deploy backup `data/backups/20261021T081909Z.dump`: 16,761,049 bytes, SHA256 `890cb4956b2568679684ad97dc80c79601936cd0de668bbf42a9115c64cc88a8`. Actually restored into isolated `radar_restore_20261021082109`; five reports, 100 signals, 485 observations, 3,409 fetches and 212 worker runs verified.
- One bounded independent live MC.PA six-month probe at 08:12 UTC reconfirmed 131 timestamps and all four 20 October OHLC null. Evidence `data/worker-daily-release-yahoo.json`. Real worker requests reused run/cache evidence rather than one request per signal.
- Production browser/API smoke passed: truthful pending banner/filter/retry dates, pending performance null/ineligible, **zero pending chart elements**, a real eligible observed signal renders its chart, J30 unavailable, authenticated routes, desktop/mobile no overflow, zero browser runtime errors. `data/worker-daily-production-browser.json` and screenshots. Isolated preview smoke also passed.
- API healthy. Runtime SQL verified `radar_app`, owner `radar_owner`, no UPDATE of J0 or DELETE of observations. DB service/network/volume untouched; no migration needed.

## Integrity and deployed hashes

`data/worker-daily-release-integrity.json` compares every original row by canonical JSON hash, not just counts. All original **five reports, 100 signals, 455 observations, 68 revisions, 68 conflicts, ten issues and 3,379 fetches** unchanged. Thirty genuine observations appended (485 now), fifteen pending issues appended (25 now), forty authentic fetches appended (3,419 now). No revision/observation overwrite or forced audit approval. Full original hashes live privately in `data/worker-daily-release-originals.json`.

Caddy live/repository configuration and entire `~/.hermes/cron/jobs.json` remained hash-identical; morning cutoff/quote source unchanged. DNS/network configuration not edited. API only recreated with `compose up -d --no-deps --no-build api`; no DB/Caddy recreation. Rollback image tags retained: `investment-radar-api:before-daily-20261021`, `investment-radar-worker:before-daily-20261021`.

Deployed API/worker image config: `sha256:415d7371239e566b64c7d687491cb7fa150f69a61a5913d618285048b1182ee9`. The final strict empty-history guard was then deployed and the real wrapper invoked once more: accepted pending-only result, zero stdout, no unexpected errors; the complete production browser smoke was repeated successfully.
Verified local-to-image source hashes and compiled JS/frontend hashes: `data/worker-daily-release-codehashes.json`. Worker source SHA256 `2a0969521653b8587de251a0690b65e9a26b850db00fad379eb17b3586ed181c`; notification adapter SHA256 `f69cf6eb2bd661d99be2032b2eba2ff33dede8317ba811007c6932a500ab8e2a`; runtime/repository wrapper SHA256 `ae982349c31b8fca9ce34845b285f849a688492991808cfed70a848f700bd11a`. Private data, credentials, snapshots and raw evidence are excluded from Git.

## Parent-only acceptance / scheduler configuration

**Ready for parent review and resume of degraded-but-truthful operation**, not a claim that the provider is fixed. Keep paused until the parent verifies delivery and consciously accepts pending data. No autonomous resume performed.

For existing worker **`1aa2dd9f097b`**, preserve origin and use:

```json
{
  "script": "investment_radar_worker.sh",
  "no_agent": true,
  "workdir": "/home/debian/.hermes/workspace/projects/investment-radar",
  "schedule": "30 9 * * 1-5",
  "deliver": "origin"
}
```

The schedule string is the edit/create API input; stored scheduler representation is `{ "kind": "cron", "expr": "30 9 * * 1-5", "display": "30 9 * * 1-5" }`. Existing profile timezone is Europe/Paris. Absolute runtime script path is also accepted by the installed scripts-directory guard. Origin is the existing private Discord channel `1507049898527297586`; verify that exact target before delivery. Do not touch daily job `f7ea6f3ad024` (`0 9 * * 1-5`, already enabled), other jobs, model/provider settings or global notification defaults. `deliver=local` would suppress user delivery of the compact first/change/recovery stdout even though the wrapper is functioning.
