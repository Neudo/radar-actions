#!/usr/bin/env python3
"""Hermes no_agent transport adapter. CLI business exit 2 stays in DB/last_result.
Only a strictly validated pending-only result is accepted as transport success.
Unexpected errors NEVER become success. Stdout is a bounded French notification.
"""
import argparse
import datetime as dt
import fcntl
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile

UTC=dt.timezone.utc

def timestamp(value):
    if not isinstance(value,str): raise ValueError('timestamp absent')
    parsed=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
    if parsed.tzinfo is None: raise ValueError('timestamp without timezone')
    return parsed

def validate(result, exit_code):
    if not isinstance(result,dict) or not isinstance(result.get('id'),str) or not result['id']:
        raise ValueError('worker run id absent')
    s=result['summary']
    if not isinstance(s,dict) or result.get('errors')!=[]:
        raise ValueError('worker errors or invalid summary: '+json.dumps(result.get('errors'),ensure_ascii=False)[:1000])
    for key in ('selected','processed','total','candidate_snapshot','remaining','unexpected_failures','new_failures','pending_data','new_pending'):
        if type(s.get(key)) is not int or s[key]<0: raise ValueError('invalid counter '+key)
    if s['total']<1 or s['unexpected_failures'] or s['new_failures'] or s['remaining'] or s.get('coverage_complete') is not True:
        raise ValueError('unexpected error or incomplete coverage')
    if not (s['selected']==s['processed']==s['candidate_snapshot']==result.get('processed')):
        raise ValueError('inconsistent coverage counters')
    if s['pending_data']>s['processed'] or s['new_pending']>s['pending_data']:
        raise ValueError('inconsistent pending counters')
    pending=result.get('status')=='pending_data'
    expected=2 if pending else 0
    if type(result.get('exitCode')) is not int or result['exitCode']!=expected or exit_code!=expected:
        raise ValueError('business/process exit mismatch')
    if not pending and result.get('status') not in ('ok','ok_with_exclusions'):
        raise ValueError('unhandled business state')
    incidents=s.get('pending_incidents')
    if not isinstance(incidents,list) or bool(incidents)!=pending or bool(s['pending_data'])!=pending:
        raise ValueError('pending evidence missing/inconsistent')
    found={}
    for item in incidents:
        symbol=item['symbol'];sessions=item['sessions'];classes=item['classes']
        if not isinstance(symbol,str) or not re.fullmatch(r'[A-Z0-9.-]{1,20}',symbol) or symbol in found:
            raise ValueError('invalid/duplicate listing')
        if not isinstance(sessions,list) or not sessions or len(set(sessions))!=len(sessions):
            raise ValueError('invalid pending sessions')
        for day in sessions:
            if dt.date.fromisoformat(day).isoformat()!=day: raise ValueError('invalid session')
            timestamp(item['expected_close_at'][day])
        if not isinstance(classes,list) or not classes or not set(classes)<= {'latest_unavailable','historical_gap'}:
            raise ValueError('invalid availability class')
        found[symbol]=item
    return found

def atomic_write(path, value):
    fd,name=tempfile.mkstemp(prefix='.'+path.name+'.',dir=path.parent)
    try:
        with os.fdopen(fd,'w') as f:
            json.dump(value,f,ensure_ascii=False,sort_keys=True);f.flush();os.fsync(f.fileno())
        os.replace(name,path)
        directory=os.open(path.parent,os.O_DIRECTORY)
        try:os.fsync(directory)
        finally:os.close(directory)
    finally:
        if os.path.exists(name):os.unlink(name)

def notify(path,result,code):
    incidents=validate(result,code)
    previous=json.loads(path.read_text()) if path.exists() else {'version':1,'active':{}}
    if previous.get('version')!=1 or not isinstance(previous.get('active'),dict):
        raise ValueError('invalid incident state; manual inspection required')
    active={};now=dt.datetime.now(UTC);changed=False;escalated=False
    for symbol,item in incidents.items():
        old=previous['active'].get(symbol)
        if old is not None and (not isinstance(old,dict) or not isinstance(old.get('classes'),list) or type(old.get('level')) is not int):
            raise ValueError('corrupt active incident')
        first=timestamp(old['first_seen']) if old else now
        # Thresholds are persistent elapsed outage age, NOT run count or today's date.
        age=(now-first).total_seconds()
        level=2 if age>=7*86400 else 1 if age>=72*3600 else 0
        classes=sorted(set(item['classes']))
        changed |= old is None or classes!=old['classes']
        escalated |= old is not None and level>old['level']
        active[symbol]={'first_seen':first.isoformat(),'level':max(level,old['level'] if old else 0),'classes':classes}
    resolved=set(previous['active'])-set(active)
    message=''
    if active and (changed or escalated or resolved):
        listings=', '.join(sorted(active)[:12])+('…' if len(active)>12 else '')
        sessions=sorted({day for x in incidents.values() for day in x['sessions']})
        dates=sessions[0] if len(sessions)==1 else sessions[0]+'…'+sessions[-1]
        prefix='⚠ Attente fournisseur prolongée' if escalated else '⚠ Données fournisseur en attente'
        message=f"{prefix} — {listings} ; séances {dates}. {result['summary']['pending_data']} suivis concernés ; couverture {result['summary']['processed']}/{result['summary']['candidate_snapshot']}. Statut métier pending_data (CLI 2), rendements concernés exclus. Nouvelle tentative au prochain jour ouvré à 09:30 Paris."
    elif not active and previous['active']:
        message='Collecte fournisseur rétablie — couverture complète, aucune séance en attente. Les exclusions/quarantaines existantes restent explicites.'
    state={'version':1,'active':active,'checked_at':now.isoformat(),'business_status':result['status'],'worker_exit_code':code,'last_result':result,'last_notification':message or previous.get('last_notification','')}
    atomic_write(path,state)
    if message:print(message,flush=True)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--state',type=pathlib.Path,default=pathlib.Path('/home/debian/.hermes/workspace/projects/investment-radar/state/worker-notification.json'))
    p.add_argument('command',nargs=argparse.REMAINDER)
    a=p.parse_args();command=a.command[1:] if a.command[:1]==['--'] else a.command
    if not command:p.error('worker command required after --')
    a.state.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    # Serializes worker + state transition, avoiding concurrent first/recovery messages.
    with a.state.with_suffix('.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        child=subprocess.run(command,capture_output=True,text=True,timeout=1500)
        if child.stderr.strip():
            # Compose uses stderr for normal container lifecycle lines. The raw runner
            # uses --quiet --no-deps to avoid these, so ANY residual stderr fails closed.
            raise ValueError('worker stderr: '+child.stderr.strip()[:1200])
        if len(child.stdout)>2_000_000:raise ValueError('oversize worker result')
        try:result=json.loads(child.stdout)
        except (ValueError,TypeError):raise ValueError(f'invalid worker JSON (process exit {child.returncode})')
        notify(a.state,result,child.returncode)
    return 0

if __name__=='__main__':
    try:sys.exit(main())
    except Exception as exc:
        print('Worker notification adapter FAILED: '+str(exc)[:1600],file=sys.stderr)
        sys.exit(1)
