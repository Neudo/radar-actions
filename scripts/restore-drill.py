#!/usr/bin/env python3
import pathlib,subprocess,datetime,json,hashlib,sys
root=pathlib.Path('/home/debian/.hermes/workspace/projects/investment-radar');compose=str(root/'scripts/compose.sh')
path=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else sorted((root/'data/backups').glob('*.dump'))[-1]
manifest=json.loads(path.with_suffix('.json').read_text())
if hashlib.sha256(path.read_bytes()).hexdigest()!=manifest['sha256']:raise SystemExit('Checksum mismatch')
name='radar_restore_'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
subprocess.run([compose,'exec','-T','db','createdb','-U','radar_owner',name],check=True)
try:
 with path.open('rb') as f:subprocess.run([compose,'exec','-T','db','pg_restore','-U','radar_owner','-d',name,'--no-owner','--no-acl','--single-transaction','--exit-on-error'],stdin=f,check=True,timeout=120)
 tables=['radar_runs','radar_signals','price_observations','market_fetches','signal_performance','split_audits','worker_runs']
 counts={}
 for table in tables:
  sql=f'SELECT count(*) FROM {table}'
  count=subprocess.check_output([compose,'exec','-T','db','psql','-U','radar_owner','-d',name,'-Atc',sql],text=True).strip();counts[table]=int(count)
 print(json.dumps({'restored':True,'isolated_database':name,'sha256_verified':True,'row_counts':counts,'source':str(path)}))
finally:subprocess.run([compose,'exec','-T','db','dropdb','-U','radar_owner',name],check=True)
