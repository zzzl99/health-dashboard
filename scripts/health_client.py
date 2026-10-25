#!/usr/bin/env python3
"""Personal Google Health v4 reader. Python 3.10+ and curl; no third-party packages."""
import argparse, base64, datetime as dt, fcntl, hashlib, http.server, json
import os, pathlib, secrets, subprocess, sys, tempfile, time, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent
PRIVATE = pathlib.Path(os.environ.get('HEALTH_PRIVATE_DIR', str(ROOT / '.private')))
SCOPES = ['https://www.googleapis.com/auth/googlehealth.' + s + '.readonly'
          for s in ['activity_and_fitness', 'health_metrics_and_measurements', 'sleep', 'settings']]
TYPES = {
 'sleep': 'sleep.interval.end_time',
 'steps': 'steps.interval.start_time',
 'exercise': 'exercise.interval.civil_start_time',
 'daily-resting-heart-rate': 'daily_resting_heart_rate.date',
 'daily-heart-rate-variability': 'daily_heart_rate_variability.date',
 'daily-oxygen-saturation': 'daily_oxygen_saturation.date',
 'daily-respiratory-rate': 'daily_respiratory_rate.date',
 'daily-sleep-temperature-derivations': 'daily_sleep_temperature_derivations.date',
}
class HealthError(Exception): pass

def init():
    PRIVATE.mkdir(exist_ok=True, mode=0o700)
    PRIVATE.chmod(0o700)

def save(path, value):
    path = pathlib.Path(path)
    fd, tmp = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(value, f, ensure_ascii=False, indent=2)
            f.flush(); os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

def read(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default

def quote(value):
    return '"' + str(value).replace('\\','\\\\').replace('"','\\"').replace('\r','\\r').replace('\n','\\n') + '"'

def request(url, form=None, token=None):
    if urllib.parse.urlsplit(url).hostname not in {'health.googleapis.com','oauth2.googleapis.com'}:
        raise HealthError('Unexpected API host')
    cfg = read(PRIVATE / 'config.json', {})
    lines = ['silent', 'show-error', 'connect-timeout = 15', 'max-time = 60', 'url = '+quote(url)]
    if cfg.get('proxy'): lines.append('proxy = '+quote(cfg['proxy']))
    if token: lines.append('header = '+quote('Authorization: Bearer '+token))
    if form is not None:
        lines += ['header = "Content-Type: application/x-www-form-urlencoded"',
                  'data = '+quote(urllib.parse.urlencode(form))]
    for attempt in range(4):
        p = subprocess.run(['curl','--config','-','--write-out','\n%{http_code}'],
                           input='\n'.join(lines),text=True,capture_output=True)
        if p.returncode:
            if attempt < 3: time.sleep(2 ** attempt); continue
            raise HealthError('Network failure; verify connectivity/proxy (curl %s)' % p.returncode)
        body, _, status = p.stdout.rpartition('\n')
        code = int(status)
        try: obj = json.loads(body)
        except ValueError: raise HealthError('Non-JSON API response, HTTP %s' % code)
        if code in {429,500,502,503,504} and attempt < 3:
            time.sleep(2 ** attempt); continue
        if code >= 400:
            err = obj.get('error', {})
            kind = err.get('status','API_ERROR') if isinstance(err,dict) else str(err)
            # Do not expose server message bodies, request URLs, credentials or personal data.
            raise HealthError('HTTP %s %s' % (code,kind))
        return obj

def credentials():
    cfg = read(PRIVATE / 'config.json', {})
    if not cfg.get('client_id'): raise HealthError('Missing .private/config.json client_id')
    return {k:cfg[k] for k in ['client_id','client_secret'] if cfg.get(k)}

def merge_token(old, new):
    if not new.get('access_token'): raise HealthError('Missing access token')
    out = {**old, **new, 'expires_at': time.time()+int(new.get('expires_in',3600))}
    if 'refresh_token_expires_in' in new:
        out['refresh_expires_at'] = time.time()+int(new['refresh_token_expires_in'])
    return out

def access(force=False):
    t = read(PRIVATE/'token.json',{})
    if not t.get('refresh_token'): raise HealthError('Authorization required: run auth')
    if force or t.get('expires_at',0) < time.time()+120:
        fresh=request('https://oauth2.googleapis.com/token',
                      {**credentials(),'grant_type':'refresh_token','refresh_token':t['refresh_token']})
        t=merge_token(t,fresh);save(PRIVATE/'token.json',t)
    return t['access_token']

def api(path, params=None):
    url='https://health.googleapis.com/v4/users/me/'+path
    if params: url+='?'+urllib.parse.urlencode(params)
    try: return request(url,token=access())
    except HealthError as e:
        if str(e).startswith('HTTP 401 '): return request(url,token=access(force=True))
        raise

def pages(path, key, params=None):
    params=dict(params or {}); result=[]; seen=set()
    while True:
        obj=api(path,params);result.extend(obj.get(key,[]))
        token=obj.get('nextPageToken')
        if not token: return result
        if token in seen: raise HealthError('Repeated pagination token')
        seen.add(token);params['pageToken']=token

def time_filter(kind, start, end):
    field=TYPES[kind]
    if field.endswith('.date') or 'civil_' in field:
        # Daily summaries and civil sessions use local calendar dates, never UTC conversion.
        lo,hi=start.date().isoformat(),end.date().isoformat()
    else:
        lo,hi=[x.astimezone(dt.timezone.utc).isoformat().replace('+00:00','Z') for x in [start,end]]
    return f'{field} >= "{lo}" AND {field} < "{hi}"'

def sync(days):
    from zoneinfo import ZoneInfo
    cfg=read(PRIVATE/'config.json',{})
    now=dt.datetime.now(ZoneInfo(cfg.get('timezone','Asia/Shanghai')))
    end=(now+dt.timedelta(days=1)).replace(hour=0,minute=0,second=0,microsecond=0)
    start=(now-dt.timedelta(days=days-1)).replace(hour=0,minute=0,second=0,microsecond=0)
    api('identity')  # Fail before collecting data if account is not linked to Google Health.
    devices=pages('pairedDevices','pairedDevices',{'pageSize':100})
    safe_devices=[{k:d[k] for k in ['name','deviceVersion','lastSyncTime','batteryLevel','batteryStatus'] if k in d} for d in devices]
    # Persist a distinct observation even when later metric requests fail.
    observation={'observedAt':now.isoformat(),'devices':safe_devices}
    with (PRIVATE/'sync-observations.jsonl').open('a') as f: f.write(json.dumps(observation)+'\n')
    (PRIVATE/'sync-observations.jsonl').chmod(0o600)
    data={}; errors={}
    for kind in TYPES:
        try: data[kind]=pages('dataTypes/'+kind+'/dataPoints','dataPoints',
                              {'filter':time_filter(kind,start,end),'pageSize':25 if kind in {'sleep','exercise'} else 1000})
        except HealthError as e: errors[kind]=str(e)
    out={'fetchedAt':now.isoformat(),'periodStart':start.isoformat(),'periodEndExclusive':end.isoformat(),
         'devices':safe_devices,'data':data,'errors':errors,
         'note':'Raw records may overlap across sources. Missing data is not zero. Device lastSyncTime differs from API fetch time.'}
    save(PRIVATE/'latest-attempt.json',out)
    if not errors: save(PRIVATE/'latest.json',out)
    print(json.dumps({'fetchedAt':out['fetchedAt'],'devices':[{k:v for k,v in d.items() if k!='name'} for d in safe_devices],
                      'counts':{k:len(v) for k,v in data.items()},'errors':errors},ensure_ascii=False,indent=2))
    if errors: raise HealthError('Partial sync; previous complete snapshot preserved; inspect latest-attempt.json')

def main():
    os.umask(0o077);init()
    parser=argparse.ArgumentParser()
    parser.add_argument('--days',type=int,default=30)
    args=parser.parse_args()
    if not 1<=args.days<=366:parser.error('days must be 1..366')
    with (PRIVATE/'run.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        sync(args.days)
if __name__=='__main__':
    try:main()
    except HealthError as e:print(str(e),file=sys.stderr);sys.exit(1)
