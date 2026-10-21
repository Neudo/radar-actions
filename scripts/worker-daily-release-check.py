#!/usr/bin/env python3
"""Read-only original-row and deployment fingerprint checks. Private evidence under data/."""
import hashlib,json,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
TABLES=['radar_runs','radar_signals','price_observations','price_revisions','data_conflicts','worker_issues','market_fetches','split_audits']
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def snapshot():
    result={}
    for table in TABLES:
        text=subprocess.check_output([str(ROOT/'scripts/compose.sh'),'exec','-T','db','psql','-U','radar_owner','-d','investment_radar','-Atc',f"SELECT coalesce(json_agg(x),'[]') FROM {table} x"],text=True)
        rows=json.loads(text);result[table]={str(row['id']):digest(row) for row in rows}
    return result
path=ROOT/'data/worker-daily-release-originals.json'
if sys.argv[1]=='before':
    assert not path.exists(),'Existing baseline must not be overwritten'
    value={'tables':snapshot(),'files':{}}
    for filename in ['/home/debian/.hermes/cron/jobs.json','/etc/caddy/Caddyfile',str(ROOT/'deploy/Caddyfile'),str(ROOT/'src/quotes.ts'),str(ROOT/'scripts/exchange-calendar.py')]:
        file=pathlib.Path(filename)
        if file.exists():value['files'][filename]=hashlib.sha256(file.read_bytes()).hexdigest()
    path.write_text(json.dumps(value));path.chmod(0o600)
    print(json.dumps({'original_counts':{k:len(v) for k,v in value['tables'].items()},'protected_files':value['files']},indent=2))
else:
    before=json.loads(path.read_text());after=snapshot();report={}
    for table,rows in before['tables'].items():
        assert all(after[table].get(key)==h for key,h in rows.items()),'Original row changed in '+table
        if table in ['radar_runs','radar_signals','split_audits']:assert len(rows)==len(after[table])
        report[table]={'original':len(rows),'now':len(after[table]),'original_hashes_unchanged':True}
    for filename,h in before['files'].items():assert hashlib.sha256(pathlib.Path(filename).read_bytes()).hexdigest()==h,'Protected file changed: '+filename
    output={'tables':report,'protected_files_unchanged':True}
    target=ROOT/'data/worker-daily-release-integrity.json';target.write_text(json.dumps(output,indent=2));target.chmod(0o600);print(json.dumps(output,indent=2))
