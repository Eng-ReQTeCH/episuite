import { readFile } from 'node:fs/promises';
import { initialState, legacyImport } from '../public/domain.js';
for (const name of ['EpiApps', 'EpiAppsTest']) {
  const folder = new URL(`../../${name}/data/`, import.meta.url);
  const productivity = JSON.parse(await readFile(new URL('epiproducitv.json', folder), 'utf8'));
  const shared = JSON.parse(await readFile(new URL('stats.json', folder), 'utf8'));
  const state = legacyImport({ productivity, shared }, initialState());
  console.log(`${name}: ${state.tasks.length} tasks, ${state.blocks.length} blocks; existing JSON data passes import validation.`);
}
