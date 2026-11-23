import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createApp } from '../server.mjs';
import { initialState, taskInput, addDays, dateKey, metrics } from '../public/domain.js';

for (const [name, taskCount, dayCount] of [['small', 20, 30], ['three-year', 60, 1095]]) {
  const directory = await mkdtemp(path.join(tmpdir(), 'episuite-profile-'));
  let app;
  try {
    const state = initialState(), date = dateKey();
    state.onboarding = { status: 'complete', step: 7 };
    state.tasks = Array.from({ length: taskCount }, (_, index) => {
      const task = taskInput({ title: 'Synthetic habit ' + index, repeat: 'daily' });
      for (let day = 1; day <= dayCount; day++) {
        task.history[addDays(date, -day)] = [{ id: index + '-' + day, coins: 5, at: Date.now() - day * 86400000 }];
      }
      return task;
    });
    state.sessions = Array.from({ length: dayCount * 3 }, (_, index) => ({
      id: 'session-' + index, date: addDays(date, -Math.floor(index / 3) - 1),
      mode: 'focus', minutes: 25, full: true, coins: 10
    }));
    await writeFile(path.join(directory, 'episuite.json'), JSON.stringify(state));
    let started = performance.now();
    app = await createApp({ dataDir: directory, backgroundInterval: 0 });
    const startupMs = performance.now() - started;
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + app.server.address().port;
    await fetch(base + '/api/state');
    started = performance.now();
    const response = await fetch(base + '/api/state');
    const snapshot = await response.json();
    const fullSyncMs = performance.now() - started;
    const saves = [];
    for (let index = 0; index < 3; index++) {
      started = performance.now();
      const response = await fetch(base + '/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Synthetic performance capture ' + index })
      });
      if (!response.ok) throw Error('Capture failed');
      await response.arrayBuffer();
      saves.push(performance.now() - started);
    }
    started = performance.now();
    for (let day = 0; day < 7; day++) metrics(snapshot, addDays(date, -day));
    const weeklyMetricsMs = performance.now() - started;
    const bytes = (await readFile(path.join(directory, 'episuite.json'))).length;
    console.log(JSON.stringify({
      fixture: name, taskCount, dayCount, bytes,
      startupMs: Math.round(startupMs), fullSyncMs: Math.round(fullSyncMs),
      captureMedianMs: Math.round(saves.sort((a, b) => a - b)[1]),
      weeklyMetricsMs: Math.round(weeklyMetricsMs)
    }));
  } finally {
    await app?.close();
    if (!path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep + 'episuite-profile-')) throw Error('Unexpected profile directory');
    await rm(directory, { recursive: true, force: true });
  }
}
