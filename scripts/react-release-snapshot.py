"""Read-only deployment guard. Saves hashes/counts, never row bodies or secrets.
Usage: python3 scripts/react-release-snapshot.py before|after
Evidence is private and ignored under data/design/.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

def run(*args):
    return subprocess.check_output(args, cwd=ROOT)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def sql(query):
    return run(str(ROOT / 'scripts/compose.sh'), 'exec', '-T', 'db',
               'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'radar_owner',
               '-d', 'investment_radar', '-Atc', query)

def snapshot():
    tables = sql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").decode().splitlines()
    rows = {}
    for table in tables:
        assert table.replace('_', '').isalnum()
        # Canonical JSONB row representation; explicit read-only transaction.
        data = sql(f'BEGIN READ ONLY; COPY (SELECT to_jsonb(t)::text FROM public."{table}" t ORDER BY to_jsonb(t)::text) TO STDOUT; ROLLBACK;')
        # psql emits BEGIN/ROLLBACK command tags around COPY; same canonical stream on both sides.
        rows[table] = {'count': int(sql(f'SELECT count(*) FROM public."{table}"')), 'sha256': sha(data)}
    containers = json.loads(run('docker', 'inspect', 'investment-radar-db-1', 'investment-radar-api-1'))
    db = containers[0]
    cron = Path.home() / '.hermes/cron/jobs.json'
    jobs = json.loads(cron.read_text())['jobs']
    if isinstance(jobs, dict):
        jobs = list(jobs.values())
    radar_jobs = [j for j in jobs if 'investment-radar' in json.dumps(j)]
    return {
        'tables': rows,
        'db_container_id': db['Id'],
        'db_started_at': db['State']['StartedAt'],
        'db_mounts': db['Mounts'],
        'db_ports': db['NetworkSettings']['Ports'],
        'api_ports': containers[1]['NetworkSettings']['Ports'],
        'caddy_sha256': sha(run('sudo', '-n', 'python3', '-c', "import pathlib,sys;sys.stdout.buffer.write(pathlib.Path('/etc/caddy/Caddyfile').read_bytes())")),
        'dns_ipv4': sorted(set(line.split()[0] for line in run('getent', 'ahostsv4', 'radar.vitalisite.com').decode().splitlines())),
        'cron_sha256': sha(cron.read_bytes()),
        'radar_jobs_sha256': sha(json.dumps(radar_jobs, sort_keys=True).encode()),
        'jobs': [{k: j.get(k) for k in ('id', 'name', 'enabled', 'state', 'schedule', 'next_run_at')} for j in radar_jobs],
    }

if __name__ == '__main__':
    label = sys.argv[1]
    assert label in ('before', 'after')
    result = snapshot()
    out = ROOT / 'data/design'
    out.mkdir(parents=True, exist_ok=True)
    (out / f'react-release-{label}.json').write_text(json.dumps(result, indent=2) + '\n')
    if label == 'after':
        previous = json.loads((out / 'react-release-before.json').read_text())
        assert result == previous, 'Deployment guard mismatch; inspect ignored before/after evidence'
    print(json.dumps({'snapshot': label, 'unchanged': label == 'after', 'tables': result['tables'], 'db_private': result['db_ports'] == {'5432/tcp': None}, 'jobs': result['jobs']}, indent=2))
