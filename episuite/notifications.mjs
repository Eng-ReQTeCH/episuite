export const notificationDefaults = { enabled: false, provider: 'ntfy', ntfyUrl: '', topic: '', ntfyToken: '', botToken: '', chatId: '', boosts: true, reminders: true, timers: true };
const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
export function notificationConfig(input, previous = notificationDefaults) {
  const next = { ...notificationDefaults, ...previous };
  for (const key of ['enabled','boosts','reminders','timers']) if (key in input) next[key] = Boolean(input[key]);
  for (const key of ['provider','ntfyUrl','topic','chatId']) if (key in input) next[key] = String(input[key]).trim().slice(0,2000);
  for (const key of ['ntfyToken','botToken']) { if (input[key]) next[key] = String(input[key]).trim().slice(0,500); if (input['clear' + key[0].toUpperCase() + key.slice(1)]) next[key] = ''; }
  if (!['ntfy','telegram'].includes(next.provider)) invalid('Choose ntfy or Telegram.');
  if (next.ntfyUrl) { let url; try { url = new URL(next.ntfyUrl); } catch { invalid('Choose a valid ntfy server URL.'); } if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) invalid('Use an HTTP or HTTPS ntfy server URL without credentials or query parameters.'); next.ntfyUrl = url.href.replace(/\/$/, ''); }
  if (next.topic && !/^[A-Za-z0-9_-]{1,128}$/.test(next.topic)) invalid('Use a topic with letters, numbers, underscores or hyphens.');
  if (next.botToken && !/^\d+:[A-Za-z0-9_-]+$/.test(next.botToken)) invalid('Enter the Telegram bot token from BotFather.');
  if (next.chatId && !/^-?\d+$/.test(next.chatId)) invalid('Enter your numeric Telegram chat ID.');
  if (next.enabled && (next.provider === 'ntfy' ? !next.ntfyUrl || !next.topic : !next.botToken || !next.chatId)) invalid('Complete the selected phone connection first.');
  return next;
}
export function publicNotifications(value) {
  return { ...value, config: { ...value.config, botToken: '', ntfyToken: '', botConfigured: Boolean(value.config.botToken), ntfyConfigured: Boolean(value.config.ntfyToken) } };
}
export function enqueueNotification(state, id, kind, title, message, now, expiresAt = now + 3600000) {
  const n = state.notifications;
  if (!n.config.enabled || kind !== 'test' && !n.config[kind] || n.jobs.some(j => j.id === id)) return;
  n.jobs.push({ id, kind, title, message, createdAt: now, expiresAt, nextAt: now, attempts: 0, status: 'pending' });
  // Keep pending work, and a bounded receipt history for deduplication.
  n.jobs = [...n.jobs.filter(j => j.status !== 'pending').slice(-200), ...n.jobs.filter(j => j.status === 'pending').slice(-200)];
}
export async function sendNotification(config, job, transport = fetch) {
  let url, headers = { 'Content-Type': 'application/json' }, body;
  if (config.provider === 'ntfy') {
    url = config.ntfyUrl;
    if (config.ntfyToken) headers.Authorization = `Bearer ${config.ntfyToken}`;
    body = { topic: config.topic, title: job.title, message: job.message, priority: 3 };
  } else {
    url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    body = { chat_id: config.chatId, text: `${job.title}\n${job.message}` };
  }
  const response = await transport(url, { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
  if (config.provider === 'telegram' && !(await response.json()).ok) throw new Error('Telegram rejected the message.');
}
