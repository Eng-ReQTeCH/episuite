export function initializeDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS days (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      wakeup_time TEXT,
      is_active INTEGER NOT NULL DEFAULT 0,
      is_finalized INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      day_id TEXT NOT NULL,
      block_index INTEGER NOT NULL CHECK(block_index >= 0 AND block_index <= 95),
      is_pinned INTEGER NOT NULL DEFAULT 0,
      pinned_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
      UNIQUE(day_id, block_index)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      day_id TEXT NOT NULL,
      block_id TEXT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','rolled_over')),
      is_absolute INTEGER NOT NULL DEFAULT 0,
      target_time TEXT,
      duration_minutes INTEGER DEFAULT 15,
      sort_order INTEGER DEFAULT 0,
      color TEXT DEFAULT 'slate',
      icon TEXT DEFAULT '',
      random_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
      FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS template_blocks (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      block_index INTEGER NOT NULL CHECK(block_index >= 0 AND block_index <= 95),
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
      UNIQUE(template_id, block_index)
    );

    CREATE TABLE IF NOT EXISTS template_tasks (
      id TEXT PRIMARY KEY,
      template_block_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_absolute INTEGER NOT NULL DEFAULT 0,
      target_time TEXT,
      duration_minutes INTEGER DEFAULT 15,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (template_block_id) REFERENCES template_blocks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_blocks_day ON blocks(day_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_day ON tasks(day_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_block ON tasks(block_id);
    CREATE INDEX IF NOT EXISTS idx_days_date ON days(date);
  `);

  try { db.exec(`ALTER TABLE tasks RENAME TO tasks_old`); } catch {}
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        day_id TEXT NOT NULL,
        block_id TEXT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','rolled_over')),
        is_absolute INTEGER NOT NULL DEFAULT 0,
        target_time TEXT,
        duration_minutes INTEGER DEFAULT 15,
        sort_order INTEGER DEFAULT 0,
        color TEXT DEFAULT 'slate',
        icon TEXT DEFAULT '',
        random_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
        FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
      );
    `);
  } catch {}
  try { db.exec(`INSERT OR IGNORE INTO tasks SELECT * FROM tasks_old; DROP TABLE tasks_old;`); } catch {}
}

export function createDay(db, date) {
  const id = crypto.randomUUID();
  const stmt = db.prepare(
    `INSERT INTO days (id, date) VALUES (?, ?)`
  );
  stmt.run(id, date);
  return getDay(db, id);
}

export function getDay(db, id) {
  return db.prepare(`SELECT * FROM days WHERE id = ?`).get(id);
}

export function getDayByDate(db, date) {
  return db.prepare(`SELECT * FROM days WHERE date = ?`).get(date);
}

export function getOrCreateToday(db) {
  const today = new Date().toISOString().split('T')[0];
  let day = getDayByDate(db, today);
  if (!day) {
    day = createDay(db, today);
    createBlocksForDay(db, day.id);
  }
  return day;
}

export function getOrCreateDayByDate(db, date) {
  let day = getDayByDate(db, date);
  if (!day) {
    day = createDay(db, date);
    createBlocksForDay(db, day.id);
  }
  return day;
}

export function createBlocksForDay(db, dayId) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO blocks (id, day_id, block_index) VALUES (?, ?, ?)`
  );
  const insertMany = db.transaction((dayId) => {
    for (let i = 0; i < 96; i++) {
      insert.run(crypto.randomUUID(), dayId, i);
    }
  });
  insertMany(dayId);
}

export function getBlocksForDay(db, dayId) {
  return db.prepare(
    `SELECT * FROM blocks WHERE day_id = ? ORDER BY block_index ASC`
  ).all(dayId);
}

export function getTasksForBlock(db, blockId) {
  return db.prepare(
    `SELECT * FROM tasks WHERE block_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).all(blockId);
}

export function getTasksForDay(db, dayId) {
  return db.prepare(
    `SELECT t.*, b.block_index FROM tasks t
     LEFT JOIN blocks b ON t.block_id = b.id
     WHERE t.day_id = ? ORDER BY b.block_index ASC, t.sort_order ASC`
  ).all(dayId);
}

export function getSidebarTasks(db, dayId) {
  return db.prepare(
    `SELECT * FROM tasks WHERE day_id = ? AND block_id IS NULL ORDER BY sort_order ASC, created_at ASC`
  ).all(dayId);
}

export function createSidebarTask(db, { dayId, title, description, color, icon }) {
  const id = crypto.randomUUID();
  const stmt = db.prepare(
    `INSERT INTO tasks (id, day_id, block_id, title, description, color, icon)
     VALUES (?, ?, NULL, ?, ?, ?, ?)`
  );
  stmt.run(id, dayId, title, description || '', color || 'slate', icon || '');
  return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
}

export function setWakeup(db, dayId, timestamp) {
  const stmt = db.prepare(
    `UPDATE days SET wakeup_time = ?, is_active = 1, updated_at = datetime('now') WHERE id = ?`
  );
  stmt.run(timestamp, dayId);
  return getDay(db, dayId);
}

export function createTask(db, { dayId, blockId, title, description, isAbsolute, targetTime, durationMinutes, color, icon, randomOrder }) {
  const id = crypto.randomUUID();
  const stmt = db.prepare(
    `INSERT INTO tasks (id, day_id, block_id, title, description, is_absolute, target_time, duration_minutes, color, icon, random_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(id, dayId, blockId, title, description || '', isAbsolute ? 1 : 0, targetTime || null, durationMinutes || 15, color || 'slate', icon || '', randomOrder ? 1 : 0);
  return db.prepare(`SELECT t.*, b.block_index FROM tasks t LEFT JOIN blocks b ON t.block_id = b.id WHERE t.id = ?`).get(id);
}

export function updateTask(db, id, fields) {
  const allowed = ['title', 'description', 'status', 'is_absolute', 'target_time', 'duration_minutes', 'block_id', 'sort_order', 'completed_at', 'color', 'icon', 'random_order'];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (sets.length === 0) return null;
  sets.push(`updated_at = datetime('now')`);
  vals.push(id);
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare(`SELECT t.*, b.block_index FROM tasks t LEFT JOIN blocks b ON t.block_id = b.id WHERE t.id = ?`).get(id);
}

export function getOrCreateDefaultTemplate(db) {
  let tmpl = db.prepare(`SELECT * FROM templates WHERE is_default = 1`).get();
  if (!tmpl) {
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO templates (id, name, is_default) VALUES (?, 'Default Routine', 1)`).run(id);
    tmpl = { id, name: 'Default Routine', is_default: 1 };
  }
  return tmpl;
}

export function cloneTemplateToDay(db, templateId, dayId) {
  const blocks = db.prepare(`SELECT * FROM template_blocks WHERE template_id = ? ORDER BY block_index`).all(templateId);
  for (const tb of blocks) {
    const blockId = crypto.randomUUID();
    db.prepare(`INSERT INTO blocks (id, day_id, block_index) VALUES (?, ?, ?) ON CONFLICT(day_id, block_index) DO UPDATE SET id = excluded.id`).run(blockId, dayId, tb.block_index);
    const tasks = db.prepare(`SELECT * FROM template_tasks WHERE template_block_id = ?`).all(tb.id);
    for (const tt of tasks) {
      db.prepare(
        `INSERT INTO tasks (id, day_id, block_id, title, description, is_absolute, target_time, duration_minutes, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(crypto.randomUUID(), dayId, blockId, tt.title, tt.description, tt.is_absolute, tt.target_time, tt.duration_minutes, tt.sort_order);
    }
  }
}

export function finalizeDay(db, dayId, templateId) {
  const existingBlocks = db.prepare(`SELECT COUNT(*) as cnt FROM blocks WHERE day_id = ?`).get(dayId);
  if (existingBlocks.cnt === 0) {
    cloneTemplateToDay(db, templateId, dayId);
  }
  db.prepare(`UPDATE days SET is_finalized = 1, updated_at = datetime('now') WHERE id = ?`).run(dayId);
  return getDay(db, dayId);
}

export function reconcileDay(db) {
  const today = new Date().toISOString().split('T')[0];
  let day = getDayByDate(db, today);
  if (!day) {
    day = getOrCreateDayByDate(db, today);
  }
  const blocks = getBlocksForDay(db, day.id);
  if (blocks.length === 0) {
    const tmpl = getOrCreateDefaultTemplate(db);
    finalizeDay(db, day.id, tmpl.id);
  }
  return getDay(db, day.id);
}
