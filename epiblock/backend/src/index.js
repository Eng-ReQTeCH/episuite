import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { getDb } from './db/connection.js';
import { initializeDatabase } from './db/schema.js';
import { ensureFeedbackTable } from './services/flowtracker.js';
import { reconcileDay } from './db/schema.js';
import { lifecycleRoutes } from './routes/lifecycle.js';
import { taskRoutes } from './routes/tasks.js';
import { blockRoutes } from './routes/blocks.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(websocket);

const db = getDb();
ensureFeedbackTable(db);

app.addHook('onRequest', async (req) => {
  req.db = getDb();
});

app.addHook('onRequest', async (req) => {
  const today = new Date().toISOString().split('T')[0];
  let day = db.prepare(`SELECT * FROM days WHERE date = ?`).get(today);
  if (!day) {
    reconcileDay(db);
  }
});

await lifecycleRoutes(app);
await taskRoutes(app);
await blockRoutes(app);

app.get('/api/v1/velocity', async (req, reply) => {
  const database = req.db;
  const today = new Date().toISOString().split('T')[0];
  const day = database.prepare(`SELECT * FROM days WHERE date = ?`).get(today);
  if (!day) return { score: null };
  const stats = database.prepare(`
    SELECT COUNT(*) as total, SUM(completed) as done
    FROM block_feedback WHERE day_id = ?
  `).get(day.id);
  if (!stats || stats.total === 0) return { score: null };
  return { score: Math.round((stats.done / stats.total) * 100), total: stats.total, done: stats.done };
});

app.get('/api/v1/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

app.register(async function (fastify) {
  fastify.get('/api/v1/live', { websocket: true }, (socket, req) => {
    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch { }
    });

    const interval = setInterval(() => {
      const today = new Date().toISOString().split('T')[0];
      const day = db.prepare(`SELECT * FROM days WHERE date = ?`).get(today);
      if (day?.wakeup_time) {
        const blocks = db.prepare(`SELECT * FROM blocks WHERE day_id = ? ORDER BY block_index`).all(day.id);
        const blocksWithTasks = blocks.map(b => ({
          ...b,
          tasks: db.prepare(`SELECT * FROM tasks WHERE block_id = ? ORDER BY sort_order`).all(b.id),
        }));
        socket.send(JSON.stringify({ type: 'BLOCKS_UPDATE', blocks: blocksWithTasks }));
      }
    }, 15000);

    socket.on('close', () => clearInterval(interval));
  });
});

try {
  const port = parseInt(process.env.PORT || '3001');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`EpiBlock backend running on port ${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
