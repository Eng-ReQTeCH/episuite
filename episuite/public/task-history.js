import { escapeHTML as e } from './life.js';

export function taskHistoryTools({ getState, today, request, showDialog, closeDialog, render, field, select, button, toast, heatmap, habitSummary }) {
  function show(id, date = today()) {
    const state = getState(), task = state.tasks.find(item => item.id === id);
    const entries = task.history[date] || [];
    showDialog(task.title, heatmap(Object.fromEntries(Object.entries(task.history || {}).map(([day, items]) => [day, items.length])), today(), 'Completion history') +
      `<p>Log a missed check-off, move an entry to its correct day, or remove a mistake. Moving preserves its reward; removal reverses it.</p>
      <form data-form="task-history-add"><input type="hidden" name="id" value="${e(id)}"><input type="hidden" name="expectedVersion" value="${task.editVersion || 0}">
      ${field('Activity date', 'date', date, 'date', `required max="${today()}"`)}
      <div class="row wrap">${button('View this day', 'task-history-day', id)}<button type="submit" class="btn primary compact">Log check-off on this day</button></div></form>
      <h3>Check-offs · ${e(date)}</h3>${entries.length ? entries.map((entry,index) => {
        const owned = state.reading?.credits.some(credit => credit.completionIds?.includes(entry.id));
        return `<article class="note-row"><p>Check-off ${index+1} · ${Number(entry.coins)||0} coins</p>${owned ? '<p class="small">Linked reading: correct this entry from the book’s reading history.</p>' : button('Correct entry', 'task-history-entry', id + ':' + date + ':' + entry.id)}</article>`;
      }).join('') : '<p class="small">No check-offs on this day.</p>'}` + habitSummary(task, today(), state.settings.timezone));
  }
  return {
    async handle(name, id) {
      if (name === 'task-history') { show(id); return true; }
      if (name === 'task-history-day') { const input = document.querySelector('[data-form="task-history-add"] [name="date"]'); if (input.reportValidity()) show(id, input.value); return true; }
      if (name === 'task-history-entry') {
        const [taskId, from, completionId] = id.split(':');
        const task = getState().tasks.find(item => item.id === taskId);
        showDialog('Correct check-off', `<input type="hidden" name="id" value="${e(taskId)}"><input type="hidden" name="from" value="${e(from)}"><input type="hidden" name="completionId" value="${e(completionId)}"><input type="hidden" name="expectedVersion" value="${task.editVersion || 0}">
          ${select('Correction','action',[['move','Move to another date'],['remove','Remove this mistaken check-off']], 'move')}
          ${field('Activity date','date',from,'date',`required max="${today()}"`)}<p>Removing reverses this entry’s reward. Linked reading entries must be corrected in reading history.</p>`, 'task-history-correct', 'Apply correction');
        return true;
      }
      return false;
    },
    async submit(type, data) {
      if (!['task-history-add','task-history-correct'].includes(type)) return false;
      await request('/api/tasks/' + data.id + '/history', { ...data, action: type === 'task-history-add' ? 'add' : data.action });
      closeDialog(); render(); toast('Task history corrected.'); return true;
    }
  };
}
