#!/usr/bin/env python3
"""Restore-only worker/API preview. Never migrates or runs new code against production.
Uses the separately tagged preview image; secrets stay in ~/.hermes/.env.
"""
import argparse, datetime, hashlib, json, os, pathlib, socket, subprocess, sys, time, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
COMPOSE = str(ROOT / 'scripts/compose.sh')
IMAGE = 'investment-radar-worker-repair-preview'
CONTAINER = 'investment-radar-repair-preview'
STATE = ROOT / 'data/worker-repair-preview.json'
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('dump', nargs='?', type=pathlib.Path)
p.add_argument('--serve', action='store_true', help='Leave authenticated preview on loopback')
p.add_argument('--port', type=int, default=17848)
p.add_argument('--stop', action='store_true', help='Remove ONLY the recorded preview container/database')
a = p.parse_args()
def sql(db, command):
    return subprocess.check_output([COMPOSE, 'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'radar_owner', '-d', db, '-Atc', command], text=True).strip()
def remove(db):
    if not db.startswith('radar_test_repair_preview_') or not db.replace('_', '').isalnum():
        raise RuntimeError('Refusing non-preview database')
    subprocess.run([COMPOSE, 'exec', '-T', 'db', 'dropdb', '-U', 'radar_owner', db], check=True)
if a.stop:
    state = json.loads(STATE.read_text())
    subprocess.run(['docker', 'rm', '-f', CONTAINER], check=True)
    remove(state['database'])
    print(json.dumps({'preview_removed': state['database']}))
    sys.exit(0)
if a.serve:
    if not 1024 <= a.port <= 65535:
        p.error('Invalid preview port')
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', a.port))  # fail BEFORE creating/restoring any DB
if not a.dump:
    p.error('Specify a real custom-format backup; run scripts/backup.py first')
manifest = json.loads(a.dump.with_suffix('.json').read_text())
if hashlib.sha256(a.dump.read_bytes()).hexdigest() != manifest['sha256']:
    raise RuntimeError('Backup checksum mismatch')
name = 'radar_test_repair_preview_' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
subprocess.run([COMPOSE, 'exec', '-T', 'db', 'createdb', '-U', 'radar_owner', name], check=True)
def docker(code, runtime=False, serve=False):
    values = {}
    for line in pathlib.Path('/home/debian/.hermes/.env').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k,v = line.split('=',1); values[k.strip()] = v.strip().strip(chr(34)).strip(chr(39))
    keys = ['IR_APP_PASSWORD'] if runtime else ['IR_DB_PASSWORD']
    if serve:
        keys += ['IR_API_KEY','IR_READ_KEY']
    environment = dict(os.environ)
    args = ['docker', 'run', '--rm', '--network', 'investment-radar_backend', '--network', 'investment-radar_egress', '-e', 'PREVIEW_DATABASE='+name]
    for key in keys:
        environment[key] = values[key]
        args += ['-e',key]
    if serve:
        args += ['-d', '--name', CONTAINER, '-p', f'127.0.0.1:{a.port}:3000']
    user, key = ('radar_app', 'IR_APP_PASSWORD') if runtime else ('radar_owner', 'IR_DB_PASSWORD')
    setup = f"process.env.DATABASE_URL='postgresql://{user}:'+encodeURIComponent(process.env.{key})+'@db:5432/'+process.env.PREVIEW_DATABASE;"
    return subprocess.run(args + [IMAGE, 'node', '--input-type=module', '-e', setup + code], capture_output=True, text=True, timeout=180, env=environment)
def rows():
    return {t: json.loads(sql(name, f"SELECT coalesce(json_agg(x ORDER BY id),'[]') FROM {t} x")) for t in ['radar_runs', 'radar_signals', 'price_observations']}
def fingerprint(rs):
    return {t: {'count': len(v), 'sha256': hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':')).encode()).hexdigest()} for t,v in rs.items()}
completed = False
server_started = False
try:
    with a.dump.open('rb') as f:
        subprocess.run([COMPOSE, 'exec', '-T', 'db', 'pg_restore', '-U', 'radar_owner', '-d', name, '--no-owner', '--no-acl', '--single-transaction', '--exit-on-error'], stdin=f, check=True, timeout=180)
    before = rows()
    migrate = docker("import pg from 'pg';import {migrate} from './dist/migrate.js';const p=new pg.Pool({connectionString:process.env.DATABASE_URL});try{await migrate(p);await p.query('GRANT USAGE ON SCHEMA public TO radar_app; GRANT SELECT,INSERT ON radar_runs,radar_signals,price_observations,market_fetches,worker_runs,data_conflicts,price_revisions,worker_issues TO radar_app; GRANT SELECT ON split_audits TO radar_app; GRANT SELECT,INSERT,UPDATE ON signal_performance TO radar_app; GRANT UPDATE ON worker_runs TO radar_app');console.log('Isolated migration OK')}finally{await p.end()}")
    if migrate.returncode:
        raise RuntimeError('Isolated migration failed: '+migrate.stderr)
    runs = []
    for _ in range(3):  # real executable, runtime non-owner, normal LIVE mode, fair batch=50
        # Real CLI child inherits DATABASE_URL in memory, never an argv secret.
        result = docker("import {spawnSync} from 'node:child_process';const r=spawnSync('node',['dist/worker.js'],{env:process.env,encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exitCode=r.status??1", runtime=True)
        if result.returncode not in (0, 2):
            raise RuntimeError('Preview worker failed: '+result.stderr)
        record = json.loads(result.stdout)
        record['actual_exit_code'] = result.returncode
        runs.append(record)
    after = rows()
    for table in before:
        actual = {row['id']: row for row in after[table]}
        if any(actual.get(row['id']) != row for row in before[table]):
            raise RuntimeError('Immutable row changed: '+table)
        if table != 'price_observations' and len(after[table]) != len(before[table]):
            raise RuntimeError('Prediction row count changed: '+table)
    summary = {'database': name, 'image': IMAGE, 'backup_sha256': manifest['sha256'], 'restored': True, 'before': fingerprint(before), 'after': fingerprint(after), 'original_rows_unchanged': True, 'worker_runs': runs,
               'revisions': json.loads(sql(name, "SELECT coalesce(json_agg(x),'[]') FROM (SELECT classification,decision,count(*)::int n FROM price_revisions GROUP BY classification,decision ORDER BY classification)x"))}
    if a.serve:
        server = docker("process.env.RADAR_API_KEY=process.env.IR_API_KEY;process.env.RADAR_READ_KEY=process.env.IR_READ_KEY;await import('./dist/server.js')", runtime=True, serve=True)
        if server.returncode:
            raise RuntimeError('Preview server failed: '+server.stderr)
        server_started = True
        ready = False
        for _ in range(20):
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{a.port}/health', timeout=2) as r:
                    summary['health'] = json.load(r)
                ready = True
                break
            except (OSError, ValueError):
                time.sleep(0.25)
        if not ready:
            raise RuntimeError('Preview server did not become ready')
        summary['preview'] = f'http://127.0.0.1:{a.port}/dashboard'
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(summary, indent=2))
    STATE.chmod(0o600)
    print(json.dumps(summary, indent=2))
    completed = True
finally:
    if not a.serve or not completed:
        if server_started:
            subprocess.run(['docker', 'rm', '-f', CONTAINER], check=True)
        remove(name)
