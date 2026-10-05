import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {initialState,taskInput,toggleCompletion,dateKey} from '../public/domain.js';
import {engagementInput,momentum,pickAction,dailySpark,contextualSpark,keepsakes,feelingInput} from '../public/engagement.js';
import {createApp} from '../server.mjs';
const date='2026-10-05';
test('starters honor a shared session, low energy and a real saved next move without awarding progress',()=>{
  const s=initialState();s.tasks.push(taskInput({title:'Engineering',steps:[{title:'Open problem two'}]}));
  assert.equal(contextualSpark(s,date)[1],'Open problem two');
  assert.equal(contextualSpark(s,date,'low')[0],'A smaller start counts');
  s.timer={mode:'focus',status:'paused'};assert.match(contextualSpark(s,date)[1],/Resume/);
  s.timer={mode:'short',status:'running'};assert.equal(contextualSpark(s,date)[0],'Let the break count');
  assert.equal(momentum(s,date).xp,0);
});
test('growth and keepsakes come only from real focus and check-offs',()=>{
  const s=initialState();s.engagement=engagementInput({goal:'task1'});
  s.notes.push({text:'capture'});s.coins=999;s.earned=999;s.checkins[date]={energy:'high'};
  const t=taskInput({title:'Actual work',steps:[{title:'Open it',done:true}]});s.tasks.push(t);
  assert.equal(momentum(s,date).xp,0);assert.equal(keepsakes(s,date).filter(c=>c.unlocked).length,0);
  toggleCompletion(s,t.id,date);assert.equal(momentum(s,date).xp,10);assert.equal(momentum(s,date).achieved,true);
  assert.equal(keepsakes(s,date).find(c=>c.id==='win').unlocked,true);
  toggleCompletion(s,t.id,date);assert.equal(momentum(s,date).xp,0);
  toggleCompletion(s,t.id,date);assert.equal(momentum(s,date).xp,10);
  s.sessions.push({id:'partial',date,mode:'focus',minutes:2,full:false});
  s.sessions.push({id:'rest',date,mode:'short',minutes:10,full:true});
  assert.equal(momentum(s,date).xp,12);assert.equal(keepsakes(s,date).find(c=>c.id==='start').unlocked,true);
  assert.equal(momentum(s,'2026-10-09').xp,12);assert.equal(momentum(s,'2026-10-09').value,0);
});
test('repeating check-offs are recognized accurately without undo farming',()=>{
  const s=initialState(),t=taskInput({title:'A twice-daily action',repeat:'interval_0.5'});s.tasks.push(t);
  toggleCompletion(s,t.id,date);assert.equal(momentum(s,date).xp,10);
  toggleCompletion(s,t.id,date);assert.equal(momentum(s,date).xp,20);
  toggleCompletion(s,t.id,date);assert.equal(momentum(s,date).xp,10);
  toggleCompletion(s,t.id,date);assert.equal(momentum(s,date).xp,20);
});
test('goal progress, levels and discoveries remain deterministic across rest days',()=>{
  const s=initialState();s.sessions=[{id:'a',date,mode:'focus',minutes:40,full:true}];
  assert.equal(momentum(s,date).level,2);assert.equal(momentum(s,date).into,0);assert.equal(momentum(s,date).left,120);
  const p=momentum(s,date);assert.equal(p.ratio,1);assert.equal(p.achieved,true);
  assert.deepEqual(keepsakes(s,date),keepsakes(s,'2026-12-01'));
  assert.equal(momentum(s,'2026-12-01').level,2);
  assert.deepEqual(dailySpark(date),dailySpark(date));assert.notDeepEqual(dailySpark(date),dailySpark('2026-10-06'));
  s.sessions.push({id:'zero-a',date:'2026-10-06',mode:'focus',minutes:0,full:false},{id:'zero-b',date:'2026-10-07',mode:'focus',minutes:0,full:false});
  assert.equal(keepsakes(s,date).find(c=>c.id==='return').unlocked,false);
  s.sessions.push({id:'real-a',date:'2026-10-06',mode:'focus',minutes:1,full:false},{id:'real-b',date:'2026-10-07',mode:'focus',minutes:1,full:false});
  assert.equal(keepsakes(s,date).find(c=>c.id==='return').unlocked,true);
});
test('picker offers eligible real actions and respects exclusions without modifying the shortlist',()=>{
  const s=initialState();s.tasks=[
    taskInput({title:'Someday',lane:'later'}),taskInput({title:'Future',due:'2026-11-01'}),
    {...taskInput({title:'Deleted'}),deleted:true},{...taskInput({title:'Completed'}),completed:true},
    taskInput({title:'Demanding',minutes:5,energy:'high'}),taskInput({title:'Light',minutes:10,energy:'low'}),
    taskInput({title:'Overdue',due:'2026-10-01',minutes:20})];
  const before=structuredClone(s.tasks),first=pickAction(s,date,'low');assert.equal(first.title,'Overdue');
  const second=pickAction(s,date,'low',[first.id]);assert.equal(second.title,'Light');
  const third=pickAction(s,date,'low',[first.id,second.id]);assert.equal(third.title,'Demanding');
  assert.equal(pickAction(s,date,'low',[first.id,second.id,third.id]),null);assert.deepEqual(s.tasks,before);
});
test('encouragement validation preserves boolean choices and rejects malformed values',()=>{
  assert.equal(engagementInput({feedback:false,haptics:true}).feedback,false);
  assert.equal(engagementInput({intent:' x '.repeat(100)}).intent.length,160);
  for(const data of [null,[],42,'invalid',{goal:'max'},{feedback:'false'},{chime:1},{novelty:null},{cue:4},{intent:{}}])assert.throws(()=>engagementInput(data));
  const a=engagementInput({goal:'focus10',intent:'Learn',haptics:true});const b=engagementInput({feedback:false},a);
  assert.equal(b.intent,'Learn');assert.equal(b.goal,'focus10');assert.equal(b.haptics,true);
});
test('optional feelings persist, update rather than farm points, and quieter means quieter',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'episuite-engagement-'));let app=await createApp({dataDir:dir});
  const listen=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${app.server.address().port}`};let base=await listen();
  const post=async(url,data)=>{const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,body:await r.json()}};
  const get=async()=> (await fetch(base+'/api/state')).json();
  try{
    const fixture=await get();fixture.sessions.push({id:'synthetic-test-session',date,mode:'focus',minutes:2,full:false});
    assert.equal((await post('/api/import',fixture)).status,200);
    assert.equal((await post('/api/engagement/feeling',{sessionId:'synthetic-test-session',feeling:'good'})).status,200);
    assert.equal((await post('/api/engagement/feeling',{sessionId:'synthetic-test-session',feeling:'quieter'})).status,200);
    const saved=await get();assert.equal(saved.feelings.length,1);assert.equal(saved.engagement.feedback,false);assert.equal(saved.engagement.haptics,false);assert.equal(saved.engagement.chime,false);assert.equal(momentum(saved,date).xp,2);
    assert.equal((await post('/api/engagement/feeling',{sessionId:'unknown',feeling:'good'})).status,400);
    assert.equal((await post('/api/engagement/feeling',{sessionId:'synthetic-test-session',feeling:'bad-input'})).status,400);
    await app.close();app=await createApp({dataDir:dir});base=await listen();assert.deepEqual((await get()).feelings,saved.feelings);
    const backup=await (await fetch(base+'/api/export')).json();assert.equal((await post('/api/import',{...backup,feelings:[{sessionId:'unknown',feeling:'good'}]})).status,400);assert.deepEqual((await get()).feelings,saved.feelings);
    assert.throws(()=>feelingInput({sessionId:'rest',feeling:'good'},{sessions:[{id:'rest',mode:'short',minutes:5}]}));
  }finally{await app.close();assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'episuite-engagement-'));await rm(dir,{recursive:true,force:true});}
});
test('preferences persist through restart and backup; invalid input rolls back without changing work',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'episuite-engagement-'));let app=await createApp({dataDir:dir});
  const listen=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${app.server.address().port}`};let base=await listen();
  const post=async(url,data)=>{const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,body:await r.json()}};
  const get=async()=> (await fetch(base+'/api/state')).json();
  try{
    await post('/api/tasks',{title:'Keep real work',lane:'today'});const tasks=(await get()).tasks;
    assert.equal((await post('/api/engagement',{goal:'focus10',feedback:false,cue:'After lunch',intent:'Build something'})).status,200);
    const prefs=(await get()).engagement;
    await app.close();app=await createApp({dataDir:dir});base=await listen();assert.deepEqual((await get()).engagement,prefs);
    const before=await get();assert.equal((await post('/api/engagement',{goal:'focus2',feedback:'yes'})).status,400);assert.deepEqual((await get()).engagement,prefs);assert.equal((await get()).revision,before.revision);
    const backup=await (await fetch(base+'/api/export')).json();await post('/api/engagement',{goal:'task1'});assert.equal((await post('/api/import',backup)).status,200);assert.deepEqual((await get()).engagement,prefs);assert.deepEqual((await get()).tasks,tasks);
    assert.equal((await post('/api/import',{...backup,engagement:{feedback:'false'}})).status,400);assert.deepEqual((await get()).engagement,prefs);
    const module=await fetch(base+'/engagement.js');assert.equal(module.status,200);assert.match(await module.text(),/export function momentum/);
    for(let i=0;i<3;i++)await get();assert.equal(momentum(await get(),dateKey(Date.now())).xp,0);
  }finally{await app.close();assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'episuite-engagement-'));await rm(dir,{recursive:true,force:true});}
});
