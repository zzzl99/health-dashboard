import unittest,sys,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from sleep_details import summarize_sleep
class SleepDetails(unittest.TestCase):
 def base(self):return {'interval':{'startTime':'2026-10-24T20:00:00Z','endTime':'2026-10-24T21:00:00Z'},'metadata':{'mainSleep':True},'type':'STAGES','summary':{'minutesAsleep':'55','minutesAwake':'5','stagesSummary':[{'type':'AWAKE','minutes':'5'},{'type':'DEEP','minutes':'10'},{'type':'LIGHT','minutes':'45'}]}}
 def segment(self,a,b,kind='LIGHT'):return {'startTime':f'2026-10-24T20:{a}:00Z','endTime':f'2026-10-24T20:{b}:00Z','type':kind}
 def test_short_awakenings_overlap_do_not_reduce_sleep(self):
  s=self.base();s['shortAwakenings']=[self.segment('10','12'),self.segment('11','13')]
  d=summarize_sleep(s);self.assertEqual(d['shortAwakeningMinutes'],3);self.assertEqual(d['asleepMinutes'],55);self.assertEqual(d['awakeMinutes'],5)
 def test_missing_does_not_become_zero(self):
  d=summarize_sleep(self.base());self.assertIsNone(d['shortAwakeningMinutes']);self.assertIsNone(d['firstDeepMinutes']);self.assertEqual(d['segments'],[])
 def test_timeline_clips_to_session_and_preserves_real_deep_latency(self):
  s=self.base();s['stages']=[{'startTime':'2026-10-24T19:59:00Z','endTime':'2026-10-24T20:05:00Z','type':'AWAKE'},self.segment('26','36','DEEP')]
  d=summarize_sleep(s);self.assertEqual(d['segments'][0]['start'],0);self.assertEqual(d['segments'][0]['end'],300);self.assertEqual(d['firstDeepMinutes'],26)
 def test_classic_sleep_is_not_fabricated_into_rem(self):
  s=self.base();s['type']='CLASSIC';s['summary']={'minutesAsleep':'20'};s['stages']=[self.segment('05','25','ASLEEP')]
  d=summarize_sleep(s);self.assertEqual(d['stageMinutes']['ASLEEP'],20);self.assertNotIn('REM',d['stageMinutes'])
if __name__=='__main__':unittest.main()
