const stageInfo={AWAKE:['清醒','#d7508b'],SHORT:['短暂觉醒','#009c69'],REM:['快速眼动睡眠','#62c9ec'],LIGHT:['浅度睡眠','#427bf2'],DEEP:['深度睡眠','#57258d'],ASLEEP:['睡眠（未分期）','#7286a3'],RESTLESS:['不安稳','#c09542']};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
const duration=m=>m==null?'暂无数据':m<1&&m>0?Math.round(m*60)+' 秒':(Math.floor(Math.round(m)/60)?Math.floor(Math.round(m)/60)+' 小时 ':'')+(Math.round(m)%60)+' 分钟';
export function sleepChart(session){
 const total=session.durationSeconds;if(!total||total<0)return '<p class="caption">该次睡眠时间范围不可用。</p>';
 const full=session.type==='STAGES'||session.segments.some(s=>['REM','LIGHT','DEEP'].includes(s.type));
 const keys=full?['AWAKE','SHORT','REM','LIGHT','DEEP']:['AWAKE','SHORT','RESTLESS','ASLEEP'];
 const width=720,left=12,right=12,track=width-left-right,rowHeight=90,firstY=44,barHeight=30,height=keys.length*rowHeight+54;
 const x=seconds=>left+Math.max(0,Math.min(1,seconds/total))*track;
 const y=key=>firstY+keys.indexOf(key)*rowHeight;
 const segmentTime=n=>clock(Date.parse(session.start)+n*1000);
 let svg=`<svg class="sleepTimeline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(clock(session.start))}至${esc(clock(session.end))}的睡眠分期时间轴"><title>睡眠分期与短暂觉醒时间轴</title>`;
 for(const key of keys){const [label,color]=stageInfo[key];const value=key==='SHORT'?session.shortAwakeningMinutes:session.stageMinutes[key];svg+=`<text x="${left}" y="${y(key)-13}" class="sleepChartLabel">${label} · ${duration(value)}</text><rect x="${left}" y="${y(key)}" width="${track}" height="${barHeight}" rx="15" fill="#edf0f6"/>`;}
 // Stage transitions connect only contiguous known segments; never bridge missing data.
 session.segments.forEach((segment,i)=>{const previous=session.segments[i-1];if(previous&&Math.abs(previous.end-segment.start)<1&&keys.includes(previous.type)&&keys.includes(segment.type)&&previous.type!==segment.type)svg+=`<line x1="${x(segment.start)}" x2="${x(segment.start)}" y1="${y(previous.type)+barHeight/2}" y2="${y(segment.type)+barHeight/2}" stroke="${stageInfo[segment.type][1]}" stroke-opacity=".22" stroke-width="3"/>`;});
 for(const key of keys){const items=key==='SHORT'?session.shortAwakenings:session.segments.filter(s=>s.type===key),color=stageInfo[key][1];for(const segment of items){const label=`${stageInfo[key][0]} ${segmentTime(segment.start)}–${segmentTime(segment.end)}，${duration((segment.end-segment.start)/60)}`;svg+=`<rect x="${x(segment.start)}" y="${y(key)}" width="${Math.max(1.5,x(segment.end)-x(segment.start))}" height="${barHeight}" rx="${key==='SHORT'?1:Math.min(10,(x(segment.end)-x(segment.start))/2)}" fill="${color}" fill-opacity="${key==='REM'?'.5':'1'}"><title>${esc(label)}</title></rect>`;}}
 const axisY=keys.length*rowHeight+15;svg+=`<text x="${left}" y="${axisY}" class="sleepAxis">${clock(session.start)}</text><text x="${width/2}" y="${axisY}" text-anchor="middle" class="sleepAxis">${clock(Date.parse(session.start)+total*500)}</text><text x="${width-right}" y="${axisY}" text-anchor="end" class="sleepAxis">${clock(session.end)}</text><text x="${left}" y="${axisY+25}" class="sleepAxis">就寝时间</text><text x="${width-right}" y="${axisY+25}" text-anchor="end" class="sleepAxis">起床时间</text></svg>`;
 return svg;
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
