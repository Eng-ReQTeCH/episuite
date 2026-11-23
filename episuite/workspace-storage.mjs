import { writeFile, rename } from 'node:fs/promises';

export const backupMaxBytes = 64 * 1024 * 1024;

export async function readJson(req, maxBytes = 5_000_000) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      req.resume();
      throw Object.assign(new Error('Request is too large.'), { status: 413 });
    }
    chunks.push(chunk);
  }
  try {
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes));
    const value = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
    return value;
  } catch {
    throw Object.assign(new Error('Send a valid UTF-8 JSON object.'), { status: 400 });
  }
}

export async function writeWorkspace(file, state) {
  await writeFile(`${file}.tmp`, JSON.stringify(state), { mode: 0o600 });
  await rename(`${file}.tmp`, file);
}
