import * as db from '../db/schema.js';
import { calculateBlockTimes, getCurrentAndNextBlocks, shiftBlocks } from '../services/scheduler.js';

export async function blockRoutes(app) {
  app.get('/api/v1/blocks/active', async (req, reply) => {
    const database = req.db;
    const today = new Date().toISOString().split('T')[0];
    const day = db.getDayByDate(database, today);
    if (!day || !day.wakeup_time) {
      return reply.status(400).send({ error: 'Not woken up today', day });
    }
    const blocks = db.getBlocksForDay(database, day.id);
    const blocksWithTasks = blocks.map(b => ({
      ...b,
      tasks: db.getTasksForBlock(database, b.id),
    }));
    const result = getCurrentAndNextBlocks(day.wakeup_time, blocksWithTasks);
    return result;
  });

  app.get('/api/v1/blocks', async (req, reply) => {
    const database = req.db;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const day = db.getOrCreateDayByDate(database, date);
    const blocks = db.getBlocksForDay(database, day.id);
    const blocksWithTasks = blocks.map(b => ({
      ...b,
      tasks: db.getTasksForBlock(database, b.id),
    }));

    const withTimes = day.wakeup_time
      ? calculateBlockTimes(day.wakeup_time, blocksWithTasks)
      : blocksWithTasks.map(b => ({ ...b, start: null, end: null }));

    return { day, blocks: withTimes };
  });

  app.post('/api/v1/blocks/shift', async (req, reply) => {
    const database = req.db;
    const today = new Date().toISOString().split('T')[0];
    const day = db.getDayByDate(database, today);
    if (!day || !day.wakeup_time) {
      return reply.status(400).send({ error: 'Not woken up today' });
    }
    const minutes = req.body?.minutes || 15;
    const blocks = db.getBlocksForDay(database, day.id);
    const blocksWithTasks = blocks.map(b => ({
      ...b,
      tasks: db.getTasksForBlock(database, b.id),
    }));
    const shifted = shiftBlocks(day.wakeup_time, blocksWithTasks, minutes);
    return { blocks: shifted };
  });

  app.post('/api/v1/blocks/feedback', async (req, reply) => {
    const database = req.db;
    const { block_id, completed } = req.body;
    if (!block_id || completed === undefined) {
      return reply.status(400).send({ error: 'block_id and completed required' });
    }
    const block = database.prepare(`SELECT * FROM blocks WHERE id = ?`).get(block_id);
    if (!block) return reply.status(404).send({ error: 'Block not found' });
    recordBlockFeedback(block.day_id, block_id, completed);
    return { success: true };
  });
}
