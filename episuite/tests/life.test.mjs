import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server.mjs';
import {activity,heatmap,shortcutInput} from '../public/life.js';
import {initialState,dateKey} from '../public/domain.js';
test('graphs count retained histories and focus, including partial habits and archived tasks',()=>{
 const state=initialState();state.tasks=[{id:'a',category:'German',deleted:true,history:{'2024-02-29':[{},{}]}}];state.sessions=[{mode:'focus',minutes:2,date:'2024-02-29'}];state.life={visits:{'2024-02-29':1}};
 const a=activity(state);assert.equal(a.all['2024-02-29'],2);assert.equal(a.byCategory.German['2024-02-29'],2);assert.equal(a.workDays.size,1);
 const html=heatmap(a.all,'2024-12-31','German','check-offs','2024-01-01');assert.equal((html.match(/aria-label="2024-/g)||[]).length,366);assert.match(html,/2024-02-29: 2 check-offs/);
 assert.throws(()=>shortcutInput({name:'bad',url:'javascript:alert(1)'}));assert.throws(()=>shortcutInput({name:'bad',url:'https://a:b@example.com'}));assert.equal(shortcutInput({name:'German',url:'https://example.com/study'}).url,'https://example.com/study');
});
test('automation is authenticated, monotonic, retry safe, persisted, scoped and excluded from export',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'life-test-'));let app=await createApp({dataDir:dir,backgroundInterval:0,rewardRandom:()=>0});let base;
 const listen=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;};await listen();
 const call=async(p,data,token,method=data===undefined?'GET':'POST')=>{const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
 try{
 const day=dateKey();const task=(await call('/api/tasks',{title:'German',repeat:'interval_0.5'})).body.result;
 assert.equal((await call('/api/automation/tasks')).status,401);
 let token=(await call('/api/automation/token',{})).body.result.token;assert.equal(token.length,64);
 assert.equal((await call('/api/automation/tasks',undefined,'é'.repeat(64))).status,401);
 const payload={taskId:task.id,eventId:'lesson-1'};
 assert.equal((await call('/api/automation/complete',payload)).status,401);
 assert.equal((await call('/api/automation/complete',{taskId:task.id},token)).status,400);
 const results=await Promise.all(Array.from({length:8},()=>call('/api/automation/complete?date='+day,payload,token)));assert.ok(results.every(x=>x.status===200));assert.equal(results.filter(x=>!x.body.result.duplicate).length,1);
 let s=(await call('/api/state')).body;assert.equal(s.tasks[0].history[day].length,1);const coins=s.coins;assert.equal(s.automation.token,undefined);assert.ok(!JSON.stringify(s).includes(token));assert.equal(Object.keys(s.life.visits).length,1);
 await call('/api/state');assert.equal(Object.keys((await call('/api/state')).body.life.visits).length,1);
 await app.close();app=await createApp({dataDir:dir,backgroundInterval:0,rewardRandom:()=>0});await listen();assert.equal((await call('/api/automation/complete?date='+day,payload,token)).body.result.duplicate,true);
 await call('/api/automation/complete?date='+day,{...payload,eventId:'lesson-2'},token);await call('/api/automation/complete?date='+day,{...payload,eventId:'lesson-3'},token);
 s=(await call('/api/state')).body;assert.equal(s.tasks[0].history[day].length,2);assert.equal(s.coins,coins*2);
 assert.equal((await call('/api/automation/complete?date=2024-01-01',payload,token)).status,409);
 const once=(await call('/api/tasks',{title:'Once'})).body.result;await call('/api/automation/complete',{taskId:once.id,eventId:'__proto__'},token);await call('/api/automation/complete',{taskId:once.id,eventId:'another'},token);assert.equal((await call('/api/state')).body.tasks[1].completed,true);
 const backup=(await call('/api/export')).body;assert.equal(backup.automation,undefined);assert.ok(!JSON.stringify(backup).includes(token));
 const shortcut=(await call('/api/life/shortcuts',{name:'German',url:'https://example.com'})).body.result;assert.ok(shortcut.id);assert.equal((await call('/api/life/shortcuts',{name:'X',url:'javascript:alert(1)'})).status,400);
 await call('/api/life/shortcuts/'+shortcut.id,{name:'Deutsch',url:'https://example.com/learn'},undefined,'PATCH');assert.equal((await call('/api/state')).body.life.shortcuts[0].name,'Deutsch');
 await call('/api/import',backup);assert.equal((await call('/api/automation/complete?date='+day,payload,token)).body.result.duplicate,true);
 token=(await call('/api/automation/token',{})).body.result.token;await call('/api/automation/token',{disable:true});assert.equal((await call('/api/automation/tasks',undefined,token)).status,401);
 }finally{await app.close();}
});
