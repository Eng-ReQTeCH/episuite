import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server.mjs';
import {initialState,addDays,dateKey} from '../public/domain.js';
import {boardDefaults,boardInput,graphSources,streak,lifePage,graphPalette} from '../public/life-board.js';

test('streak waits for real work today, retains yesterday, grows, and handles gaps, leap dates and future records', () => {
  const state=initialState();state.life={visits:{'2024-03-01':1}};
  state.tasks=[{id:'habit',title:'German',category:'Learning',repeat:'daily',history:{'2024-02-27':[{}],'2024-02-28':[{}],'2024-02-29':[{}],'2024-03-02':[{}]}}];
  let s=streak(state,'2024-03-01');assert.equal(s.current,3);assert.equal(s.active,false);assert.equal(s.best,3);
  state.tasks[0].history['2024-03-01']=[{}];s=streak(state,'2024-03-01');assert.equal(s.current,4);assert.equal(s.active,true);assert.equal(s.best,4);
  delete state.tasks[0].history['2024-03-01'];state.sessions=[{mode:'focus',date:'2024-03-01',minutes:1}];assert.equal(streak(state,'2024-03-01').current,4);
  state.sessions[0].minutes=0;assert.equal(streak(state,'2024-03-01').active,false);assert.equal(streak(state,'2024-03-05').current,0);
});

test('board starts with no graph dump, validates choices and stays bounded with many pins', () => {
  const state=initialState();state.life={board:boardDefaults()};
  assert.equal((lifePage(state,'2026-10-30').match(/class="board-graph"/g)||[]).length,0);
  assert.doesNotMatch(lifePage(state,'2026-10-30'),/Every task|Life areas & hobbies|life-stats/);
  assert.throws(()=>boardInput({graphs:['missing']},state));assert.throws(()=>boardInput({showFlame:'yes'},state));assert.throws(()=>boardInput({graphAccent:'red;display:none'},state));assert.equal(boardInput({graphAccent:'#A855F7'},state).graphAccent,'#a855f7');assert.equal(graphPalette('#3b82f6')['--graph-3'],'#3b82f6');assert.notEqual(graphPalette('#3b82f6')['--graph-1'],graphPalette('#3b82f6')['--graph-4']);assert.throws(()=>boardInput({graphs:Array(25).fill('all')},state));
  state.tasks=Array.from({length:20},(_,i)=>({id:String(i),title:'Task '+i,category:'Hobby',repeat:'daily',history:{}}));
  const sources=graphSources(state);state.life.board=boardInput({graphs:sources.slice(0,20).map(s=>s.id)},state);
  const html=lifePage(state,'2026-10-30');assert.equal((html.match(/class="board-graph"/g)||[]).length,4);assert.match(html,/1 \/ 5/);assert.match(html,/12 weeks/);
  state.life.board.showFlame=false;state.life.board.showShortcuts=false;assert.doesNotMatch(lifePage(state,'2026-10-30'),/class="ember-panel|class="board-apps/);
});

test('board persists, detects stale edits, survives import, and permanent deletion safely unlinks retained records',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'life-board-'));let app=await createApp({dataDir:dir,backgroundInterval:0}),base;
  const listen=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;};await listen();
  const call=async(p,data,method=data===undefined?'GET':'POST')=>{const response=await fetch(base+p,{method,headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,body:await response.json()};};
  try{
    const t=(await call('/api/tasks',{title:'Remove me',repeat:'daily'})).body.result;
    const graph=`task:${t.id}`;
    assert.equal((await call('/api/life/board',{graphs:[graph,'focus'],showTotals:true,graphAccent:'#3b82f6',expectedBoardVersion:0})).status,200);
    assert.equal((await call('/api/life/board',{graphs:[],expectedBoardVersion:0})).status,409);
    assert.equal((await call('/api/life/board',{graphs:['missing'],expectedBoardVersion:1})).status,400);
    const backup=(await call('/api/export')).body;await call('/api/import',backup);
    await app.close();app=await createApp({dataDir:dir,backgroundInterval:0});await listen();
    let s=(await call('/api/state')).body;assert.deepEqual(s.life.board.graphs,[graph,'focus']);assert.equal(s.life.board.showTotals,true);assert.equal(s.life.board.graphAccent,'#3b82f6');
    const b=(await call('/api/blocks',{name:'Linked block',date:dateKey(),taskIds:[t.id]})).body.result;
    await call('/api/tasks/'+t.id+'/complete',{});const coins=(await call('/api/state')).body.coins;
    await call('/api/timer/start',{mode:'focus',minutes:2,taskId:t.id});
    assert.equal((await call('/api/tasks/'+t.id+'/purge',{confirmation:'DELETE'},'DELETE')).status,400);
    await call('/api/tasks/'+t.id,{},'DELETE');
    assert.equal((await call('/api/tasks/'+t.id+'/purge',{confirmation:'no'},'DELETE')).status,400);
    assert.equal((await call('/api/tasks/'+t.id+'/purge',{confirmation:'DELETE',expectedVersion:0},'DELETE')).status,409);
    assert.equal((await call('/api/tasks/'+t.id+'/purge',{confirmation:'DELETE'},'DELETE')).status,200);
    s=(await call('/api/state')).body;assert.equal(s.tasks.some(task=>task.id===t.id),false);assert.equal(s.timer.taskId,null);assert.equal(s.coins,coins);assert.deepEqual(s.blocks.find(block=>block.id===b.id).taskIds,[]);assert.deepEqual(s.life.board.graphs,['focus']);
    assert.equal((await call('/api/tasks/'+t.id+'/restore',{})).status,404);
    await app.close();app=await createApp({dataDir:dir,backgroundInterval:0});await listen();assert.equal((await call('/api/state')).body.tasks.length,0);
  }finally{await app.close();}
});
