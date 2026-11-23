import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server.mjs';
import { addDays, countToday, dateKey, habitOpportunities, initialState, isDue, taskInput } from '../public/domain.js';
import { weekStart } from '../public/productivity.js';
import { readJson } from '../workspace-storage.mjs';

async function workspace(run, fixture, options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'episuite-productivity-'));
  let app;
  try {
    if (fixture) await writeFile(path.join(dir, 'episuite.json'), JSON.stringify(fixture));
    app = await createApp({ dataDir: dir, backgroundInterval: 0, ...options });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + app.server.address().port;
    const call = async (endpoint, body, method = 'POST') => {
      const response = await fetch(base + endpoint, {
        method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
      });
      return { status: response.status, body: await response.json() };
    };
    await run({ app, call, dir, base });
  } finally {
    await app?.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'episuite-productivity-'));
    await rm(dir, { recursive: true, force: true });
  }
}

test('large Unicode backups round-trip onto a clean server, including plans and habits', async () => {
  const fixture = initialState();
  fixture.notes = Array.from({ length: 1900 }, (_, index) => ({ id: 'note-' + index, text: 'ح'.repeat(2800), created: Date.now() }));
  const task = taskInput({ title: 'Read', repeat: 'weekly', nextAction: 'Open page 4', habitCue: 'After tea', habitMinimum: 'Read a paragraph', habitObstacle: 'If tired, read one line' });
  task.habitRest = { '2026-11-18': 1 };
  fixture.tasks.push(task);
  fixture.dayPlans = { '2026-11-18': { taskId: task.id, outcome: 'Summarize the chapter' } };
  fixture.weeklyReviews = { '2026-11-16': { outcome: 'Read', friction: 'Noise', adjustment: 'Try silence' } };
  let exported;
  await workspace(async ({ call }) => {
    const response = await call('/api/export', undefined, 'GET');
    assert.equal(response.status, 200);
    exported = JSON.stringify(response.body);
    assert.ok(Buffer.byteLength(exported) > 5_000_000);
  }, fixture);
  await workspace(async ({ call, dir }) => {
    const imported = await call('/api/import', exported);
    assert.equal(imported.status, 200);
    const state = (await call('/api/state', undefined, 'GET')).body;
    assert.deepEqual(state.notes, fixture.notes);
    assert.deepEqual(state.dayPlans, fixture.dayPlans);
    assert.equal(state.tasks[0].habitPlan.cue, 'After tea');
    assert.equal(state.tasks[0].nextAction, 'Open page 4');
    assert.equal(state.tasks[0].habitRest['2026-11-18'], 1);
    assert.deepEqual(state.weeklyReviews, fixture.weeklyReviews);
    assert.equal((await call('/api/import', exported, 'PATCH')).status, 405);
    assert.equal(JSON.parse(await readFile(path.join(dir, 'episuite.json'), 'utf8')).notes.length, 1900);
  });
});

test('body reader counts bytes, decodes split UTF-8 once, and rejects malformed or oversized bodies', async () => {
  const bytes = Buffer.from('{"text":"مرحبا"}');
  const request = { async *iterator() { for (const byte of bytes) yield Buffer.from([byte]); }, resume() {} };
  assert.deepEqual(await readJson(request), { text: 'مرحبا' });
  await assert.rejects(readJson(request, 8), { status: 413 });
  await assert.rejects(readJson({ async *iterator() { yield Buffer.from([0xff]); } }), { status: 400 });
});

test('priority rollover, weekly review, and optional watch authentication persist safely', async () => {
  const fixture = initialState();
  const task = taskInput({ title: 'Important draft' });
  fixture.tasks.push(task);
  await workspace(async ({ app, call, base }) => {
    const date = dateKey(), tomorrow = addDays(date, 1);
    assert.equal((await call('/api/day/priority', { taskId: 'missing' })).status, 400);
    assert.equal((await call('/api/day/priority', { taskId: task.id, outcome: 'Draft one paragraph' })).status, 200);
    assert.equal((await call('/api/day/priority', { taskId: task.id, expectedVersion: 0 })).status, 409);
    assert.equal((await call('/api/settings', { quietFocus: false }, 'DELETE')).status, 405);
    assert.equal((await call('/api/day/end', { rollover: 'carry' })).status, 200);
    assert.equal(app.getState().dayPlans[tomorrow].taskId, task.id);
    assert.equal((await call('/api/day/end', { rollover: 'schedule', start: '09:15' })).status, 200);
    assert.equal(app.getState().blocks.at(-1).date, tomorrow);
    assert.equal(app.getState().blocks.at(-1).start, '09:15');
    await call('/api/day/end', { rollover: 'schedule', start: '09:15' });
    assert.equal(app.getState().blocks.length, 1);
    assert.equal((await call('/api/weekly-review', { outcome: 'Wrote', friction: 'Audio', adjustment: 'Speech-free' })).status, 200);
    assert.equal(app.getState().weeklyReviews[weekStart(date)].adjustment, 'Speech-free');
    assert.equal((await call('/api/weekly-review', { expectedVersion: 0, adjustment: 'Stale edit' })).status, 409);
    assert.equal((await call('/api/v1/day', undefined, 'GET')).status, 401);
    const watch = await fetch(base + '/api/v1/day', { headers: { Authorization: 'Bearer test-watch-token' } });
    assert.equal(watch.status, 200);
    assert.equal((await call('/api/notes', { text: 'Wrong workspace', workspace: 'different' })).status, 409);
  }, fixture, { watchToken: 'test-watch-token' });
});

test('habit minimum, planned rest, undo, and opportunity summaries respect daily targets', async () => {
  const fixture = initialState(), date = dateKey();
  const habit = taskInput({ title: 'Stretch', repeat: 'interval_0.5', minimumGapMinutes: 0, habitMinimum: 'Stand up' });
  fixture.tasks.push(habit);
  await workspace(async ({ app, call }) => {
    assert.equal((await call('/api/tasks/' + habit.id + '/habit', { action: 'rest' })).status, 200);
    assert.equal((await call('/api/tasks/' + habit.id + '/habit', { action: 'minimum' })).status, 200);
    let task = app.getState().tasks[0];
    assert.equal(countToday(task, date), 1);
    assert.equal(isDue(task, date), false);
    assert.equal((await call('/api/tasks/' + habit.id + '/habit', { action: 'minimum' })).status, 400);
    assert.equal((await call('/api/tasks/' + habit.id + '/habit', { action: 'undo-rest' })).status, 200);
    task = app.getState().tasks[0];
    assert.equal(isDue(task, date), true);
    const summary = habitOpportunities(task, date, date, fixture.settings.timezone);
    assert.equal(summary[0].completed, 1);
  }, fixture);
  const weekly = taskInput({ title: 'Weekly', repeat: 'weekly' }, { created: Date.parse(date + 'T00:00:00Z') });
  assert.equal(habitOpportunities(weekly, date, addDays(date, 13), 'UTC').length, 2);
  weekly.habitRest[date] = 1;
  assert.equal(isDue(weekly, addDays(date, 1)), false);
  assert.equal(isDue(weekly, addDays(date, 7)), true);
});

test('fresh workspaces use predictable rewards, quiet focus and optional streaks', async () => {
  await workspace(async ({ app }) => {
    const state = app.getState();
    assert.equal(state.settings.quietFocus, true);
    assert.equal(state.settings.showStreaks, false);
    assert.equal(state.life.board.showFlame, false);
    assert.equal(state.rewardEvents.config.enabled, false);
    assert.equal(state.notifications.config.boosts, false);
  });
  const old = initialState();
  old.rewardEvents = { config: { enabled: true } };
  await workspace(async ({ app }) => assert.equal(app.getState().rewardEvents.config.enabled, true), old);
});

test('changing credentials mid-sync cannot revert the new calendar connection', async () => {
  let release, started;
  const received = new Promise(resolve => { started = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const remote = http.createServer(async (req, res) => {
    for await (const chunk of req) { void chunk; }
    started();
    await blocked;
    res.writeHead(207, { 'Content-Type': 'application/xml' });
    res.end('<d:multistatus xmlns:d="DAV:"/>');
  });
  await new Promise(resolve => remote.listen(0, '127.0.0.1', resolve));
  try {
    await workspace(async ({ app, call }) => {
      const url = 'http://127.0.0.1:' + remote.address().port + '/calendar/';
      await call('/api/calendar/config', { url, username: 'owner', password: 'old-test-password' });
      const pending = call('/api/calendar/sync', {});
      await received;
      await call('/api/calendar/config', { url, username: 'owner', password: 'new-test-password' });
      release();
      const result = await pending;
      assert.equal(result.status, 409);
      assert.equal(app.getState().calendar.password, 'new-test-password');
      assert.match(result.body.error, /remote/i);
    });
  } finally {
    release();
    await new Promise(resolve => remote.close(resolve));
  }
});
