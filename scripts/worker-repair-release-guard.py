#!/usr/bin/env python3
"""Read-only release evidence. Private originals stay in ignored data/, never stdout."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release_snapshot', ROOT / 'scripts/react-release-snapshot.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
label = sys.argv[1]
assert label in ('before', 'after')
state = module.snapshot()
originals = {}
for table in ('radar_runs', 'radar_signals', 'price_observations'):
    originals[table] = json.loads(module.sql(f"SELECT coalesce(json_agg(t ORDER BY id),'[]') FROM {table} t"))
fingerprints = {t: {'count': len(rows), 'sha256': hashlib.sha256(json.dumps(rows, sort_keys=True, separators=(',', ':')).encode()).hexdigest()} for t, rows in originals.items()}
security = []
for name in ('investment-radar-api-1', 'investment-radar-repair-preview'):
    container = json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]
    env = dict(value.split('=', 1) for value in container['Config']['Env'])
    forbidden = [k for k in env if k == 'IR_DB_PASSWORD' or any(s in k for s in ('OPENAI', 'ANTHROPIC', 'OPENROUTER', 'GITHUB_TOKEN'))]
    assert not forbidden, 'Owner/provider credential found in runtime'
    url = env.get('DATABASE_URL', '')
    assert 'radar_owner' not in url
    code = "import pg from 'pg';const p=new pg.Pool({connectionString:process.env.DATABASE_URL});console.log(JSON.stringify((await p.query(\"SELECT current_user, current_database(), (SELECT rolcreaterole OR rolsuper FROM pg_roles WHERE rolname=current_user) elevated,(SELECT tableowner FROM pg_tables WHERE tablename='radar_runs') owner\")).rows[0]));await p.end()"
    if name.endswith('preview'):
        code = "process.env.DATABASE_URL='postgresql://radar_app:'+encodeURIComponent(process.env.IR_APP_PASSWORD)+'@db:5432/'+process.env.PREVIEW_DATABASE;" + code
    identity = json.loads(subprocess.check_output(['docker', 'exec', name, 'node', '--input-type=module', '-e', code]))
    assert identity['current_user'] == 'radar_app' and not identity['elevated'] and identity['owner'] != 'radar_app'
    security.append({'container': name, 'identity': identity, 'owner_provider_secrets_absent': True})
result = {'state': state, 'originals': originals, 'fingerprints': fingerprints, 'security': security}
path = ROOT / f'data/worker-repair-release-{label}.json'
if label == 'after':
    before = json.loads((ROOT / 'data/worker-repair-release-before.json').read_text())
    for table, rows in before['originals'].items():
        current = {r['id']: r for r in originals[table]}
        assert all(current.get(r['id']) == r for r in rows), 'Changed or missing original: ' + table
        if table != 'price_observations':
            assert len(current) == len(rows), 'Unexpected prediction write'
    for key in ('db_container_id', 'db_started_at', 'db_mounts', 'db_ports', 'api_ports', 'caddy_sha256', 'dns_ipv4', 'cron_sha256', 'radar_jobs_sha256'):
        assert state[key] == before['state'][key], 'Protected deployment state changed: ' + key
    result['original_rows_unchanged'] = True
    result['protected_deployment_state_unchanged'] = True
path.write_text(json.dumps(result, indent=2) + '\n')
os.chmod(path, 0o600)
print(json.dumps({'snapshot': label, 'fingerprints': fingerprints, 'security': security, 'original_rows_unchanged': result.get('original_rows_unchanged'), 'protected_deployment_state_unchanged': result.get('protected_deployment_state_unchanged')}, indent=2))
