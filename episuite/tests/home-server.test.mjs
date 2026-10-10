import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {webcrypto} from 'node:crypto';
import {createApp} from '../server.mjs';
import {uid,initialState,startTimer} from '../public/domain.js';

test('LAN HTTP UUID fallback produces unique valid IDs without randomUUID',()=>{
  const source={getRandomValues:bytes=>webcrypto.getRandomValues(bytes)};
  const ids=Array.from({length:100},()=>uid(source));assert.equal(new Set(ids).size,100);
  for(const id of ids)assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});

async function workspace(run){
  const dir=await mkdtemp(path.join(tmpdir(),'episuite-home-'));let app=await createApp({dataDir:dir});
  const listen=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${app.server.address().port}`};let base=await listen();
  const get=async(headers={})=>{const response=await fetch(base+'/api/state',{headers});return {status:response.status,etag:response.headers.get('etag'),state:response.status===304?null:await response.json()}};
  const post=async(url,data={},method='POST')=>{const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,...await response.json()}};
  try{await run({get,post,restart:async()=>{await app.close();app=await createApp({dataDir:dir});base=await listen();}});}
  finally{await app.close();assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'episuite-home-'));await rm(dir,{recursive:true,force:true});}
}
test('one workspace shares onboarding, preferences, tasks and captures across clients and restart',async()=>workspace(async({get,post,restart})=>{
  const laptop=(await get()).state,phone=(await get()).state;assert.equal(laptop.workspaceId,phone.workspaceId);
  await post('/api/onboarding',{status:'active',step:2});assert.equal((await get()).state.onboarding.step,2);
  await post('/api/onboarding',{status:'paused',step:3});await post('/api/settings',{name:'Owner',theme:'dark'});
  const t=(await post('/api/tasks',{title:'One shared task',lane:'today'})).result;
  const id=uid();await Promise.all([post('/api/notes',{id,text:'Queued thought'}),post('/api/notes',{id,text:'Queued thought'})]);
  await restart();const pc=(await get()).state;assert.equal(pc.workspaceId,laptop.workspaceId);assert.equal(pc.onboarding.step,3);assert.equal(pc.settings.name,'Owner');assert.equal(pc.tasks[0].id,t.id);assert.equal(pc.notes.length,1);
  const backup=structuredClone(pc);backup.workspaceId='different-machine';await post('/api/import',backup);assert.equal((await get()).state.workspaceId,laptop.workspaceId);
}));
test('conditional polling returns no payload when unchanged and a new version when another device writes',async()=>workspace(async({get,post})=>{
  const a=await get();assert.equal((await get({'If-None-Match':a.etag})).status,304);
  await post('/api/tasks',{title:'Phone change'});const b=await get({'If-None-Match':a.etag});assert.equal(b.status,200);assert.notEqual(b.etag,a.etag);assert.equal(b.state.tasks[0].title,'Phone change');
  assert.equal((await get({'If-None-Match':b.etag})).status,304);
}));
test('stale edits and duplicated completion from another device cannot overwrite work or undo a win',async()=>workspace(async({get,post})=>{
  const t=(await post('/api/tasks',{title:'First draft'})).result;
  assert.equal((await post(`/api/tasks/${t.id}`,{title:'PC version',expectedVersion:t.editVersion},'PATCH')).status,200);
  const stale=await post(`/api/tasks/${t.id}`,{title:'Stale phone version',expectedVersion:t.editVersion},'PATCH');assert.equal(stale.status,409);assert.equal(stale.state.tasks[0].title,'PC version');
  const latest=(await get()).state.tasks[0];const results=await Promise.all([post(`/api/tasks/${t.id}/complete`,{expectedVersion:latest.editVersion}),post(`/api/tasks/${t.id}/complete`,{expectedVersion:latest.editVersion})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await get()).state.tasks[0].completed,true);const awarded=results.find(r=>r.status===200).result.delta;assert.ok(Number.isInteger(awarded)&&awarded>0);assert.equal((await get()).state.coins,awarded);
  const current=(await get()).state.tasks[0];assert.equal((await post(`/api/tasks/${t.id}/complete`,{expectedVersion:current.editVersion})).status,200);assert.equal((await get()).state.coins,0);
}));
test('bulk day/category changes invalidate stale task editors; time blocks also protect drafts',async()=>workspace(async({get,post})=>{
  const t=(await post('/api/tasks',{title:'Today action',lane:'today',category:'Work'})).result;
  await post('/api/day/end');assert.equal((await post(`/api/tasks/${t.id}`,{lane:'today',expectedVersion:t.editVersion},'PATCH')).status,409);
  const latest=(await get()).state.tasks[0];await post('/api/categories',{name:'Work',remove:true});assert.equal((await post(`/api/tasks/${t.id}`,{title:'stale',expectedVersion:latest.editVersion},'PATCH')).status,409);
  const block=(await post('/api/blocks',{name:'Block',date:'2026-10-05',mode:'relative'})).result;await post('/api/schedule/shift?date=2026-10-05',{minutes:15});
  assert.equal((await post(`/api/blocks/${block.id}`,{name:'Stale block',expectedVersion:block.editVersion},'PATCH')).status,409);
}));
test('shared timers persist through restart and stale controls cannot end a newer session',async()=>workspace(async({get,post,restart})=>{
  const first=(await post('/api/timer/start',{minutes:2})).state.timer;
  await post('/api/timer/pause',{timerId:first.id});await restart();assert.equal((await get()).state.timer.id,first.id);assert.equal((await get()).state.timer.status,'paused');
  await post('/api/timer/resume',{timerId:first.id});await post('/api/timer/finish',{timerId:first.id,early:true});const count=(await get()).state.sessions.length;
  assert.equal((await post('/api/timer/finish',{timerId:first.id,early:true})).status,200);assert.equal((await get()).state.sessions.length,count);
  const second=(await post('/api/timer/start',{minutes:2})).state.timer;
  for(const action of ['finish','pause','reset'])assert.equal((await post('/api/timer/'+action,{timerId:first.id,early:true})).status,409);
  assert.equal((await get()).state.timer.id,second.id);
}));
test('Docker package exposes the shared server, excludes local data and preserves its volume',async()=>{
  const compose=await readFile(new URL('../docker-compose.yml',import.meta.url),'utf8'),image=await readFile(new URL('../Dockerfile',import.meta.url),'utf8'),ignore=await readFile(new URL('../.dockerignore',import.meta.url),'utf8');
  assert.match(compose,/name: episuite/);assert.match(compose,/EPISUITE_BIND_ADDRESS:-0\.0\.0\.0/);assert.match(compose,/episuite-data:\/app\/data/);assert.match(compose,/healthcheck:/);assert.match(compose,/restart: unless-stopped/);assert.match(compose,/init: true/);
  assert.match(image,/USER node/);assert.match(image,/COPY public/);assert.match(ignore,/^data$/m);assert.match(ignore,/^\.env$/m);
});
test('expired focus creates one shared automatic break; concurrent clients cannot finish that new break',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'episuite-home-'));const fixture=initialState();fixture.settings.autoBreak=true;
  startTimer(fixture,{minutes:2},Date.now()-123000);await writeFile(path.join(dir,'episuite.json'),JSON.stringify(fixture));
  const app=await createApp({dataDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
  try{await Promise.all([fetch(base+'/api/state'),fetch(base+'/api/state'),fetch(base+'/api/state')]);const s=await (await fetch(base+'/api/state')).json();assert.equal(s.sessions.filter(s=>s.mode==='focus').length,1);assert.equal(s.sessions[0].minutes,2);assert.equal(s.timer.mode,'short');assert.equal(s.timer.status,'running');assert.ok(s.timer.deadline>Date.now());}
  finally{await app.close();assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'episuite-home-'));await rm(dir,{recursive:true,force:true});}
});
test('opening after a long absence saves focus and its elapsed break without starting a surprise timer',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'episuite-home-'));const fixture=initialState();fixture.settings.autoBreak=true;
  startTimer(fixture,{minutes:2},Date.now()-3600000);await writeFile(path.join(dir,'episuite.json'),JSON.stringify(fixture));
  const app=await createApp({dataDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
  try{const s=await (await fetch(base+'/api/state')).json();assert.equal(s.sessions.length,2);assert.equal(s.sessions[0].minutes,2);assert.equal(s.sessions[1].mode,'short');assert.equal(s.timer,null);}
  finally{await app.close();assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'episuite-home-'));await rm(dir,{recursive:true,force:true});}
});
