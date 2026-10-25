#!/usr/bin/env python3
"""Publish the latest local snapshot without an AI agent or another API pull."""
import datetime as dt,fcntl,json,os,pathlib,subprocess,sys
from zoneinfo import ZoneInfo
ROOT=pathlib.Path(__file__).resolve().parents[1]
PRIVATE=pathlib.Path.home()/'Library/Application Support/PersonalHealthAnalysis/.private'
STATE=PRIVATE/'dashboard-publish-status.json'
TZ=ZoneInfo('Asia/Shanghai')
def write_state(value):
    temp=STATE.with_suffix('.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2));temp.chmod(0o600);temp.replace(STATE)
def main():
    os.umask(0o077)
    now=dt.datetime.now(TZ)
    with (PRIVATE/'dashboard-publish.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:return 0
        old=json.loads(STATE.read_text()) if STATE.exists() else {}
        status={'attemptedAt':now.isoformat(),'lastSuccessAt':old.get('lastSuccessAt')}
        try:
            raw=json.loads((PRIVATE/'latest.json').read_text())
            fetched=dt.datetime.fromisoformat(raw['fetchedAt'])
            if raw.get('errors') or (now-fetched).total_seconds()>26*3600:raise RuntimeError('Latest complete health snapshot is stale; previous website data retained')
            env=os.environ.copy();env['PATH']='/opt/homebrew/bin:/Users/liuzhi/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
            p=subprocess.run(['/opt/homebrew/bin/node',str(ROOT/'scripts/sync.mjs'),'--cached','--publish'],cwd=ROOT,env=env,capture_output=True,text=True,timeout=300)
            if p.returncode:raise RuntimeError('Dashboard generation or git publish failed; previous deployment remains available')
            status.update(status='success',lastSuccessAt=dt.datetime.now(TZ).isoformat(),sourceFetchedAt=raw['fetchedAt'])
            write_state(status);print('Dashboard published from latest local health snapshot',flush=True);return 0
        except Exception as e:
            status.update(status='failed',error=str(e) if isinstance(e,RuntimeError) else type(e).__name__)
            write_state(status);print(status['error'],file=sys.stderr,flush=True);return 1
if __name__=='__main__':sys.exit(main())
