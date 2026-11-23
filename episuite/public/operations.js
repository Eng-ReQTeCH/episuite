import { dateKey, done, InputError, toggleCompletion, validDate, pauseTimer, resumeTimer, finishTimer } from './domain.js';
import { logReading, editReadingLog } from './books-domain.js';
import { syncContactCompletion } from './social-domain.js';

export function applyOperation(state, operation, award, now = Date.now()) {
  if (!operation || typeof operation.id !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(operation.id)) throw new InputError('Use a valid operation ID.');
  if (operation.workspace !== state.workspaceId) throw Object.assign(new InputError('This change belongs to another workspace.'), { status: 409 });
  const today = dateKey(now, state.settings.timezone), date = operation.date;
  if (!validDate(date) || date > today) throw new InputError('Choose an activity date up to today.');
  const data = operation.data || {};
  if (operation.kind === 'timer-control') {
    if (!['pause','resume','finish','reset'].includes(data.action) || !Number.isFinite(data.at) || data.at > now + 60000 || dateKey(data.at,state.settings.timezone) !== date || data.at < (data.expectedTimer?.started || 0)) throw new InputError('Invalid saved timer control.');
    const signature = timer => timer && JSON.stringify(['id','mode','taskId','duration','remaining','started','deadline','status','elapsed'].map(key => timer[key] ?? null));
    const automatic = state.sessions.find(session => session.id === data.timerId && session.automatic && signature(session.timerSnapshot) === signature(data.expectedTimer));
    const untouchedBreak = state.timer?.automaticFrom === data.timerId && state.timer.status === 'running' && state.timer.deadline === state.timer.automaticDeadline;
    if (automatic && data.at < automatic.at && (!state.timer || untouchedBreak) &&
        !state.sessions.some(session => session.id !== automatic.id && session.at >= automatic.at && !(session.automaticFrom === data.timerId && session.automatic))) {
      const replaced = state.sessions.filter(session => session.id === data.timerId || session.automaticFrom === data.timerId);
      const coins = replaced.reduce((sum,session) => sum + Number(session.coins || 0), 0);
      state.coins -= coins; state.earned = Math.max(0,state.earned-coins);
      state.sessions = state.sessions.filter(session => !replaced.includes(session));
      state.timer = structuredClone(automatic.timerSnapshot);
    }
    if (!state.timer && ['finish','reset'].includes(data.action) && state.sessions.some(session => session.id === data.timerId)) return { alreadyFinished: true };
    if (state.timer?.id !== data.timerId || signature(state.timer) !== signature(data.expectedTimer)) throw Object.assign(new InputError('This timer changed on another device. Your saved control needs review.'), { status: 409 });
    if (data.action === 'pause') return pauseTimer(state, data.at);
    if (data.action === 'resume') return resumeTimer(state, data.at);
    if (data.action === 'finish') return finishTimer(state, data.at, Boolean(data.early));
    state.timer = null; return { ok: true };
  }
  if (operation.kind === 'focus-session') {
    if (typeof operation.entityId !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(operation.entityId) ||
        !['focus', 'short', 'long'].includes(data.mode) || !Number.isInteger(data.minutes) || data.minutes < 0 || data.minutes > 120 ||
        !Number.isFinite(data.at) || data.at > now + 60000 || dateKey(data.at, state.settings.timezone) !== date) throw new InputError('Invalid offline focus session.');
    const existing = state.sessions.find(session => session.id === operation.entityId);
    if (existing) return existing;
    const coins = data.mode === 'focus' && data.minutes > 0 ? Math.max(1, Math.round(data.minutes * .4)) : 0;
    const session = {
      id: operation.entityId, mode: data.mode, minutes: data.minutes, full: Boolean(data.full), date, at: data.at,
      taskId: state.tasks.some(task => task.id === data.taskId) ? data.taskId : null,
      coins, baseCoins: coins, rewardTier: 'fixed'
    };
    state.sessions.push(session); state.coins += coins; state.earned += coins;
    return session;
  }
  if (operation.kind === 'task-complete') {
    const task = state.tasks.find(item => item.id === operation.entityId && !item.deleted);
    if (!task) throw Object.assign(new InputError('Task no longer exists.'), { status: 409 });
    const delta = done(task, date) ? 0 : toggleCompletion(state, task.id, date, award);
    syncContactCompletion(state, task);
    return { delta, taskStatus: done(task, date) ? 'completed' : 'recorded' };
  }
  const book = state.reading.books.find(item => item.id === operation.entityId);
  if (!book) throw Object.assign(new InputError('Book no longer exists.'), { status: 409 });
  if (operation.kind === 'reading-log') return logReading(state, book, { ...data, date }, today, award);
  if (operation.kind === 'reading-edit' || operation.kind === 'reading-delete') {
    return editReadingLog(state, book, data.logId, { ...data, date }, today, award, operation.kind === 'reading-delete');
  }
  throw new InputError('Choose a supported pending change.');
}

export function operationForRequest(state, endpoint, data, method, date) {
  let match = endpoint.split('?')[0].match(/^\/api\/books\/([^/]+)\/log$/);
  if (match && method === 'POST') {
    const book = state.reading.books.find(item => item.id === match[1]);
    return { kind: 'reading-log', entityId: match[1], data: { ...data, from: Number(data.from ?? book?.currentPage ?? 0) } };
  }
  match = endpoint.match(/^\/api\/books\/([^/]+)\/logs\/([^/?]+)$/);
  if (match && ['PATCH', 'DELETE'].includes(method)) return {
    kind: method === 'DELETE' ? 'reading-delete' : 'reading-edit', entityId: match[1], data: { ...data, logId: match[2] }
  };
  match = endpoint.match(/^\/api\/tasks\/([^/]+)\/complete(?:\?.*)?$/);
  if (match && method === 'POST') {
    const task = state.tasks.find(item => item.id === match[1]);
    if (task && !done(task, date)) return { kind: 'task-complete', entityId: match[1], data: {} };
  }
  return null;
}
