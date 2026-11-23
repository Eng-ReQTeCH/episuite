import { mkdir, readdir, readFile, writeFile, rename, unlink, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { backupMaxBytes } from './workspace-storage.mjs';

const validName = name => /^snapshot-\d{13}-[a-f0-9-]{36}\.json$/.test(name);
const checksum = text => createHash('sha256').update(text).digest('hex');

export function createBackups({ directory, getSnapshot, getSettings, validate }) {
  directory = path.resolve(directory);
  let queue = Promise.resolve(), lastError = '', verifiedAt = 0;
  async function list() {
    let names;
    try { names = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    const files = [];
    for (const name of names.filter(validName).sort().reverse()) {
      const info = await stat(path.join(directory, name));
      files.push({ name, at: Number(name.slice(9, 22)), bytes: info.size });
    }
    return files;
  }
  async function verify(name) {
    if (!validName(name)) throw Object.assign(Error('Choose a saved backup.'), { status: 400 });
    const file = path.join(directory, name);
    const text = await readFile(file, 'utf8');
    const hash = (await readFile(file + '.sha256', 'utf8')).trim();
    if (checksum(text) !== hash) throw Object.assign(Error('This backup failed its integrity check.'), { status: 400 });
    const data = JSON.parse(text);
    validate(data);
    verifiedAt = Date.now();
    return { ok: true, name, verifiedAt, tasks: data.tasks.length, books: data.reading?.books?.length || 0 };
  }
  async function create(now = Date.now()) {
    const work = queue.then(async () => {
      try {
        const data = await getSnapshot(), text = JSON.stringify(data);
        if (Buffer.byteLength(text) > backupMaxBytes) throw Error('The workspace exceeds the portable snapshot limit.');
        validate(data);
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const name = 'snapshot-' + now + '-' + randomUUID() + '.json', file = path.join(directory, name);
        await writeFile(file + '.tmp', text, { mode: 0o600 });
        await writeFile(file + '.sha256', checksum(text), { mode: 0o600 });
        await rename(file + '.tmp', file);
        await verify(name);
        const keep = getSettings().backupKeep ?? 14;
        for (const old of (await list()).slice(keep)) {
          await unlink(path.join(directory, old.name));
          await unlink(path.join(directory, old.name + '.sha256')).catch(() => {});
        }
        lastError = '';
        return { ok: true, name };
      } catch (error) {
        lastError = error.message;
        throw error;
      }
    });
    queue = work.catch(() => {});
    return work;
  }
  return {
    create, verify,
    async read(name) { await verify(name); return JSON.parse(await readFile(path.join(directory, name), 'utf8')); },
    async status() {
      try {
        return { files: await list(), directory, enabled: getSettings().backupEnabled !== false, intervalHours: getSettings().backupIntervalHours ?? 24, keep: getSettings().backupKeep ?? 14, lastError, verifiedAt };
      } catch (error) { return { files: [], directory, lastError: error.message, enabled: getSettings().backupEnabled !== false }; }
    },
    async runDue(now) {
      if (getSettings().backupEnabled === false) return;
      try {
        const latest = (await list())[0];
        if (!latest || now - latest.at >= (getSettings().backupIntervalHours ?? 24) * 3600000) await create(now);
      } catch (error) { lastError = error.message; }
    },
    close: () => queue
  };
}
