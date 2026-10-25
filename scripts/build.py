import json,datetime as dt,pathlib,os
from zoneinfo import ZoneInfo
from sleep_details import summarize_sleep
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=pathlib.Path(os.environ.get('HEALTH_DATA_PATH',str(pathlib.Path.home()/'Library/Application Support/PersonalHealthAnalysis/.private/latest.json')))
TZ=ZoneInfo('Asia/Shanghai')
RECOVERY_TYPES={'RUNNING','BIKING','STRENGTH_TRAINING','WEIGHTLIFTING','WEIGHT_LIFTING','CALISTHENICS','RESISTANCE_TRAINING'}
def instant(s): return dt.datetime.fromisoformat(s.replace('Z','+00:00')).astimezone(TZ)
def dedupe(records,field):
    # Prefer explicit recordings, then longest interval; never sum overlapping sessions.
    candidates=[]
    for r in records:
        s=r[field];i=s.get('interval',{})
        if not i.get('startTime') or not i.get('endTime'):continue
        a,b=instant(i['startTime']),instant(i['endTime'])
        candidates.append((r,a,b))
    candidates.sort(key=lambda x:(x[0].get('dataSource',{}).get('recordingMethod')=='ACTIVELY_MEASURED',(x[2]-x[1]).total_seconds()),reverse=True)
    kept=[]
    for r,a,b in candidates:
        if not any(a<y and b>x for _,x,y in kept):kept.append((r,a,b))
    return sorted(kept,key=lambda x:x[1])
def build(raw,old,recovery=None):
    recovery=recovery or {}
    if raw.get('errors'): raise ValueError('Incomplete source')
    days={d['date']:d for d in old.get('days',[])}
    start=instant(raw['periodStart']).date();end=instant(raw['periodEndExclusive']).date()
    for n in range((end-start).days):
        key=(start+dt.timedelta(days=n)).isoformat()
        days[key]={'date':key,'sleepMinutes':None,'bedtime':None,'wake':None,'beforeMidnight':None,'napMinutes':None,'steps':None,'runMinutes':None,'runKm':None,'strengthMinutes':None,'activities':[],'sleepSessions':[]}
    def day(date):return days.get(date.isoformat())
    for r,a,b in dedupe(raw['data'].get('sleep',[]),'sleep'):
        d=day(b.date());s=r['sleep'];mins=s.get('summary',{}).get('minutesAsleep')
        if d is None:continue
        d['sleepSessions'].append(summarize_sleep(s))
        if mins is None:continue
        mins=float(mins)
        if s.get('metadata',{}).get('mainSleep'):
            if d['sleepMinutes'] is None or mins>d['sleepMinutes']:
                d.update(sleepMinutes=mins,bedtime=a.isoformat(),wake=b.isoformat(),beforeMidnight=a.date()<b.date() and a.hour>=18)
        else:d['napMinutes']=(d['napMinutes'] or 0)+mins
    for r,a,b in dedupe(raw['data'].get('exercise',[]),'exercise'):
        d=day(a.date());s=r['exercise']
        if d is None:continue
        typ=s.get('exerciseType','UNKNOWN');m=s.get('metricsSummary',{})
        mins=float(s.get('activeDuration',str((b-a).total_seconds())+'s').rstrip('s'))/60
        km=float(m['distanceMillimeters'])/1e6 if 'distanceMillimeters' in m else None
        activity={'type':typ,'start':a.isoformat(),'minutes':round(mins,1),'km':round(km,2) if km is not None else None}
        if typ in RECOVERY_TYPES:
            k=s['interval']['startTime']+'|'+s['interval']['endTime']
            activity['recovery']=recovery.get(k,{}).get('result',{'hrr1':None,'hrr2':None,'note':'暂无足够心率采样。'})
        d['activities'].append(activity)
        if typ=='RUNNING':
            d['runMinutes']=(d['runMinutes'] or 0)+mins
            if km is not None:d['runKm']=(d['runKm'] or 0)+km
        if typ in {'STRENGTH_TRAINING','WEIGHTLIFTING','WEIGHT_LIFTING','CALISTHENICS','RESISTANCE_TRAINING'}:
            d['strengthMinutes']=(d['strengthMinutes'] or 0)+mins
    for r,a,b in dedupe(raw['data'].get('steps',[]),'steps'):
        d=day(a.date())
        if d is not None and 'count' in r['steps']:d['steps']=(d['steps'] or 0)+int(r['steps']['count'])
    for kind,field,value,out in [('daily-resting-heart-rate','dailyRestingHeartRate','beatsPerMinute','rhr'),('daily-heart-rate-variability','dailyHeartRateVariability','averageHeartRateVariabilityMilliseconds','hrv')]:
        for r in raw['data'].get(kind,[]):
            s=r[field];date=s['date'];d=day(dt.date(date['year'],date['month'],date['day']))
            if d is not None and value in s:d[out]=float(s[value])
    return {'fetchedAt':raw['fetchedAt'],'deviceSync':max((d.get('lastSyncTime','') for d in raw['devices']),default=''),'days':sorted(days.values(),key=lambda d:d['date'])[-180:],'planStart':'2026-10-26','planEnd':'2027-01-25'}
if __name__=='__main__':
    p=ROOT/'.private/summary.json';old=json.loads(p.read_text()) if p.exists() else {}
    recovery_path=ROOT/'.private/recovery.json'
    recovery=json.loads(recovery_path.read_text()) if recovery_path.exists() else {}
    result=build(json.loads(SOURCE.read_text()),old,recovery)
    p.write_text(json.dumps(result,ensure_ascii=False));p.chmod(0o600)
    print('Aggregated health data locally; '+str(len(result['days']))+' days')
