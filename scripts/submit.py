#!/usr/bin/env python3
import sys,json,pathlib,urllib.request,urllib.error,os
root=pathlib.Path('/home/debian/.hermes/workspace/projects/investment-radar')
payload_path=pathlib.Path(sys.argv[1]).resolve();payload=json.loads(payload_path.read_text())
ctx=json.loads((root/'data'/f"{payload['run_date']}.context.json").read_text())
if ctx.get('existing_run'):raise SystemExit('Existing run: do not regenerate; deliver stored report')
if payload['cutoff_at']!=ctx['cutoff_at'] or payload['run_key']!=ctx['run_key']:raise SystemExit('Cutoff/run_key differs from frozen context')
discovery_path=root/'data'/f"{payload['run_date']}.discoveries.context.json"
if discovery_path.exists():
 extra=json.loads(discovery_path.read_text())
 if extra['cutoff_at']!=ctx['cutoff_at']:raise SystemExit('Discovery cutoff mismatch')
 known={(w['ticker'],w['exchange']) for w in ctx['securities']}
 ctx['securities'] += [w for w in extra['securities'] if (w['ticker'],w['exchange']) not in known]
for s in payload['signals']:
 quotes=[w for w in ctx['securities'] if w['ticker']==s['ticker'] and w['exchange']==s['exchange']]
 if not quotes:raise SystemExit('Security missing frozen quote context: '+s['ticker'])
 w=quotes[0]
 for k in ['signal_price','quote_at','quote_source','currency','market_symbol','data_status','data_reason']:s[k]=w[k]
 if s['data_status']=='missing' and s['tag']!='ORANGE':raise SystemExit('Missing data must be ORANGE with explicit incompleteness')
secrets={}
for line in pathlib.Path('/home/debian/.hermes/.env').read_text().splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  k,v=line.split('=',1);secrets[k.strip()]=v.strip().strip('"').strip("'")
req=urllib.request.Request('http://127.0.0.1:17845/api/v1/radar/runs',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+secrets['IR_API_KEY'],'Content-Type':'application/json'},method='POST')
try:
 with urllib.request.urlopen(req,timeout=30) as r:result=json.load(r)
 req=urllib.request.Request('http://127.0.0.1:17845/api/v1/radar/runs?run_key='+payload['run_key'],headers={'Authorization':'Bearer '+secrets['IR_READ_KEY']})
 with urllib.request.urlopen(req,timeout=30) as r:stored=json.load(r)['items']
 if len(stored)!=1 or stored[0]['id']!=result['id'] or stored[0]['payload']!=payload:raise RuntimeError('Readback verification failed')
 print(json.dumps({'stored':True,'verified':True,**result}))
except urllib.error.HTTPError as e:
 print(json.dumps({'stored':False,'status':e.code,'error':e.read().decode()}));sys.exit(1)
