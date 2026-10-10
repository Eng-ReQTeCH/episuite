// Pure functions shared by the server and browser. Dates always use the user's timezone.
export function uid(source=globalThis.crypto) {
  if(source.randomUUID)return source.randomUUID();
  // randomUUID requires HTTPS in browsers; getRandomValues also works on a LAN over HTTP.
  const bytes=source.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export class InputError extends Error { constructor(message) { super(message); this.status = 400; } }
export const dateKey = (time = Date.now(), zone = 'Africa/Cairo') => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(time));
export const addDays = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export function initialState() {
  return { version: 1, revision: 0, tasks: [], blocks: [], templates: [], sessions: [], events: [], notes: [], social: {circles:[],people:[],checkins:[]},
    categories: ['Personal', 'Work', 'Health', 'Learning', 'Home'],
    settings: { name: '', timezone: 'Africa/Cairo', theme: 'light', focusMinutes: 25, shortBreak: 5, longBreak: 15, cycles: 4, partialThreshold: 90, sound: true, volume: .25, gamification: true, reducedMotion: false, lowStim: false, autoBreak: false, dailyGoal: 2, accent: '#316b57', timerFont: 'sans', background: '', ollamaModel: 'llama3.2' },
    coins: 0, earned: 0, legacyFocus: 0, legacyCompleted: 0, legacyDays: {}, purchases: [],
    rewards: [{ id: 'tea', name: 'A good cup of tea', cost: 15, minutes: 10 }, { id: 'episode', name: 'An episode of something good', cost: 50, minutes: 25 }],
    redemption: null, timer: null, wake: {}, checkins: {}, blockFeedback: {}, calendar: { url: '', username: '', password: '', eventUrls: {} }, archivedLegacy: null };
}
export function finite(value, min, max, fallback) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
export function taskInput(input, existing = {}) {
  const title = String(input.title ?? existing.title ?? '').trim().slice(0, 300);
  if (!title) throw new InputError('Give this task a name.');
  const repeat = String(input.repeat ?? existing.repeat ?? 'none');
  if (!/^(none|daily|weekly|interval_\d+(\.\d+)?)$/.test(repeat) || (repeat.startsWith('interval_') && Number(repeat.slice(9)) <= 0)) throw new InputError('Choose a valid repeat interval.');
  const due = input.due ?? existing.due ?? '';
  if (due && !validDate(due)) throw new InputError('Choose a valid due date.');
  const minimumGapMinutes = Number(input.minimumGapMinutes ?? existing.minimumGapMinutes ?? (repeat.startsWith('interval_') && Number(repeat.slice(9)) < 1 ? 360 : 0));
  if (!Number.isInteger(minimumGapMinutes) || minimumGapMinutes < 0 || minimumGapMinutes > 1440) throw new InputError('Choose a gap between 0 and 1440 minutes.');
  return { ...existing, id: existing.id ? String(existing.id) : uid(), title, description: String(input.description ?? existing.description ?? '').slice(0, 3000),
    minimumGapMinutes, personIds: Array.isArray(input.personIds) ? [...new Set(input.personIds.map(String))].slice(0,50) : existing.personIds || [], socialContact: Boolean(existing.socialContact),
    category: String(input.category ?? existing.category ?? 'Personal').slice(0, 50), minutes: finite(input.minutes ?? existing.minutes, 1, 480, 15),
    energy: ['low', 'medium', 'high'].includes(input.energy ?? existing.energy) ? (input.energy ?? existing.energy) : 'medium',
    difficulty: finite(input.difficulty ?? existing.difficulty, 1, 3, 1), repeat, target: finite(input.target ?? existing.target, 1, 20, repeat.startsWith('interval_') ? Math.max(1, Math.round(1 / Number(repeat.slice(9)))) : 1),
    due, lane: ['inbox', 'today', 'later'].includes(input.lane ?? existing.lane) ? (input.lane ?? existing.lane) : 'inbox',
    steps: Array.isArray(input.steps) ? input.steps.slice(0, 30).map(s => ({ id: s.id || uid(), title: String(s.title || '').slice(0, 300), done: Boolean(s.done) })).filter(s => s.title) : existing.steps || [],
    history: existing.history || {}, completed: existing.completed || false, deleted: existing.deleted || false, created: existing.created || Date.now(), order: finite(existing.order, -1e13, 1e15, Date.now()) };
}
export function validDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(String(date)) && !Number.isNaN(Date.parse(date)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date; }
export function countToday(task, date) { return (task.history?.[date] || []).length; }
export function done(task, date) { return task.repeat === 'none' ? task.completed : countToday(task, date) >= task.target; }
export function nextEligibleAt(task, date) {
  if (!task.repeat.startsWith('interval_') || Number(task.repeat.slice(9)) >= 1 || !countToday(task,date) || done(task,date)) return null;
  const last = Math.max(...(task.history?.[date] || []).map(e=>Number(e.at)||0));
  return last + (task.minimumGapMinutes ?? 360) * 60000;
}
export function isDue(task, date, now = Date.now()) {
  if (task.deleted || done(task, date)) return false;
  if (task.due && task.due > date) return false;
  if (task.repeat === 'none' || task.repeat === 'daily') return true;
  const days = task.repeat === 'weekly' ? 7 : Number(task.repeat.slice(9));
  if (days < 1) return (nextEligibleAt(task,date) ?? 0) <= now;
  const dates = Object.keys(task.history || {}).filter(d => task.history[d].length).sort();
  return !dates.length || date >= addDays(dates.at(-1), days);
}
export function chooseNext(state, date, energy = 'medium', now = Date.now()) {
  const rank = { low: 0, medium: 1, high: 2 };
  return state.tasks.filter(t => t.lane === 'today' && isDue(t, date, now)).sort((a, b) => {
    const score = t => (t.due && t.due <= date ? -100 : 0) + Math.max(0, rank[t.energy] - rank[energy]) * 40 + t.minutes + (t.order / 1e14);
    return score(a) - score(b);
  })[0] || null;
}
function rememberCompletionRolls(task) {
  task.rewardRolls ||= {};
  for(const [date,entries] of Object.entries(task.history||{}))for(const [index,entry] of entries.entries()){
    const key=entry.rollKey||`${task.repeat==='none'?'once':date}:${index}`;
    task.rewardRolls[key] ||= {baseCoins:entry.baseCoins??entry.coins,coins:entry.coins,rewardTier:entry.rewardTier||'fixed'};
  }
}
export function toggleCompletion(state, id, date, awardTask) {
  const task = state.tasks.find(t => t.id === id && !t.deleted);
  if (!task) throw new InputError('This task was not found.');
  rememberCompletionRolls(task);
  if (done(task, date)) {
    const entry = task.repeat === 'none' ? Object.values(task.history).flat().at(-1) : task.history[date].at(-1);
    const day = task.repeat === 'none' ? Object.keys(task.history).find(d => task.history[d].includes(entry)) : date;
    if (entry) { task.history[day] = task.history[day].filter(e => e.id !== entry.id); state.coins -= entry.coins; state.earned = Math.max(0, state.earned - entry.coins); }
    task.completed = false;
    return -Number(entry?.coins || 0);
  }
  const rollKey = `${task.repeat === 'none' ? 'once' : date}:${countToday(task,date)}`;
  task.rewardRolls ||= {};
  const baseCoins=[0,5,10,20][Math.round(task.difficulty)]||5;
  const award = task.rewardRolls[rollKey] ||= awardTask ? awardTask(baseCoins) : {baseCoins,coins:baseCoins,rewardTier:'fixed'};
  const { coins } = award;
  const entry = { id: uid(), at: Date.now(), rollKey, ...award };
  (task.history[date] ||= []).push(entry);
  if (task.repeat === 'none') task.completed = true;
  state.coins += coins; state.earned += coins;
  return coins;
}
export function undoLastCompletion(state,id,date) {
  const task=state.tasks.find(t=>t.id===id&&!t.deleted);if(!task)throw new InputError('This task was not found.');
  rememberCompletionRolls(task);
  const entries=task.history?.[date];if(!entries?.length)throw new InputError('There is no completion to undo today.');
  const entry=entries.pop();state.coins-=Number(entry.coins||0);state.earned=Math.max(0,state.earned-Number(entry.coins||0));task.completed=false;return -Number(entry.coins||0);
}
export function blockInput(input, existing = {}) {
  const name = String(input.name ?? existing.name ?? '').trim().slice(0, 120);
  const date = input.date ?? existing.date;
  if (!name || !validDate(date)) throw new InputError('A block needs a name and date.');
  const mode = input.mode ?? existing.mode ?? 'fixed';
  const start = String(input.start ?? existing.start ?? '09:00');
  if (!['fixed', 'relative'].includes(mode) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) throw new InputError('Choose a valid start time.');
  const commitment = Boolean(input.commitment ?? existing.commitment);
  const endDate = input.endDate ?? existing.endDate ?? '';
  if (endDate && (!validDate(endDate) || endDate < date)) throw new InputError('End date must be on or after the start date.');
  const weekdays = input.weekdays ?? existing.weekdays ?? [];
  if (!Array.isArray(weekdays) || weekdays.some(d => !Number.isInteger(Number(d)) || Number(d) < 0 || Number(d) > 6)) throw new InputError('Choose valid weekdays.');
  const repeat = input.repeat ?? existing.repeat ?? 'none';
  if (!['none', 'daily', 'weekly', 'weekdays'].includes(repeat)) throw new InputError('Choose a valid repeat schedule.');
  if (repeat === 'weekdays' && !weekdays.length) throw new InputError('Choose at least one weekday.');
  const reminder = 'reminderMinutes' in input ? input.reminderMinutes : 'reminderMinutes' in existing ? existing.reminderMinutes : commitment ? 15 : null;
  if (reminder !== null && reminder !== '' && (!Number.isInteger(Number(reminder)) || Number(reminder) < 0 || Number(reminder) > 10080)) throw new InputError('Reminder must be between 0 and 10080 minutes.');
  if (commitment && mode !== 'fixed') throw new InputError('Commitments need a fixed start time.');
  const excludedDates = input.excludedDates ?? existing.excludedDates ?? [];
  if (!Array.isArray(excludedDates) || excludedDates.some(d=>!validDate(d))) throw new InputError('Skipped dates must be valid dates.');
  const color = String(input.color ?? existing.color ?? '');
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) throw new InputError('Choose a valid accent color.');
  return { ...existing, id: existing.id || uid(), name, date, mode, start, offset: finite(input.offset ?? existing.offset, 0, 1425, 0),
    color, personIds: Array.isArray(input.personIds) ? [...new Set(input.personIds.map(String))].slice(0,50) : existing.personIds || [],
    commitment, endDate, weekdays: [...new Set(weekdays.map(Number))].sort(), reminderMinutes: reminder === null || reminder === '' ? null : Number(reminder),
    location: String(input.location ?? existing.location ?? '').slice(0, 300), description: String(input.description ?? existing.description ?? '').slice(0, 3000),
    excludedDates: [...new Set(excludedDates)].sort(),
    duration: finite(input.duration ?? existing.duration, 5, 480, 30), shift: existing.shift || 0,
    repeat,
    taskIds: Array.isArray(input.taskIds) ? input.taskIds.map(String).slice(0, 50) : existing.taskIds || [], kind: input.kind === 'break' ? 'break' : input.kind === 'focus' ? 'focus' : existing.kind || 'focus' };
}
export const calendarPalette = ['#3156ce','#9b3b83','#177a68','#b56419','#7053b4','#b33e4e','#287c9b','#6b7730'];
export function blockColor(block, blocks = []) {
  if (/^#[0-9a-f]{6}$/i.test(block.color || '')) return block.color;
  // Creation order remains stable across dates, names and views. Stored colors survive deletions.
  const index = blocks.findIndex(b=>b.id === block.id);
  return calendarPalette[(index < 0 ? 0 : index) % calendarPalette.length];
}
export function assignBlockColor(block, blocks) {
  if (block.color) return block;
  const counts = calendarPalette.map(color=>blocks.filter(b=>blockColor(b,blocks)===color).length);
  if(Math.min(...counts)===0)block.color = calendarPalette[counts.indexOf(0)];
  else {let index=blocks.length;do {const hue=(index++*137.508)%360,s=.6,l=.4;const channel=n=>{const k=(n+hue/30)%12;return Math.round(255*(l-s*Math.min(l,1-l)*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};block.color='#'+channel(0)+channel(8)+channel(4);}while(blocks.some(b=>b.color===block.color));}
  return block;
}
export function blockOnDate(block, date) {
  if (date < block.date || (block.endDate && date > block.endDate) || block.excludedDates?.includes(date)) return false;
  if (block.repeat === 'weekdays') return block.weekdays.includes(new Date(`${date}T12:00:00Z`).getUTCDay());
  return block.date === date || block.repeat === 'daily' || (block.repeat === 'weekly' && (Date.parse(date) - Date.parse(block.date)) % (7 * 86400000) === 0);
}
export function calendarDates(start, end = start) {
  if (!validDate(start) || !validDate(end) || end < start || (Date.parse(end) - Date.parse(start)) / 86400000 > 366) throw new InputError('Choose a calendar range of up to one year.');
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}
export function dueReminders(state, now = Date.now()) {
  const day = dateKey(now, state.settings.timezone);
  return calendarDates(addDays(day, -1), addDays(day, 7)).flatMap(date => schedule(state, date).filter(b => b.startMinute !== null && b.reminderMinutes != null).map(b => {
    const startsAt = zonedTimestamp(date, b.startMinute, state.settings.timezone);
    return { id: `${b.id}:${date}:${startsAt}:${b.reminderMinutes}`, blockId: b.id, date, name: b.name, location: b.location || '', startsAt, remindAt: startsAt - b.reminderMinutes * 60000 };
  })).filter(r => r.remindAt <= now && r.startsAt >= now);
}
export function schedule(state, date) {
  return state.blocks.filter(b => blockOnDate(b, date)).map(b => {
    const [h, m] = b.start.split(':').map(Number);
    const wake = state.wake[date];
    let start = h * 60 + m;
    if (b.mode === 'relative') {
      if (!wake) return { ...b, startMinute: null, endMinute: null };
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: state.settings.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(wake)).split(':').map(Number);
      start = parts[0] * 60 + parts[1] + b.offset + b.shift;
    }
    return { ...b, startMinute: start, endMinute: start + b.duration };
  }).sort((a, b) => (a.startMinute ?? Infinity) - (b.startMinute ?? Infinity));
}
export function conflicts(blocks) { return blocks.flatMap((b, i) => blocks.slice(i + 1).filter(c => b.startMinute !== null && c.startMinute !== null && b.startMinute < c.endMinute && c.startMinute < b.endMinute).map(c => [b.id, c.id])); }
export function zonedTimestamp(date, minute, zone) {
  const desired = Date.parse(`${date}T00:00:00Z`) + minute * 60000;
  let guess = desired;
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
    const p = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const actual = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
    if (actual === desired) break;
    guess += desired - actual;
  }
  return guess;
}
export function startTimer(state, { mode = 'focus', minutes, taskId = null }, now = Date.now()) {
  if (state.timer && ['running', 'paused'].includes(state.timer.status)) throw new InputError('Finish or reset your current timer first.');
  if (!['focus', 'short', 'long', 'reward'].includes(mode)) throw new InputError('Choose a valid timer mode.');
  const duration = finite(minutes, 1, 120, mode === 'focus' ? state.settings.focusMinutes : mode === 'long' ? state.settings.longBreak : state.settings.shortBreak) * 60;
  state.timer = { id: uid(), mode, taskId, duration, remaining: duration, started: now, deadline: now + duration * 1000, status: 'running', elapsed: 0 };
  return state.timer;
}
export function remaining(timer, now = Date.now()) { return timer?.status === 'running' ? Math.max(0, Math.ceil((timer.deadline - now) / 1000)) : Math.max(0, timer?.remaining || 0); }
export function pauseTimer(state, now = Date.now()) {
  const t = state.timer;
  if (!t || t.status !== 'running') throw new InputError('There is no running timer.');
  t.remaining = remaining(t, now); t.status = 'paused'; t.elapsed = t.duration - t.remaining; return t;
}
export function resumeTimer(state, now = Date.now()) {
  const t = state.timer;
  if (!t || t.status !== 'paused') throw new InputError('There is no paused timer.');
  t.status = 'running'; t.deadline = now + t.remaining * 1000; return t;
}
export function finishTimer(state, now = Date.now(), early = false) {
  const t = state.timer;
  if (!t || !['running', 'paused'].includes(t.status)) return null;
  const seconds = t.duration - remaining(t, now);
  if (!early && remaining(t, now) > 0) throw new InputError('This session is still running.');
  if (state.sessions.some(s => s.id === t.id)) { state.timer = null; return null; }
  const minutes = Math.floor(seconds / 60);
  const credited = t.mode === 'focus' && minutes > 0;
  const full = seconds >= t.duration * state.settings.partialThreshold / 100;
  const finishedAt = !early && t.deadline && now >= t.deadline ? t.deadline : now;
  const baseCoins = credited ? Math.max(1, Math.round(minutes * .4)) : 0;
  const award = { baseCoins, coins: baseCoins, rewardTier: 'fixed' };
  const { coins } = award;
  const session = { id: t.id, date: dateKey(finishedAt, state.settings.timezone), at: finishedAt, taskId: t.taskId, mode: t.mode, minutes, full, ...award };
  state.sessions.push(session); state.coins += coins; state.earned += coins; state.timer = null; return session;
}
export function metrics(state, date) {
  const focus = state.sessions.filter(s => s.mode === 'focus');
  const completions = state.tasks.flatMap(t => Object.entries(t.history).flatMap(([day, entries]) => entries.map(e => ({ ...e, day }))));
  return { focus: focus.filter(s => s.date === date).reduce((n, s) => n + s.minutes, 0) + Number(state.legacyDays?.[date]?.focusMinutes || 0),
    totalFocus: focus.reduce((n, s) => n + s.minutes, 0) + state.legacyFocus,
    completed: completions.filter(e => e.day === date).length,
    totalCompleted: completions.length + state.legacyCompleted,
    sessions: focus.filter(s => s.date === date && s.full).length,
    activeDays: new Set([...focus.map(s => s.date), ...completions.map(e => e.day)]).size };
}
export function legacyImport(payload, current) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new InputError('Choose an Episuite or EpiApps JSON backup.');
  if (payload.version === 1 && Array.isArray(payload.tasks) && Array.isArray(payload.blocks)) {
    const state = { ...initialState(), ...structuredClone(payload), revision: current.revision, calendar: current.calendar };
    state.settings = { ...initialState().settings, ...payload.settings };
    if (state.onboarding && (!['active','paused','complete'].includes(state.onboarding.status) || !Number.isInteger(state.onboarding.step) || state.onboarding.step < 0 || state.onboarding.step > 7 || (state.onboarding.status === 'complete' && state.onboarding.step !== 7))) throw new InputError('Backup contains invalid setup progress.');
    new Intl.DateTimeFormat('en', { timeZone: state.settings.timezone });
    state.tasks = state.tasks.map(t => { const valid = taskInput(t, { ...t, history: {} }); valid.history = normalizeHistory(t.history); return valid; });
    state.blocks = state.blocks.map(b => blockInput(b, b));
    for (const key of ['sessions', 'events', 'notes', 'templates', 'rewards', 'purchases', 'categories']) if (!Array.isArray(state[key])) throw new InputError(`Backup ${key} must be a list.`);
    for (const key of ['coins', 'earned', 'legacyFocus', 'legacyCompleted']) state[key] = finite(state[key], key === 'coins' ? -1e9 : 0, 1e9, 0);
    for (const session of state.sessions) {
      if (!session || typeof session.id !== 'string' || !validDate(session.date) || !['focus', 'short', 'long'].includes(session.mode) || !Number.isFinite(Number(session.minutes)) || Number(session.minutes) < 0) throw new InputError('Backup contains an invalid focus session.');
      session.minutes = finite(session.minutes, 0, 120, 0);
    }
    for (const reward of state.rewards) {
      if (!reward || typeof reward.id !== 'string' || !String(reward.name || '').trim()) throw new InputError('Backup contains an invalid reward.');
      if(reward.kind && !['personal','screentime'].includes(reward.kind))throw new InputError('Backup contains an invalid reward type.');
      reward.cost = finite(reward.cost, 1, 100000, 20); reward.minutes = finite(reward.minutes, reward.kind==='screentime'?1:0, reward.kind==='screentime'?1440:120, 0);
    }
    for (const key of ['wake', 'checkins', 'legacyDays']) if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) throw new InputError(`Backup ${key} must be an object.`);
    state.timer = null; state.redemption = null; return state;
  }
  const prod = payload.epiproducitv || payload.productivity || (Array.isArray(payload.tasks) && !payload.stats ? payload : null);
  const shared = payload.shared || (payload.stats ? payload : null);
  if (!prod && !shared) throw new InputError('This is not a recognized backup.');
  const state = structuredClone(current);
  state.archivedLegacy = payload; // Preserve cosmetics, quests, histories and unsupported legacy metadata losslessly.
  if (prod) {
    state.categories = (prod.categories || []).map(c => typeof c === 'string' ? c : c.name).filter(Boolean);
    if (!state.categories.length) state.categories = initialState().categories;
    const cats = Object.fromEntries((prod.categories || []).map(c => [c.id, c.name]));
    state.tasks = (prod.tasks || []).map(t => taskInput({ ...t, title: t.text || t.title, category: cats[t.category] || t.category || 'Personal', lane: 'inbox' }, { ...t, history: normalizeHistory(t.history), title: t.text || t.title, deleted: false }));
    state.tasks.push(...(prod.deletedTasks || []).map(t => taskInput({ ...t, title: t.text || t.title }, { ...t, history: normalizeHistory(t.history), deleted: true })));
    const today = dateKey(Date.now(), state.settings.timezone);
    state.blocks = (prod.timeblocks?.blocks || []).map(b => { const [eh, em] = (b.endTime || '10:00').split(':').map(Number); const [sh, sm] = (b.startTime || '09:00').split(':').map(Number); return blockInput({ name: b.name, date: b.scheduledDate || today, start: b.startTime || '09:00', duration: Math.max(5, (eh * 60 + em - sh * 60 - sm + 1440) % 1440), taskIds: b.taskIds, repeat: b.recurrence }, { id: b.id }); });
  }
  if (shared?.stats) {
    const known = new Set(state.tasks.map(t => t.id));
    for (const t of shared.tasks || []) {
      if (known.has(String(t.id))) continue;
      const task = taskInput({ ...t, title: t.text || t.title, minutes: t.minutes ?? (Number(t.estimated) > 0 ? Number(t.estimated) * state.settings.focusMinutes : 15), lane: 'inbox' }, { ...t, history: normalizeHistory(t.history) });
      state.tasks.push(task); known.add(task.id);
    }
    const stats = shared.stats, all = stats.allTime || {};
    state.coins = finite(all.coins, 0, 1e9, 0); state.earned = finite(all.totalCoinsEarned, 0, 1e9, state.coins);
    state.legacyFocus = finite(all.focusMinutes, 0, 1e9, 0);
    const importedCount = state.tasks.flatMap(t => Object.values(t.history).flat()).length;
    state.legacyCompleted = Math.max(0, Number(all.tasksCompleted || 0) - importedCount);
    state.legacyDays = stats.days || {};
    const redeemable = finite(all.redeemableMinutes, 0, 100000, 0);
    if (redeemable) state.purchases.push({ id: uid(), reward: 'Imported reward time', minutes: redeemable, at: Date.now() });
    if (Number(stats.currentRedemption?.minutes) > 0 && stats.currentRedemption.active) {
      const remainingMinutes = Math.max(0, Math.floor(Number(stats.currentRedemption.minutes) - (Date.now() - Date.parse(stats.currentRedemption.startedAt)) / 60000));
      if (remainingMinutes) state.purchases.push({ id: uid(), reward: 'Unused imported break', minutes: remainingMinutes, at: Date.now() });
    }
    state.rewards.push(...(stats.customShopItems || []).map(r => ({ id: r.id || uid(), name: r.name || 'Imported reward', cost: finite(r.cost ?? r.price, 1, 100000, 20), minutes: finite(r.minutes, 0, 120, 0) })));
  }
  return state;
}
function normalizeHistory(history) {
  const result = {};
  for (const [key, value] of Object.entries(history || {})) {
    const date = key === '__once__' ? value.date : key;
    if (!validDate(date)) continue;
    const entries = Array.isArray(value) ? value : Array.isArray(value?.completions) ? value.completions : [value];
    result[date] = entries.map(e => ({ id: e?.id || uid(), at: Number(e?.at) || Date.parse(`${date}T12:00:00Z`), coins: finite(e?.coins, 0, 1e9, 0) }));
  }
  return result;
}
export function calendarText(state, date, endDate = date) {
  const escape = s => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&');
  const stamp = (day, minute) => { const d = new Date(Date.parse(`${day}T00:00:00Z`) + minute * 60000); return d.toISOString().replace(/[-:]/g, '').slice(0, 15); };
  const events = calendarDates(date, endDate).flatMap(date => schedule(state, date).filter(b => b.startMinute !== null).map(b => [
    'BEGIN:VEVENT', `UID:${b.id}-${date}@episuite`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=${state.settings.timezone}:${stamp(date, b.startMinute)}`, `DTEND;TZID=${state.settings.timezone}:${stamp(date, b.endMinute)}`,
    `SUMMARY:${escape(b.name)}`, `COLOR:${blockColor(b,state.blocks)}`, `LOCATION:${escape(b.location || '')}`, `DESCRIPTION:${escape([b.description, ...(b.personIds || []).map(id => state.social?.people.find(p => p.id === id)).filter(Boolean).map(p => 'With: ' + p.name), ...b.taskIds.map(id => state.tasks.find(t => t.id === id)?.title)].filter(Boolean).join('\n'))}`,
    ...(b.reminderMinutes == null ? [] : ['BEGIN:VALARM', `TRIGGER:-PT${b.reminderMinutes}M`, 'ACTION:DISPLAY', `DESCRIPTION:${escape(b.name)}`, 'END:VALARM']), 'END:VEVENT'
  ]));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Episuite//EN', 'CALSCALE:GREGORIAN', ...events.flat(), 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
