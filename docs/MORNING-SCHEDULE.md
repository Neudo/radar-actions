# Morning schedule — effective 2026-10-19

## Contract and scheduler handoff

- Daily Big Radar stays paused until Monday **2026-10-19**, then runs **every day at 09:00 Europe/Paris** (including weekends). Parent owns actual pause/resume and durable Monday reactivation; this code release does not edit any cron or gateway.
- Install the **complete `prompts/daily-cron.md`** as the daily agent-driven prompt, workdir `/home/debian/.hermes/workspace/projects/investment-radar`, schedule `0 9 * * *`, timezone `Europe/Paris`. It reads `prompts/big-radar-original.md` and `docs/PAYLOAD.md`.
- `src/quotes.ts::cutoffForDate` is shared by preparation and backend live validation: dates before 2026-10-19 keep **17:45 Paris**, dates from 2026-10-19 use **09:00 Paris**. Monday 2026-10-19 is 07:00 UTC; after the October DST transition, Monday 2026-10-26 is 08:00 UTC. Do not schedule at a fixed UTC hour.
- The anti-hindsight window remains exactly **15 minutes** for both generation and first ingestion. Existing immutable runs may be replayed identically after that deadline, never altered or backfilled.
- Morning quotes may be from the previous session (especially US listings). Only completed minute bars strictly before cutoff and within the existing five-day bound are eligible. Preserve actual timestamps and disclose delay/missing data; do not fabricate opening prices, use an unfinished 09:00 minute, or move sources past cutoff. Same-day daily bars remain excluded.
- The immutable original user text `prompts/big-radar-user-source.txt` is unchanged. No SQL migration, history rewrite, live report, worker restart/pause, provider key or frontend migration is part of this release.

## Verification actually executed

- Failing schedule tests reproduced the old afternoon behavior before the production-code change.
- Clean-worktree `npm ci`: zero reported vulnerabilities. `npm run build`: PASS. Local suite: **50 passed, 1 PostgreSQL integration test skipped** without a DB URL.
- Same clean Docker image tested against a newly created disposable real PostgreSQL database: **51 passed, 0 failed, 0 skipped**; database dropped afterward. Includes old/new cutoff validation, autumn and spring DST boundaries, exact cutoff+15min acceptance, +1ms refusal for new ingestion, identical late replay, immutable hash/readback, quote minute boundaries and previous-session baseline.
- Both existing production runs validate under the new backend with their original canonical payload hashes unchanged.
- Built only the API image from isolated worktree `fix/radar-morning-cutoff` based on `fffdeba`. Recreated only existing Compose project `investment-radar` API using the original Compose file, environment, networks, port and database. No builds from the dirty frontend workspace. Deployed image: `sha256:82d8dc9c86131de02db9f758ae7b59c2738d3d8026191ab6d670fad037829adc`.
- Trusted live HTTPS smoke `python3 scripts/verify-https.py`: PASS; anonymous/invalid credentials 401, public diagnostics 403, authorized Basic/Bearer reads 200, no read secret in JavaScript. An immediate loopback probe during API startup reset once; the following readiness and full HTTPS checks passed.
- Before/after production full-row fingerprints unchanged: radar_runs **2**, `b5e2cb0f7cc87769d9278f8d76a0e2f0`; radar_signals **40**, `02b57f86dd429689351a933e49173f8a`; price_observations **370**, `68bcf71f637db313bddfe9d6c4c53a09`. DB container identity/mounts, proxy config digest and **22 protected dirty frontend files** also unchanged.

## Operational caveats

- A supported local Compose `run` has no `--no-build` flag; the test invocation was corrected to default no-build behavior. The fixture worker correctly rejected an initial disposable DB name without its required `radar_test_` prefix; renamed, reran successfully, both databases dropped. No safety guard was relaxed.
- The previous running API image ID was no longer present in the image store, so a pre-morning rollback tag could not be created. No deployment occurred in that failed tag command. The old committed backend remains reproducible from `fffdeba` in a separate clean worktree if rollback is required.
- Existing worker business status remains **degraded** by quarantined provider revisions. This release does not repair/quarantine-clear data. Scheduler readiness and a successful scheduled report are separate: no Monday report or delivery is claimed before it actually executes.
