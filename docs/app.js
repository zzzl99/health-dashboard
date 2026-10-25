import {PLAN_START as start,PLAN_END as end,dateAdd,taskFor,completion,labels} from './plan.mjs';
const $=s=>document.querySelector(s);
const localDate=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(d);
let data,range=14,today=localDate(new Date()),selected=today,month=today.slice(0,7);
const time=s=>s?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s)):'—';
const stamp=s=>s?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s)):'未知';
const dur=m=>m==null?'暂无记录':`${Math.floor(Math.round(m)/60)}小时${Math.round(m)%60}分`;
const sum=(a,k)=>a.reduce((n,d)=>n+(d[k]??0),0),avg=(a,k)=>{const v=a.filter(d=>d[k]!=null);return v.length?sum(v,k)/v.length:null};
const byDate=date=>data.days.find(d=>d.date===date);
const symbols={complete:'✓',partial:'◐',unknown:'○',future:'·',rest:'↻',outside:'—'};
const badge=(state,prefix='')=>`<span class="statusTag ${state}">${symbols[state]} ${prefix}<span class="statusText">${labels[state]}</span></span>`;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const exerciseName=t=>({RUNNING:'跑步',WALKING:'步行',BIKING:'骑行',STRENGTH_TRAINING:'力量训练',WEIGHTLIFTING:'举重',WEIGHT_LIFTING:'举重',CALISTHENICS:'自重训练',RESISTANCE_TRAINING:'抗阻训练'}[t]??t);
function hrrText(value){return value==null?'暂无数据':`${value>0?'+':''}${value} 次/分`}
function bounds(){return {min:[data.days[0]?.date??start,start].sort()[0].slice(0,7),max:[today,end].sort().at(-1).slice(0,7)}}
function renderCalendar(){
 const first=month+'-01',offset=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7;
 const next=new Date(first+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);const count=Math.round((next-Date.parse(first+'T12:00:00Z'))/864e5);
 const limit=bounds();$('#monthTitle').textContent=month.replace('-',' 年 ')+' 月';$('#prev').disabled=month<=limit.min;$('#next').disabled=month>=limit.max;
 let cells='<div class="calendarEmpty" aria-hidden="true"></div>'.repeat(offset),sleepDone=0,moveDone=0;
 for(let i=0;i<count;i++){
  const date=dateAdd(first,i),d=byDate(date),task=taskFor(date),s=completion(date,d,today);
  if(s.sleep==='complete')sleepDone++;if(s.exercise==='complete')moveDone++;
  const subtitle=task?.name??(d?.activities.length?'有运动记录':'每日记录');
  cells+=`<button class="calendarDay ${date===today?'todayCell':''} ${date===selected?'selected':''}" data-date="${date}" aria-label="${date}，${subtitle}，睡眠${labels[s.sleep]}，运动${labels[s.exercise]}" aria-pressed="${date===selected}"><span class="calendarDate">${i+1}<small>${date===today?'今天':''}</small></span><span class="calendarTask">${subtitle}</span>${task?badge(s.sleep,'睡眠 ')+badge(s.exercise,'运动 '):`<span class="calendarFact">${d?.sleepMinutes!=null?'睡 '+Math.floor(d.sleepMinutes/60)+'h'+Math.round(d.sleepMinutes%60):'睡 —'}</span><span class="calendarFact">${d?.runMinutes!=null?'跑 '+Math.round(d.runMinutes)+'m':d?.activities.length?'动 '+d.activities.length+'次':'动 —'}</span>`}</button>`;
 }
 $('#calendar').innerHTML=cells;$('#completion').textContent=`本月已完成 · 睡眠 ${sleepDone} 天 / 运动 ${moveDone} 天`;
 document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{selected=b.dataset.date;renderCalendar();renderDetail();$('#dayDetail').scrollIntoView({behavior:'smooth',block:'nearest'});});
}
function renderDetail(){
 const d=byDate(selected),task=taskFor(selected),s=completion(selected,d,today),cycle=task?Math.floor((Date.parse(selected)-Date.parse(start))/864e5/14)+1:null;
 const runTarget=task?.run?`跑步至少 ${task.run} 分钟`:'今天不安排跑步';
 const strengthTarget=task?.strength?`力量至少 ${task.strength} 分钟`:'今天不安排力量';
 const entries=d?.activities??[];
 const rows=entries.length?entries.map(a=>`<li><div><b>${escape(exerciseName(a.type))}</b><span>${time(a.start)} · ${Math.round(a.minutes)} 分钟${a.km==null?'':' · '+a.km.toFixed(2)+' km'}</span></div>${a.recovery?`<p>心率恢复 HRR1：<b>${hrrText(a.recovery?.hrr1)}</b> · HRR2：<b>${hrrText(a.recovery?.hrr2)}</b></p><small>${escape(a.recovery?.note??'暂无运动结束前后心率采样，无法计算。')}${a.recovery?.endBpm!=null?' 结束附近心率 '+a.recovery.endBpm+' 次/分。':''}</small>`:''}</li>`).join(''):'<li class="muted">'+(selected>today?'尚未开始记录':'当天暂无可用运动记录')+'</li>';
 $('#dayDetail').innerHTML=`<div class="detailHead"><div><p class="eyebrow">DAILY DETAIL</p><h2>${selected.replaceAll('-',' / ')}</h2></div><span class="muted">${cycle?cycle<=6?'第 '+cycle+' 个两周周期':'总结周':'计划周期外 · 仅查看记录'}</span></div><div class="detailColumns"><section><div class="detailTitle"><h3>睡眠计划</h3>${badge(s.sleep)}</div><p>${task?'午夜前入睡，主睡眠至少 7 小时。':'当天无计划，不计入完成统计。'}</p><dl><div><dt>主睡眠</dt><dd>${dur(d?.sleepMinutes)}</dd></div><div><dt>入睡 → 起床</dt><dd>${time(d?.bedtime)} → ${time(d?.wake)}</dd></div><div><dt>午睡</dt><dd>${dur(d?.napMinutes)}</dd></div></dl><small>睡眠归属醒来这一天；夜间睡眠次日同步后自动判断。设备估计不能确认熄灯时间。</small></section><section><div class="detailTitle"><h3>${task?.name??'运动记录'}</h3>${badge(s.exercise)}</div><p>${task?task.detail:'当天无训练计划。'}</p><dl><div><dt>${task?.run?runTarget:'跑步记录'}</dt><dd>${d?.runMinutes==null?'暂无记录':Math.round(d.runMinutes)+' 分钟'}</dd></div><div><dt>${task?.strength?strengthTarget:'力量记录'}</dt><dd>${d?.strengthMinutes==null?'暂无记录':Math.round(d.strengthMinutes)+' 分钟'}</dd></div><div><dt>步数</dt><dd>${d?.steps==null?'暂无记录':d.steps.toLocaleString()}</dd></div></dl><small>跑步与力量都安排时，两项时长均达标才完成；仅核对设备记录，不确认动作质量。恢复日不判定完成。</small></section></div><div class="activityDetail"><h3>当日运动与心率恢复</h3><ul>${rows}</ul><p class="caption">HRR1 / HRR2 = 运动结束附近心率 − 结束后 1 / 2 分钟附近心率（采样时间偏差不超过 10 秒）。为手环估算值，非标准化恢复测试；走动、冷身与传感器误差均会影响结果。缺采样不补值，不以单次数值诊断。</p></div>`;
}
function chart(key,second,max,target){let dates=Array.from({length:range},(_,i)=>dateAdd(today,i-range+1)),w=540,h=230,l=32,r=10,top=18,b=32,cw=(w-l-r)/range,pH=h-top-b;let s=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="最近${range}天${key==='sleepMinutes'?'睡眠时长':'运动时长'}柱状图">`;
 if(target)s+=`<rect x="${l}" y="${top+pH*(1-9/max)}" width="${w-l-r}" height="${pH*2/max}" fill="#edf3d7"/>`;
 for(let j=0;j<4;j++){let v=max*j/3,y=top+pH*(1-j/3);s+=`<line x1="${l}" x2="${w-r}" y1="${y}" y2="${y}" stroke="#e9ede5"/><text x="0" y="${y+4}" fill="#7c8981" font-size="9">${Math.round(v)}</text>`;}
 dates.forEach((date,i)=>{let d=byDate(date),v=d?.[key],v2=d?.[second],scale=key==='sleepMinutes'?60:1,x=l+i*cw+cw*.2,bw=cw*.6;if(v!=null){let height=Math.min(v/scale/max,1)*pH;s+=`<rect x="${x}" y="${top+pH-height}" width="${second?bw*.55:bw}" height="${height}" rx="2" fill="#356854"><title>${date}：${key==='sleepMinutes'?dur(v):Math.round(v)+'分钟'}</title></rect>`;}if(v2!=null){let height=Math.min(v2/max,1)*pH;s+=`<rect x="${x+bw*.6}" y="${top+pH-height}" width="${bw*.4}" height="${height}" rx="2" fill="#d69b66"><title>${date} 力量：${Math.round(v2)}分钟</title></rect>`;}if(i%Math.ceil(range/7)===0)s+=`<text x="${x}" y="${h-9}" fill="#7c8981" font-size="9">${date.slice(5).replace('-','/')}</text>`;});return s+'</svg>';
}
function renderCharts(){$('#sleepChart').innerHTML=chart('sleepMinutes',null,Math.max(12,...data.days.slice(-range).map(d=>(d.sleepMinutes??0)/60)),true);$('#moveChart').innerHTML=chart('runMinutes','strengthMinutes',Math.max(60,...data.days.slice(-range).map(d=>Math.max(d.runMinutes??0,d.strengthMinutes??0))),false)}
function render(){
 today=localDate(new Date());const recent=data.days.filter(d=>d.date>=dateAdd(today,-6)&&d.date<=today),sleep=avg(recent,'sleepMinutes'),sleepN=recent.filter(d=>d.sleepMinutes!=null).length;
 const recoveryDays=data.days.filter(d=>d.date<=today).flatMap(d=>d.activities.filter(a=>a.recovery?.hrr1!=null).map(a=>({date:d.date,...a.recovery}))),latest=recoveryDays.at(-1);
 const metrics=[['近 7 天平均睡眠',sleep==null?'—':(sleep/60).toFixed(1),'小时',`${sleepN}/7 天有主睡眠记录`],['近 7 天跑步',sum(recent,'runKm').toFixed(1),'km',`${recent.filter(d=>d.runMinutes!=null).length} 天有记录 · ${Math.round(sum(recent,'runMinutes'))} 分钟`],['近 7 天力量',String(recent.filter(d=>d.strengthMinutes!=null).length),'天','只统计明确的力量类记录'],['运动后 1 分钟心率恢复',latest?String(latest.hrr1):'—','次/分',latest?`${latest.date} · 手环采样估算`:'暂无足够采样，不能计算']];
 $('#metrics').innerHTML=metrics.map(([name,value,unit,note])=>`<article class="metric"><div>${name}</div><div class="value">${value}<small>${unit}</small></div><div class="note">${note}</div></article>`).join('');$('#todayDate').textContent=today;
 const task=taskFor(today);$('#focus').textContent=task?.name??(today<start?'明天开始，今晚先睡好。':'三个月结束，回顾你的变化。');$('#focusSub').textContent=task?.detail??'每周三次跑步、三次力量，保留恢复日。';
 const stale=Date.now()-Date.parse(data.deviceSync)>36*3600e3||Date.now()-Date.parse(data.fetchedAt)>36*3600e3;$('#sync').classList.toggle('stale',stale);$('#sync').textContent=`${stale?'● 数据可能已过期，请检查设备同步或自动任务。':'● 已载入最新发布的数据。'} 手环同步 ${stamp(data.deviceSync)} · 数据拉取 ${stamp(data.fetchedAt)}（上海时间）`;$('#footSync').textContent='每小时由 Mac 后台脚本拉取并更新，无需 agent；手环需先同步到 Fitbit。';renderCharts();renderCalendar();renderDetail();
}
async function load(){try{const response=await fetch('data.json?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error();data=await response.json();render()}catch{$('#sync').textContent='暂时无法加载数据，请稍后刷新。上次已显示的数据会保留。';$('#sync').classList.add('stale')}}
document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{range=Number(b.dataset.range);document.querySelectorAll('[data-range]').forEach(x=>x.classList.toggle('active',x===b));if(data)renderCharts()});
function changeMonth(n){const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);month=d.toISOString().slice(0,7);selected=month===today.slice(0,7)?today:month+'-01';renderCalendar();renderDetail();}
$('#prev').onclick=()=>changeMonth(-1);$('#next').onclick=()=>changeMonth(1);$('#goToday').onclick=()=>{selected=today;month=today.slice(0,7);renderCalendar();renderDetail()};load();setInterval(load,300000);
