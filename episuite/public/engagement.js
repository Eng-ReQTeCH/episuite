import {metrics, isDue, InputError} from './domain.js';
export const goalOptions=[['focus2','Make a start',2,'focus'],['task1','One useful win',1,'task'],['focus10','Find a rhythm',10,'focus']];
export function engagementInput(input={},current={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new InputError('Choose valid encouragement preferences.');
  const out={goal:'focus2',intent:'',cue:'After my morning drink',feedback:true,haptics:false,chime:false,novelty:true,...current};
  if('goal' in input){if(!goalOptions.some(g=>g[0]===input.goal))throw new InputError('Choose a valid small goal.');out.goal=input.goal;}
  for(const key of ['intent','cue'])if(key in input){if(typeof input[key]!=='string')throw new InputError('Use text for your personal cue.');out[key]=input[key].trim().slice(0,160);}
  for(const key of ['feedback','haptics','chime','novelty'])if(key in input){if(typeof input[key]!=='boolean')throw new InputError('Choose a valid feedback setting.');out[key]=input[key];}
  return out;
}
export function momentum(state,date){
  const m=metrics(state,date),prefs=engagementInput({},state.engagement);
  const goal=goalOptions.find(g=>g[0]===prefs.goal)||goalOptions[0],value=goal[3]==='focus'?m.focus:m.completed;
  const xp=Math.max(0,m.totalFocus+10*m.totalCompleted),level=Math.floor(Math.sqrt(xp/40))+1;
  const floor=40*(level-1)**2,ceiling=40*level**2;
  return {prefs,goal,value,ratio:Math.min(1,value/goal[2]),achieved:value>=goal[2],xp,level,into:xp-floor,needed:ceiling-floor,left:ceiling-xp,m};
}
export function pickAction(state,date,energy='medium',exclude=[]){
  const rank={low:0,medium:1,high:2};
  return state.tasks.filter(t=>!exclude.includes(t.id)&&!t.deleted&&t.lane!=='later'&&isDue(t,date)).sort((a,b)=>{
    const score=t=>(t.due&&t.due<=date?-1000:0)+(t.lane==='today'?-100:0)+Math.max(0,rank[t.energy]-rank[energy])*30+t.minutes;
    return score(a)-score(b);
  })[0]||null;
}
export const sparkPrompts=[
  ['Open it first','Open the file, book or tool. That is your entire first move.'],
  ['Make it visible','Put what you need in front of you. Hide one distraction.'],
  ['Try the rough version','A messy first sentence or first attempt is a useful start.'],
  ['Shrink the finish line','Choose one problem, paragraph, message or small surface.'],
  ['Leave yourself a runway','Before stopping, write the very next action for your return.'],
  ['Move, then return','Stand up and stretch. Come back for a two-minute start.'],
  ['Start beside someone','If it helps, arrange a quiet work session with someone you know.']
];
export function dailySpark(date){const index=Math.floor(Date.parse(date+'T12:00Z')/86400000)%sparkPrompts.length;return sparkPrompts[index];}
export function contextualSpark(state,date,energy='medium'){
  if(state.timer)return state.timer.mode==='focus'?['Your place is kept',state.timer.status==='paused'?'Resume your saved session when you are ready.':'Your session is already running. Return to that one thing.']:['Let the break count','Look away, stretch, or get water. Your workspace will be here.'];
  if(energy==='low')return ['A smaller start counts','Open what you need. Try two minutes, then decide whether to continue.'];
  const task=pickAction(state,date,energy);
  const step=task?.steps?.find(s=>!s.done);
  if(step)return ['Your runway is ready',step.title];
  if(momentum(state,date).achieved)return ['You reached your small goal','You can stop here, take a break, or choose another useful move.'];
  return dailySpark(date);
}
export function keepsakes(state,date){
  const p=momentum(state,date),m=p.m;
  const workedDays=new Set([
    ...state.sessions.filter(s=>s.mode==='focus'&&s.minutes>0).map(s=>s.date),
    ...state.tasks.flatMap(t=>Object.entries(t.history||{}).filter(([,entries])=>entries.length>0).map(([day])=>day))
  ]).size;
  return [
    {id:'start',name:'First light',symbol:'◒',text:'Two minutes of focus.',unlocked:m.totalFocus>=2},
    {id:'win',name:'Follow-through',symbol:'✦',text:'Your first useful check-off.',unlocked:m.totalCompleted>=1},
    {id:'rhythm',name:'A little rhythm',symbol:'≋',text:'Ten minutes invested.',unlocked:m.totalFocus>=10},
    {id:'return',name:'Finding your way',symbol:'↗',text:'Real work on three different days.',unlocked:workedDays>=3},
    {id:'bloom',name:'Room to grow',symbol:'✳',text:'Reach growth level three.',unlocked:p.level>=3}
  ];
}
export function feelingInput(input,state){
  if(!input||typeof input!=='object')throw new InputError('Choose a feeling for a saved focus session.');
  const session=state.sessions.find(s=>s.id===input.sessionId&&s.mode==='focus'&&s.minutes>0);
  if(!session||!['good','neutral','quieter'].includes(input.feeling))throw new InputError('Choose a feeling for a saved focus session.');
  return {sessionId:session.id,feeling:input.feeling};
}
