import { escapeHTML as e } from './life.js';

export function backupControls() {
  return `<div class="productivity-panel"><h3>Automatic snapshots</h3><p class="small">Review backup freshness, check a snapshot, or restore a saved version.</p><button class="btn secondary compact" type="button" data-action="backup-status">Manage automatic backups</button></div>`;
}

export function backupTools({ request, getState, render, showDialog, closeDialog, field, toast }) {
  const button = (label, action, id = '') => `<button class="btn secondary compact" type="button" data-action="${action}" data-id="${e(id)}">${label}</button>`;
  let restoreData = null;
  return {
    async handle(name, id) {
      if (!name.startsWith('backup-')) return false;
      if (name === 'backup-status') {
        const response = await fetch('/api/backups');
        if (!response.ok) throw Error('Could not read backup status.');
        const status = await response.json(), settings = getState().settings, latest = status.files[0];
        const overdue = !latest || Date.now() - latest.at > (status.intervalHours ?? 24) * 3600000;
        showDialog('Automatic backups', `<p>${latest ? 'Latest snapshot · ' + e(new Date(latest.at).toLocaleString()) : 'No snapshots yet.'}</p>
          <p role="status">${status.enabled === false ? 'Scheduled snapshots are paused.' : overdue ? 'A fresh snapshot is due.' : 'Your snapshot is up to date.'}</p>
          ${status.lastError ? `<p role="status">${e(status.lastError)}</p>` : ''}
          <p class="small">Snapshot folder · ${e(status.directory)}</p>
          <p class="small">For a separate disk or network backup, mount that destination and set EPISUITE_BACKUP_DIR. Docker supports EPISUITE_BACKUP_PATH on the host.</p>
          <form data-form="backup-settings"><label><input type="checkbox" name="backupEnabled" ${settings.backupEnabled !== false ? 'checked' : ''}> Create scheduled snapshots while the server is running</label>
            ${field('Hours between snapshots','backupIntervalHours',settings.backupIntervalHours ?? 24,'number','min="1" max="168" required')}
            ${field('Snapshots to keep','backupKeep',settings.backupKeep ?? 14,'number','min="1" max="90" required')}
            <button type="submit" class="btn primary compact">Save backup schedule</button></form>
          <div class="row wrap">${button('Back up now','backup-create')}</div>
          <h3>Saved versions</h3>${status.files.map(file => `<article class="note-row"><p>${e(new Date(file.at).toLocaleString())} · ${Math.ceil(file.bytes / 1024)} KB</p><div class="row wrap">${button('Check backup','backup-verify',file.name)}${button('Restore','backup-restore',file.name)}<a class="btn text compact" href="/api/backups/${file.name}" download="${file.name}">Download</a></div></article>`).join('')}`);
        return true;
      }
      if (name === 'backup-create') { await request('/api/backups/create', {}); await this.handle('backup-status'); toast('Snapshot saved and checked.'); return true; }
      if (name === 'backup-verify') {
        const result = await request('/api/backups/' + id + '/verify', {});
        toast('Integrity and restore format checked · ' + result.tasks + ' tasks, ' + result.books + ' books.');
        return true;
      }
      if (name === 'backup-restore') {
        const response = await fetch('/api/backups/' + id);
        if (!response.ok) throw Error('This snapshot could not be read or verified.');
        restoreData = await response.json();
        showDialog('Restore this snapshot?', `<p>Restore ${restoreData.tasks.length} tasks and ${restoreData.reading?.books?.length || 0} books from this saved version? A recovery copy of your current workspace is saved first.</p>${button('Restore saved version','backup-confirm-restore')}`);
        return true;
      }
      if (name === 'backup-confirm-restore' && restoreData) {
        await request('/api/import', restoreData); restoreData = null;
        closeDialog(); render(); toast('Saved version restored.'); return true;
      }
      return false;
    },
    async submit(type, data, form) {
      if (type !== 'backup-settings') return false;
      await request('/api/settings', { ...data, backupEnabled: form.elements.backupEnabled.checked });
      closeDialog(); render(); toast('Backup schedule saved.'); return true;
    }
  };
}
