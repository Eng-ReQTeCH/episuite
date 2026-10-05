import * as db from '../db/schema.js';

export async function lifecycleRoutes(app) {
  app.post('/api/v1/lifecycle/wakeup', async (req, reply) => {
    const database = req.db;
    const today = new Date().toISOString().split('T')[0];
    const day = db.getOrCreateToday(database);
    if (day.is_active) {
      return reply.status(400).send({ error: 'Already woken up today' });
    }
    const timestamp = req.body?.timestamp || new Date().toISOString();
    const updated = db.setWakeup(database, day.id, timestamp);
    return { day: updated };
  });

  app.post('/api/v1/lifecycle/later', async (req, reply) => {
    const database = req.db;
    const today = new Date().toISOString().split('T')[0];
    const day = db.getDayByDate(database, today);
    if (!day || !day.is_active) {
      return reply.status(400).send({ error: 'Not woken up yet' });
    }
    const minutes = req.body?.minutes || 15;
    const wakeTime = dayjs(day.wakeup_time).subtract(minutes, 'minute').toISOString();
    db.setWakeup(database, day.id, wakeTime);
    return { shifted: true, minutes };
  });

  app.post('/api/v1/lifecycle/prep', async (req, reply) => {
    const database = req.db;
    const date = req.body?.date;
    if (!date) {
      return reply.status(400).send({ error: 'date required' });
    }
    const targetDay = db.getOrCreateDayByDate(database, date);
    const blocks = db.getBlocksForDay(database, targetDay.id);
    return { day: targetDay, blocks };
  });

  app.post('/api/v1/lifecycle/finalize', async (req, reply) => {
    const database = req.db;
    const date = req.body?.date || new Date().toISOString().split('T')[0];
    const targetDay = db.getOrCreateDayByDate(database, date);
    const tmpl = db.getOrCreateDefaultTemplate(database);
    const finalized = db.finalizeDay(database, targetDay.id, tmpl.id);
    return { day: finalized };
  });
}
