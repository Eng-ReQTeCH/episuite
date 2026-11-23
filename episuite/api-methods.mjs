const getRoutes = new Set([
  '/api/state', '/api/health', '/api/cosmetics', '/api/export',
  '/api/calendar.ics', '/api/v1/day', '/api/automation/tasks', '/api/books/search'
]);
const postRoutes = new Set([
  '/api/ai/breakdown', '/api/day/priority', '/api/weekly-review',
  '/api/automation/token', '/api/automation/complete', '/api/life/board', '/api/life/shortcuts',
  '/api/screentime/redeem', '/api/reward-events/config', '/api/notifications/config', '/api/notifications/test',
  '/api/social/circles', '/api/social/people', '/api/social/checkins', '/api/social/checkins/delete', '/api/social/contact-task',
  '/api/engagement', '/api/engagement/feeling', '/api/onboarding', '/api/tasks', '/api/blocks',
  '/api/blocks/skip', '/api/blocks/feedback', '/api/schedule/shift', '/api/day/wake', '/api/day/end',
  '/api/checkin', '/api/templates/save', '/api/templates/apply', '/api/templates/delete', '/api/day/clone',
  '/api/timer/start', '/api/timer/pause', '/api/timer/resume', '/api/timer/finish', '/api/timer/reset',
  '/api/notes', '/api/notes/convert', '/api/notes/delete', '/api/categories', '/api/rewards',
  '/api/rewards/delete', '/api/rewards/buy', '/api/redeem/start', '/api/redeem/stop', '/api/quests/claim',
  '/api/cosmetics/equip', '/api/settings', '/api/import', '/api/calendar/config',
  '/api/calendar/sync', '/api/calendar/delete', '/api/books', '/api/reading/task'
]);

export function assertApiMethod(path, method) {
  let allowed;
  if (getRoutes.has(path)) allowed = ['GET'];
  else if (postRoutes.has(path)) allowed = ['POST'];
  else if (/^\/api\/books\/[^/]+\/log$/.test(path)) allowed = ['POST'];
  else if (/^\/api\/books\/[^/]+$/.test(path)) allowed = ['PATCH', 'DELETE'];
  else if (/^\/api\/tasks\/[^/]+\/purge$/.test(path)) allowed = ['DELETE'];
  else if (/^\/api\/tasks\/[^/]+\/(complete|restore|move|undo|habit)$/.test(path)) allowed = ['POST'];
  else if (/^\/api\/(tasks|blocks|social\/people|social\/circles|life\/shortcuts)\/[^/]+$/.test(path)) allowed = ['PATCH', 'DELETE'];
  else if (/^\/api\/rewards\/[^/]+$/.test(path)) allowed = ['PATCH'];
  if (allowed && !allowed.includes(method)) {
    throw Object.assign(new Error('Use ' + allowed.join(' or ') + ' for this operation.'), { status: 405 });
  }
}
