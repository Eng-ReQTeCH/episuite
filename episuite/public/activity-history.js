import { dateKey, done, habitWeekStart, InputError, removeCompletion, taskProgress, toggleCompletion, validDate } from './domain.js';
import { syncContactCompletion } from './social-domain.js';

export function correctTaskHistory(state, task, data, award) {
  const date = data.date, today = dateKey(Date.now(), state.settings.timezone);
  if (!validDate(date) || date > today) throw new InputError('Choose an activity date up to today.');
  if (data.action === 'add') {
    if (done(task, date)) throw new InputError('This period already meets the task target.');
    toggleCompletion(state, task.id, date, award);
  } else {
    const from = data.from;
    if (!validDate(from)) throw new InputError('Choose the original activity date.');
    const entry = task.history[from]?.find(item => item.id === data.completionId);
    if (!entry) throw Object.assign(new InputError('This completion changed. Reopen history.'), { status: 409 });
    if (state.reading?.credits.some(credit => credit.completionIds?.includes(entry.id))) throw new InputError('Correct the linked reading session from the book’s history.');
    if (data.action === 'remove') removeCompletion(state, task, from, entry.id);
    else if (data.action === 'move') {
      if (date === from) return { unchanged: true };
      const progress = taskProgress(task, date);
      const samePeriod = task.repeat === 'quota' && habitWeekStart(date) === habitWeekStart(from);
      if (task.repeat !== 'none' && !samePeriod && progress.count >= progress.target) throw new InputError('The destination period already meets the target.');
      task.history[from] = task.history[from].filter(item => item.id !== entry.id);
      (task.history[date] ||= []).push(entry);
      if (task.repeat === 'none') task.completed = true;
    } else throw new InputError('Choose add, move, or remove.');
  }
  syncContactCompletion(state, task);
  return { ...taskProgress(task, date) };
}
