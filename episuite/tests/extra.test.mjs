import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { initialState, startTimer, finishTimer } from '../public/domain.js';
test('a completed timer opened much later credits its actual finish date', () => {
  const s = initialState(); startTimer(s, { minutes: 2 }, Date.parse('2026-10-04T07:00:00Z'));
  const session = finishTimer(s, Date.parse('2026-10-05T07:00:00Z'));
  assert.equal(session.date, '2026-10-04'); assert.equal(session.minutes, 2);
});
test('offline capture sync is idempotent and block feedback accepts updates', async () => {
  const app = await createApp({ dataDir: await mkdtemp(path.join(tmpdir(), 'episuite-offline-')) }); await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (p, data) => { const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); assert.equal(r.status, 200, await r.clone().text()); return r.json(); };
  try {
    await post('/api/notes', { id: 'offline-note', text: 'Captured offline' }); const r = await post('/api/notes', { id: 'offline-note', text: 'Captured offline' }); assert.equal(r.state.notes.length, 1);
    const block = await post('/api/blocks', { name: 'Focus', date: '2026-10-04' }); const feedback = await post('/api/blocks/feedback?date=2026-10-04', { id: block.result.id, completed: true }); assert.equal(feedback.state.blockFeedback['2026-10-04:' + block.result.id], true);
  } finally { await app.close(); }
});
test('optional AI response is reviewed as steps and malformed responses fail clearly', async () => {
  let valid = true;
  const mock = http.createServer(async (req, res) => { let raw = ''; for await (const c of req) raw += c; assert.match(JSON.parse(raw).prompt, /Write a paragraph/); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ response: JSON.stringify({ steps: valid ? ['Open draft', 'Write a sentence'] : [null, 4] }) })); });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const app = await createApp({ dataDir: await mkdtemp(path.join(tmpdir(), 'episuite-ai-')), aiUrl: `http://127.0.0.1:${mock.address().port}/api/generate` }); await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const request = () => fetch(`http://127.0.0.1:${app.server.address().port}/api/ai/breakdown`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Write a paragraph' }) });
  try { const r = await request(); assert.equal(r.status, 200); assert.equal((await r.json()).steps.length, 2); assert.equal(app.getState().tasks.length, 0); valid = false; assert.equal((await request()).status, 503); }
  finally { await app.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); }
});
