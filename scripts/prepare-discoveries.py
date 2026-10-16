#!/usr/bin/env python3
import sys,subprocess,pathlib,json,os
root=pathlib.Path('/home/debian/.hermes/workspace/projects/investment-radar');date=sys.argv[1];extras=json.loads(pathlib.Path(sys.argv[2]).read_text())
if not isinstance(extras,list) or not 2<=len(extras)<=5:raise SystemExit('Require 2–5 justified discovery metadata records')
keys={'ticker','exchange','market_symbol','company','sector','currency'}
if any(set(x)!=keys or x['exchange'] not in ['XNAS','XNYS','XPAR'] or x['currency']!=('EUR' if x['exchange']=='XPAR' else 'USD') for x in extras):raise SystemExit('Invalid discovery metadata')
path=root/'data'/f'{date}.discoveries.context.json'
if path.exists():
 print(json.dumps({'path':str(path),'existing_context':True}));sys.exit(0)
raw=subprocess.check_output([str(root/'scripts/compose.sh'),'exec','-T','api','node','dist/prepare.js',date,json.dumps(extras)],text=True,timeout=160)
data=json.loads(raw)
if data.get('existing_run'):raise SystemExit('Run exists: discovery cannot change history')
with path.open('x') as f:json.dump(data,f,ensure_ascii=False,indent=2)
os.chmod(path,0o600);print(json.dumps({'path':str(path),'securities':len(data['securities'])}))
