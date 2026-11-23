import { finishTimer, remaining, startTimer } from './public/domain.js';

export function advanceExpiredTimer(state, now = Date.now()) {
  if (state.timer?.status !== 'running' || remaining(state.timer, now) > 0) return null;

  const timerSnapshot = structuredClone(state.timer);
  const session = finishTimer(state, now);
  if (session) Object.assign(session, { automatic: true, timerSnapshot });
  if (session?.mode === 'focus' && state.settings.autoBreak) {
    const completed = state.sessions.filter(item => item.mode === 'focus' && item.full).length;
    const long = completed > 0 && completed % state.settings.cycles === 0;
    startTimer(state, {
      mode: long ? 'long' : 'short',
      minutes: long ? state.settings.longBreak : state.settings.shortBreak
    }, session.at);
    state.timer.automaticFrom = session.id;
    state.timer.automaticDeadline = state.timer.deadline;
    if (remaining(state.timer, now) === 0) {
      const breakSession = finishTimer(state, now);
      if (breakSession) breakSession.automatic = true;
    }
  }
  return session;
}
