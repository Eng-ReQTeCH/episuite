import { getDb } from '../db/connection.js';

export function recordBlockFeedback(dayId, blockId, completed) {
  const db = getDb();
  db.prepare(`
    INSERT INTO block_feedback (id, day_id, block_id, completed)
    VALUES (?, ?, ?, ?)
  `).run(crypto.randomUUID(), dayId, blockId, completed ? 1 : 0);
}

export function getVelocityScore(dayId) {
  const db = getDb();
  const stats = db.prepare(`
    SELECT COUNT(*) as total, SUM(completed) as done
    FROM block_feedback WHERE day_id = ?
  `).get(dayId);
  if (!stats || stats.total === 0) return null;
  return { score: Math.round((stats.done / stats.total) * 100), total: stats.total, done: stats.done };
}

export function ensureFeedbackTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS block_feedback (
      id TEXT PRIMARY KEY,
      day_id TEXT NOT NULL,
      block_id TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
      FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
    );
  `);
}
