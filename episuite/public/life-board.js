import {addDays, validDate, InputError} from './domain.js';
import {activity, escapeHTML as e} from './life.js';

export const boardDefaults = () => ({graphs: [], showFlame: true, showShortcuts: true, showTotals: false, graphAccent: '#22c55e'});
export function graphPalette(accent = '#22c55e') {
  if (!/^#[\da-f]{6}$/i.test(accent)) accent = '#22c55e';
  const rgb = accent.slice(1).match(/../g).map(n => parseInt(n, 16));
  const mix = (weight, target) => '#' + rgb.map(n => Math.round(n * weight + target * (1 - weight)).toString(16).padStart(2, '0')).join('');
  return {'--graph-1': mix(.6, 255), '--graph-2': mix(.8, 255), '--graph-3': accent, '--graph-4': mix(.75, 0), '--graph-dark-1': mix(.7, 0), '--graph-dark-2': mix(.85, 0), '--graph-dark-3': accent, '--graph-dark-4': mix(.7, 255)};
}
export function graphAccentPicker(accent) {
  const presets = [['#22c55e', 'Emerald'], ['#3b82f6', 'Blue'], ['#f97316', 'Orange'], ['#a855f7', 'Purple'], ['#ec4899', 'Pink']];
  return `<fieldset class="graph-accent-setting"><legend>Graph accent</legend><div class="graph-accent-controls"><input type="color" name="graphAccent" value="${e(accent)}" aria-label="Custom graph accent"><div class="graph-accent-presets">${presets.map(([color, name]) => `<button type="button" data-action="graph-color-preset" data-id="${color}" aria-label="${name} graph accent" aria-pressed="${color === accent}" style="--swatch:${color}"><span></span></button>`).join('')}</div><code id="graph-accent-value">${e(accent)}</code></div><div class="graph-accent-preview" style="${Object.entries(graphPalette(accent)).map(([k,v])=>`${k}:${v}`).join(';')}" aria-label="Graph intensity preview"><span class="heat-0"></span>${[1,2,3,4].map(n=>`<span class="heat-${n}"></span>`).join('')}<small>Every contribution graph · light & dark themes</small></div></fieldset>`;
}
export function graphSources(state) {
  return [
    {id: 'all', name: 'All check-offs', kind: 'Overview', unit: 'check-offs', mark: '✓'},
    {id: 'focus', name: 'Focus time', kind: 'Overview', unit: 'minutes', mark: '◷'},
    {id: 'visits', name: 'Days opened', kind: 'Overview', unit: 'opens', mark: '↗'},
    ...[...new Set(state.tasks.filter(t => !t.deleted).map(t => t.category))].sort().map(name => ({id: `category:${name}`, name, kind: 'Life area', unit: 'check-offs', mark: '◎'})),
    ...state.tasks.filter(t => !t.deleted).map(t => ({id: `task:${t.id}`, name: t.title, kind: t.repeat === 'none' ? 'Task' : 'Habit', unit: 'check-offs', mark: t.repeat === 'none' ? '✓' : '↻'}))
  ];
}
export function boardInput(data, state, existing = boardDefaults()) {
  const out = {...boardDefaults(), ...existing};
  if ('graphAccent' in data) {
    if (typeof data.graphAccent !== 'string' || !/^#[\da-f]{6}$/i.test(data.graphAccent)) throw new InputError('Choose a valid graph accent color.');
    out.graphAccent = data.graphAccent.toLowerCase();
  }
  for (const key of ['showFlame', 'showShortcuts', 'showTotals']) {
    if (key in data) {
      if (typeof data[key] !== 'boolean') throw new InputError('Choose whether to show each section.');
      out[key] = data[key];
    }
  }
  if ('graphs' in data) {
    if (!Array.isArray(data.graphs) || data.graphs.length > 24 || data.graphs.some(id => typeof id !== 'string')) throw new InputError('Choose up to 24 graphs.');
    const valid = new Set(graphSources(state).map(s => s.id));
    if (data.graphs.some(id => !valid.has(id))) throw new InputError('One of these graphs is no longer available. Reopen Customize.');
    out.graphs = [...new Set(data.graphs)];
  }
  return out;
}
export function graphCounts(source, a) {
  if (source.id === 'all') return a.all;
  if (source.id === 'focus') return a.focus;
  if (source.id === 'visits') return a.visits;
  if (source.id.startsWith('task:')) return a.byTask[source.id.slice(5)] || {};
  return a.byCategory[source.id.slice(9)] || {};
}
export function streak(state, day) {
  const a = activity(state), days = [...a.workDays].filter(d => validDate(d) && d <= day).sort();
  const worked = new Set(days), active = worked.has(day);
  let current = 0, cursor = active ? day : addDays(day, -1), best = 0, run = 0, previous;
  while (worked.has(cursor)) { current++; cursor = addDays(cursor, -1); }
  for (const date of days) { run = previous && addDays(previous, 1) === date ? run + 1 : 1; best = Math.max(best, run); previous = date; }
  return {active, current, best, total: days.length, worked};
}
export function flameSVG() {
  return `<svg class="flame-art" viewBox="0 0 160 188" fill="none" aria-hidden="true"><defs><linearGradient id="ember-outer" x1="84" y1="24" x2="84" y2="178" gradientUnits="userSpaceOnUse"><stop stop-color="#ffb146"/><stop offset=".5" stop-color="#f97535"/><stop offset="1" stop-color="#db4d2d"/></linearGradient><linearGradient id="ember-inner" x1="83" y1="101" x2="83" y2="179" gradientUnits="userSpaceOnUse"><stop stop-color="#fff1b3"/><stop offset="1" stop-color="#ffc05a"/></linearGradient></defs><path class="flame-spark spark-one" d="M31 58c-9-8-5-15 0-21 7 9 9 15 0 21Z" fill="#ef9651"/><path class="flame-spark spark-two" d="M132 91c-7-7-4-12 0-17 6 7 7 12 0 17Z" fill="#ffb55c"/><path d="M83 9c7 25-3 37-18 54-13 15-22 30-17 47-11-8-16-20-15-32-22 23-28 44-18 68 11 27 34 40 64 40 36 0 64-23 66-56 2-23-8-45-29-66 2 16-2 25-11 32 3-32-4-63-22-87Z" fill="url(#ember-outer)"/><path d="M81 94c3 17-5 25-13 36-10 12-10 27-1 37 9 11 26 12 36 2 15-15 9-39-3-53 0 12-4 18-9 21 3-16 0-31-10-43Z" fill="url(#ember-inner)"/><path d="M45 134c-3-15 3-29 15-43" stroke="#ffd08a" stroke-width="4" stroke-linecap="round" opacity=".65"/><ellipse cx="80" cy="185" rx="46" ry="2" fill="#d56a36" opacity=".12"/></svg>`;
}
function flamePanel(state, day, celebration) {
  const s = streak(state, day), scale = .64 + Math.min(.455, Math.log2(s.current + 1) * .065);
  const week = Array.from({length: 7}, (_, i) => addDays(day, i - 6));
  return `<section class="ember-panel ${s.active ? 'is-lit' : 'is-dormant'} ${celebration ? 'is-igniting' : ''}" aria-label="Daily work streak" data-streak="${s.current}" data-active="${s.active}" style="--flame-scale:${scale}"><div class="ember-visual"><div class="ember-halo"></div><div class="ember-flame">${flameSVG()}</div><span class="ember-state">${s.active ? 'LIT FOR TODAY' : 'READY WHEN YOU ARE'}</span></div><div class="ember-copy"><span class="life-kicker">YOUR DAILY SPARK</span><div class="ember-number"><strong>${s.current}</strong><span>day${s.current === 1 ? '' : 's'}<br>in a row</span></div><h2>${s.active ? s.current === 1 ? 'That’s your spark.' : 'Look at you, showing up.' : s.current ? 'Your next spark is waiting.' : 'A small start makes a spark.'}</h2><p>${s.active ? 'You did something for yourself today. Let that count.' : 'One check-off or one recorded focus minute lights your flame.'}</p><div class="ember-week" aria-label="Last seven days">${week.map(d => `<span class="ember-day ${s.worked.has(d) ? 'worked' : ''} ${d === day ? 'is-today' : ''}" title="${d}: ${s.worked.has(d) ? 'work recorded' : 'not yet'}"><small>${new Date(d + 'T12:00:00Z').toLocaleDateString('en', {weekday: 'narrow', timeZone: 'UTC'})}</small><i aria-hidden="true">${s.worked.has(d) ? '✓' : '·'}</i><span class="sr-only">${d}: ${s.worked.has(d) ? 'work recorded' : 'not yet'}</span></span>`).join('')}</div><div class="ember-foot"><span>Personal best <strong>${s.best} days</strong></span><button class="btn ${s.active ? 'secondary' : 'primary'} compact" data-action="nav" data-id="${s.active ? 'tasks' : 'now'}">${s.active ? 'Keep going →' : 'Find my next small step →'}</button></div></div><span class="sr-only" role="status">${celebration ? `Flame lit. ${s.current} day streak.` : ''}</span></section>`;
}
function miniGraph(source, counts, day, editing, index, total) {
  const start = addDays(day, -83), offset = new Date(start + 'T12:00:00Z').getUTCDay(), cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span class="mini-blank"></span>');
  let sum = 0, active = 0;
  const monthLabels = [];
  for (let i = 0; i < 84; i++) {
    const d = addDays(start, i), n = Number(counts[d]) || 0; sum += n; if (n > 0) active++;
    if (i === 0 || d.endsWith('-01')) monthLabels.push(`<span style="grid-column:${Math.floor((i + offset) / 7) + 1}">${new Date(d + 'T12:00:00Z').toLocaleDateString('en', {month: 'short', timeZone: 'UTC'})}</span>`);
    const intensity = source.id === 'focus' ? Math.min(4, Math.ceil(n / 15)) : Math.min(4, n);
    cells.push(`<button class="mini-cell heat-${intensity} ${d === day ? 'mini-today' : ''}" tabindex="${i === 83 ? 0 : -1}" aria-label="${d}: ${n} ${e(source.unit)}" title="${d}: ${n} ${e(source.unit)}" data-detail="${d}: ${n} ${e(source.unit)}"></button>`);
  }
  return `<article class="board-graph" data-graph="${e(source.id)}"><h3 class="graph-card-heading"><button class="graph-top" data-action="life-expand" data-id="${e(source.id)}" aria-label="Open full history for ${e(source.name)}"><span class="graph-identity"><span class="graph-mark" aria-hidden="true">${source.mark}</span><span class="graph-name-wrap"><span class="life-kicker">${source.kind}</span><span class="graph-name">${e(source.name)}</span></span></span><span class="graph-expand" aria-hidden="true">↗</span></button></h3><div class="mini-months" style="--mini-cols:${Math.ceil((84 + offset) / 7)}">${monthLabels.join('')}</div><div class="mini-grid" role="group" aria-label="${e(source.name)} last twelve weeks" style="--mini-cols:${Math.ceil((84 + offset) / 7)}">${cells.join('')}</div><div class="graph-foot" title="${active} active days in the past twelve weeks"><span><strong>${sum}</strong> ${e(source.unit)}</span><span>12 weeks</span></div>${editing ? `<div class="graph-edit"><button class="btn text compact" data-action="life-move" data-id="${e(source.id)}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="Move ${e(source.name)} earlier">↑</button><button class="btn text compact" data-action="life-move" data-id="${e(source.id)}" data-direction="1" ${index === total - 1 ? 'disabled' : ''} aria-label="Move ${e(source.name)} later">↓</button><button class="btn text compact" data-action="life-remove" data-id="${e(source.id)}">Remove graph</button></div>` : ''}</article>`;
}
function shortcuts(state) {
  return `<section class="board-apps" aria-labelledby="apps-title"><div class="board-section-heading"><h2 id="apps-title">A jump back in.</h2><button class="btn text compact" data-action="new-shortcut">+ Create shortcut</button></div><div class="board-shortcuts">${(state.life?.shortcuts || []).map(s => `<article class="shortcut"><a href="${e(s.url)}" target="_blank" rel="noopener noreferrer"><img src="${e(new URL('/favicon.ico', s.url).href)}" referrerpolicy="no-referrer" alt="" width="28" height="28"><span>${e(s.name)}<small>${e(new URL(s.url).host)}</small></span></a><details class="shortcut-menu"><summary aria-label="Manage ${e(s.name)} shortcut">⋯</summary><div><button data-action="edit-shortcut" data-id="${e(s.id)}">Edit</button><button data-action="delete-shortcut" data-id="${e(s.id)}">Remove</button></div></details></article>`).join('') || `<button class="shortcut-empty" data-action="new-shortcut"><span aria-hidden="true">↗</span><span>Your German companion. Your favourite tools.<small>Add a link and make it one click away.</small></span><span aria-hidden="true">+</span></button>`}</div></section>`;
}
export function lifePage(state, day, {editing = false, boardPage = 0, celebration = false} = {}) {
  const board = {...boardDefaults(), ...state.life?.board}, a = activity(state), sources = graphSources(state);
  const chosen = board.graphs.map(id => sources.find(s => s.id === id)).filter(Boolean), pages = Math.max(1, Math.ceil(chosen.length / 4)), currentPage = Math.max(0, Math.min(boardPage, pages - 1));
  return `<div class="life-board"><header class="board-heading"><div><span class="life-kicker">YOUR SPACE. YOUR PACE.</span><h1>LIFE OS<span class="board-title-dot">.</span></h1></div><button class="btn secondary compact" data-action="life-customize"><span aria-hidden="true">⚙</span> Customize</button></header>${board.showFlame ? flamePanel(state, day, celebration) : ''}${board.showTotals ? `<section class="board-totals" aria-label="Lifetime totals"><span><strong>${a.workDays.size}</strong> work days</span><span><strong>${Object.keys(a.visits).length}</strong> days opened</span><span><strong>${Object.values(a.all).reduce((x, n) => x + n, 0)}</strong> check-offs</span><span><strong>${Object.values(a.focus).reduce((x, n) => x + n, 0)}</strong> focus minutes</span></section>` : ''}<section class="board-tracking" aria-labelledby="tracking-title"><div class="board-section-heading"><div><h2 id="tracking-title">What matters to you.</h2><p>${chosen.length ? 'Past 12 weeks · Only the graphs you chose.' : 'Your board starts small. You decide what belongs.'}</p></div><div class="row">${chosen.length ? `<button class="btn text compact" data-action="life-edit" aria-pressed="${editing}">${editing ? 'Done editing' : 'Edit'}</button>` : ''}<button class="btn secondary compact" data-action="life-add">+ Add graph</button></div></div>${chosen.length ? `<div class="board-grid">${chosen.slice(currentPage * 4, currentPage * 4 + 4).map((source, i) => miniGraph(source, graphCounts(source, a), day, editing, currentPage * 4 + i, chosen.length)).join('')}</div>${pages > 1 ? `<nav class="board-pages" aria-label="Graph pages"><button class="btn text compact" data-action="life-page" data-id="${currentPage - 1}" ${currentPage === 0 ? 'disabled' : ''}>← Previous</button><span>${currentPage + 1} / ${pages} <small>· ${chosen.length} pinned graphs</small></span><button class="btn text compact" data-action="life-page" data-id="${currentPage + 1}" ${currentPage === pages - 1 ? 'disabled' : ''}>Next →</button></nav>` : ''}` : `<button class="board-empty" data-action="life-add"><span class="empty-graph" aria-hidden="true">${Array.from({length: 35}, (_, i) => `<i class="sample-${i % 6}"></i>`).join('')}</span><span><strong>A little window into your progress.</strong><small>Pin a habit, a hobby, or your focus time. Nothing is added automatically.</small></span><span class="empty-add" aria-hidden="true">+</span></button>`}</section>${board.showShortcuts ? shortcuts(state) : ''}<footer class="board-footer"><span>Made for coming back, not keeping up.</span><button class="btn text compact" data-action="automation-setup">Connect automation ↗</button></footer></div>`;
}
export function boardPicker(state, sectionSettings = false) {
  const board = {...boardDefaults(), ...state.life?.board}, sources = graphSources(state).sort((a,b)=>{const ai=board.graphs.indexOf(a.id),bi=board.graphs.indexOf(b.id);return (ai<0?1000:ai)-(bi<0?1000:bi);});
  return `<p class="picker-intro">Pin only what you want to see. Your tasks stay in Tasks.</p>${sectionSettings ? `<fieldset class="board-section-options"><legend>Show on my page</legend>${[['showFlame', 'Daily flame'], ['showShortcuts', 'Webapp shortcuts'], ['showTotals', 'Lifetime totals']].map(([key, label]) => `<label><input name="${key}" type="checkbox" ${board[key] ? 'checked' : ''}><span>${label}</span></label>`).join('')}</fieldset>${graphAccentPicker(board.graphAccent)}` : ''}<label class="board-picker-search">Find a graph<input id="board-source-search" type="search" placeholder="German, reading, focus…" autocomplete="off"></label><div class="picker-summary"><span id="board-selected-count">${board.graphs.length} / 24 selected</span><button type="button" class="btn text compact" data-action="life-clear-selection">Clear selection</button></div><div class="board-source-list">${sources.map((source, i) => `<label class="board-source" data-source-search="${e((source.name + ' ' + source.kind).toLowerCase())}" ${i >= 30 && !board.graphs.includes(source.id) ? 'hidden' : ''}><input type="checkbox" name="graphs" value="${e(source.id)}" ${board.graphs.includes(source.id) ? 'checked' : ''}><span class="graph-mark" aria-hidden="true">${source.mark}</span><span><strong>${e(source.name)}</strong><small>${source.kind}</small></span></label>`).join('')}</div><p class="small muted" id="board-picker-note">Search to find more. You can reorder or remove graphs with Edit on your board.</p><input type="hidden" name="sectionSettings" value="${sectionSettings}"><input type="hidden" name="expectedBoardVersion" value="${state.life?.boardVersion || 0}">`;
}
