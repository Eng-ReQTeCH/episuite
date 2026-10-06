import {uid,validDate,InputError,taskInput,blockInput,assignBlockColor,addDays} from './domain.js';
export const emptySocial = () => ({circles:[],people:[],checkins:[]});
const text = (value,max) => String(value ?? '').trim().slice(0,max);
export function circleInput(input,existing={}) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new InputError('Choose a valid circle.');
 const name=text(input.name??existing.name,60);if(!name)throw new InputError('Give this circle a name.');
 const color=text(input.color??existing.color??'#7053b4',7);if(!/^#[0-9a-f]{6}$/i.test(color))throw new InputError('Choose a valid circle color.');
 return {...existing,id:existing.id||uid(),name,color};
}
export function personInput(input,existing={},social=emptySocial()) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new InputError('Choose a valid person.');
 const name=text(input.name??existing.name,120);if(!name)throw new InputError('Give this person a name.');
 const circleIds=input.circleIds??existing.circleIds??[];
 if(!Array.isArray(circleIds)||circleIds.some(id=>!social.circles.some(c=>c.id===id)))throw new InputError('Choose circles that exist.');
 const everyDays=Number(input.everyDays??existing.everyDays??14);if(!Number.isInteger(everyDays)||everyDays<0||everyDays>365)throw new InputError('Choose a check-in rhythm from 0 to 365 days.');
 const lastChecked=input.lastChecked??existing.lastChecked??'';if(lastChecked&&!validDate(lastChecked))throw new InputError('Choose a valid last check-in date.');
 return {...existing,id:existing.id||uid(),name,circleIds:[...new Set(circleIds)],everyDays,lastChecked,notes:text(input.notes??existing.notes,3000),contact:text(input.contact??existing.contact,300),created:existing.created||Date.now()};
}
export function validatePeople(state,ids=[]) {
 if(!Array.isArray(ids)||ids.some(id=>!state.social.people.some(p=>p.id===id)))throw new InputError('Choose people who exist in Social.');
}
export function lastContact(state,person) {
 return [person.lastChecked,...state.social.checkins.filter(c=>c.personId===person.id).map(c=>c.date)].filter(Boolean).sort().at(-1)||'';
}
export function contactStatus(state,person,today) {
 const last=lastContact(state,person),next=person.everyDays&&last?addDays(last,person.everyDays):'';
 return {last,next,due:Boolean(person.everyDays&&(!next||next<=today))};
}
export function contactTask(state,personId,date) {
 validatePeople(state,[personId]);const person=state.social.people.find(p=>p.id===personId);
 const current=state.tasks.find(t=>t.socialContact&&!t.deleted&&!t.completed&&t.personIds.includes(personId));if(current)return current;
 const task=taskInput({title:`Check in with ${person.name}`,category:'Personal',minutes:5,due:date,lane:'inbox',personIds:[personId]});task.socialContact=true;task.order=Math.max(0,...state.tasks.map(t=>t.order))+1;state.tasks.push(task);return task;
}
export function addCheckin(state,input,today) {
 validatePeople(state,[input.personId]);const date=input.date||today;
 if(!validDate(date)||date>today)throw new InputError('Check-ins need a date today or earlier.');
 const entry={id:uid(),personId:input.personId,date,method:text(input.method||'Checked in',60),note:text(input.note,2000),at:Date.now()};state.social.checkins.push(entry);return entry;
}
export function syncContactCompletion(state,task) {
 if(!task.socialContact)return;
 const entries=Object.entries(task.history).flatMap(([date,list])=>list.map(e=>({...e,date})));
 const ids=new Set(entries.map(e=>e.id));
 state.social.checkins=state.social.checkins.filter(c=>c.taskId!==task.id||ids.has(c.completionId));
 for(const entry of entries)for(const personId of task.personIds){
  if(!state.social.people.some(p=>p.id===personId)||state.social.checkins.some(c=>c.completionId===entry.id&&c.personId===personId))continue;
  state.social.checkins.push({id:uid(),personId,date:entry.date,method:'Check-in task completed',note:'',at:entry.at,taskId:task.id,completionId:entry.id});
 }
}
export function socialPlan(state,input,existing={}) {
 validatePeople(state,input.personIds??existing.personIds??[]);
 if(!(input.personIds??existing.personIds??[]).length)throw new InputError('Choose at least one person for this plan.');
 const block=blockInput({...input,commitment:true,mode:'fixed',repeat:input.repeat??existing.repeat??'none'},existing);
 assignBlockColor(block,state.blocks);return block;
}
export function normalizeSocial(state) {
 state.social ||= emptySocial();const s=state.social;
 if(!s||typeof s!=='object'||['circles','people','checkins'].some(k=>!Array.isArray(s[k])))throw new InputError('Backup Social must include circles, people and check-ins.');
 for(const list of [s.circles,s.people,s.checkins])if(list.some(record=>!record||typeof record!=='object'||Array.isArray(record)))throw new InputError('Backup contains an invalid Social record.');
 s.circles=s.circles.map(c=>circleInput(c,c));s.people=s.people.map(p=>personInput(p,p,s));
 for(const list of [s.circles,s.people,s.checkins])if(new Set(list.map(x=>x.id)).size!==list.length)throw new InputError('Social records contain duplicate IDs.');
 for(const c of s.checkins){if(!c||typeof c!=='object')throw new InputError('Backup contains an invalid check-in.');validatePeople(state,[c.personId]);if(!validDate(c.date)||typeof c.id!=='string')throw new InputError('Backup contains an invalid check-in.');c.note=text(c.note,2000);c.method=text(c.method,60);}
 for(const r of [...state.tasks,...state.blocks])validatePeople(state,r.personIds||[]);
 return state;
}
