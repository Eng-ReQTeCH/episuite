import { readdir, readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['data', 'test-results'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await check(file);
    else if (/\.(mjs|js)$/.test(file)) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr);
    }
  }
}
await check(root);
for (const file of ['public/index.html', 'public/styles.css', 'public/app.js', 'public/domain.js', 'public/calendar.js', 'public/engagement.js', 'public/sw.js', 'public/icon.svg', 'public/manifest.webmanifest', 'public/cosmetics.json']) {
  if (!(await stat(path.join(root, file))).size) throw new Error(`Empty asset: ${file}`);
}
JSON.parse(await readFile(path.join(root, 'public/manifest.webmanifest')));
console.log('Episuite source checks passed');
