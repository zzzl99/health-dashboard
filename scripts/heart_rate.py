"""Minute-level heart-rate aggregates; no raw sample export."""
import datetime as dt,fcntl,importlib.util,json,os,pathlib
from zoneinfo import ZoneInfo
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'docs/heart-rate.json'
TZ=ZoneInfo('Asia/Shanghai')
def aggregate(rows):
    samples={}
    for row in rows:
        source=row.get('dataSource',{});device=source.get('device',{}).get('displayName')
        if device!='Fitbit Air':continue
        hr=row.get('heartRate',{});stamp=hr.get('sampleTime',{}).get('physicalTime');bpm=hr.get('beatsPerMinute')
        if stamp is None or bpm is None:continue
        t=dt.datetime.fromisoformat(stamp.replace('Z','+00:00'));samples[int(t.timestamp()*1000)]=int(bpm)
    buckets={}
    for stamp,bpm in sorted(samples.items()):buckets.setdefault(stamp//60000*60000,[]).append(bpm)
    points=[[stamp,round(sum(values)/len(values),2),min(values),max(values),len(values)] for stamp,values in buckets.items()]
    if not samples:return points,None,None
    values=list(samples.values());latest=max(samples)
    return points,{'mean':round(sum(values)/len(values),2),'min':min(values),'max':max(values),'samples':len(values)}, {'time':dt.datetime.fromtimestamp(latest/1000,TZ).isoformat(),'bpm':samples[latest]}
def main():
    hp=pathlib.Path(os.environ.get('HEALTH_CLIENT_PATH',str(pathlib.Path.home()/'Library/Application Support/PersonalHealthAnalysis/health.py')))
    spec=importlib.util.spec_from_file_location('health',hp);h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
    now=dt.datetime.now(TZ);today=now.date();old=h.read(OUTPUT,{})
    history={d['date']:d for d in old.get('daily',[])};days={d['date']:d for d in old.get('days',[])};latest=old.get('latest');errors={}
    with (h.PRIVATE/'run.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        for offset in range(6,-1,-1):
            date=today-dt.timedelta(days=offset);key=date.isoformat()
            if offset>=2 and key in days:continue
            start=dt.datetime.combine(date,dt.time(),TZ);end=start+dt.timedelta(days=1)
            try:
                rows=h.pages('dataTypes/heart-rate/dataPoints','dataPoints',{'filter':f'heart_rate.sample_time.physical_time >= "{start.isoformat()}" AND heart_rate.sample_time.physical_time < "{end.isoformat()}"','pageSize':10000,'dataSourceFamily':'users/me/dataSourceFamilies/google-wearables'})
                points,summary,last=aggregate(rows)
                days[key]={'date':key,'points':points,'fetchedAt':now.isoformat()}
                history[key]={'date':key,**(summary or {'mean':None,'min':None,'max':None,'samples':0})}
                if last and (not latest or last['time']>=latest['time']):latest=last
            except h.HealthError as e:errors[key]=str(e)
    result={'attemptedAt':now.isoformat(),'latest':latest,'resolution':'minute','days':[days[k] for k in sorted(days) if k>=(today-dt.timedelta(days=6)).isoformat()],'daily':[history[k] for k in sorted(history)][-180:],'errors':errors}
    h.save(OUTPUT,result);print('Heart-rate minute aggregates updated; unavailable days:',len(errors))
if __name__=='__main__':main()
