BEGIN;
-- Additive only: original predictions, observations, fetches and conflicts stay untouched.
CREATE TABLE IF NOT EXISTS price_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 observation_id uuid NOT NULL REFERENCES price_observations(id),
 signal_id uuid NOT NULL REFERENCES radar_signals(id),
 session date NOT NULL,
 existing_hash text NOT NULL,
 new_hash text NOT NULL,
 fetch_id uuid NOT NULL REFERENCES market_fetches(id),
 ohlc jsonb,
 classification text NOT NULL CHECK(classification IN ('cent_precision','material','ambiguous')),
 decision text NOT NULL CHECK(decision IN ('retain_frozen','exclude')),
 policy text NOT NULL CHECK(policy='frozen-first-v1'),
 provenance jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(observation_id,new_hash),
 CHECK ((classification='cent_precision') = (decision='retain_frozen'))
);
CREATE INDEX IF NOT EXISTS revisions_signal ON price_revisions(signal_id);
CREATE TABLE IF NOT EXISTS worker_issues (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 signal_id uuid NOT NULL REFERENCES radar_signals(id),
 kind text NOT NULL CHECK(kind IN ('split','missing')),
 fingerprint text NOT NULL,
 evidence jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(signal_id,kind,fingerprint)
);
ALTER TABLE worker_runs ADD COLUMN IF NOT EXISTS summary jsonb NOT NULL DEFAULT '{}';
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['price_revisions','worker_issues'] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname=t||'_immutable') THEN
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_history_change()',t||'_immutable',t);
 EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION reject_history_change()',t||'_no_truncate',t);
 END IF;
 END LOOP;
END;$$;
COMMIT;
