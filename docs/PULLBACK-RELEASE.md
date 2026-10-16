# Pullback-first release verification — 2026-10-16

## Delivered

- Exact French user source: `prompts/big-radar-user-source.txt`, byte-identical to supplied document, SHA256 `07ddeadddd95d1fe5362fac7917ee5bb5c1c0d4a42a46d017640d51d132fb8a7`.
- Canonical methodology: `prompts/big-radar-original.md`; scheduler prompt to install verbatim: **`prompts/daily-cron.md`**. At that release, schedule remained 17:45 Europe/Paris (superseded by `docs/MORNING-SCHEDULE.md` effective 2026-10-19); parent agent owns scheduler updates/resume. No cron state was edited by this release.
- Structured optional `setup` (listing provenance, support, pre-support alert, structural invalidation, technical evidence, confirmations) and `assessment_status` validated and stored in existing immutable JSONB. No SQL migration, no old-row updates, no default fields altering old payload hashes.
- Unknown research remains a legacy ORANGE carrier only at storage boundary, explicitly Non évalué in UI/report policy, excluded from directional tag cohorts/validated measurements/eligible filters. No fabricated ORANGE opportunity or automatic RED for missing data.
- Deterministic preparation now exposes up to120 previous-session daily OHLCV, real volume/null, MA20/50/100, extrema20/60 and confirmed pivots. Same-day final daily data excluded; separate daily errors preserve a valid minute baseline. No new vendor, dependency, paid key, live analysis or invented prediction.
- Existing detail page minimally exposes J0 levels/provenance and honest daily-only alert limitation. No frontend framework migration or live alert monitoring.

## Verification actually executed

- `npm run build`: PASS.
- Local test suite: 40 passed, one PG integration test skipped (expected without DB URL).
- `scripts/integration.sh`: **41 passed, zero failed/skipped**, disposable real PostgreSQL database removed afterward. Includes support/alert exact readback through signal and run APIs, conflicting support =>409, unchanged old payload hashes, unknown cohort exclusion, auth/roles/immutability and deterministic worker fixtures.
- Container images rebuilt; API recreated with new build (no production migration). `scripts/verify-https.py`: PASS trusted hostname/TLS; unauthorized/invalid401, diagnostics public403, Basic/Bearer authenticated200, no credential in JS. First immediate request during restart returned transient502; readiness and complete smoke subsequently passed.
- `scripts/design-release-smoke.cjs`: PASS real read-only production browser paths/search/paging/sorting/detail/Bilan/Methode, 1440/390/320 widths, no browser errors. New levels are not retroactively invented for old details.
- Read-only real Yahoo NVDA daily-feed diagnostic:120 valid historical bars, last2026-10-15, volume and MA50 available; no market-cache write and zero predictions created. Today's context was absent; today's analysis was not run outside cutoff.

## Production history unchanged before/after

Full-row fingerprints (PostgreSQL md5 of ordered row JSON, not a replacement for canonical SHA256 payload hashes):

- radar_runs:2, `a5453e197cade6b8b11fe980b2f96585`
- radar_signals:40, `e5032146c84857057ec3ed8e8f4ca5bc`
- price_observations:40, `f92ff49c126413b5b133a75f0ad9c1e5`

## Reactivation handoff

Daily research is ready after parent installs the FULL daily prompt and verifies cron resume/list state. Do not run a manual live report early/late; live ingestion still enforces actual cutoff+15 minutes. No claim of a successful scheduled delivery was made.

Tracking is still **stale/degraded**: last production worker2026-10-06,18 active signals and22 quarantined for provider revisions. No production worker run, forced quarantine clearing or historical repair was performed. Existing observations remain excluded until audited; resuming a schedule does not mean these22 are repaired. Parent decides whether to resume the deterministic worker with this limitation.

Next frontend request (real shadcn UI and graphs) is intentionally deferred until cron verification; only the minimal J0 detail/status additions are included here.
