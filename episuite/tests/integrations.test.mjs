import {calendarMock} from './caldav-helper.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { initialState, taskInput, toggleCompletion, legacyImport, zonedTimestamp } from '../public/domain.js';
test('CalDAV PUT sends valid event bodies and DELETE removes only known events', async () => {
  const observed = [];
  const {server:mock}=calendarMock(observed);
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const app = await createApp({ dataDir: await mkdtemp(path.join(tmpdir(), 'episuite-caldav-')) });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (endpoint, body) => { const r = await fetch(base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); assert.equal(r.status, 200, await r.clone().text()); return r.json(); };
  try {
    await post('/api/calendar/config', { url: `http://127.0.0.1:${mock.address().port}/calendar/`, username: 'test', password: 'test-only' });
    await post('/api/blocks', { name: 'Mock meeting', date: '2026-10-04', start: '09:00', duration: 30 });
    const r = await post('/api/calendar/sync', { date: '2026-10-04' }); assert.equal(r.count, 1); assert.equal(observed[0].method, 'PUT'); assert.match(observed[0].body, /BEGIN:VEVENT/); assert.match(observed[0].body, /DTSTART;TZID=Africa\/Cairo:20261004T090000/); assert.ok(observed[0].auth.startsWith('Basic '));
    const d = await post('/api/calendar/delete', { date: '2026-10-04' }); assert.equal(d.count, 1); assert.equal(observed[1].method, 'DELETE'); assert.equal(observed[0].url, observed[1].url);
    const empty = await post('/api/calendar/delete', { date: '2026-10-04' }); assert.equal(empty.count, 0);
  } finally { await app.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); }
});
test('coin undo cannot be used to farm repeat reward purchases', () => {
  const s = initialState(), t = taskInput({ title: 'Task', difficulty: 3 }); s.tasks.push(t);
  toggleCompletion(s, t.id, '2026-10-04'); s.coins -= 20; // Reward spent.
  toggleCompletion(s, t.id, '2026-10-04'); assert.equal(s.coins, -20);
  toggleCompletion(s, t.id, '2026-10-04'); assert.equal(s.coins, 0);
});
test('native import rejects malformed sessions and rewards, legacy reward time survives', () => {
  const broken = initialState(); broken.sessions.push({ id: 'a', date: 'oops', minutes: -5 }); assert.throws(() => legacyImport(broken, initialState()));
  const reward = initialState(); reward.rewards.push({ id: 'bad', name: '' }); assert.throws(() => legacyImport(reward, initialState()));
  const state = legacyImport({ stats: { allTime: { redeemableMinutes: 30 } } }, initialState()); assert.equal(state.purchases[0].minutes, 30);
});
test('watch timestamps correctly represent the user timezone and overnight blocks', () => {
  assert.equal(new Date(zonedTimestamp('2026-10-04', 600, 'Africa/Cairo')).toISOString(), '2026-10-04T07:00:00.000Z');
  assert.equal(new Date(zonedTimestamp('2026-10-04', 1455, 'Africa/Cairo')).toISOString(), '2026-10-04T21:15:00.000Z');
});
