#!/usr/bin/env python3
import pathlib,sys,urllib.request,json
values={}
for line in pathlib.Path('/home/debian/.hermes/.env').read_text().splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  k,v=line.split('=',1);values[k.strip()]=v.strip().strip('"').strip("'")
path=sys.argv[1] if len(sys.argv)>1 else '/health'
if not path.startswith('/') or path.startswith('//'):raise SystemExit('Only local API paths permitted')
req=urllib.request.Request('http://127.0.0.1:17845'+path,headers={'Authorization':'Bearer '+values['IR_READ_KEY']})
with urllib.request.urlopen(req,timeout=30) as r:print(json.dumps(json.load(r),ensure_ascii=False,indent=2))
