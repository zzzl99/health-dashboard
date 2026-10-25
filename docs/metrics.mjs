import {mountPlot,purgeCharts,dailyTrace,dateTime,wallTime,formatTime,withGaps} from './charts.mjs';
import {dateAdd} from './plan.mjs';
import {renderSleepDetails,mountSleepCharts} from './sleep.mjs';
const $=s=>document.querySelector(s),titles={heart:'心率',rhr:'静息心率',hrv:'心率变异性',spo2:'血氧饱和度',sleep:'睡眠状态',exercise:'近七天运动'};
let state,heartData,current,today,days=7,anchor;
const last=(rows,key)=>rows.filter(d=>d[key]!=null).at(-1);
const spark=(rows,key)=>{const values=rows.map(r=>r[key]).filter(v=>v!=null);if(!values.length)return '<div class="sparkEmpty">暂无记录</div>';const min=Math.min(...values),max=Math.max(...values);return `<svg class="metricSpark" viewBox="0 0 200 48" aria-hidden="true"><polyline points="${values.map((v,i)=>`${6+i*188/Math.max(1,values.length-1)},${40-(v-min)/(max-min||1)*32}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>`};
export function updateMetrics(data,heart,date){
 state=data;heartData=heart;today=date;const recent=data.days.filter(d=>d.date>=dateAdd(today,-6)&&d.date<=today),latestSleep=last(data.days,'sleepMinutes');
 const configs=[{key:'heart',value:heart?.latest?.bpm,unit:'bpm',note:heart?.latest?`最近采样 ${new Date(heart.latest.time).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})} · 非实时`:'等待日内心率同步',plot:spark((heart?.days.at(-1)?.points??[]).map(p=>({v:p[1]})),'v')},...['rhr','hrv','spo2'].map(key=>{const d=last(data.days,key);return {key,value:d?.[key],unit:key==='rhr'?'bpm':key==='hrv'?'毫秒':'%',note:d?`${d.date} · ${key==='spo2'?'每日平均血氧':'每日指标'}`:'暂无数据',plot:spark(recent,key)}}),{key:'sleep',value:latestSleep?(latestSleep.sleepMinutes/60).toFixed(1):null,unit:'小时',note:latestSleep?`${latestSleep.date} · ${latestSleep.sleepMinutes>=420?'睡眠时长充足':'睡眠时长偏短'}`:'暂无睡眠记录',plot:spark(recent,'sleepMinutes')},{key:'exercise',value:Math.round(recent.reduce((n,d)=>n+(d.runMinutes??0)+(d.strengthMinutes??0),0)),unit:'分钟',note:`跑步 ${Math.round(recent.reduce((n,d)=>n+(d.runMinutes??0),0))} 分 · 力量 ${Math.round(recent.reduce((n,d)=>n+(d.strengthMinutes??0),0))} 分（已记录）`,plot:spark(recent.map(d=>({v:d.runMinutes==null&&d.strengthMinutes==null?null:(d.runMinutes??0)+(d.strengthMinutes??0)})),'v')}];
 $('#metrics').innerHTML=configs.map(c=>`<button class="metric metricButton" data-metric="${c.key}" aria-label="查看${titles[c.key]}统计图"><div class="metricHeading">${titles[c.key]}<span>↗</span></div><div class="value">${c.value??'—'}<small>${c.unit}</small></div>${c.plot}<div class="note">${c.note}</div></button>`).join('');
 document.querySelectorAll('[data-metric]').forEach(button=>button.onclick=()=>openMetric(button.dataset.metric));
}
function openMetric(key){current=key;days=key==='heart'?1:7;anchor=today;$('#metricTitle').textContent=titles[key];$('#metricDate').value=anchor;$('#metricDate').max=today;$('#metricDialog').showModal();document.body.classList.add('dialogOpen');renderMetric();}
async function renderMetric(){
 const root=$('#metricBody');purgeCharts(root);root.innerHTML='<div class="chartReadout" id="metricReadout" aria-live="polite">移动鼠标或点击图线，查看时间与数值。</div><div id="metricPlot" class="interactivePlot"></div><p class="caption" id="metricNote"></p><div id="metricExtra"></div>';
 document.querySelectorAll('[data-metric-range]').forEach(b=>b.classList.toggle('active',Number(b.dataset.metricRange)===days));
 const from=dateAdd(anchor,1-days),rows=Array.from({length:days},(_,i)=>state.days.find(d=>d.date===dateAdd(from,i))??{date:dateAdd(from,i)}),range=[dateTime(from),dateTime(dateAdd(anchor,1))];let traces=[],unit='',note='',intraday=days===1;
 if(current==='heart'){
  unit='bpm';const points=withGaps((heartData?.days??[]).filter(d=>d.date>=from&&d.date<=anchor).flatMap(d=>d.points));
  if(days<=7){traces=[{type:'scatter',mode:'lines',name:'分钟平均心率',x:points.map(p=>p[0]+8*3600e3),y:points.map(p=>p[1]),line:{color:'#087ea0',width:2},customdata:points.map(p=>({detail:`${formatTime(p[0]+8*3600e3)} · 平均 ${p[1]} bpm · 范围 ${p[2]}–${p[3]} bpm · ${p[4]} 次采样`})),hovertemplate:'%{customdata.detail}<extra></extra>'}];note='最近 7 天提供分钟平均、最小/最大值和采样数。心率卡片显示最近一次真实采样；曲线不是实时读数。';}
  else {traces=[dailyTrace((heartData?.daily??[]).filter(d=>d.date>=from&&d.date<=anchor),'mean','每日平均心率','#087ea0')];note='月与三个月视图显示已积累的每日平均心率；历史不足的日期不补值。';}
  if(heartData&&Object.keys(heartData.errors??{}).length)note+=' 部分日期同步未完成，当前显示已有数据。';
 }else if(['rhr','hrv','spo2'].includes(current)){
  unit=current==='rhr'?'bpm':current==='hrv'?'毫秒':'%';traces=[dailyTrace(rows,current,titles[current],current==='spo2'?'#009c8a':'#398c60')];note='该指标由设备按日提供。放大可查看日期和数值，不代表有分钟级测量。';
 }else if(current==='sleep'){
  unit='小时';traces=[dailyTrace(rows,'sleepMinutes','主睡眠','#5869b7',60),dailyTrace(rows,'napMinutes','午睡','#bda2d4',60)];note='主睡眠按醒来日期归属，午睡单独显示；空白表示没有记录。选择“日”可查看该晚可缩放的睡眠分期。';
  if(days===1){$('#metricExtra').innerHTML=renderSleepDetails(rows[0]);mountSleepCharts($('#metricExtra'));}
 }else{
  unit='分钟';traces=[dailyTrace(rows,'runMinutes','跑步','#275c4c'),dailyTrace(rows,'strengthMinutes','力量','#cf9158')];note='跑步与力量分别统计。未被设备记录的训练显示为空，不能自动认定为零或未完成。';
 }
 $('#metricNote').textContent=note;await mountPlot($('#metricPlot'),traces,{unit,range,intraday,zero:['sleep','exercise'].includes(current),readout:$('#metricReadout'),resetButton:$('#resetMetricPlot')});
 if(!traces.some(t=>t.y.some(v=>v!=null)))$('#metricReadout').textContent='所选时间范围暂无数据。';
}
export function initMetricDialog(){
 const dialog=$('#metricDialog');$('#closeMetricDialog').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{document.body.classList.remove('dialogOpen');document.querySelector(`[data-metric="${current}"]`)?.focus({preventScroll:true})});
 let outside=false;const check=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom};dialog.addEventListener('pointerdown',e=>outside=e.target===dialog&&check(e));dialog.addEventListener('click',e=>{if(outside&&e.target===dialog&&check(e))dialog.close();outside=false});
 document.querySelectorAll('[data-metric-range]').forEach(b=>b.onclick=()=>{days=Number(b.dataset.metricRange);renderMetric()});$('#metricDate').onchange=e=>{if(e.target.value&&e.target.value<=today){anchor=e.target.value;renderMetric()}};
}
