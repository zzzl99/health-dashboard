"""Publish only the sleep timeline fields needed by the dashboard."""
import datetime as dt
STAGES=('AWAKE','RESTLESS','REM','LIGHT','DEEP','ASLEEP')
def timestamp(s):return dt.datetime.fromisoformat(s.replace('Z','+00:00'))
def union_seconds(segments):
    end=None;total=0
    for a,b in sorted((s['start'],s['end']) for s in segments):
        if end is None or a>end:total+=b-a
        elif b>end:total+=b-end
        end=b if end is None else max(end,b)
    return total

def summarize_sleep(s):
    start=timestamp(s['interval']['startTime']);end=timestamp(s['interval']['endTime']);length=(end-start).total_seconds()
    def normalize(items):
        result=[]
        for segment in items:
            if not segment.get('startTime') or not segment.get('endTime'):continue
            a=max(0,(timestamp(segment['startTime'])-start).total_seconds());b=min(length,(timestamp(segment['endTime'])-start).total_seconds())
            if b>a:result.append({'start':a,'end':b,'type':segment.get('type','UNKNOWN')})
        return sorted(result,key=lambda v:v['start'])
    segments=normalize(s.get('stages',[]));short=normalize(s.get('shortAwakenings',[]));summary=s.get('summary',{})
    totals={item['type']:float(item['minutes']) for item in summary.get('stagesSummary',[]) if 'minutes' in item}
    derived=[]
    for kind in STAGES:
        matching=[v for v in segments if v['type']==kind]
        if kind not in totals and matching:
            totals[kind]=union_seconds(matching)/60;derived.append(kind)
    def number(key):return float(summary[key]) if key in summary else None
    first_deep=next((v['start']/60 for v in segments if v['type']=='DEEP'),None)
    return {'start':start.isoformat(),'end':end.isoformat(),'main':bool(s.get('metadata',{}).get('mainSleep')),'type':s.get('type'),'stagesStatus':s.get('metadata',{}).get('stagesStatus'),'durationSeconds':length,'asleepMinutes':number('minutesAsleep'),'awakeMinutes':number('minutesAwake'),'periodMinutes':number('minutesInSleepPeriod'),'stageMinutes':totals,'derivedStageMinutes':derived,'segments':segments,'shortAwakenings':short,'shortAwakeningMinutes':union_seconds(short)/60 if 'shortAwakenings' in s else None,'shortAwakeningCount':len(short) if 'shortAwakenings' in s else None,'firstDeepMinutes':first_deep}
