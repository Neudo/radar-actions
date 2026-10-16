#!/usr/bin/env python3
import sys,subprocess,pathlib,json,datetime,zoneinfo,os
root=pathlib.Path('/home/debian/.hermes/workspace/projects/investment-radar')
date=sys.argv[1] if len(sys.argv)>1 else datetime.datetime.now(zoneinfo.ZoneInfo('Europe/Paris')).date().isoformat()
path=root/'data'/f'{date}.context.json';path.parent.mkdir(mode=0o700,exist_ok=True)
if path.exists():
 data=json.loads(path.read_text());print(json.dumps({'path':str(path),'existing_context':True,'existing_run':bool(data.get('existing_run'))}));sys.exit(0)
cmd=[str(root/'scripts/compose.sh'),'exec','-T','api','node','dist/prepare.js',date]
if len(sys.argv)>2:cmd.append(sys.argv[2])
p=subprocess.run(cmd,capture_output=True,text=True,timeout=160)
if p.returncode:print(p.stderr,file=sys.stderr);sys.exit(p.returncode)
data=json.loads(p.stdout)
with path.open('x') as f:json.dump(data,f,ensure_ascii=False,indent=2)
os.chmod(path,0o600)
print(json.dumps({'path':str(path),'securities':len(data.get('securities',[])),'missing':sum(s.get('data_status')=='missing' for s in data.get('securities',[])),'existing_run':bool(data.get('existing_run'))}))
