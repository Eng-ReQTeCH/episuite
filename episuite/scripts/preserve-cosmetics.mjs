import { readFile, writeFile } from 'node:fs/promises';
const text = await readFile(new URL('../../EpiAppsTest/epidoro/templates/index.html', import.meta.url), 'utf8');
const section = text.slice(text.indexOf('const TIME_UNLOCKABLES = ['), text.indexOf('/* ═', text.indexOf('const TIME_UNLOCKABLES = [') + 10));
const items = [];
for (const line of section.split('\n')) {
  const id = line.match(/id:\s*'([^']+)'/), name = line.match(/name:\s*'([^']+)'/), minutes = line.match(/minutes:\s*(\d+)/), type = line.match(/type:\s*'([^']+)'/), icon = line.match(/icon:\s*'([^']+)'/);
  if (!id || !name || !minutes || !type) continue;
  const data = {};
  for (const prop of ['title', 'color', 'glow']) { const match = line.match(new RegExp(prop + ":\\s*'([^']+)'")); if (match) data[prop] = match[1]; }
  items.push({ id: id[1], name: name[1], minutes: Number(minutes[1]), type: type[1], icon: icon?.[1] || '', data });
}
if (items.length !== 55) throw new Error(`Expected the 55 legacy unlockables; extracted ${items.length}`);
await writeFile(new URL('../public/cosmetics.json', import.meta.url), JSON.stringify(items, null, 2));
console.log(`Preserved ${items.length} original unlockables without executing legacy code`);
