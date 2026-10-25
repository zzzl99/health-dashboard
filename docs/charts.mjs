export const wallTime=value=>new Date(value).getTime()+8*3600e3;
export const dateTime=date=>Date.parse(date+'T00:00:00Z');
export const formatTime=value=>typeof value==='number'?new Date(value).toISOString().slice(0,16).replace('T',' '):String(value).slice(0,16).replace('T',' ');
export const plotDate=value=>typeof value==='number'?new Date(value).toISOString().slice(0,23):value;
export const plotConfig={responsive:true,displaylogo:false,scrollZoom:false,doubleClick:'reset',modeBarButtonsToRemove:['select2d','lasso2d','zoomIn2d','zoomOut2d','autoScale2d','toImage']};
export function purgeCharts(root){if(!window.Plotly)return;root.querySelectorAll('.js-plotly-plot').forEach(p=>Plotly.purge(p));}
export async function mountPlot(host,traces,options={}){
 if(!window.Plotly){host.textContent='图表组件加载失败，请刷新。';return;}
 if(host.classList.contains('js-plotly-plot'))Plotly.purge(host);
 const layout={paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{family:'system-ui, sans-serif',size:12,color:'#264d40'},margin:{l:48,r:18,t:24,b:50},height:options.height??350,dragmode:'zoom',hovermode:'x unified',showlegend:traces.length>1,legend:{orientation:'h',y:1.18,x:0},xaxis:{type:'date',tickformat:options.intraday?'%H:%M':'%m/%d',gridcolor:'#edf0e8',showspikes:true,spikemode:'across',spikesnap:'cursor',range:options.range},yaxis:{fixedrange:true,gridcolor:'#edf0e8',title:options.unit??'',rangemode:options.zero?'tozero':'normal'},...options.layout};
 if(layout.xaxis?.range)layout.xaxis.range=layout.xaxis.range.map(plotDate);
 const normalized=traces.map(t=>t.type==='bar'?{...t,base:t.base?.map(plotDate)}:{...t,x:t.x?.map(plotDate)});
 await Plotly.newPlot(host,normalized,layout,plotConfig);
 const readout=options.readout;
 const inspect=event=>{if(!readout||!event.points?.length)return;readout.textContent=event.points.map(p=>p.customdata?.detail??`${formatTime(p.x)} · ${p.data.name}: ${Number(p.y).toFixed(1)} ${options.unit??''}`).join(' ｜ ')};
 host.on('plotly_hover',inspect);host.on('plotly_click',inspect);
 host.on('plotly_relayout',event=>{host.dataset.zoomed=event['xaxis.range[0]']!==undefined?'true':event['xaxis.autorange']?'false':host.dataset.zoomed??'false'});
 const reset=()=>{host.dataset.zoomed='false';return Plotly.relayout(host,options.range?{'xaxis.range':options.range.map(plotDate)}:{'xaxis.autorange':true})};
 if(host.resetDoubleClick)host.removeEventListener('dblclick',host.resetDoubleClick,true);
 host.resetDoubleClick=event=>{event.preventDefault();event.stopPropagation();reset()};
 host.addEventListener('dblclick',host.resetDoubleClick,true);
 if(options.resetButton)options.resetButton.onclick=reset;
 host.dataset.zoomed='false';return {reset};
}
export function dailyTrace(days,key,name,color,scale=1){return {type:'scatter',mode:'lines+markers',name,x:days.map(d=>dateTime(d.date)),y:days.map(d=>d[key]==null?null:d[key]/scale),connectgaps:false,line:{color,width:2.5},marker:{size:6},hovertemplate:'%{x|%Y-%m-%d}<br>'+name+'：%{y:.2f}<extra></extra>'};}

export function withGaps(points,maxGap=120000){const out=[];points.forEach((p,i)=>{if(i&&p[0]-points[i-1][0]>maxGap)out.push([points[i-1][0]+60000,null,null,null,0]);out.push(p)});return out;}
