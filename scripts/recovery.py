"""Fetch short heart-rate windows for runs; retain raw samples only on this Mac."""
import datetime as dt,fcntl,importlib.util,json,pathlib,os
from build import instant,dedupe,RECOVERY_TYPES
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=ROOT/'.private/recovery.json'
def key(exercise):return exercise['interval']['startTime']+'|'+exercise['interval']['endTime']
def calculate(rows,end,device=None):
    groups={}
    for row in rows:
        sample=row.get('heartRate',{});timestamp=sample.get('sampleTime',{}).get('physicalTime');bpm=sample.get('beatsPerMinute')
        if timestamp is None or bpm is None:continue
        source=row.get('dataSource',{});dev=source.get('device',{}).get('displayName')
        if device and dev!=device:continue
        group=json.dumps(source,sort_keys=True)
        groups.setdefault(group,[]).append((instant(timestamp),int(bpm)))
    # All three readings must come from the same source, never mix sensors.
    best={'hrr1':None,'hrr2':None,'note':'缺少同一设备的运动结束前后采样，无法计算。'};best_score=-1
    for samples in groups.values():
        baseline=[p for p in samples if 0<=(end-p[0]).total_seconds()<=10]
        if not baseline:continue
        base=max(baseline,key=lambda p:p[0]);out={'hrr1':None,'hrr2':None,'endBpm':base[1],'endOffsetSeconds':round((base[0]-end).total_seconds(),1),'note':'按运动结束时间附近的同源心率采样估算；冷身或走动会影响结果。'}
        for minute in (1,2):
            target=end+dt.timedelta(minutes=minute)
            near=[p for p in samples if abs((p[0]-target).total_seconds())<=10]
            if near:
                point=min(near,key=lambda p:abs((p[0]-target).total_seconds()))
                out[f'hrr{minute}']=base[1]-point[1];out[f'after{minute}Bpm']=point[1];out[f'after{minute}OffsetSeconds']=round((point[0]-target).total_seconds(),1)
        score=sum(out[f'hrr{i}'] is not None for i in (1,2))
        if score>best_score:best,best_score=out,score
    return best

def main():
    hp=pathlib.Path(os.environ.get('HEALTH_CLIENT_PATH',str(pathlib.Path.home()/'Library/Application Support/PersonalHealthAnalysis/health.py')))
    spec=importlib.util.spec_from_file_location('health',hp);h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
    raw=h.read(h.PRIVATE/'latest.json');cache=h.read(CACHE,{})
    with (h.PRIVATE/'run.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            print('Heart-rate enrichment deferred: connector busy');return
        runs=[r for r,a,b in dedupe(raw['data'].get('exercise',[]),'exercise') if r['exercise']['exerciseType'] in RECOVERY_TYPES]
        for row in runs:
            exercise=row['exercise'];k=key(exercise);entry=cache.get(k);now=dt.datetime.now(dt.timezone.utc)
            if entry and entry.get('sourceUpdatedAt')==exercise.get('updateTime'):
                if entry.get('result',{}).get('hrr1') is not None and entry.get('result',{}).get('hrr2') is not None:continue
                if (now-dt.datetime.fromisoformat(entry['checkedAt'])).total_seconds()<3600:continue
            end=instant(exercise['interval']['endTime']);lo=(end-dt.timedelta(seconds=11)).isoformat();hi=(end+dt.timedelta(seconds=131)).isoformat()
            try:
                rows=h.pages('dataTypes/heart-rate/dataPoints','dataPoints',{'filter':f'heart_rate.sample_time.physical_time >= "{lo}" AND heart_rate.sample_time.physical_time < "{hi}"','pageSize':1000,'dataSourceFamily':'users/me/dataSourceFamilies/google-wearables'})
                device=row.get('dataSource',{}).get('device',{}).get('displayName')
                result=calculate(rows,end,device)
                cache[k]={'checkedAt':now.isoformat(),'sourceUpdatedAt':exercise.get('updateTime'),'result':result,'samples':rows}
            except h.HealthError:
                # Preserve previous valid measurements and make unavailable measurements explicit.
                if not entry:cache[k]={'checkedAt':now.isoformat(),'sourceUpdatedAt':exercise.get('updateTime'),'result':{'hrr1':None,'hrr2':None,'note':'心率采样暂时读取失败，等待下次同步。'}}
            h.save(CACHE,cache)
    print('Heart-rate recovery windows checked:',len(runs))
if __name__=='__main__':main()
