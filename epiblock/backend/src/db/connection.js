import Database from 'better-sqlite3';
import { initializeDatabase } from './schema.js';

let db;

export function getDb() {
  if (!db) {
    const path = process.env.DATABASE_PATH || '/tmp/epiblock.db';
    db = new Database(path);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase(db);
  }
  return db;
}
