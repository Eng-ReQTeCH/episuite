const BASE = '/api/v1';

async function request(path, opts = {}) {
  const headers = { ...opts.headers };
  if (opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { headers, ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  wakeup: (timestamp) =>
    request('/lifecycle/wakeup', { method: 'POST', body: JSON.stringify({ timestamp }) }),

  shiftLater: (minutes) =>
    request('/lifecycle/later', { method: 'POST', body: JSON.stringify({ minutes }) }),

  prepDay: (date) =>
    request('/lifecycle/prep', { method: 'POST', body: JSON.stringify({ date }) }),

  finalizeDay: (date) =>
    request('/lifecycle/finalize', { method: 'POST', body: JSON.stringify({ date }) }),

  getActiveBlocks: () => request('/blocks/active'),

  getBlocks: (date) => request(`/blocks${date ? `?date=${date}` : ''}`),

  shiftBlocks: (minutes) =>
    request('/blocks/shift', { method: 'POST', body: JSON.stringify({ minutes }) }),

  getTasks: (date) => request(`/tasks${date ? `?date=${date}` : ''}`),

  createTask: (data) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }),

  updateTask: (id, data) =>
    request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteTask: (id) =>
    request(`/tasks/${id}`, { method: 'DELETE' }),

  clearRemaining: (date) =>
    request(`/tasks/clear-remaining`, { method: 'POST', body: JSON.stringify({ date }) }),

  getSidebarTasks: (date) => request(`/tasks/sidebar${date ? `?date=${date}` : ''}`),

  createSidebarTask: (data) =>
    request('/tasks/sidebar', { method: 'POST', body: JSON.stringify(data) }),

  assignTaskToBlock: (id, blockIndex) =>
    request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ block_index: blockIndex }) }),

  blockFeedback: (blockId, completed) =>
    request('/blocks/feedback', { method: 'POST', body: JSON.stringify({ block_id: blockId, completed }) }),

  getVelocity: () => request('/velocity'),

  health: () => request('/health'),
};
