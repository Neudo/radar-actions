#!/usr/bin/env python3
import pathlib,subprocess,datetime,os,hashlib,json,fcntl
root=pathlib.Path('/home/debian/.hermes/workspace/projects/investment-radar');out=root/'data'/'backups';out.mkdir(parents=True,mode=0o700,exist_ok=True)
lock=(out/'.lock').open('w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
name=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
path=out/(name+'.dump');temp=out/(name+'.partial')
try:
 with temp.open('xb') as f:
  p=subprocess.run([str(root/'scripts/compose.sh'),'exec','-T','db','pg_dump','-U','radar_owner','-d','investment_radar','--format=custom','--no-owner','--no-acl'],stdout=f,check=True,timeout=180)
 os.chmod(temp,0o600);temp.rename(path)
 with path.open('rb') as f:subprocess.run([str(root/'scripts/compose.sh'),'exec','-T','db','pg_restore','--list'],stdin=f,stdout=subprocess.DEVNULL,check=True)
 h=hashlib.sha256(path.read_bytes()).hexdigest();manifest=path.with_suffix('.json');manifest.write_text(json.dumps({'file':str(path),'sha256':h,'bytes':path.stat().st_size,'format':'pg_dump custom','retention_days':30},indent=2));os.chmod(manifest,0o600)
 cutoff=datetime.datetime.now(datetime.timezone.utc).timestamp()-30*86400
 for old in out.glob('*.dump'):
  if old.stat().st_mtime<cutoff:old.unlink();old.with_suffix('.json').unlink(missing_ok=True)
 print(json.dumps({'backup':str(path),'bytes':path.stat().st_size,'sha256':h,'archive_listing':'ok'}))
except Exception:
 temp.unlink(missing_ok=True);raise
