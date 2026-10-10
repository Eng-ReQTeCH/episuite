import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {initialState,taskInput,blockInput,toggleCompletion,undoLastCompletion,startTimer,finishTimer,dateKey} from '../public/domain.js';
import {rewardDefaults,rewardConfig} from '../public/reward-events.js';
import {coinAward,randomUnit} from '../random-rewards.mjs';
import {notificationConfig,sendNotification} from '../notifications.mjs';
import {createApp} from '../server.mjs';
const noon=Date.parse('2026-10-07T09:00:00Z');
function seeded(){const s=initialState();s.rewardEvents={config:{...rewardDefaults},history:[],lastSlot:0};return s;}
test('variable payouts have broad diversity, a rare upper tail, and no time weighting',()=>{
  const s=seeded(),values=Array.from({length:10000},(_,i)=>coinAward(s,5,noon,()=>(i+.5)/10000).coins);
  assert.ok(values.every(n=>Number.isInteger(n)&&n>0));assert.ok(new Set(values).size>100);
  assert.ok(values.filter(n=>n>=1000).length<values.filter(n=>n<50).length/100);
  assert.equal(coinAward(s,5,noon,()=>.8).coins,coinAward(s,5,noon+43200000,()=>.8).coins);
  s.settings.gamification=false;assert.equal(coinAward(s,5,noon,()=>.999).coins,5);
  assert.deepEqual(rewardConfig({enabled:false}),{enabled:false});assert.throws(()=>coinAward(seeded(),5,noon,()=>1));
  const entropy=Array.from({length:20},randomUnit);assert.ok(entropy.every(x=>x>=0&&x<1));assert.ok(new Set(entropy).size>1);
});
test('task undo reverses the exact draw, redo cannot reroll, and focus remains proportional',()=>{
  const s=seeded(),now=Date.now();
  const t=taskInput({title:'Task'});s.tasks.push(t);
  const jackpot=coinAward(s,5,now,()=>.9995).coins;let draws=0;assert.equal(toggleCompletion(s,t.id,dateKey(),base=>coinAward(s,base,now,()=>{draws++;return .9995;})),jackpot);assert.equal(t.history[dateKey()][0].baseCoins,5);
  assert.equal(undoLastCompletion(s,t.id,dateKey()),-jackpot);assert.equal(s.coins,0);
  assert.equal(toggleCompletion(s,t.id,dateKey(),()=>{draws++;throw Error('Must not reroll');}),jackpot);assert.equal(draws,1);
  assert.equal(toggleCompletion(s,t.id,dateKey()),-jackpot);assert.equal(s.coins,0);
  startTimer(s,{minutes:1},now-60000);const session=finishTimer(s,now+120000);
  assert.equal(session.coins,1);assert.equal(session.rewardTier,'fixed');assert.equal(finishTimer(s),null);
});
test('ntfy and Telegram use documented authenticated requests and reject failed responses',async()=>{
  let captured;
  const transport=async(url,options)=>{captured={url,...options};return {ok:true,json:async()=>({ok:true})};};
  const job={title:'A boost',message:'Double coins'};
  await sendNotification(notificationConfig({enabled:true,ntfyUrl:'http://home:8080',topic:'private',ntfyToken:'secret'}),job,transport);
  assert.equal(captured.url,'http://home:8080');assert.equal(captured.headers.Authorization,'Bearer secret');assert.equal(JSON.parse(captured.body).topic,'private');
  await sendNotification(notificationConfig({enabled:true,provider:'telegram',botToken:'123:abc',chatId:'456'}),job,transport);
  assert.equal(captured.url,'https://api.telegram.org/bot123:abc/sendMessage');assert.equal(JSON.parse(captured.body).chat_id,'456');
  await assert.rejects(sendNotification({provider:'telegram'},job,async()=>({ok:true,json:async()=>({ok:false})})));
  assert.throws(()=>notificationConfig({ntfyUrl:'file:///x'}));assert.throws(()=>notificationConfig({enabled:true}));
});
test('background server sends without a browser, persists receipts, retries, and redacts tokens',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'episuite-phone-'));
  const s=seeded();s.rewardEvents.lastSlot=Math.floor(Date.now()/900000);
  const now=Date.now();s.timer={id:'expired',status:'running',mode:'focus',duration:60,remaining:60,deadline:now-1000,started:now-61000};
  s.notifications={config:notificationConfig({enabled:true,ntfyUrl:'http://home:8080',topic:'private',ntfyToken:'secret',botToken:'123:abc'}),jobs:[]};
  await writeFile(path.join(dir,'episuite.json'),JSON.stringify(s));
  let sends=0,fail=true;
  let app=await createApp({dataDir:dir,backgroundInterval:0,rewardRandom:()=>.99,notificationFetch:async()=>{sends++;if(fail)throw Error('secret must not leak');return {ok:true};}});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+app.server.address().port;
  const post=(url,data={})=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  try{
    await app.backgroundTick(now+1000);assert.equal(app.getState().sessions.length,1);assert.equal(sends,1);assert.equal(app.getState().notifications.jobs[0].status,'pending');
    fail=false;await app.backgroundTick(now+31001);assert.equal(sends,2);assert.equal(app.getState().notifications.jobs[0].status,'sent');
    await app.backgroundTick(now+60000);assert.equal(sends,2);
    for(const endpoint of ['/api/state','/api/export']){const json=await(await fetch(base+endpoint)).text();assert.ok(!json.includes('secret'));assert.ok(!json.includes('123:abc'));}
    const forbidden=await post('/api/notifications/config',{provider:'smtp'});assert.equal(forbidden.status,400);
    await post('/api/notifications/test');await app.backgroundTick(now+61000);assert.equal(sends,3);
    const backup=await(await fetch(base+'/api/export')).json();await post('/api/import',backup);assert.equal(app.getState().notifications.config.ntfyToken,'secret');
  }finally{await app.close();}
  app=await createApp({dataDir:dir,backgroundInterval:0,rewardRandom:()=>.99,notificationFetch:async()=>{sends++;return {ok:true};}});
  try{await app.backgroundTick(now+90000);assert.equal(sends,3);}finally{await app.close();}
});
test('calendar reminders are deduplicated and stale alerts expire without timed boosts',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'episuite-events-')),s=seeded();
  const day=dateKey(noon,s.settings.timezone);
  s.blocks.push(blockInput({name:'Planned focus',date:day,start:'12:15',duration:30,reminderMinutes:15}));
  s.notifications={config:notificationConfig({enabled:true,ntfyUrl:'http://home:8080',topic:'private'}),jobs:[]};
  await writeFile(path.join(dir,'episuite.json'),JSON.stringify(s));let sent=0;
  const app=await createApp({dataDir:dir,backgroundInterval:0,rewardRandom:()=>0,notificationFetch:async()=>{sent++;return {ok:true};}});
  try{
    await app.backgroundTick(noon);assert.equal(sent,1);assert.equal(app.getState().rewardEvents.history,undefined);
    await app.backgroundTick(noon+30000);assert.equal(sent,1);
    await app.backgroundTick(noon+900000);assert.equal(sent,1);
  }finally{await app.close();}
  // A failed provider cannot leave a boost retry alive past the boost window.
  s.notifications.jobs=[{id:'old-boost',kind:'boosts',title:'Boost',message:'Expired',createdAt:noon,expiresAt:noon+1000,nextAt:noon,attempts:0,status:'pending'}];
  s.rewardEvents.lastSlot=Math.floor(noon/900000);s.blocks=[];
  await writeFile(path.join(dir,'episuite.json'),JSON.stringify(s));
  const expired=await createApp({dataDir:dir,backgroundInterval:0,rewardRandom:()=>.99,notificationFetch:async()=>{throw Error('Should not send');}});
  try{await expired.backgroundTick(noon+2000);assert.equal(expired.getState().notifications.jobs[0].status,'expired');}finally{await expired.close();}
});
test('delivery stops after five failed attempts and reports a sanitized error',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'episuite-retries-')),s=seeded(),now=Date.now();s.rewardEvents.lastSlot=Math.floor(now/900000);
  s.notifications={config:notificationConfig({enabled:true,ntfyUrl:'http://home:8080',topic:'private'}),jobs:[{id:'retry',kind:'test',title:'Test',message:'Hello',createdAt:now,expiresAt:now+3600000,nextAt:now,attempts:0,status:'pending'}]};
  await writeFile(path.join(dir,'episuite.json'),JSON.stringify(s));let attempts=0;
  const app=await createApp({dataDir:dir,backgroundInterval:0,rewardRandom:()=>.99,notificationFetch:async()=>{attempts++;throw Error('secret');}});
  try{let clock=now;for(let i=0;i<5;i++){await app.backgroundTick(clock);clock=app.getState().notifications.jobs[0].nextAt;}assert.equal(attempts,5);assert.equal(app.getState().notifications.jobs[0].status,'failed');assert.ok(!app.getState().notifications.lastError.includes('secret'));await app.backgroundTick(clock+1000);assert.equal(attempts,5);}finally{await app.close();}
});
