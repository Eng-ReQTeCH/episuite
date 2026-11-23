// Calendar dates are already expressed in the workspace timezone.
export function weekStart(date) {
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  return shiftDate(date, -((weekday + 6) % 7));
}

function shiftDate(date, days) {
  return new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}

export function weeklyCount(task, date, source = 'history') {
  const start = weekStart(date), end = shiftDate(start, 6);
  return Object.entries(task[source] || {}).filter(([day]) => day >= start && day <= end)
    .reduce((sum, [, value]) => sum + (Array.isArray(value) ? value.length : Number(value) || 0), 0);
}

export function taskProgress(task, date) {
  if (task.repeat === 'quota') {
    const target = [...(task.quotaHistory || [])].filter(entry => entry.from <= weekStart(date)).sort((a,b) => a.from.localeCompare(b.from)).at(-1)?.target ?? task.weeklyTarget ?? 3;
    return { count: weeklyCount(task, date), target, rest: weeklyCount(task, date, 'habitRest'), period: 'this week' };
  }
  return { count: (task.history?.[date] || []).length, target: task.target || 1, rest: task.habitRest?.[date] || 0, period: 'today' };
}

export function scheduledDay(task, date) {
  return task.repeat !== 'weekdays' || (task.weekdays || [1, 2, 3, 4, 5]).includes(new Date(date + 'T12:00:00Z').getUTCDay());
}
