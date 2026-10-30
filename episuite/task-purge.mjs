import {InputError} from './public/domain.js';
export function purgeTask(state, id, confirmation) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) throw Object.assign(new InputError('Task not found.'), {status: 404});
  if (!task.deleted) throw new InputError('Move this task to Recently deleted before permanently deleting it.');
  if (confirmation !== 'DELETE') throw new InputError('Type DELETE to confirm permanent deletion.');
  state.tasks = state.tasks.filter(t => t.id !== id);
  for (const block of state.blocks) block.taskIds = (block.taskIds || []).filter(taskId => taskId !== id);
  for (const template of state.templates || []) for (const block of template.blocks || []) block.taskIds = (block.taskIds || []).filter(taskId => taskId !== id);
  for (const session of state.sessions) if (session.taskId === id) session.taskId = null;
  if (state.timer?.taskId === id) state.timer.taskId = null;
  // Keep real social conversations; detach the deleted task's bookkeeping.
  for (const checkin of state.social?.checkins || []) if (checkin.taskId === id) { delete checkin.taskId; delete checkin.completionId; }
  if (state.life?.board) {
    state.life.board.graphs = state.life.board.graphs.filter(graph => graph !== `task:${id}`);
    state.life.boardVersion = (state.life.boardVersion || 0) + 1;
  }
  // Receipts contain no title/history and prevent source events being reused for another task.
  return {ok: true};
}
