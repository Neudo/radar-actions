#!/usr/bin/env python3
"""Run ALL tests in real isolated PostgreSQL with separately tagged daily preview image."""
import datetime, os, pathlib, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[1]
compose=str(root/'scripts/compose.sh')
name='radar_test_daily_'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
values={}
for line in pathlib.Path('/home/debian/.hermes/.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.split('=',1);values[k.strip()]=v.strip().strip('"').strip("'")
env=dict(os.environ,IR_DB_PASSWORD=values['IR_DB_PASSWORD'])
subprocess.run([compose,'exec','-T','db','createdb','-U','radar_owner',name],check=True)
try:
    r=subprocess.run(['docker','run','--rm','--network','investment-radar_backend','-e','IR_DB_PASSWORD','-e','TEST_DB_NAME='+name,'investment-radar-worker-daily-preview','node','--input-type=module','-e',"import {spawnSync} from 'node:child_process'; process.env.TEST_DATABASE_URL='postgresql://radar_owner:'+encodeURIComponent(process.env.IR_DB_PASSWORD)+'@db:5432/'+process.env.TEST_DB_NAME;process.env.NODE_ENV='test';const r=spawnSync('npm',['test'],{env:process.env,stdio:'inherit'});process.exitCode=r.status??1"],env=env)
finally:
    subprocess.run([compose,'exec','-T','db','dropdb','-U','radar_owner',name],check=True)
sys.exit(r.returncode)
