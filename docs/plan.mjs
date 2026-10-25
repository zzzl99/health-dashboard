export const PLAN_START='2026-10-26', PLAN_END='2027-01-25';
export const dateAdd=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
export function taskFor(date){
 if(date<PLAN_START||date>PLAN_END)return null;
 const i=Math.round((Date.parse(date)-Date.parse(PLAN_START))/864e5)%7;
 return [
  {name:'力量 A',detail:'全身基础 · 15–20 分钟',strength:15},
  {name:'轻松跑',detail:'20 分钟 · 能说完整句子',run:20},
  {name:'力量 B',detail:'髋背与稳定 · 15–20 分钟',strength:15},
  {name:'恢复日',detail:'散步 20–30 分钟或休息'},
  {name:'跑步 + 力量 C',detail:'跑 15–20 分钟 · 力量 10–15 分钟',run:15,strength:10},
  {name:'恢复日',detail:'散步或休息，不补课'},
  {name:'轻松跑',detail:'25 分钟 · 保持轻松',run:25}
 ][i];
}
export function completion(date,day,today){
 const task=taskFor(date);
 if(!task)return {sleep:'outside',exercise:'outside'};
 if(date>today)return {sleep:'future',exercise:'future'};
 const sleep=day?.sleepMinutes==null||day?.beforeMidnight==null?'unknown':day.sleepMinutes>=420&&day.beforeMidnight?'complete':'partial';
 if(!task.run&&!task.strength)return {sleep,exercise:'rest'};
 const runDone=!task.run||(day?.runMinutes??-1)>=task.run;
 const strengthDone=!task.strength||(day?.strengthMinutes??-1)>=task.strength;
 const anyRelevant=(task.run&&day?.runMinutes!=null)||(task.strength&&day?.strengthMinutes!=null);
 return {sleep,exercise:runDone&&strengthDone?'complete':anyRelevant?'partial':'unknown'};
}
export const labels={complete:'已完成',partial:'未达标',unknown:'待同步 / 无记录',future:'待开始',rest:'恢复日',outside:'无计划'};
