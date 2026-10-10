import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {coinAward} from '../random-rewards.mjs';
import {createApp} from '../server.mjs';
import {initialState,dateKey} from '../public/domain.js';
async function fixture(options={}) {
  const dataDir=await mkdtemp(path.join(tmpdir(),'episuite-screentime-')),state=initialState();state.coins=500;
  await writeFile(path.join(dataDir,'episuite.json'),JSON.stringify(state));
  let app,base;
  const start=async()=>{app=await createApp({dataDir,backgroundInterval:0,...options});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;};
  await start();
  return {get app(){return app;},dataDir,
    async call(endpoint,data={},method='POST',headers={}){const response=await fetch(base+endpoint,{method,headers:{'Content-Type':'application/json',...headers},body:method==='GET'?undefined:JSON.stringify(data)});return {status:response.status,body:await response.json()};},
    async restart(){await app.close();await start();},close:()=>app.close()};
}
async function purchase(f,minutes=45,cost=40){
  const reward=await f.call('/api/rewards',{name:'Phone time',kind:'screentime',cost,minutes});assert.equal(reward.status,200);
  const bought=await f.call('/api/rewards/buy',{id:reward.body.result.id});assert.equal(bought.status,200);return bought.body.result.purchase;
}
test('custom personal rewards remain available; screentime packages are validated and editable',async()=>{
  const f=await fixture();try{
    assert.equal(f.app.getState().rewards.filter(r=>r.kind==='screentime').length,2);
    const personal=await f.call('/api/rewards',{name:'Coffee',cost:15,minutes:10});assert.equal(personal.body.result.kind,'personal');
    const bought=await f.call('/api/rewards/buy',{id:personal.body.result.id});assert.equal(bought.body.result.purchase.key,undefined);
    assert.equal((await f.call('/api/redeem/start',{id:bought.body.result.purchase.id})).status,200);await f.call('/api/redeem/stop');
    for(const input of [{cost:0},{cost:1.5},{minutes:0},{minutes:1441},{minutes:1.5},{kind:'other'}])assert.equal((await f.call('/api/rewards',{name:'Bad',kind:'screentime',cost:20,minutes:10,...input})).status,400);
    const p=await purchase(f,180);assert.equal(p.minutes,180);
    const reward=f.app.getState().rewards.find(r=>r.name==='Phone time');
    const edited=await f.call('/api/rewards/'+reward.id,{name:'Updated phone time',minutes:60,cost:80},'PATCH');assert.equal(edited.status,200);
    // Purchased minutes do not change when their shop option is edited or deleted.
    await f.call('/api/rewards/delete',{id:reward.id});assert.equal((await f.call('/api/screentime/redeem',{key:p.key})).body.minutes,180);
    await f.call('/api/rewards/delete',{id:'screen-15'});await f.restart();assert.equal(f.app.getState().rewards.some(r=>r.id==='screen-15'),false);
  }finally{await f.close();}
});
test('purchase deducts coins once and generates unique persistent keys, while insufficient funds mint nothing',async()=>{
  const f=await fixture();try{
    const first=await purchase(f);assert.match(first.key,/^[A-Z0-9]{4}(-[A-Z0-9]{4}){5}$/);assert.equal(f.app.getState().coins,460);
    const second=await purchase(f);assert.notEqual(first.key,second.key);assert.equal(Object.keys(f.app.getState().screentime.keys).length,2);
    const before=f.app.getState();const expensive=await f.call('/api/rewards',{name:'Too expensive',kind:'screentime',cost:1000,minutes:60});
    assert.equal((await f.call('/api/rewards/buy',{id:expensive.body.result.id})).status,400);assert.equal(f.app.getState().coins,before.coins);assert.equal(f.app.getState().purchases.length,before.purchases.length);
    await f.restart();assert.equal(f.app.getState().purchases.find(p=>p.id===first.id).key,first.key);
    const result=await f.call('/api/screentime/redeem',{key:first.key});assert.equal(result.status,200);assert.deepEqual(result.body,{ok:true,minutes:45,seconds:2700,purchaseId:first.id});
    const disk=JSON.parse(await readFile(path.join(f.dataDir,'episuite.json'),'utf8'));assert.equal(Object.keys(disk.screentime.keys).length,1);assert.equal(disk.purchases.find(p=>p.id===first.id).key,undefined);
    await f.restart();assert.equal((await f.call('/api/screentime/redeem',{key:first.key})).status,410);assert.equal((await f.call('/api/screentime/redeem',{key:second.key})).status,200);
  }finally{await f.close();}
});
test('racing redemption requests have exactly one winner and ignore client-supplied minutes',async()=>{
  const f=await fixture();try{
    const p=await purchase(f,30),coins=f.app.getState().coins;
    const results=await Promise.all(Array.from({length:10},()=>f.call('/api/screentime/redeem',{key:p.key,minutes:9999})));
    assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===410).length,9);
    assert.equal(results.find(r=>r.status===200).body.minutes,30);assert.equal(f.app.getState().coins,coins);assert.equal(Object.keys(f.app.getState().screentime.keys).length,0);
  }finally{await f.close();}
});
test('malformed keys and disallowed requests cannot consume a key; native Android JSON requests work',async()=>{
  const f=await fixture();try{
    const p=await purchase(f,15);
    for(const key of [undefined,null,{},'short','0'.repeat(1000)])assert.equal((await f.call('/api/screentime/redeem',{key})).status,400);
    assert.equal((await f.call('/api/screentime/redeem',{key:'0'.repeat(24)})).status,410);
    assert.equal((await f.call('/api/screentime/redeem',{key:p.key},'PATCH')).status,405);
    assert.equal((await f.call('/api/screentime/redeem',{key:p.key},'POST',{'Content-Type':'text/plain'})).status,415);
    assert.equal((await f.call('/api/screentime/redeem',{key:p.key},'POST',{Origin:'http://other-host'})).status,403);
    assert.equal((await f.call('/api/redeem/start',{id:p.id})).status,400);
    const result=await f.call('/api/screentime/redeem',{key:'  '+p.key.toLowerCase().replaceAll('-',' ')+'  '});assert.equal(result.status,200);assert.equal(result.body.seconds,900);assert.equal(result.body.state,undefined);
  }finally{await f.close();}
});
test('exports exclude live keys, imports preserve pending keys and cannot resurrect consumed keys',async()=>{
  const f=await fixture();try{
    const first=await purchase(f,10),second=await purchase(f,20),snapshot=f.app.getState();
    const exported=await f.call('/api/export',{},'GET');assert.equal(exported.body.screentime,undefined);assert.ok(!JSON.stringify(exported.body).includes(first.key));assert.ok(!JSON.stringify(exported.body).includes(second.key));
    const publicState=await f.call('/api/state',{},'GET');assert.deepEqual(publicState.body.screentime,{outstanding:2});
    await f.call('/api/screentime/redeem',{key:first.key});
    assert.equal((await f.call('/api/import',snapshot)).status,200);
    assert.equal((await f.call('/api/screentime/redeem',{key:first.key})).status,410);assert.equal(f.app.getState().purchases.find(p=>p.id===first.id).used,true);
    assert.equal(f.app.getState().purchases.find(p=>p.id===second.id).key,second.key);assert.equal((await f.call('/api/screentime/redeem',{key:second.key})).status,200);
    const restored=await f.call('/api/import',exported.body);assert.equal(restored.status,200);assert.equal(Object.keys(f.app.getState().screentime.keys).length,0);
  }finally{await f.close();}
});
test('HTTP task jackpot remains stable across undo, redo, import and restart; alerts are not repeated',async()=>{
  let draws=0;const sent=[];
  const f=await fixture({rewardRandom:()=>{draws++;return .9995;},notificationFetch:async(url,options)=>{sent.push(JSON.parse(options.body));return {ok:true};}});
  try{
    await f.call('/api/notifications/config',{enabled:true,ntfyUrl:'http://local-ntfy',topic:'private'});
    const task=(await f.call('/api/tasks',{title:'Earn a jackpot'})).body.result;
    const jackpot=coinAward(f.app.getState(),5,Date.now(),()=>.9995).coins;const completed=await f.call('/api/tasks/'+task.id+'/complete');assert.equal(completed.body.result.delta,jackpot);assert.equal(completed.body.result.award.rewardTier,'jackpot');
    await f.app.backgroundTick(Date.now()+1000);assert.equal(sent.length,1);assert.match(sent[0].title,/jackpot/i);
    const day=dateKey(),backup=(await f.call('/api/export',{},'GET')).body;
    await f.call('/api/tasks/'+task.id+'/undo');await f.restart();
    assert.equal((await f.call('/api/tasks/'+task.id+'/complete')).body.result.delta,jackpot);assert.equal(draws,1);
    await f.call('/api/import',backup);await f.call('/api/tasks/'+task.id+'/undo');assert.equal((await f.call('/api/tasks/'+task.id+'/complete')).body.result.delta,jackpot);assert.equal(draws,1);
    assert.equal((await f.call('/random-rewards.mjs',{},'GET')).status,404);
    const publicModule=await readFile(new URL('../public/reward-events.js',import.meta.url),'utf8');assert.ok(!publicModule.includes('coinAward'));assert.ok(!publicModule.includes('taskPayoutTiers'));
    await f.app.backgroundTick(Date.now()+2000);assert.equal(sent.length,1);assert.equal(f.app.getState().tasks[0].history[day][0].coins,jackpot);
    const claim=await f.call('/api/quests/claim',{id:'finish'});assert.equal(claim.body.result.coins,5);assert.equal(draws,1);
  }finally{await f.close();}
});
