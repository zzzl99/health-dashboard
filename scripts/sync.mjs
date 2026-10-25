import {readFileSync,writeFileSync,existsSync,chmodSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const configPath=path.join(process.env.HOME,'Library/Application Support/PersonalHealthAnalysis/.private/config.json');
const privateConfig=JSON.parse(readFileSync(configPath,'utf8'));
const env={...process.env};
if(privateConfig.proxy){env.HTTPS_PROXY=privateConfig.proxy;env.HTTP_PROXY=privateConfig.proxy;}
const run=(cmd,args)=>execFileSync(cmd,args,{cwd:root,env,stdio:'pipe',timeout:1200000});
try{
 if(!process.argv.includes('--cached'))run('/Users/liuzhi/.local/bin/python3',[path.join(process.env.HOME,'Library/Application Support/PersonalHealthAnalysis/health.py'),'sync','--days','30']);
 run('/Users/liuzhi/.local/bin/python3',['scripts/heart_rate.py']);
 run('/Users/liuzhi/.local/bin/python3',['scripts/recovery.py']);
 run('/Users/liuzhi/.local/bin/python3',['scripts/build.py']);
 writeFileSync(path.join(root,'docs/data.json'),readFileSync(path.join(root,'.private/summary.json')));
 if(process.argv.includes('--publish')){
  run('git',['add','docs/data.json','docs/heart-rate.json']);
  let changed=false;try{run('git',['diff','--cached','--quiet']);}catch{changed=true;}
  if(changed)run('git',['commit','-m','Update daily health summary']);
  run('git',['push','origin','main']);
 }
 console.log('Health summary generated'+(process.argv.includes('--publish')?' and pushed.':'.'));
}catch(e){console.error('Sync failed; previous published data remains available. '+(e.status??e.code??'Check local connection'));process.exit(1);}
