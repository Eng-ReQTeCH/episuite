import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server.mjs';
import {initialState,taskInput,toggleCompletion,undoLastCompletion,isDue,nextEligibleAt,chooseNext,blockInput,assignBlockColor,blockColor,schedule,dateKey,calendarText} from '../public/domain.js';
import {pickAction} from '../public/engagement.js';
import {circleInput,personInput,contactStatus,addCheckin,contactTask,syncContactCompletion,normalizeSocial} from '../public/social-domain.js';
test('twice-daily habits wait after first completion, become due after gap, allow custom gap and reset next day',()=>{
 const s=initialState(),date=dateKey(),task=taskInput({title:'Brush teeth',repeat:'interval_0.5',lane:'today'});s.tasks=[task];toggleCompletion(s,task.id,date);const first=task.history[date][0].at;
 assert.equal(task.target,2);assert.equal(task.minimumGapMinutes,360);assert.equal(isDue(task,date,first+1),false);assert.equal(chooseNext(s,date,'medium',first+1),null);assert.equal(pickAction(s,date),null);
 assert.equal(nextEligibleAt(task,date),first+360*60000);assert.equal(isDue(task,date,first+360*60000-1),false);assert.equal(isDue(task,date,first+360*60000),true);assert.equal(isDue(task,'2099-01-01',first+1),true);
 const custom=taskInput({minimumGapMinutes:30},task);assert.equal(isDue(custom,date,first+30*60000),true);assert.equal(isDue(taskInput({minimumGapMinutes:0},task),date,first+1),true);assert.throws(()=>taskInput({minimumGapMinutes:-1},task));
 toggleCompletion(s,task.id,date);assert.equal(isDue(task,date,first+12*3600000),false);
 undoLastCompletion(s,task.id,date);assert.equal(task.history[date].length,1);undoLastCompletion(s,task.id,date);assert.equal(task.history[date].length,0);assert.equal(isDue(task,date,first+1),true);assert.equal(s.coins,0);assert.throws(()=>undoLastCompletion(s,task.id,date));
});
test('automatic accents differ, custom accents persist and invalid colors are rejected',()=>{
 const blocks=[];for(let i=0;i<20;i++){const b=blockInput({name:'Block '+i,date:'2026-10-06'});assignBlockColor(b,blocks);blocks.push(b);}assert.equal(new Set(blocks.map(b=>b.color)).size,20);
 const before=blocks[5].color;assert.equal(blockColor(blocks[5],blocks),before);blocks.shift();assert.equal(blockColor(blocks[4],blocks),before);
 const custom=blockInput({name:'Custom',date:'2026-10-06',color:'#ff0088'});assignBlockColor(custom,blocks);assert.equal(custom.color,'#ff0088');assert.throws(()=>blockInput({name:'Invalid',date:'2026-10-06',color:'red;display:none'}));
});
test('circles, check-in rhythm, deduplicated tasks, completion/undo history integrate',()=>{
 const s=initialState(),date=dateKey();const c=circleInput({name:'Friends'});s.social.circles.push(c);const person=personInput({name:'Sam',circleIds:[c.id],everyDays:7,lastChecked:'2026-01-01'},{},s.social);s.social.people.push(person);
 assert.equal(contactStatus(s,person,date).due,true);const task=contactTask(s,person.id,date);assert.equal(contactTask(s,person.id,date).id,task.id);
 toggleCompletion(s,task.id,date);syncContactCompletion(s,task);assert.equal(s.social.checkins.length,1);assert.equal(contactStatus(s,person,date).due,false);syncContactCompletion(s,task);assert.equal(s.social.checkins.length,1);
 toggleCompletion(s,task.id,date);syncContactCompletion(s,task);assert.equal(s.social.checkins.length,0);addCheckin(s,{personId:person.id,date,method:'Call'},date);assert.equal(contactStatus(s,person,date).last,date);
 assert.throws(()=>addCheckin(s,{personId:person.id,date:'2099-01-01'},date));assert.throws(()=>personInput({name:'Other',circleIds:['missing']},{},s.social));assert.throws(()=>normalizeSocial({...s,social:{circles:[],people:[],checkins:[{personId:'missing',date}]}}));
});
test('social HTTP flows persist, reject stale edits and malformed imports, and expose calendar/watch links',async()=>{
 const dataDir=await mkdtemp(path.join(tmpdir(),'episuite-social-'));let app=await createApp({dataDir});let base;
 const listen=async()=>{await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;};await listen();
 const call=async(url,data={},method='POST',status=200)=>{const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data)});assert.equal(response.status,status,await response.clone().text());return response.json();};
 try{
  const circle=(await call('/api/social/circles',{name:'Friends',color:'#7053b4'})).result;const person=(await call('/api/social/people',{name:'Sam',circleIds:[circle.id],everyDays:7})).result;
  await call('/api/social/people/'+person.id,{notes:'A changed note',expectedVersion:person.editVersion},'PATCH');await call('/api/social/people/'+person.id,{notes:'Stale draft',expectedVersion:person.editVersion},'PATCH',409);
  const task=(await call('/api/social/contact-task',{personId:person.id})).result;await call('/api/tasks/'+task.id+'/complete');assert.equal(app.getState().social.checkins.length,1);
  await call('/api/tasks/'+task.id+'/undo');assert.equal(app.getState().social.checkins.length,0);await call('/api/tasks/'+task.id+'/complete');assert.equal(app.getState().social.checkins.length,1);
  const block=(await call('/api/blocks',{name:'Coffee together',date:'2026-10-06',start:'18:00',personIds:[person.id],reminderMinutes:30,commitment:true})).result;
  const watch=await call('/api/v1/day?date=2026-10-06',{},'GET');assert.deepEqual(watch.day.blocks[0].personIds,[person.id]);assert.match(calendarText(app.getState(),'2026-10-06'),/Coffee together/);assert.match(calendarText(app.getState(),'2026-10-06'),/TRIGGER:-PT30M/);
  const backup=await call('/api/export',{},'GET');await call('/api/import',backup);assert.equal(app.getState().social.people[0].name,'Sam');const broken=structuredClone(backup);broken.social.people[0].circleIds=['missing'];await call('/api/import',broken,'POST',400);assert.equal(app.getState().social.people[0].name,'Sam');
  await app.close();app=await createApp({dataDir});await listen();assert.equal(app.getState().blocks[0].color,block.color);assert.equal(app.getState().social.checkins.length,1);
  await call('/api/social/circles/'+circle.id,{},'DELETE');assert.deepEqual(app.getState().social.people[0].circleIds,[]);await call('/api/social/people/'+person.id,{},'DELETE');assert.equal(app.getState().social.people.length,0);assert.equal(app.getState().social.checkins.length,0);assert.deepEqual(app.getState().blocks[0].personIds,[]);assert.equal(app.getState().blocks.length,1);
  assert.equal((await fetch(base+'/social.js')).status,200);assert.equal((await fetch(base+'/social-domain.js')).status,200);
 }finally{await app.close();}
});
