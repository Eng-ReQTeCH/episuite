const forms = new Set(['task', 'runway', 'weekly-review', 'end-day', 'book-save', 'book-log', 'book-log-edit', 'project', 'capture-dialog', 'capture-inline', 'capture-page', 'quick-task', 'day-priority', 'commitment', 'social-plan', 'block']);

export function draftRecovery({ workspace, dialog, notify, refreshFields }) {
  const originals = new WeakMap();
  function key(form) {
    if (!form || !forms.has(form.dataset.form) || !workspace()) return null;
    return 'episuite.draft:' + workspace() + ':' + form.dataset.form + ':' +
      (form.elements.logId?.value || form.elements.id?.value || form.elements.draftKey?.value || 'new');
  }
  function values(form) {
    return [...form.elements].filter(input => input.name && !['password', 'file', 'submit', 'button'].includes(input.type) && !['eventId', 'operationId'].includes(input.name))
      .map(input => ({ name: input.name, type: input.type, value: input.value, checked: input.checked }));
  }
  function apply(form, fields) {
    const counts = {};
    for (const saved of fields) {
      const options = [...form.elements].filter(input => input.name === saved.name && input.type === saved.type);
      const input = options[counts[saved.name] || 0];
      counts[saved.name] = (counts[saved.name] || 0) + 1;
      if (!input) continue;
      if (input.type === 'checkbox' || input.type === 'radio') input.checked = saved.checked;
      else input.value = saved.value;
    }
  }
  function clear(form) {
    const id = key(form);
    if (id) try { localStorage.removeItem(id); } catch {}
  }
  function capture(form) {
    if (!form && !dialog.open) return;
    form ||= dialog.querySelector('form[data-form]');
    const id = key(form), initial = originals.get(form);
    if (!id || !initial) return;
    const current = values(form);
    if (JSON.stringify(current) === JSON.stringify(initial)) { clear(form); return; }
    try { localStorage.setItem(id, JSON.stringify({ at: Date.now(), fields: current })); }
    catch { notify('This browser could not save draft recovery. Keep the form open until you save.'); }
  }
  function restore(form) {
    const id = key(form);
    if (!id) return;
    const initial = values(form);
    originals.set(form, initial);
    if (form.dataset.skipDraft) return;
    let draft;
    try { draft = JSON.parse(localStorage.getItem(id)); } catch {}
    if (!Array.isArray(draft?.fields)) return;
    const freshVersion = form.elements.expectedVersion?.value;
    apply(form, draft.fields);
    refreshFields();
    const banner = document.createElement('div');
    banner.className = 'notice draft-recovered';
    const text = document.createElement('p');
    text.textContent = 'Recovered your unsaved draft.';
    banner.append(text);
    const discard = document.createElement('button');
    discard.type = 'button'; discard.className = 'btn text compact'; discard.textContent = 'Discard draft';
    discard.addEventListener('click', () => { apply(form, initial); clear(form); banner.remove(); refreshFields(); });
    banner.append(discard);
    if (freshVersion !== undefined && form.elements.expectedVersion.value !== freshVersion) {
      const details = document.createElement('details'), summary = document.createElement('summary');
      summary.textContent = 'This record changed. Review the latest saved values.';
      details.append(summary);
      for (const field of initial.filter(field => field.type !== 'hidden' && field.value)) {
        const row = document.createElement('p'); row.textContent = field.name + ' · ' + field.value; details.append(row);
      }
      const accept = document.createElement('button');
      accept.type = 'button'; accept.className = 'btn secondary compact'; accept.textContent = 'Use my reviewed draft';
      accept.addEventListener('click', () => { form.elements.expectedVersion.value = freshVersion; accept.remove(); capture(form); });
      banner.append(details, accept);
    }
    form.prepend(banner);
  }
  document.addEventListener('input', event => capture(event.target.closest('form[data-form]')));
  document.addEventListener('change', event => capture(event.target.closest('form[data-form]')));
  dialog.addEventListener('cancel', () => capture());
  window.addEventListener('pagehide', () => { capture(); document.querySelectorAll('main form[data-form]').forEach(form => capture(form)); });
  return { capture, clear, restore };
}
