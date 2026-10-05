import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = [];
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '__pycache__', 'guides', '.git', '.agents', 'data'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(py|js|jsx|html|css|json|yml|md)$/.test(file)) {
      const source = await readFile(file, 'utf8');
      files.push({ file: path.relative(root, file).replaceAll('\\', '/'), lines: source.split('\n').length, bytes: Buffer.byteLength(source), sha256: createHash('sha256').update(source).digest('hex'),
        routes: [...source.matchAll(/@app\.route\(([^\n]+)|(?:fastify|app)\.(?:get|post|put|patch|delete)\(([^\n]+)/g)].map(m => (m[1] || m[2]).trim()),
        functions: [...source.matchAll(/(?:async )?function (\w+)|^def (\w+)|^export function (\w+)/gm)].map(m => m[1] || m[2] || m[3]) });
    }
  }
}
for (const name of ['EpiApps', 'EpiAppsTest', 'epiblock']) await scan(path.join(root, name));
const result = { generated: new Date().toISOString(), excluded: 'Vendored Zepp guides, private user data, Python bytecode and dependency directories', files };
await writeFile(path.join(root, 'episuite', 'SOURCE-INVENTORY.json'), JSON.stringify(result, null, 2));
console.log(`Inventoried ${files.length} source/config files, ${files.reduce((n, f) => n + f.lines, 0)} lines.`);
for (const name of ['epiproducitv', 'epidoro', 'epimix']) {
  const a = files.find(f => f.file === `EpiApps/${name}/app.py`), b = files.find(f => f.file === `EpiAppsTest/${name}/app.py`);
  console.log(`${name}: original ${a.lines} lines / ${a.routes.length} routes; test ${b.lines} lines / ${b.routes.length} routes; identical=${a.sha256 === b.sha256}`);
}
