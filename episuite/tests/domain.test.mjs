import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, taskInput, blockInput, isDue, done, toggleCompletion, chooseNext, startTimer, pauseTimer, resumeTimer, finishTimer, remaining, schedule, conflicts, dateKey, addDays, metrics, legacyImport, calendarText } from '../public/domain.js';
const day = '2026-10-04';
test('one-off completion awards once, undo restores history and balance', () => {
  const s = initialState(), t = taskInput({ title: 'Start', difficulty: 2 }); s.tasks.push(t);
  assert.equal(toggleCompletion(s, t.id, day), 10); assert.equal(s.coins, 10); assert.equal(done(t, day), true);
  assert.equal(toggleCompletion(s, t.id, day), -10); assert.equal(s.coins, 0); assert.equal(metrics(s, day).completed, 0);
});
test('multi-daily habits count independent completions and undo one', () => {
  const s = initialState(), t = taskInput({ title: 'Water', repeat: 'interval_0.5', target: 2 }); s.tasks.push(t);
  toggleCompletion(s, t.id, day); assert.equal(done(t, day), false); toggleCompletion(s, t.id, day); assert.equal(done(t, day), true);
  toggleCompletion(s, t.id, day); assert.equal(t.history[day].length, 1); assert.equal(isDue(t, addDays(day, 1)), true);
});
test('weekly and custom interval habits wait until due, and future tasks stay quiet', () => {
  const s = initialState(), t = taskInput({ title: 'Clean', repeat: 'weekly' }); s.tasks.push(t); toggleCompletion(s, t.id, day);
  assert.equal(isDue(t, addDays(day, 1)), false); assert.equal(isDue(t, addDays(day, 7)), true);
  assert.equal(isDue(taskInput({ title: 'Later', due: '2026-10-12' }), day), false);
});
test('next action favors low energy and respects shortlist, deleted and completed tasks', () => {
  const s = initialState(); s.tasks = [taskInput({ title: 'Big', minutes: 60, energy: 'high', lane: 'today' }), taskInput({ title: 'Tiny', minutes: 2, energy: 'low', lane: 'today' }), taskInput({ title: 'Inbox', minutes: 1 })];
  assert.equal(chooseNext(s, day, 'low').title, 'Tiny'); s.tasks[1].deleted = true; assert.equal(chooseNext(s, day).title, 'Big');
});
test('timestamp timer survives long background intervals, pause and resume', () => {
  const s = initialState(); startTimer(s, { minutes: 25 }, 1000); assert.equal(remaining(s.timer, 601000), 900);
  pauseTimer(s, 601000); assert.equal(remaining(s.timer, 2000000), 900); resumeTimer(s, 2000000);
  assert.equal(remaining(s.timer, 2300000), 600); assert.throws(() => startTimer(s, { minutes: 2 }, 0));
});
test('finish is idempotent; partial credit reflects only elapsed focus minutes', () => {
  const s = initialState(); startTimer(s, { minutes: 25 }, 1000); assert.throws(() => finishTimer(s, 2000));
  const result = finishTimer(s, 121000, true); assert.equal(result.minutes, 2); assert.equal(result.full, false); assert.equal(s.coins, 1);
  assert.equal(finishTimer(s, 121000, true), null); assert.equal(s.sessions.length, 1);
});
test('break sessions never award focus credit', () => {
  const s = initialState(); startTimer(s, { mode: 'short', minutes: 5 }, 1000); finishTimer(s, 301000);
  assert.equal(s.coins, 0); assert.equal(metrics(s, day).totalFocus, 0);
});
test('flexible blocks move later while pinned appointments stay fixed', () => {
  const s = initialState(); s.wake[day] = '2026-10-04T07:00:00Z'; // Cairo is UTC+3 here.
  s.blocks = [blockInput({ name: 'Flexible', date: day, mode: 'relative', offset: 15, duration: 30 }), blockInput({ name: 'Meeting', date: day, start: '10:30', duration: 15 })];
  const before = schedule(s, day); assert.equal(before[0].startMinute, 615); assert.equal(conflicts(before).length, 1);
  s.blocks[0].shift = 15; const after = schedule(s, day); assert.equal(after[0].startMinute, 630); assert.equal(after[1].startMinute, 630);
});
test('wake-relative blocks remain unanchored before waking', () => {
  const s = initialState(); s.blocks.push(blockInput({ name: 'Morning', date: day, mode: 'relative' }));
  assert.equal(schedule(s, day)[0].startMinute, null); assert.equal(conflicts(schedule(s, day)).length, 0);
});
test('recurring blocks appear on correct future dates', () => {
  const s = initialState(); s.blocks.push(blockInput({ name: 'Weekly', date: day, repeat: 'weekly' }));
  assert.equal(schedule(s, addDays(day, 1)).length, 0); assert.equal(schedule(s, addDays(day, 7)).length, 1);
});
test('timezone day boundaries and calendar escaping are correct', () => {
  assert.equal(dateKey(Date.parse('2026-10-03T22:30Z'), 'Africa/Cairo'), day);
  const s = initialState(); s.blocks.push(blockInput({ name: 'Meeting, one; two\nthree', date: day, start: '23:45', duration: 30 }));
  const text = calendarText(s, day); assert.match(text, /Meeting\\, one\\; two\\nthree/); assert.match(text, /DTEND;TZID=Africa\/Cairo:20261005T001500/);
});
test('legacy import preserves categories, habits, histories, time blocks and private metadata', () => {
  const s = initialState(), payload = { productivity: { categories: [{ id: 'work', name: 'Work' }], tasks: [{ id: 'a', text: 'Write', category: 'work', repeat: 'none', completed: true, history: { __once__: { date: day, coins: 10 } } }], timeblocks: { blocks: [{ id: 'b', name: 'Write', startTime: '09:00', endTime: '09:30', taskIds: ['a'] }] } }, shared: { stats: { allTime: { coins: 25, totalCoinsEarned: 40, focusMinutes: 80, tasksCompleted: 2 }, equippedTitle: 'Scholar' } } };
  const imported = legacyImport(payload, s); assert.equal(imported.tasks[0].title, 'Write'); assert.equal(imported.tasks[0].history[day].length, 1); assert.equal(imported.blocks[0].duration, 30); assert.equal(imported.legacyCompleted, 1); assert.equal(imported.archivedLegacy.shared.stats.equippedTitle, 'Scholar');
});
test('native backup restores records but clears active timers and preserves calendar credentials', () => {
  const s = initialState(); s.calendar.password = 'private'; const payload = initialState(); payload.timer = { status: 'running' }; payload.calendar.password = 'other';
  const imported = legacyImport(payload, s); assert.equal(imported.timer, null); assert.equal(imported.calendar.password, 'private');
});
test('invalid inputs fail rather than create corrupt tasks and blocks', () => {
  assert.throws(() => taskInput({ title: ' ' })); assert.throws(() => taskInput({ title: 'x', repeat: 'interval_0' })); assert.throws(() => taskInput({ title: 'x', due: '2026-02-30' }));
  assert.throws(() => blockInput({ name: 'x', date: day, start: '25:00' })); assert.throws(() => legacyImport({ random: true }, initialState()));
});
test('standalone Epidoro task backups preserve numeric IDs, estimates and completion', () => {
  const s = legacyImport({ tasks: [{ id: 123, text: 'Draft', estimated: 2, actual: 1, completed: false }], stats: { allTime: { focusMinutes: 25 } } }, initialState());
  assert.equal(s.tasks[0].id, '123'); assert.equal(s.tasks[0].minutes, 50); assert.equal(s.tasks[0].actual, 1); assert.equal(s.legacyFocus, 25);
  assert.equal(toggleCompletion(s, '123', '2026-10-04'), 5);
});
