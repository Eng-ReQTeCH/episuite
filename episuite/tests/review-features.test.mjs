import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server.mjs';
import { initialState, taskInput, isDue, done, dateKey, addDays, taskProgress, toggleCompletion, chooseNext, habitOpportunities, startTimer, habitWeekStart } from '../public/domain.js';
import { bookInput, logReading, editReadingLog } from '../public/books-domain.js';
import { applyOperation } from '../public/operations.js';
import { correctTaskHistory } from '../public/activity-history.js';
import { advanceExpiredTimer } from '../timer-service.mjs';

test('offline controls reconcile automatic expiry without discarding newer independent work', () => {
  for (const autoBreak of [false,true]) {
    const state=initialState();state.workspaceId='expiry';state.settings.autoBreak=autoBreak;
    const now=Date.now(),started=now-180000;startTimer(state,{minutes:2},started);
    const timer=structuredClone(state.timer),pauseAt=started+60000;
    const pause={id:'pause-before-expiry',kind:'timer-control',workspace:state.workspaceId,date:dateKey(pauseAt,state.settings.timezone),data:{action:'pause',at:pauseAt,timerId:timer.id,expectedTimer:timer}};
    advanceExpiredTimer(state,now);assert.equal(state.sessions[0].minutes,2);
    applyOperation(state,pause,undefined,now);
    assert.equal(state.timer.id,timer.id);assert.equal(state.timer.status,'paused');assert.equal(state.timer.remaining,60);assert.equal(state.sessions.length,0);assert.equal(state.coins,0);
    const finish={...pause,id:'finish-paused',data:{action:'finish',at:now,early:true,timerId:timer.id,expectedTimer:structuredClone(state.timer)}};
    finish.date=dateKey(now,state.settings.timezone);applyOperation(state,finish,undefined,now);
    assert.equal(state.sessions[0].minutes,1);assert.equal(state.coins,1);
  }
  const state=initialState();state.workspaceId='independent';const now=Date.now();startTimer(state,{minutes:2},now-180000);
  const timer=structuredClone(state.timer);advanceExpiredTimer(state,now);startTimer(state,{minutes:10},now);
  const command={id:'old-pause',kind:'timer-control',workspace:state.workspaceId,date:dateKey(now-120000,state.settings.timezone),data:{action:'pause',at:now-120000,timerId:timer.id,expectedTimer:timer}};
  assert.throws(()=>applyOperation(state,command,undefined,now),/changed on another device/);
  assert.notEqual(state.timer.id,timer.id);assert.equal(state.sessions.length,1);
});

test('correcting a session can establish a finish and reopening it revokes only that finish', () => {
  const {state, book} = reader(), today = dateKey();
  logReading(state, book, {eventId:'finish-edit',page:20,expectedVersion:0},today);
  editReadingLog(state, book, 'finish-edit', {date:today,from:0,page:100,finished:true,expectedVersion:book.editVersion},today);
  assert.equal(book.status,'finished'); assert.equal(book.finishedDate,today);
  editReadingLog(state, book, 'finish-edit', {date:today,from:0,page:30,finished:false,expectedVersion:book.editVersion},today);
  assert.equal(book.status,'reading');
  const historical = bookInput({title:'Historical',status:'finished',finishedDate:'2024-01-01',totalPages:100});
  state.reading.books.push(historical);
  logReading(state,historical,{eventId:'reread',from:0,page:10,expectedVersion:0},today);
  editReadingLog(state,historical,'reread',{expectedVersion:historical.editVersion},today,undefined,true);
  assert.equal(historical.status,'finished'); assert.equal(historical.finishedDate,'2024-01-01');
});

test('quota reports begin in their creation week and edits preserve prior weekly targets', () => {
  const today=dateKey(), task=taskInput({title:'Walk',repeat:'quota',weeklyTarget:3});
  const entries=habitOpportunities(task,addDays(today,-27),today,'Africa/Cairo');
  assert.equal(entries.length,1); assert.equal(entries[0].date,habitWeekStart(today)); assert.equal(entries[0].missed,0);
  task.created=Date.parse(addDays(today,-21)+'T12:00:00Z'); task.quotaHistory=[{from:habitWeekStart(addDays(today,-21)),target:3}];
  const updated=taskInput({weeklyTarget:5},task);
  assert.equal(taskProgress(updated,addDays(today,-7)).target,3);
  assert.equal(taskProgress(updated,today).target,5);
});

test('queued controls preserve the timer identity and reject concurrent timer changes', () => {
  const state=initialState();state.workspaceId='timer-test';const now=Date.now();
  startTimer(state,{minutes:25},now-120000);
  const command=(action,at)=>({id:action,workspace:state.workspaceId,kind:'timer-control',date:dateKey(at,state.settings.timezone),data:{action,at,timerId:state.timer.id,expectedTimer:structuredClone(state.timer),early:true}});
  const pause=command('pause',now); applyOperation(state,pause,undefined,now);
  assert.equal(state.timer.status,'paused');assert.equal(state.timer.remaining,1380);
  assert.throws(()=>applyOperation(state,pause,undefined,now),/changed on another device/);
  applyOperation(state,command('resume',now+1000),undefined,now+1000);
  const finish=command('finish',now+61000);applyOperation(state,finish,undefined,now+61000);
  assert.equal(state.timer,null);assert.equal(state.sessions.length,1);assert.equal(state.sessions[0].minutes,3);
  applyOperation(state,finish,undefined,now+61000);assert.equal(state.sessions.length,1);
  startTimer(state,{minutes:2},now+61000);
  assert.throws(()=>applyOperation(state,finish,undefined,now+61000),/changed on another device/);
});

test('manual activity corrections move exact entries without rerolling and refund removals', () => {
  const state=initialState(), task=taskInput({title:'Exercise',repeat:'daily'});state.tasks.push(task);
  const today=dateKey(), yesterday=addDays(today,-1);
  correctTaskHistory(state,task,{action:'add',date:yesterday});
  const entry=task.history[yesterday][0], coins=state.coins;
  correctTaskHistory(state,task,{action:'move',from:yesterday,date:today,completionId:entry.id});
  assert.equal(task.history[yesterday].length,0);assert.equal(task.history[today][0].id,entry.id);assert.equal(state.coins,coins);
  correctTaskHistory(state,task,{action:'remove',from:today,date:today,completionId:entry.id});
  assert.equal(state.coins,0);
  correctTaskHistory(state,task,{action:'add',date:yesterday});assert.equal(state.coins,coins);
  state.reading.credits.push({completionIds:[task.history[yesterday][0].id]});
  assert.throws(()=>correctTaskHistory(state,task,{action:'remove',from:yesterday,date:today,completionId:task.history[yesterday][0].id}),/reading session/);
});

test('offline focus sessions credit minutes once and validate their activity date', () => {
  const state = initialState(), now = Date.now();
  const operation = { id: 'offline-focus', workspace: state.workspaceId, kind: 'focus-session', entityId: 'session-1', date: dateKey(now, state.settings.timezone), data: { mode: 'focus', minutes: 10, full: false, at: now } };
  const coins = state.coins;
  applyOperation(state, operation, undefined, now);
  applyOperation(state, operation, undefined, now);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.coins, coins + 4);
  assert.throws(() => applyOperation(state, { ...operation, date: addDays(operation.date, -1) }, undefined, now), /Invalid offline focus session/);
});

async function workspace(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'episuite-review-features-'));
  const app = await createApp({ dataDir: directory, backgroundInterval: 0 });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const call = async (endpoint, data, method = 'POST') => {
    const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, body: await response.json() };
  };
  try { await run({ app, directory, call }); }
  finally {
    await app.close();
    assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep + 'episuite-review-features-'));
    await rm(directory, { recursive: true, force: true });
  }
}

function reader(policy = 'daily') {
  const state = initialState(), task = taskInput({ title: 'Reading', repeat: 'daily' });
  state.tasks.push(task);
  const book = bookInput({ title: 'A book', totalPages: 100 });
  state.reading.books.push(book);
  state.reading.policy = policy;
  return { state, task, book };
}

test('weekday habits keep their calendar days and weekly quotas reset on Monday', () => {
  const task = taskInput({ title: 'Exercise', repeat: 'weekdays', weekdays: [1, 3, 5] });
  assert.equal(isDue(task, '2026-11-23'), true);
  assert.equal(isDue(task, '2026-11-24'), false);
  assert.equal(isDue(task, '2026-11-25'), true);
  const state = initialState(), quota = taskInput({ title: 'Three walks', repeat: 'quota', weeklyTarget: 3 });
  state.tasks.push(quota);
  for (const day of ['2026-11-23', '2026-11-24', '2026-11-27']) toggleCompletion(state, quota.id, day);
  assert.deepEqual(taskProgress(quota, '2026-11-28'), { count: 3, target: 3, rest: 0, period: 'this week' });
  assert.equal(done(quota, '2026-11-28'), true);
  assert.equal(isDue(quota, '2026-11-30'), true);
  toggleCompletion(state, quota.id, '2026-11-28');
  assert.equal(taskProgress(quota, '2026-11-28').count, 2);
});

test('reading session correction changes page totals and moves only owned task check-offs', () => {
  const { state, task, book } = reader(), today = dateKey(), yesterday = addDays(today, -1);
  logReading(state, book, { page: 80, from: 0, date: today, eventId: 'session', expectedVersion: 0 }, today);
  assert.equal(book.currentPage, 80);
  editReadingLog(state, book, 'session', { from: 0, page: 30, date: yesterday, expectedVersion: book.editVersion }, today);
  assert.equal(book.currentPage, 30);
  assert.equal(task.history[today].length, 0);
  assert.equal(task.history[yesterday].length, 1);
  assert.equal(book.logs[0].to - book.logs[0].from, 30);
  editReadingLog(state, book, 'session', { expectedVersion: book.editVersion }, today, undefined, true);
  assert.equal(book.currentPage, 0);
  assert.equal(task.history[yesterday].length, 0);
  assert.equal(state.coins, 0);
});

test('deleting a reading session preserves manually recorded task work and reopens an auto-finished book', () => {
  const { state, task, book } = reader(), today = dateKey();
  toggleCompletion(state, task.id, today);
  const manualId = task.history[today][0].id;
  logReading(state, book, { page: 100, from: 0, eventId: 'finish', expectedVersion: 0 }, today);
  assert.equal(book.status, 'finished');
  editReadingLog(state, book, 'finish', { expectedVersion: book.editVersion }, today, undefined, true);
  assert.equal(book.status, 'reading');
  assert.equal(task.history[today][0].id, manualId);
});

test('reading policies support per-session targets and an explicit choice after manual undo', () => {
  const { state, task, book } = reader('session'), today = dateKey();
  Object.assign(task, taskInput({ repeat: 'interval_0.5', minimumGapMinutes: 0 }, task));
  for (const [index, page] of [10, 20].entries()) logReading(state, book, { page, eventId: 'session-' + index, expectedVersion: book.editVersion }, today);
  assert.equal(done(task, today), true);
  toggleCompletion(state, task.id, today);
  state.reading.restoreAfterUndo = true;
  logReading(state, book, { page: 30, eventId: 'after-undo', expectedVersion: book.editVersion }, today);
  assert.equal(done(task, today), true);
  const other = reader('target');
  Object.assign(other.task, taskInput({ repeat: 'interval_0.5' }, other.task));
  logReading(other.state, other.book, { page: 10, eventId: 'target', expectedVersion: 0 }, today);
  assert.equal(done(other.task, today), true);
});

test('offline operation retries remain idempotent and stale reading logs can be reviewed and rebased', async () => workspace(async ({ app, call }) => {
  const task = (await call('/api/tasks', { title: 'Reading', repeat: 'daily' })).body.result;
  const book = (await call('/api/books', { title: 'Queued book', totalPages: 100 })).body.result;
  const state = app.getState(), today = dateKey();
  const operation = { id: 'offline-reading', workspace: state.workspaceId, entityId: book.id, date: today, kind: 'reading-log', data: { page: 20, from: 0, eventId: 'offline-session', expectedVersion: book.editVersion } };
  assert.equal((await call('/api/operations', operation)).status, 200);
  assert.equal((await call('/api/operations', operation)).body.result.duplicate, true);
  assert.equal(app.getState().reading.books[0].logs.length, 1);
  assert.equal(app.getState().tasks.find(item => item.id === task.id).history[today].length, 1);
  const second = { ...operation, id: 'second-operation', data: { ...operation.data, page: 30, eventId: 'second-session' } };
  assert.equal((await call('/api/operations', second)).status, 409);
  second.data.expectedVersion = app.getState().reading.books[0].editVersion;
  assert.equal((await call('/api/operations', second)).status, 200);
  const snapshot = (await call('/api/export', undefined, 'GET')).body;
  await call('/api/import', snapshot);
  assert.equal((await call('/api/operations', operation)).body.result.duplicate, true);
  assert.equal(app.getState().reading.books[0].currentPage, 30);
}));

test('projects retain outcomes, waiting tasks stay out of suggestions, and removal keeps tasks', async () => workspace(async ({ app, call }) => {
  const project = (await call('/api/projects', { title: 'Finish a course', outcome: 'Ship the final exercise' })).body.result;
  const task = (await call('/api/tasks', { title: 'First lesson', lane: 'today', projectId: project.id, workStatus: 'waiting', waitingFor: 'A workbook' })).body.result;
  assert.equal(chooseNext(app.getState(), dateKey()), null);
  const ready = await call('/api/tasks/' + task.id, { workStatus: 'ready', expectedVersion: task.editVersion }, 'PATCH');
  assert.equal(ready.status, 200);
  assert.equal(chooseNext(app.getState(), dateKey()).id, task.id);
  assert.equal((await call('/api/projects/' + project.id, { nextTaskId: task.id, expectedVersion: project.editVersion }, 'PATCH')).status, 200);
  assert.equal((await call('/api/projects/' + project.id, { outcome: 'Stale', expectedVersion: project.editVersion }, 'PATCH')).status, 409);
  await call('/api/projects/' + project.id, { expectedVersion: app.getState().projects[0].editVersion }, 'DELETE');
  assert.equal(app.getState().tasks[0].projectId, '');
  assert.equal(app.getState().tasks[0].title, 'First lesson');
}));

test('scheduled snapshots rotate, verify integrity, and restore through the ordinary import path', async () => workspace(async ({ app, call, directory }) => {
  await call('/api/tasks', { title: 'Keep this task' });
  await app.backgroundTick();
  let status = (await call('/api/backups', undefined, 'GET')).body;
  assert.equal(status.files.length, 1);
  assert.equal((await call('/api/backups/' + status.files[0].name + '/verify', {})).body.ok, true);
  const saved = (await call('/api/backups/' + status.files[0].name, undefined, 'GET')).body;
  await call('/api/settings', { backupKeep: 2 });
  await call('/api/backups/create', {});
  await call('/api/backups/create', {});
  status = (await call('/api/backups', undefined, 'GET')).body;
  assert.equal(status.files.length, 2);
  await call('/api/tasks', { title: 'Added later' });
  await call('/api/import', saved);
  assert.equal(app.getState().tasks.length, 1);
  const file = path.join(directory, 'backups', status.files[0].name);
  await writeFile(file, (await readFile(file, 'utf8')) + ' ');
  assert.equal((await call('/api/backups/' + status.files[0].name + '/verify', {})).status, 400);
}));

test('HTTP history corrections reject stale edits and timer command retries do not duplicate sessions', async () => workspace(async ({ app, call }) => {
  const thought='A long captured thought with details. '.repeat(30);
  await call('/api/notes',{id:'long-thought',text:thought});await call('/api/notes/convert',{id:'long-thought'});
  assert.equal(app.getState().tasks[0].description,thought.trim());
  assert.ok(app.getState().tasks[0].title.length<=120);
  const task=(await call('/api/tasks',{title:'Correct dated work',repeat:'daily'})).body.result;
  const today=dateKey(), yesterday=addDays(today,-1);
  assert.equal((await call('/api/tasks/'+task.id+'/history',{action:'add',date:yesterday,expectedVersion:task.editVersion||0})).status,200);
  assert.equal((await call('/api/tasks/'+task.id+'/history',{action:'add',date:today,expectedVersion:task.editVersion||0})).status,409);
  let current=app.getState().tasks.find(item=>item.id===task.id),entry=current.history[yesterday][0];
  assert.equal((await call('/api/tasks/'+task.id+'/history',{action:'move',date:today,from:yesterday,completionId:entry.id,expectedVersion:current.editVersion})).status,200);
  current=app.getState().tasks.find(item=>item.id===task.id);assert.equal(current.history[today][0].id,entry.id);
  await call('/api/timer/start',{minutes:25});
  const make=action=>({id:'http-'+action,kind:'timer-control',workspace:app.getState().workspaceId,date:today,entityId:app.getState().timer.id,data:{action,timerId:app.getState().timer.id,expectedTimer:structuredClone(app.getState().timer),at:Date.now(),early:true}});
  const pause=make('pause');assert.equal((await call('/api/operations',pause)).status,200);assert.equal((await call('/api/operations',pause)).body.result.duplicate,true);
  const finish=make('finish');assert.equal((await call('/api/operations',finish)).status,200);assert.equal((await call('/api/operations',finish)).body.result.duplicate,true);
  assert.equal(app.getState().sessions.length,1);assert.equal(app.getState().timer,null);
}));
