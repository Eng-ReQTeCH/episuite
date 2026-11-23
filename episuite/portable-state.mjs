import { publicNotifications } from './notifications.mjs';

export function portableState(state) {
  const data = structuredClone(state);
  delete data.screentime;
  delete data.automation;
  for (const purchase of data.purchases) if (purchase.kind === 'screentime') { delete purchase.key; purchase.used = true; }
  data.notifications = publicNotifications(data.notifications);
  data.notifications.jobs = [];
  data.calendar.password = '';
  if (data.archivedLegacy) data.archivedLegacy = JSON.parse(JSON.stringify(data.archivedLegacy, (key, value) => /password|token|secret/i.test(key) ? undefined : value));
  return data;
}
