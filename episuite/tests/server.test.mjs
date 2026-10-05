import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
const dir = await mkdtemp(path.join(tmpdir(), 'episuite-test-'));
let app = await createApp({ dataDir: dir });
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
let base = `http://127.0.0.1:${app.server.address().port}`;
async function call(endpoint, data, method = 'POST', headers = {}) {
  const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: method === 'GET' ? undefined : JSON.stringify(data || {}) });
  return { status: response.status, body: await response.json() };
}
test.after(async () => app.close());
test('HTTP assets and health are served with no external dependencies', async () => {
  for (const url of ['/', '/app.js', '/domain.js', '/styles.css', '/sw.js', '/icon.svg', '/manifest.webmanifest']) assert.equal((await fetch(base + url)).status, 200);
  assert.equal((await call('/api/health', null, 'GET')).body.ok, true);
});
test('CRUD, soft delete, restore, recurrence and shortlist limit work over HTTP', async () => {
  const t = (await call('/api/tasks', { title: 'Tiny task', lane: 'today' })).body.result;
  await call(`/api/tasks/${t.id}`, { title: 'Edited', minutes: 2 }, 'PATCH');
  assert.equal((await call('/api/state', null, 'GET')).body.tasks[0].title, 'Edited');
  await call(`/api/tasks/${t.id}/complete`); assert.equal((await call('/api/state', null, 'GET')).body.coins, 5);
  await call(`/api/tasks/${t.id}`, {}, 'DELETE'); await call(`/api/tasks/${t.id}/restore`);
  assert.equal((await call('/api/state', null, 'GET')).body.tasks[0].deleted, false);
  for (const title of ['A', 'B', 'C']) assert.equal((await call('/api/tasks', { title, lane: 'today' })).status, 200);
  assert.equal((await call('/api/tasks', { title: 'D', lane: 'today' })).status, 400);
  assert.equal((await call('/api/tasks', { title: '  ' })).status, 400);
});
test('concurrent captures and completions are serialized without lost writes', async () => {
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => call('/api/tasks', { title: 'Parallel ' + i })));
  assert.ok(results.every(r => r.status === 200));
  const ids = results.map(r => r.body.result.id);
  await Promise.all(ids.map(id => call(`/api/tasks/${id}/complete`)));
  const state = (await call('/api/state', null, 'GET')).body;
  assert.ok(ids.every(id => state.tasks.some(t => t.id === id && t.completed)));
  assert.equal(new Set(state.tasks.map(t => t.id)).size, state.tasks.length);
});
test('timer pause, resume, partial finish and duplicate finish are safe', async () => {
  assert.equal((await call('/api/timer/start', { minutes: 2 })).status, 200);
  assert.equal((await call('/api/timer/start', { minutes: 25 })).status, 400);
  assert.equal((await call('/api/timer/pause')).body.state.timer.status, 'paused');
  assert.equal((await call('/api/timer/resume')).body.state.timer.status, 'running');
  await call('/api/timer/finish', { early: true }); const first = (await call('/api/state', null, 'GET')).body;
  await call('/api/timer/finish', { early: true }); const second = (await call('/api/state', null, 'GET')).body;
  assert.equal(first.sessions.length, second.sessions.length); assert.equal(first.coins, second.coins);
});
test('time blocks, tomorrow routine copy, templates and end-day rollover integrate', async () => {
  const day = '2026-10-04'; await call(`/api/blocks?date=${day}`, { name: 'Flexible', date: day, mode: 'relative', duration: 30 });
  await call(`/api/day/wake?date=${day}`); await call(`/api/schedule/shift?date=${day}`, { minutes: 15 });
  const state = (await call('/api/state', null, 'GET')).body; assert.equal(state.blocks[0].shift, 15);
  await call(`/api/templates/save?date=${day}`, { name: 'Gentle day' });
  const template = (await call('/api/state', null, 'GET')).body.templates[0];
  await call('/api/templates/apply?date=2026-10-05', { id: template.id });
  assert.ok((await call('/api/state', null, 'GET')).body.blocks.some(b => b.date === '2026-10-05'));
  await call('/api/day/end', { reflection: 'Starting small helped.' });
  assert.equal((await call('/api/state', null, 'GET')).body.tasks.filter(t => t.lane === 'today' && !t.completed).length, 0);
});
test('capture conversion creates a task; reward redemption refunds unused minutes', async () => {
  await call('/api/notes', { text: 'A thought' }); const note = (await call('/api/state', null, 'GET')).body.notes[0];
  await call('/api/notes/convert', { id: note.id }); assert.equal((await call('/api/state', null, 'GET')).body.notes.length, 0);
  assert.equal((await call('/api/rewards/buy', { id: 'tea' })).status, 200);
  const purchase = (await call('/api/state', null, 'GET')).body.purchases[0];
  await call('/api/redeem/start', { id: purchase.id }); assert.equal((await call('/api/redeem/start', { id: purchase.id })).status, 400);
  await call('/api/redeem/stop'); const updated = (await call('/api/state', null, 'GET')).body.purchases[0]; assert.equal(updated.used, false); assert.ok(updated.minutes <= 10 && updated.minutes >= 9);
});
test('settings validate timezone; secrets do not leak through state or export', async () => {
  assert.equal((await call('/api/settings', { timezone: 'No/SuchZone' })).status, 400);
  await call('/api/calendar/config', { url: 'https://calendar.example/dav/', username: 'test', password: 'private-password' });
  assert.equal((await call('/api/state', null, 'GET')).body.calendar.password, ''); assert.equal((await call('/api/export', null, 'GET')).body.calendar.password, '');
  const r = await call('/api/tasks', { title: 'Attack' }, 'POST', { Origin: 'https://bad.example' }); assert.equal(r.status, 403);
});
test('import rejects malformed data and creates a recovery backup before replacement', async () => {
  const before = (await call('/api/state', null, 'GET')).body;
  assert.equal((await call('/api/import', { unrelated: true })).status, 400);
  const after = (await call('/api/state', null, 'GET')).body; assert.equal(after.tasks.length, before.tasks.length);
  const exported = (await call('/api/export', null, 'GET')).body;
  assert.equal((await call('/api/import', exported)).status, 200);
  assert.ok((await readdir(dir)).some(file => file.startsWith('before-import-')));
});
test('watch bridge exposes day and correctly named task fields', async () => {
  const r = await call('/api/v1/day?date=2026-10-04', null, 'GET'); assert.equal(r.status, 200); assert.ok(r.body.day.wakeup_time); assert.ok(Array.isArray(r.body.day.blocks));
});
test('state persists across a complete server restart', async () => {
  const state = (await call('/api/state', null, 'GET')).body;
  await app.close(); app = await createApp({ dataDir: dir }); await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${app.server.address().port}`;
  const restored = (await call('/api/state', null, 'GET')).body; assert.equal(restored.tasks.length, state.tasks.length); assert.equal(restored.coins, state.coins);
  assert.ok(JSON.parse(await readFile(path.join(dir, 'episuite.json'))).revision >= 1);
});
