"""Run GitHub CLI with the existing private network configuration; never print it."""
import json,os,pathlib,subprocess,sys
p=pathlib.Path.home()/'Library/Application Support/PersonalHealthAnalysis/.private/config.json'
e=os.environ.copy();proxy=json.loads(p.read_text()).get('proxy') if p.exists() else None
if proxy:e.update(HTTPS_PROXY=proxy,HTTP_PROXY=proxy)
r=subprocess.run(['gh',*sys.argv[1:]],env=e,capture_output=True,text=True)
for text,stream in [(r.stdout,sys.stdout),(r.stderr,sys.stderr)]:stream.write(text.replace(proxy,'[configured proxy]') if proxy else text)
sys.exit(r.returncode)
