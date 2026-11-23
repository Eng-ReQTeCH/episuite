import { addDays, done, habitOpportunities, isDue, schedule, conflicts } from './domain.js';
import { dayPriority, focusConditions } from './productivity.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const action = (label, name, id = '') => `<button type="button" class="btn text compact" data-action="${name}" data-id="${escape(id)}">${label}</button>`;

export function priorityPanel(state, date) {
  const plan = state.dayPlans?.[date];
  const task = dayPriority(state, date);
  const blocks = schedule(state, date);
  const plannedMinutes = blocks.reduce((total, block) => total + block.duration, 0);
  const shortlistMinutes = state.tasks.filter(task => task.lane === 'today' && isDue(task, date)).reduce((total, task) => total + task.minutes, 0);
  const overlapCount = conflicts(blocks).length;
  return `<section class="settings-panel productivity-panel">
    <div class="row spread wrap"><h2>Today’s outcome</h2>${action(plan ? 'Edit outcome' : 'Choose an outcome', 'choose-priority')}</div>
    ${plan?.outcome ? `<p>${escape(plan.outcome)}</p>` : ''}
    ${task ? `<p class="small">${done(task, date) ? 'Completed · ' : ''}${escape(task.title)}</p>` : ''}
    ${plannedMinutes || shortlistMinutes ? `<p class="small">${plannedMinutes} min in scheduled blocks · ${shortlistMinutes} min estimated in your shortlist${overlapCount ? ` · ${overlapCount} overlapping block pair${overlapCount === 1 ? '' : 's'}` : ''}</p>` : ''}
    <div class="row wrap">${state.notes.length ? action(`Review captures (${state.notes.length})`, 'nav', 'capture') : ''}${action('Close the day', 'end-day')}</div>
  </section>`;
}

export function habitSummary(task, date, timezone) {
  if (task.repeat === 'none') return '';
  const entries = habitOpportunities(task, addDays(date, -27), date, timezone).reverse();
  return `<section class="productivity-panel">
    <h3>Recent habit opportunities</h3>
    ${entries.length ? `<ul>${entries.map(entry => `<li><time>${entry.date}</time> · ${entry.completed} logged · ${entry.rest} planned rest${entry.missed ? ` · ${entry.missed} missed` : ''}</li>`).join('')}</ul>` : '<p>No scheduled opportunities in this period.</p>'}
  </section>`;
}

export function focusTools({ active, task, quiet }) {
  return `<div class="row wrap productivity-panel">
    ${active && task ? action('Save where I am', 'leave-runway', task.id) : ''}
    ${active ? action('Capture a thought', 'quick-capture') + action('Take a short break', 'take-focus-break') + action('Reset after a distraction', 'focus-reset-plan') : action('Prepare my focus', 'focus-setup')}
    ${quiet ? '<span class="small">Quiet focus on</span>' : ''}
  </div>`;
}

export function experimentSummary(entries) {
  const groups = [
    ...focusConditions.map(([condition, label]) => [label, entries.filter(entry => entry.kind === 'audio' && entry.condition === condition)]),
    ['Browsing reset', entries.filter(entry => entry.kind === 'reset')]
  ];
  return `<table class="productivity-table">
    <caption>Last 30 days on this device</caption>
    <thead><tr><th scope="col">Condition</th><th scope="col">Logged</th><th scope="col">Advanced</th><th scope="col">Skipped</th><th scope="col">Average friction</th></tr></thead>
    <tbody>${groups.map(([label, rows]) => {
      const ratings = rows.filter(row => Number.isInteger(row.friction) && row.friction > 0);
      const friction = ratings.length ? (ratings.reduce((sum, row) => sum + row.friction, 0) / ratings.length).toFixed(1) + ' / 5' : '–';
      return `<tr><th scope="row">${label}</th><td>${rows.length}</td><td>${rows.filter(row => row.outcome === 'advanced').length}</td><td>${rows.filter(row => row.outcome === 'skipped').length}</td><td>${friction}</td></tr>`;
    }).join('')}</tbody>
  </table>`;
}
