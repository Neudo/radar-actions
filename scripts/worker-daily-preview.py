#!/usr/bin/env python3
"""Replay authentic source archives at fixed time against a fresh real restore, non-owner runtime.
Leaves only isolated preview when --serve is specified. Never migrates or runs worker in production.
"""
import argparse, datetime, hashlib, json, os, pathlib, socket, subprocess, sys, time, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
COMPOSE=str(ROOT/'scripts/compose.sh');IMAGE='investment-radar-worker-daily-preview'
p=argparse.ArgumentParser(description=__doc__);p.add_argument('dump',type=pathlib.Path);p.add_argument('--at',default='2026-10-21T07:33:00Z');p.add_argument('--serve',action='store_true');p.add_argument('--port',type=int,default=17849)
a=p.parse_args()
if a.serve:
    with socket.socket() as s:s.bind(('127.0.0.1',a.port))
manifest=json.loads(a.dump.with_suffix('.json').read_text())
assert hashlib.sha256(a.dump.read_bytes()).hexdigest()==manifest['sha256'],'Backup checksum mismatch'
name='radar_test_daily_preview_'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
container='investment-radar-daily-preview'
values={}
for line in pathlib.Path('/home/debian/.hermes/.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.split('=',1);values[k.strip()]=v.strip().strip('"').strip("'")
def sql(db,q):
    return subprocess.check_output([COMPOSE,'exec','-T','db','psql','-U','radar_owner','-d',db,'-v','ON_ERROR_STOP=1','-Atc',q],text=True).strip()
def rows(db):return {t:json.loads(sql(db,f"SELECT coalesce(json_agg(x ORDER BY id),'[]') FROM {t} x")) for t in ['radar_runs','radar_signals','price_observations']}
def fp(data):return {t:{'rows':len(v),'sha256':hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':')).encode()).hexdigest()} for t,v in data.items()}
def docker(code=None,runtime=True,serve=False):
    keys=['IR_APP_PASSWORD'] if runtime else ['IR_DB_PASSWORD']
    if serve:keys+=['IR_API_KEY','IR_READ_KEY']
    env=dict(os.environ,REPLAY_DATABASE=name,REPLAY_AT=a.at)
    args=['docker','run','--rm','--network','investment-radar_backend','-e','REPLAY_DATABASE','-e','REPLAY_AT']
    for k in keys:env[k]=values[k];args+=['-e',k]
    if serve:args+=['--network','investment-radar_egress','-d','--name',container,'-p',f'127.0.0.1:{a.port}:3000']
    role,key=('radar_app','IR_APP_PASSWORD') if runtime else ('radar_owner','IR_DB_PASSWORD')
    setup=f"process.env.DATABASE_URL='postgresql://{role}:'+encodeURIComponent(process.env.{key})+'@db:5432/'+process.env.REPLAY_DATABASE;"
    if serve:code="process.env.RADAR_API_KEY=process.env.IR_API_KEY;process.env.RADAR_READ_KEY=process.env.IR_READ_KEY;await import('./dist/server.js')"
    if code is None:code="await import('./scripts/worker-daily-replay.mjs')"
    return subprocess.run(args+[IMAGE,'node','--input-type=module','-e',setup+code],capture_output=True,text=True,env=env,timeout=180)
prod_before=fp(rows('investment_radar'))
subprocess.run([COMPOSE,'exec','-T','db','createdb','-U','radar_owner',name],check=True)
keep=False
server_started=False
try:
    with a.dump.open('rb') as f:subprocess.run([COMPOSE,'exec','-T','db','pg_restore','-U','radar_owner','-d',name,'--no-owner','--no-acl','--single-transaction','--exit-on-error'],stdin=f,check=True)
    before=rows(name)
    # No schema changes needed; grant only existing runtime permissions in this isolated DB.
    sql(name,'GRANT USAGE ON SCHEMA public TO radar_app;GRANT SELECT,INSERT ON radar_runs,radar_signals,price_observations,market_fetches,worker_runs,data_conflicts,price_revisions,worker_issues TO radar_app;GRANT SELECT ON split_audits TO radar_app;GRANT SELECT,INSERT,UPDATE ON signal_performance TO radar_app;GRANT UPDATE ON worker_runs TO radar_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC')
    results=[]
    for i in range(3):
        r=docker()
        if r.returncode not in (0,2):raise RuntimeError(r.stderr)
        results.append(dict(json.loads(r.stdout),actual_exit_code=r.returncode))
    after=rows(name)
    for t,rs in before.items():
        actual={r['id']:r for r in after[t]}
        assert all(actual.get(r['id'])==r for r in rs), 'Immutable rows changed: '+t
        if t!='price_observations':assert len(after[t])==len(rs)
    prod_after=fp(rows('investment_radar'));assert prod_before==prod_after,'Production immutable state changed'
    summary={'database':name,'container':container if a.serve else None,'image':IMAGE,'backup':str(a.dump),'backup_sha256':manifest['sha256'],'restored':True,'before':fp(before),'after':fp(after),'original_rows_unchanged':True,'production_before':prod_before,'production_after':prod_after,'production_immutable_unchanged':True,'runs':results,'source_recovery_limitation':'Replay uses frozen primary archives only. Live diagnostic period window still had null close. Does not claim supplemental Yahoo repaired Oct20 data.'}
    if a.serve:
        r=docker(serve=True)
        if r.returncode:raise RuntimeError(r.stderr)
        server_started=True
        for _ in range(30):
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{a.port}/health',timeout=2) as response:summary['health']=json.load(response)
                break
            except OSError:time.sleep(.2)
        else:raise RuntimeError('Preview readiness failed')
        summary['preview']=f'http://127.0.0.1:{a.port}/dashboard'
        keep=True
    path=ROOT/'data/worker-daily-preview.json';path.write_text(json.dumps(summary,indent=2));path.chmod(0o600)
    print(json.dumps(summary,indent=2))
finally:
    if not keep:
        if server_started:subprocess.run(['docker','rm','-f',container],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        subprocess.run([COMPOSE,'exec','-T','db','dropdb','-U','radar_owner',name],check=True)
