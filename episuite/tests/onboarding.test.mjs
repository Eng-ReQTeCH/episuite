import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server.mjs';
const dir=await mkdtemp(path.join(tmpdir(),'episuite-guide-'));
let app=await createApp({dataDir:dir});
async function listen(){await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${app.server.address().port}`;}
let base=await listen();
async function post(url,data){const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};}
async function state(){return (await fetch(base+'/api/state')).json();}
test.after(async()=>{await app.close();assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'episuite-guide-'));await rm(dir,{recursive:true,force:true});});
test('guided setup persists pause/resume and completion through server restart without changing user content',async()=>{
  await post('/api/tasks',{title:'Existing real task',lane:'today'});
  const before=await state();
  await post('/api/onboarding',{status:'active',step:1});
  await post('/api/onboarding',{status:'paused',step:3});
  await app.close();app=await createApp({dataDir:dir});base=await listen();
  assert.equal((await state()).onboarding.step,3);
  assert.equal((await state()).onboarding.status,'paused');
  await post('/api/onboarding',{status:'active',step:3});
  await post('/api/onboarding',{status:'complete',step:7});
  const after=await state();
  assert.equal(after.onboarding.status,'complete');
  assert.deepEqual(after.tasks,before.tasks);assert.deepEqual(after.blocks,before.blocks);assert.deepEqual(after.settings,before.settings);
  assert.equal((await post('/api/onboarding',{status:'active',step:0})).status,200);
  assert.equal((await state()).tasks.length,1);
});
test('invalid progress is rejected atomically and guide state survives backup export/import',async()=>{
  const before=await state();
  for(const data of [{status:'active',step:8},{status:'active',step:-1},{status:'active',step:1.5},{status:'unknown',step:0},{status:'active',step:'3'},{status:'complete',step:0}])assert.equal((await post('/api/onboarding',data)).status,400);
  assert.deepEqual((await state()).onboarding,before.onboarding);
  const backup=await (await fetch(base+'/api/export')).json();
  await post('/api/onboarding',{status:'complete',step:7});
  assert.equal((await post('/api/import',backup)).status,200);
  assert.deepEqual((await state()).onboarding,backup.onboarding);
  const invalid={...backup,onboarding:{status:'active',step:200}};
  assert.equal((await post('/api/import',invalid)).status,400);
  assert.deepEqual((await state()).onboarding,backup.onboarding);
});
