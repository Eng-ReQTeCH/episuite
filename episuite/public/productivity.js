import { addDays, done, InputError, validDate, taskAvailable } from './domain.js';

export const focusConditions = [['usual', 'Usual audio'], ['quiet', 'Speech-free']];

export function shortText(value, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function weekStart(date) {
  const day = new Date(date + 'T12:00:00Z').getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

export function reviewInput(data) {
  return {
    outcome: shortText(data.outcome),
    friction: shortText(data.friction),
    adjustment: shortText(data.adjustment)
  };
}

export function dayPriority(state, date) {
  const id = state.dayPlans?.[date]?.taskId;
  return id ? state.tasks.find(task => task.id === id && !task.deleted) : undefined;
}

export function setPriority(state, date, data) {
  if ('expectedVersion' in data && Number(data.expectedVersion) !== (state.dayPlans?.[date]?.editVersion || 0)) {
    throw Object.assign(new InputError('Today’s outcome changed on another device. Reopen this editor.'), { status: 409 });
  }
  const taskId = shortText(data.taskId, 300);
  if (taskId && !state.tasks.some(task => task.id === taskId && !task.deleted && (!done(task, date) || state.dayPlans?.[date]?.taskId === taskId))) {
    throw new InputError('Choose an unfinished task.');
  }
  state.dayPlans ||= {};
  state.dayPlans[date] = { taskId, outcome: shortText(data.outcome), editVersion: (state.dayPlans[date]?.editVersion || 0) + 1 };
  return state.dayPlans[date];
}

export function normalizeProductivity(state) {
  for (const [key, transform] of [
    ['dayPlans', entry => ({ taskId: shortText(entry.taskId, 300), outcome: shortText(entry.outcome) })],
    ['weeklyReviews', reviewInput]
  ]) {
    const entries = state[key];
    if (entries && (typeof entries !== 'object' || Array.isArray(entries))) throw new InputError('Invalid planning history.');
    state[key] = Object.fromEntries(Object.entries(entries || {}).map(([date, entry]) => {
      if (!validDate(date) || !entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new InputError('Invalid planning entry.');
      }
      const normalized = transform(entry);
      if (Number.isSafeInteger(entry.editVersion) && entry.editVersion >= 0) normalized.editVersion = entry.editVersion;
      return [date, normalized];
    }));
  }
}

export function duePriority(state, date) {
  const task = dayPriority(state, date);
  return task && taskAvailable(state, task, date) ? task : null;
}
