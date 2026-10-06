import { readdir, readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['data', 'test-results', 'node_modules'].includes(entry.name)) continue;
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
const manifest=JSON.parse(await readFile(path.join(root,'public/manifest.webmanifest')));
if(!manifest.id||manifest.start_url!=='/'||manifest.scope!=='/'||manifest.display!=='standalone')throw Error('PWA manifest is incomplete');
for(const size of ['192x192','512x512'])if(!manifest.icons.some(i=>i.sizes===size&&i.type==='image/png'))throw Error('Missing install icon '+size);
for(const file of ['public/social.js','public/social-domain.js'])if(!(await stat(path.join(root,file))).size)throw Error('Missing Social asset');
const sw=await readFile(path.join(root,'public/sw.js'),'utf8'),assetList=JSON.parse(sw.match(/const ASSETS = (\[[^;]+\]);/)[1].replace(/'/g,'"'));
if(new Set(assetList).size!==assetList.length)throw Error('Duplicate service-worker cache URLs');
for(const asset of assetList)if(asset!=='/'&&!(await stat(path.join(root,'public',asset.slice(1)))).size)throw Error('Missing offline asset '+asset);
console.log('Episuite source checks passed');
