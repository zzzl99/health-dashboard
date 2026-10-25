import unittest,sys,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from heart_rate import aggregate
class MinuteHeartRate(unittest.TestCase):
 def row(self,t,bpm,device='Fitbit Air'):
  return {'dataSource':{'device':{'displayName':device}},'heartRate':{'sampleTime':{'physicalTime':t},'beatsPerMinute':str(bpm)}}
 def test_minute_mean_range_counts_and_latest_sample(self):
  rows=[self.row('2026-10-25T00:25:01Z',60),self.row('2026-10-25T00:25:11Z',70),self.row('2026-10-25T00:26:01Z',80)]
  points,daily,latest=aggregate(rows)
  self.assertEqual(points[0][1:],[65,60,70,2]);self.assertEqual(daily['mean'],70);self.assertEqual(latest['bpm'],80)
 def test_duplicates_and_other_sensors_are_not_double_counted(self):
  a=self.row('2026-10-25T00:25:01Z',60)
  points,daily,_=aggregate([a,a,self.row('2026-10-25T00:25:01Z',180,'Other')]);self.assertEqual(points[0][4],1);self.assertEqual(daily['mean'],60)
 def test_missing_is_missing(self):self.assertEqual(aggregate([]),([],None,None))
if __name__=='__main__':unittest.main()
