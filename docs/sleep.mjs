import {mountPlot,wallTime} from './charts.mjs';
const stageInfo={AWAKE:['清醒','#d7508b'],SHORT:['短暂觉醒','#009c69'],REM:['快速眼动睡眠','#62c9ec'],LIGHT:['浅度睡眠','#427bf2'],DEEP:['深度睡眠','#57258d'],ASLEEP:['睡眠（未分期）','#7286a3'],RESTLESS:['不安稳','#c09542']};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
const duration=m=>m==null?'暂无数据':m<1&&m>0?Math.round(m*60)+' 秒':(Math.floor(Math.round(m)/60)?Math.floor(Math.round(m)/60)+' 小时 ':'')+(Math.round(m)%60)+' 分钟';
export function sleepChart(session){
 return `<div class="sleepInteractive" data-session="${esc(JSON.stringify(session))}"><div class="plotControls"><span>拖选区间放大 · 双击恢复</span><button class="resetSleepPlot">恢复全览</button></div><div class="sleepReadout chartReadout" aria-live="polite">移动鼠标或点选片段，查看睡眠阶段与起止时间。</div><div class="sleepPlot interactivePlot" role="group" aria-label="交互式睡眠分期时间轴"></div></div>`;
}
function sessionDetail(session){
 const asleep=session.asleepMinutes;const rows=['AWAKE','REM','LIGHT','DEEP','ASLEEP','RESTLESS'].filter(k=>session.stageMinutes[k]!=null).map(k=>{const minutes=session.stageMinutes[k],percentage=['REM','LIGHT','DEEP','ASLEEP'].includes(k)&&asleep>0?`${(minutes/asleep*100).toFixed(1)}%`:'—';return `<tr><td><i style="background:${stageInfo[k][1]}"></i>${stageInfo[k][0]}</td><td>${duration(minutes)}</td><td>${percentage}</td></tr>`;}).join('');
 const graph=session.segments.length?sleepChart(session):'<div class="sleepUnavailable">本次记录未提供分期时间轴；仅显示可用的睡眠汇总。</div>';
 const shortText=session.shortAwakeningCount==null?'暂无数据':session.shortAwakeningCount+' 个片段';
 const sourceNote=session.derivedStageMinutes.length?'部分分期时长由时间片段计算。':'分期时长来自设备汇总。';
 return `<div class="sleepSession"><p class="sleepSessionTime">${clock(session.start)} → ${clock(session.end)} · 实际睡眠 ${duration(asleep)} · 记录区间 ${duration(session.periodMinutes)}</p>${graph}<div class="sleepBreakdown"><div class="sleepStageTable"><table><thead><tr><th>阶段</th><th>时长</th><th>占实际睡眠</th></tr></thead><tbody>${rows||'<tr><td colspan="3">暂无分期汇总</td></tr>'}</tbody></table></div><div class="sleepQuality"><h4>觉醒与睡眠细节</h4><dl><div><dt>短暂觉醒总时长</dt><dd>${duration(session.shortAwakeningMinutes)}</dd></div><div><dt>短暂觉醒片段</dt><dd>${shortText}</dd></div><div><dt>首次深睡距就寝</dt><dd>${duration(session.firstDeepMinutes)}${session.firstDeepMinutes==null?'':'（推算）'}</dd></div></dl><p class="caption">短暂觉醒可与分期重叠，单独展示，不再次计入清醒时长或从睡眠总时长扣除。</p></div></div><p class="caption">${sourceNote}“首次深睡距就寝”不等同于 App 的“进入优质睡眠所需时长”。Fitbit App 的“优质睡眠”“完全清醒”及个人范围评价暂未同步，不显示推测分数。</p><details class="sleepSegments"><summary>展开逐段时间明细（${session.segments.length} 段）</summary><div class="sleepSegmentList">${session.segments.map(s=>`<div><span>${segmentTimeFor(session,s.start)}–${segmentTimeFor(session,s.end)}</span><b>${esc(stageInfo[s.type]?.[0]??'未分类')}</b><span>${duration((s.end-s.start)/60)}</span></div>`).join('')||'<p>暂无片段</p>'}</div></details></div>`;
}
const segmentTimeFor=(session,seconds)=>clock(Date.parse(session.start)+seconds*1000);
export function renderSleepDetails(day){
 const sessions=day?.sleepSessions??[];
 if(!sessions.length)return '<section class="sleepPanel"><h3>睡眠分期详情</h3><p class="caption">该日暂无详细睡眠记录，云端同步后会自动显示。</p></section>';
 const ordered=[...sessions].sort((a,b)=>Number(b.main)-Number(a.main)||Date.parse(a.start)-Date.parse(b.start));
 return `<section class="sleepPanel"><div class="sleepPanelHead"><div><p class="eyebrow">YOUR NIGHT, IN DETAIL</p><h3>睡眠分期详情</h3></div><span class="muted">Fitbit 设备估计</span></div>${ordered.map((s,i)=>s.main?`<h4 class="sleepSessionTitle">主睡眠</h4>${sessionDetail(s)}`:`<details class="napDetail"><summary>其他睡眠 / 午睡 · ${clock(s.start)}–${clock(s.end)} · ${duration(s.asleepMinutes)}</summary>${sessionDetail(s)}</details>`).join('')}</section>`;
}

export async function mountSleepCharts(root){
 for(const wrapper of root.querySelectorAll('.sleepInteractive')){
  if(wrapper.dataset.mounted)continue;
  const folded=wrapper.closest('details');
  if(folded&&!folded.open){folded.addEventListener('toggle',()=>{if(folded.open)mountSleepCharts(folded)},{once:true});continue;}
  wrapper.dataset.mounted='true';
  const session=JSON.parse(wrapper.dataset.session),full=session.type==='STAGES'||session.segments.some(s=>['REM','LIGHT','DEEP'].includes(s.type));
  const keys=full?['DEEP','LIGHT','REM','SHORT','AWAKE']:['ASLEEP','RESTLESS','SHORT','AWAKE'],begin=wallTime(session.start),finish=wallTime(session.end);
  const traces=keys.map((key,i)=>{const items=key==='SHORT'?session.shortAwakenings:session.segments.filter(s=>s.type===key);return {type:'bar',orientation:'h',name:stageInfo[key][0],base:items.map(s=>begin+s.start*1000),x:items.map(s=>(s.end-s.start)*1000),y:items.map(()=>i),width:.32,marker:{color:stageInfo[key][1]},customdata:items.map(s=>({detail:`${stageInfo[key][0]} · ${segmentTimeFor(session,s.start)}–${segmentTimeFor(session,s.end)} · ${duration((s.end-s.start)/60)}`})),hovertemplate:'%{customdata.detail}<extra></extra>'}});
  const annotations=keys.map((key,i)=>({xref:'paper',x:0,y:i+.35,xanchor:'left',showarrow:false,text:stageInfo[key][0]+' · '+duration(key==='SHORT'?session.shortAwakeningMinutes:session.stageMinutes[key]),font:{size:12,color:'#264d40'}}));
  await mountPlot(wrapper.querySelector('.sleepPlot'),traces,{height:440,intraday:true,range:[begin,finish],readout:wrapper.querySelector('.sleepReadout'),resetButton:wrapper.querySelector('.resetSleepPlot'),layout:{barmode:'overlay',bargap:.5,showlegend:false,hovermode:'closest',margin:{l:8,r:8,t:28,b:45},annotations,yaxis:{fixedrange:true,range:[-.35,keys.length-.35],visible:false},xaxis:{type:'date',range:[begin,finish],tickformat:'%H:%M',showspikes:true,spikemode:'across',spikesnap:'cursor',spikecolor:'#24382e',spikethickness:1},shapes:keys.map((key,i)=>({type:'rect',xref:'paper',x0:0,x1:1,y0:i-.16,y1:i+.16,fillcolor:'#edf0f6',line:{width:0},layer:'below'}))}});
 }
}
