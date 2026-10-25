import unittest,sys,pathlib,datetime as dt
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from recovery import calculate
class Recovery(unittest.TestCase):
 def setUp(self):self.end=dt.datetime.fromisoformat('2026-10-24T21:40:00+08:00')
 def sample(self,seconds,bpm,device='Fitbit Air'):
  return {'dataSource':{'device':{'displayName':device}},'heartRate':{'sampleTime':{'physicalTime':(self.end+dt.timedelta(seconds=seconds)).isoformat()},'beatsPerMinute':str(bpm)}}
 def test_drop(self):
  r=calculate([self.sample(-2,160),self.sample(61,135),self.sample(119,120)],self.end,'Fitbit Air')
  self.assertEqual(r['hrr1'],25);self.assertEqual(r['hrr2'],40)
 def test_missing_sample_not_interpolated(self):
  r=calculate([self.sample(0,160),self.sample(80,130),self.sample(120,122)],self.end)
  self.assertIsNone(r['hrr1']);self.assertEqual(r['hrr2'],38)
 def test_no_mixing_devices(self):
  r=calculate([self.sample(0,160),self.sample(60,130,'Other')],self.end)
  self.assertIsNone(r['hrr1'])
 def test_no_baseline_and_negative_recovery(self):
  self.assertIsNone(calculate([self.sample(60,130)],self.end)['hrr1'])
  self.assertEqual(calculate([self.sample(0,140),self.sample(60,150)],self.end)['hrr1'],-10)
if __name__=='__main__':unittest.main()
