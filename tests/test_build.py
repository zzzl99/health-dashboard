import unittest,sys,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from build import build
class Aggregation(unittest.TestCase):
 def raw(self):return {'fetchedAt':'2026-10-25T13:39:00+08:00','periodStart':'2026-10-24T00:00:00+08:00','periodEndExclusive':'2026-10-26T00:00:00+08:00','devices':[],'data':{},'errors':{}}
 def test_missing_is_not_zero(self):
  d=build(self.raw(),{})['days'][0];self.assertIsNone(d['sleepMinutes']);self.assertIsNone(d['runMinutes']);self.assertIsNone(d['steps'])
 def test_partial_rejected(self):
  r=self.raw();r['errors']={'sleep':'failed'}
  with self.assertRaises(ValueError):build(r,{})
 def test_overlap_and_strength(self):
  r=self.raw()
  def session(t,start,end,method):return {'dataSource':{'recordingMethod':method},'exercise':{'exerciseType':t,'interval':{'startTime':start,'endTime':end},'activeDuration':'1200s'}}
  r['data']['exercise']=[session('RUNNING','2026-10-24T12:00:00Z','2026-10-24T12:20:00Z','ACTIVELY_MEASURED'),session('RUNNING','2026-10-24T12:05:00Z','2026-10-24T12:25:00Z','PASSIVELY_MEASURED'),session('STRENGTH_TRAINING','2026-10-24T13:00:00Z','2026-10-24T13:20:00Z','ACTIVELY_MEASURED')]
  d=build(r,{})['days'][0];self.assertEqual(d['runMinutes'],20);self.assertEqual(d['strengthMinutes'],20);self.assertEqual(len(d['activities']),2)
 def test_sleep_timezone_nap(self):
  r=self.raw();r['data']['sleep']=[{'sleep':{'interval':{'startTime':'2026-10-24T15:40:00Z','endTime':'2026-10-25T00:00:00Z'},'summary':{'minutesAsleep':'470'},'metadata':{'mainSleep':True}}},{'sleep':{'interval':{'startTime':'2026-10-25T05:00:00Z','endTime':'2026-10-25T05:20:00Z'},'summary':{'minutesAsleep':'20'}}}]
  d=build(r,{})['days'][1];self.assertEqual(d['sleepMinutes'],470);self.assertEqual(d['napMinutes'],20);self.assertTrue(d['beforeMidnight'])
if __name__=='__main__':unittest.main()
