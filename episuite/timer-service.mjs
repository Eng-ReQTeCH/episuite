import { finishTimer, remaining, startTimer } from './public/domain.js';

export function advanceExpiredTimer(state, now = Date.now()) {
  if (state.timer?.status !== 'running' || remaining(state.timer, now) > 0) return null;

  const session = finishTimer(state, now);
  if (session?.mode === 'focus' && state.settings.autoBreak) {
    const completed = state.sessions.filter(item => item.mode === 'focus' && item.full).length;
    const long = completed > 0 && completed % state.settings.cycles === 0;
    startTimer(state, {
      mode: long ? 'long' : 'short',
      minutes: long ? state.settings.longBreak : state.settings.shortBreak
    }, session.at);
    if (remaining(state.timer, now) === 0) finishTimer(state, now);
  }
  return session;
}
