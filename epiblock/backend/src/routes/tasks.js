import * as db from '../db/schema.js';

export async function taskRoutes(app) {
  app.get('/api/v1/tasks', async (req, reply) => {
    const database = req.db;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const day = db.getOrCreateDayByDate(database, date);
    const tasks = db.getTasksForDay(database, day.id);
    return { day, tasks };
  });

  app.get('/api/v1/tasks/:id', async (req, reply) => {
    const database = req.db;
    const task = database.prepare(`SELECT t.*, b.block_index FROM tasks t LEFT JOIN blocks b ON t.block_id = b.id WHERE t.id = ?`).get(req.params.id);
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    return task;
  });

  app.post('/api/v1/tasks', async (req, reply) => {
    const database = req.db;
    const { title, block_index, day_id, date, is_absolute, target_time, duration_minutes, description, color, icon, random_order } = req.body;
    if (!title) return reply.status(400).send({ error: 'title required' });

    let dayId = day_id;
    if (!dayId) {
      if (date) {
        dayId = db.getOrCreateDayByDate(database, date).id;
      } else {
        dayId = db.getOrCreateToday(database).id;
      }
    }
    let blockId = null;

    if (block_index !== undefined && block_index !== null && block_index >= 0) {
      const block = database.prepare(`SELECT id FROM blocks WHERE day_id = ? AND block_index = ?`).get(dayId, block_index);
      if (block) {
        blockId = block.id;
      } else {
        blockId = crypto.randomUUID();
        database.prepare(`INSERT INTO blocks (id, day_id, block_index) VALUES (?, ?, ?)`).run(blockId, dayId, block_index);
      }
    }

    const task = db.createTask(database, {
      dayId, blockId, title, description, isAbsolute: is_absolute, targetTime: target_time, durationMinutes: duration_minutes, color, icon, randomOrder: random_order,
    });

    return reply.status(201).send(task);
  });

  app.patch('/api/v1/tasks/:id', async (req, reply) => {
    const database = req.db;
    const existing = database.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);
    if (!existing) return reply.status(404).send({ error: 'Task not found' });

    const fields = {};
    const allowed = ['title', 'description', 'status', 'is_absolute', 'target_time', 'duration_minutes', 'block_id', 'sort_order', 'color', 'random_order', 'icon'];
    for (const k of allowed) {
      if (req.body[k] !== undefined) fields[k] = req.body[k];
    }

    if (req.body.block_index !== undefined) {
      if (req.body.block_index === null || req.body.block_index < 0) {
        fields.block_id = null;
      } else {
        const dayId = existing.day_id;
        const block = database.prepare(`SELECT id FROM blocks WHERE day_id = ? AND block_index = ?`).get(dayId, req.body.block_index);
        if (block) {
          fields.block_id = block.id;
        } else {
          const newId = crypto.randomUUID();
          database.prepare(`INSERT INTO blocks (id, day_id, block_index) VALUES (?, ?, ?)`).run(newId, dayId, req.body.block_index);
          fields.block_id = newId;
        }
      }
    }

    if (req.body.status === 'completed') {
      fields.completed_at = new Date().toISOString();
    }

    const updated = db.updateTask(database, req.params.id, fields);
    return updated;
  });

  app.post('/api/v1/tasks/clear-remaining', async (req, reply) => {
    const database = req.db;
    const date = req.body?.date || new Date().toISOString().split('T')[0];
    const day = db.getDayByDate(database, date);
    if (!day) return reply.status(404).send({ error: 'No day found' });
    database.prepare(`DELETE FROM tasks WHERE day_id = ? AND status != 'completed'`).run(day.id);
    return { success: true };
  });

  app.get('/api/v1/tasks/sidebar', async (req, reply) => {
    const database = req.db;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const day = db.getOrCreateDayByDate(database, date);
    const tasks = db.getSidebarTasks(database, day.id);
    return { day, tasks };
  });

  app.post('/api/v1/tasks/sidebar', async (req, reply) => {
    const database = req.db;
    const { title, day_id, date, description, color, icon } = req.body;
    if (!title) return reply.status(400).send({ error: 'title required' });
    let dayId = day_id;
    if (!dayId) {
      if (date) {
        dayId = db.getOrCreateDayByDate(database, date).id;
      } else {
        dayId = db.getOrCreateToday(database).id;
      }
    }
    const task = db.createSidebarTask(database, { dayId, title, description, color, icon });
    return reply.status(201).send(task);
  });

  app.delete('/api/v1/tasks/:id', async (req, reply) => {
    const database = req.db;
    const existing = database.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);
    if (!existing) return reply.status(404).send({ error: 'Task not found' });
    database.prepare(`DELETE FROM tasks WHERE id = ?`).run(req.params.id);
    return { success: true };
  });
}
