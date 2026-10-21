"""Synthetic subprocess fixtures ONLY; no fixture is used as live market evidence."""
import copy, importlib.util, json, pathlib, subprocess, sys, tempfile, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
SCRIPT=ROOT/'scripts/worker-notify.py'
def result(pending=True):
    return {'id':'test-fixture-run','status':'pending_data' if pending else 'ok_with_exclusions','exitCode':2 if pending else 0,'processed':100,'errors':[], 'summary':{'selected':100,'processed':100,'total':100,'candidate_snapshot':100,'remaining':0,'coverage_complete':True,'unexpected_failures':0,'new_failures':0,'pending_data':15 if pending else 0,'new_pending':15 if pending else 0,'pending_incidents':[{'symbol':'MC.PA','sessions':['2026-10-20'],'classes':['latest_unavailable'],'expected_close_at':{'2026-10-20':'2026-10-20T15:30:00Z'}}] if pending else []}}
class NotifyTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.state=pathlib.Path(self.tmp.name)/'incident.json'
    def tearDown(self):self.tmp.cleanup()
    def run_fixture(self,r=None,code=None,stderr='',raw=None):
        if r is None:r=result()
        if code is None:code=r['exitCode']
        payload=json.dumps(r) if raw is None else raw
        fixture="import sys;sys.stdout.write("+repr(payload)+");sys.stderr.write("+repr(stderr)+");sys.exit("+str(code)+")"
        return subprocess.run([sys.executable,str(SCRIPT),'--state',str(self.state),'--',sys.executable,'-c',fixture],text=True,capture_output=True)
    def test_pending_first_repeat_change_recovery(self):
        a=self.run_fixture();self.assertEqual(a.returncode,0,a.stderr);self.assertIn('en attente',a.stdout);self.assertLess(len(a.stdout),700)
        self.assertEqual(self.run_fixture().stdout,'')
        # Count/new_pending/date jitter must not turn one provider incident into daily spam.
        b=result();b['summary']['pending_data']=16;b['summary']['new_pending']=1;b['summary']['pending_incidents'][0]['sessions']=['2026-10-21'];b['summary']['pending_incidents'][0]['expected_close_at']={'2026-10-21':'2026-10-21T15:30:00Z'}
        self.assertEqual(self.run_fixture(b).stdout,'')
        b['summary']['pending_incidents'][0]['classes']=['historical_gap'];self.assertTrue(self.run_fixture(b).stdout)
        self.assertEqual(self.run_fixture(b).stdout,'')
        self.assertIn('rétablie',self.run_fixture(result(False)).stdout);self.assertEqual(self.run_fixture(result(False)).stdout,'')
        self.assertIn('en attente',self.run_fixture().stdout)
    def test_aging_escalates_once_without_replacing_first_seen(self):
        self.run_fixture();state=json.loads(self.state.read_text());state['active']['MC.PA']['first_seen']='2020-01-01T00:00:00+00:00';self.state.write_text(json.dumps(state))
        a=self.run_fixture();self.assertIn('prolongée',a.stdout);self.assertEqual(a.returncode,0);self.assertEqual(self.run_fixture().stdout,'')
        self.assertEqual(json.loads(self.state.read_text())['active']['MC.PA']['first_seen'],'2020-01-01T00:00:00+00:00')
    def test_72_hour_then_seven_day_escalation_and_new_listing(self):
        import datetime as dt
        self.run_fixture();state=json.loads(self.state.read_text());state['active']['MC.PA']['first_seen']=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(hours=73)).isoformat();self.state.write_text(json.dumps(state))
        self.assertIn('prolongée',self.run_fixture().stdout);self.assertEqual(self.run_fixture().stdout,'')
        state=json.loads(self.state.read_text());self.assertEqual(state['active']['MC.PA']['level'],1)
        state['active']['MC.PA']['first_seen']=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=8)).isoformat();self.state.write_text(json.dumps(state))
        self.assertIn('prolongée',self.run_fixture().stdout);self.assertEqual(self.run_fixture().stdout,'')
        r=result();other=copy.deepcopy(r['summary']['pending_incidents'][0]);other['symbol']='AIR.PA';r['summary']['pending_incidents'].append(other)
        self.assertIn('AIR.PA',self.run_fixture(r).stdout);self.assertEqual(self.run_fixture(r).stdout,'')
    def test_fail_closed_on_crash_http_structural_or_partial(self):
        for raw,code in [('not json',0),('',1),('{}',2)]:
            with self.subTest(raw=raw):self.assertNotEqual(self.run_fixture(raw=raw,code=code).returncode,0)
        for mutate in [lambda r:r.update(status='partial'),lambda r:r.update(errors=[{'unexpected':True,'error':'HTTP 429'}]),lambda r:r['summary'].update(unexpected_failures=1),lambda r:r['summary'].update(new_failures=1),lambda r:r['summary'].update(coverage_complete=False),lambda r:r['summary'].update(remaining=1),lambda r:r['summary'].update(pending_incidents=[]),lambda r:r['summary'].update(processed=99),lambda r:r.update(exitCode=0),lambda r:r['summary'].update(unexpected_failures=False),lambda r:r['summary']['pending_incidents'][0].update(sessions=['bad'])]:
            r=result();mutate(r)
            with self.subTest(r=r):self.assertNotEqual(self.run_fixture(r,code=2).returncode,0)
        self.assertNotEqual(self.run_fixture(stderr='unexpected diagnostic').returncode,0)
        self.assertNotEqual(self.run_fixture(result(False),code=1).returncode,0)
    def test_corrupt_state_and_no_false_recovery_after_error(self):
        self.run_fixture();previous=self.state.read_text();r=result(False);r['errors']=[{'error':'invalid OHLC'}]
        self.assertNotEqual(self.run_fixture(r).returncode,0);self.assertEqual(self.state.read_text(),previous)
        self.state.write_text('{broken');self.assertNotEqual(self.run_fixture().returncode,0)
    def test_healthy_initial_is_quiet_but_persisted_as_business_status(self):
        self.assertEqual(self.run_fixture(result(False)).stdout,'');self.assertEqual(json.loads(self.state.read_text())['business_status'],'ok_with_exclusions')
if __name__=='__main__':unittest.main()
