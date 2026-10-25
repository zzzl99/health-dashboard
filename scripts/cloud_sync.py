#!/usr/bin/env python3
"""GitHub-hosted refresh: only docs/data.json may leave the ephemeral workspace."""
import datetime as dt,json,os,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
PRIVATE=ROOT/'.private'
CLOUD=PRIVATE/'cloud'
SECRET_NAMES=('GOOGLE_HEALTH_CLIENT_ID','GOOGLE_HEALTH_CLIENT_SECRET','GOOGLE_HEALTH_REFRESH_TOKEN')
def prepare_credentials(values,target):
    if not values.get(SECRET_NAMES[0]) or not values.get(SECRET_NAMES[2]):
        raise RuntimeError('Required Google Health secrets are missing')
    target.mkdir(parents=True,exist_ok=True,mode=0o700)
    config={'client_id':values[SECRET_NAMES[0]],'timezone':'Asia/Shanghai'}
    if values.get(SECRET_NAMES[1]):config['client_secret']=values[SECRET_NAMES[1]]
    for filename,value in [('config.json',config),('token.json',{'refresh_token':values[SECRET_NAMES[2]],'expires_at':0})]:
        path=target/filename;path.write_text(json.dumps(value));path.chmod(0o600)
def run(script):
    result=subprocess.run([sys.executable,str(ROOT/'scripts'/script)],cwd=ROOT,capture_output=True,text=True,timeout=1200)
    if result.returncode:
        # Never forward arbitrary API bodies, credentials or subprocess output to public logs.
        raise RuntimeError(f'{script} failed; previous published data retained. Check Google authorization or API connectivity.')
def main():
    os.umask(0o077)
    credentials={name:os.environ.pop(name,'') for name in SECRET_NAMES}
    prepare_credentials(credentials,CLOUD)
    os.environ.update(HEALTH_PRIVATE_DIR=str(CLOUD),HEALTH_CLIENT_PATH=str(ROOT/'scripts/health_client.py'),HEALTH_DATA_PATH=str(CLOUD/'latest.json'))
    # The checked-out public summary is our durable history; no private cache is uploaded.
    prior=ROOT/'docs/data.json'
    if prior.exists():(PRIVATE/'summary.json').write_bytes(prior.read_bytes())
    run('health_client.py')
    raw=json.loads((CLOUD/'latest.json').read_text())
    fetched=dt.datetime.fromisoformat(raw['fetchedAt'])
    if raw.get('errors') or (dt.datetime.now(dt.timezone.utc)-fetched).total_seconds()>3600:
        raise RuntimeError('Fresh complete source data required')
    run('recovery.py')
    run('build.py')
    summary=json.loads((PRIVATE/'summary.json').read_text())
    summary['syncMode']='github-actions'
    destination=ROOT/'docs/data.json'
    tmp=destination.with_suffix('.tmp');tmp.write_text(json.dumps(summary,ensure_ascii=False));tmp.replace(destination)
    # Rotated credentials are never printed; the normal Google refresh response retains the original.
    token=json.loads((CLOUD/'token.json').read_text())
    if token.get('refresh_token')!=credentials[SECRET_NAMES[2]]:
        print('::warning::Google rotated the refresh credential. The repository secret must be updated before the next run.')
    print('Cloud refresh complete; public daily summary generated.')
if __name__=='__main__':
    try:main()
    except Exception as e:
        print(str(e) if isinstance(e,RuntimeError) else 'Cloud sync failed: '+type(e).__name__,file=sys.stderr)
        sys.exit(1)
