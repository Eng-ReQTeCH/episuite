import { dateKey, addDays, done, isDue, chooseNext, countToday, remaining, metrics, schedule, conflicts, uid } from './domain.js';
import {momentum, goalOptions, dailySpark, contextualSpark, pickAction, keepsakes} from './engagement.js';
import {calendarPanel, calendarRange, moveCalendar, commitmentForm, deliverReminders} from './calendar.js';
import {colorField} from './calendar.js';
import {blockColor,nextEligibleAt,initialState} from './domain.js';
import {socialPage,personForm,circleForm,checkinForm,peopleSelector,peopleChips,socialNow,socialProgress} from './social.js';
let socialCircle = '', socialQuery = '', eligibilityKey = '';

let calendarView = 'month', checkingReminders = false;

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const btn = (label, action, id = '', style = 'secondary', extra = '') => `<button class="btn ${style}" data-action="${action}" ${id ? `data-id="${esc(id)}"` : ''} ${extra}>${label}</button>`;
const field = (label, name, value = '', type = 'text', attrs = '') => `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}></div>`;
const select = (label, name, options, value) => `<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}">${options.map(([v, text]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></div>`;
let state, page = location.hash.slice(1) || 'now', online = true, busy = false, energy = 'medium', timerMode = 'focus', duration = 25, selectedTask = undefined, planDate, taskTab = 'inbox', search = '', category = '', zen = false, toastTimeout, lastFocus;
let audio, soundNode, soundGain, soundKind = 'off', videoUrl = null;
let winTimeout, actionChoices=[], installPrompt=null;
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;});
const pointText=n=>`${n} growth point${n===1?'':'s'}`;
function canLeaveRunway(id){const t=state?.tasks.find(t=>t.id===id);return Boolean(t&&!t.deleted&&!done(t,today()));}
function showWin(title,detail,before=null){
  const p=momentum(state,today());if(!p.prefs.feedback||!state.settings.gamification)return;
  $('#momentum-win')?.remove();clearTimeout(winTimeout);
  const card=document.createElement('section');card.id='momentum-win';card.className='momentum-win';card.setAttribute('aria-label','Work acknowledged');
  const discovered=before?keepsakes(state,today()).filter(c=>c.unlocked&&!before.some(b=>b.id===c.id&&b.unlocked)):[];
  card.innerHTML=`<button class="win-close" data-action="win-close" aria-label="Dismiss acknowledgment">×</button><span class="win-mark" aria-hidden="true">✦</span><div role="status"><span class="eyebrow">THAT COUNTS</span><h2>${esc(title)}</h2><p>${esc(detail)}</p>${discovered.length&&!state.settings.lowStim?`<p class="discovery"><span aria-hidden="true">${discovered[0].symbol}</span> Discovered: <strong>${esc(discovered[0].name)}</strong></p>`:''}</div><div class="row wrap">${btn('Take a break →','win-break','','secondary compact')}${btn('See my growth','nav','progress','text compact')}${canLeaveRunway(state.sessions.at(-1)?.taskId)?btn('Leave a next move','leave-runway',state.sessions.at(-1).taskId,'text compact'):''}</div>`;
  document.body.append(card);
  if(!state.settings.lowStim&&!state.settings.reducedMotion&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    if(p.prefs.haptics&&navigator.vibrate)navigator.vibrate(25);
    if(p.prefs.chime&&title==='One thing finished.') {ensureAudio();if(audio){const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=660;g.gain.setValueAtTime(.06*state.settings.volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.2);}}
  }
  winTimeout=setTimeout(()=>{if(!card.contains(document.activeElement))card.remove();},10000);
  return true;
}
const today = () => dateKey(Date.now(), state?.settings.timezone || 'Africa/Cairo');
const taskById = id => state.tasks.find(t => t.id === id);
const next = () => chooseNext(state, today(), energy);
const navItems = [['now', '◉', 'Now'], ['tasks', '☷', 'Tasks'], ['plan', '▦', 'Calendar'], ['social', '♧', 'Social'], ['focus', '◷', 'Focus'], ['capture', '⌑', 'Capture'], ['progress', '↗', 'Progress'], ['rewards', '◇', 'Rewards']];
const guideSteps = [
  {page:'now',name:'Now',title:'Your daily starting point',text:'Now keeps one next action, your timer, and up to three open tasks in view. You do not need to fill all three spaces.',tip:'The daily loop: choose one task → focus briefly → take a break. Close the day when you are done.'},
  {page:'tasks',name:'Tasks',title:'Get one thing out of your head',text:'Inbox holds everything. Today is your small shortlist. Someday holds ideas that can wait. Habits are tasks with a repeat interval.',tip:'Name an action you can begin: “Open the assignment” is easier to start than “Sort my life out”. Add just one task; choose Inbox if it can wait.',action:'guide-new-task',label:'+ Add one task'},
  {page:'plan',name:'My day',title:'Add structure only where it helps',text:'Fixed blocks stay on the clock. Flexible blocks start relative to when you press Start my day. You can repeat a block or save several as a routine.',tip:'Optional: add one appointment you already know. Leave your other time open. You can skip scheduling entirely for now.',action:'new-block',label:'+ Add one commitment'},
  {page:'focus',name:'Focus',title:'Make the start small',text:'Choose a task and a session length, then Start. Pause or finish whenever you need to; completed minutes still count. Short and long breaks are free.',tip:'Try two minutes before changing your entire routine. Quiet view hides navigation; sound is optional. Space pauses or resumes while you are on this page.',action:'guide-two-min',label:'Choose a 2-minute start'},
  {page:'capture',name:'Capture',title:'Park interruptions without losing your place',text:'Capture is for a thought, reminder or idea you do not want to act on yet. Later, turn it into a task or remove it.',tip:'Try capturing one real thought below. From any page, press C or use Capture in the header. Captures also save locally when the server is offline.',action:'quick-capture',label:'+ Capture a thought'},
  {page:'progress',name:'Progress',title:'Notice what actually helped',text:'Focus minutes, completed tasks and reflections show what happened. Partial sessions count. There is no streak to lose.',tip:'This page can be empty at first. After a session, return to see it here. Close the day adds an optional reflection and moves unfinished tasks back to the inbox.'},
  {page:'rewards',name:'Rewards',title:'Choose encouragement you enjoy',text:'Tasks earn coins according to effort. You can create a personal reward, claim gentle goals or unlock cosmetics. Ordinary rest never costs coins.',tip:'Optional: create one small reward that you would actually enjoy. You can turn rewards off in the next step.',action:'new-reward',label:'+ Create a personal reward'},
  {page:'settings',name:'Settings',title:'Keep the defaults, or change one thing',text:'Adjust session lengths, appearance, stimulation and rewards. Select Save preferences after editing. Categories group the parts of your life; add one below if it helps.',tip:'Calendar, AI and watch connections can wait. Start with one task and one short session. Replay this guide here any time.',action:'guide-category',label:'+ Name one life area'}
];
function guidePanel() {
  if(zen)return '';
  const g=state.onboarding;
  if(g?.status==='complete') return '';
  if(!g || g.status==='paused') return page==='now' ? `<section class="guide-invitation"><div><span class="eyebrow">START LIGHT</span><h3>${g ? 'Pick up where you left off.' : 'Turn this workspace into a daily habit.'}</h3><p>A short guided setup, one page at a time. Every setup action is optional.</p></div>${btn(g?'Resume setup →':'Set up my workspace →','guide-start','','primary')}</section>` : '';
  const step={...guideSteps[g.step]};
  if(step.page==='rewards'&&!state.settings.gamification){step.action=null;step.text='Rewards are currently switched off. Tasks, focus and free breaks still work.';step.tip='You can turn “Rewards & gentle goals” on in Settings later. Continue with no setup needed.';}
  if(page!==step.page) return `<section class="guide-return row spread wrap"><p class="small">Your setup guide is at <strong>${step.name}</strong>. You can explore freely.</p>${btn('Return to guide →','guide-return','','soft compact')}${btn('Pause guide','guide-pause','','text compact')}</section>`;
  const check=g.step===1&&state.tasks.some(t=>!t.deleted)?'A task is saved. You can edit it whenever you need.':g.step===2&&state.blocks.length?'Your schedule has a block. You can adjust it in My day.':g.step===4&&state.notes.length?'A thought is parked. It does not need to become a task.':'';
  return `<section class="guide-panel" aria-label="Guided setup"><div class="guide-top"><span class="eyebrow">GUIDED SETUP · ${g.step+1} OF ${guideSteps.length}</span>${btn('Pause & save my place','guide-pause','','text compact')}</div><div class="guide-track" aria-hidden="true">${guideSteps.map((s,i)=>`<span class="${i<=g.step?'visited':''}"></span>`).join('')}</div><h2>${step.title}</h2><p>${step.text}</p><p class="guide-tip">${step.tip}</p>${check?`<p class="guide-check">✓ ${check}</p>`:''}<div class="guide-controls">${step.action?btn(step.label,step.action,'','secondary'):''}<div class="row wrap">${g.step?btn('← Back','guide-back','','text compact'):''}${btn(g.step===7?'Save & finish guide →':`Next: ${guideSteps[g.step+1].name} →`,'guide-next','','primary')}</div></div><p class="guide-optional">No need to complete an action to continue. Your place is saved.</p></section>`;
}
function guideWelcome() {
  showDialog('Start small. Build as you go.', `<p>You only need one task and a short focus session to begin. This guide walks through each page and helps you set up what is useful.</p><div class="guide-welcome"><span>01 · Learn where things go</span><span>02 · Try optional setup actions</span><span>03 · Leave with a simple daily loop</span></div><p class="small muted">No sample tasks, packed calendar, or account setup. Pause and resume whenever you want.</p><div class="dialog-foot">${btn('Explore on my own','guide-pause','','text')}${btn('Start guided setup →','guide-start','','primary')}</div>`);
  $('#dialog').dataset.welcome='true';
}
async function guideMove(step,status='active') {
  await request('/api/onboarding',{step,status});
  if($('#dialog').open) closeDialog();
  if(status==='active') {page=guideSteps[step].page;location.hash=page;}
  if(status==='active'&&step===1&&state.tasks.some(t=>t.lane==='today'&&!t.deleted&&!done(t,today()))&&!state.tasks.some(t=>t.lane==='inbox'&&!t.deleted&&!done(t,today())))taskTab='today';
  if(status==='paused') {page='now';location.hash=page;}
  render();$('#main')?.focus();window.scrollTo({top:0,behavior:'instant'});
}
const friendlyDate = date => new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
const clock = minute => minute === null ? 'After wake' : `${String(Math.floor((minute % 1440) / 60)).padStart(2, '0')}:${String(Math.round(minute % 60)).padStart(2, '0')}${minute >= 1440 ? ' +1d' : ''}`;
const timeText = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
function toast(message, undo) { clearTimeout(toastTimeout); $('#toast').innerHTML = esc(message) + (undo ? btn('Undo', 'undo', undo, 'text compact') : ''); $('#toast').classList.add('show'); toastTimeout = setTimeout(() => $('#toast').classList.remove('show'), undo ? 9000 : 4500); }
async function request(endpoint, data, method = 'POST') {
  if (!online) throw new Error('The server is offline. Your saved workspace is still here; reconnect to make changes.');
  data={...data};
  const match=endpoint.split('?')[0].match(/^\/api\/(tasks|blocks)\/([^/]+)/);
  if(match&&!('expectedVersion' in data)){const record=state[match[1]].find(t=>t.id===match[2]);if(record)data.expectedVersion=record.editVersion||0;}
  if(/^\/api\/timer\/(pause|resume|finish|reset)$/.test(endpoint)&&!('timerId' in data))data.timerId=state.timer?.id||null;
  const response = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) });
  const result = await response.json();
  if(result.state&&(!state||result.state.workspaceId!==state.workspaceId||result.state.revision>=state.revision)){state=result.state;cache();}
  if(!response.ok){if(response.status===409&&!$('#dialog').open)render();throw new Error(result.error||'Could not save. Try again.');}
  return result;
}
function cache() { try { localStorage.setItem('episuite.snapshot', JSON.stringify(state)); } catch {} }
function captureQueue() { try { return JSON.parse(localStorage.getItem('episuite.captureQueue') || '[]'); } catch { return []; } }
async function saveCapture(text) {
  const note = { id: uid(), text: String(text).trim().slice(0, 3000), created: Date.now() };
  if (!note.text) throw new Error('Write something to capture.');
  if (online) { try { await request('/api/notes', note); return; } catch (e) { if (!(e instanceof TypeError)) throw e; online = false; } }
  const queue = captureQueue(); queue.push(note);
  localStorage.setItem('episuite.captureQueue', JSON.stringify(queue));
  state.notes.unshift(note); cache();
}
async function syncCaptures() {
  const queue = captureQueue();
  for (const note of [...queue]) {
    const response = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note) });
    if (!response.ok) throw new Error('Your offline captures could not be synced. They are still saved on this device.');
    queue.splice(queue.findIndex(n => n.id === note.id), 1); localStorage.setItem('episuite.captureQueue', JSON.stringify(queue));
  }
  return queue.length === 0;
}
async function load(initial = false) {
  try {
    const headers=state?.workspaceId&&!captureQueue().length?{'If-None-Match':`"${state.workspaceId}:${state.revision}"`}:{};
    const response = await fetch('/api/state',{headers});
    if(response.status===304){const reconnect=!online;online=true;if(reconnect&&!$('#dialog').open)render();updateTimer();return;}
    if (!response.ok) throw Error(); let incoming = await response.json();
    if (captureQueue().length) { await syncCaptures(); incoming = await (await fetch('/api/state')).json(); toast('Your offline thoughts are safely synced.'); }
    if (state && incoming.workspaceId===state.workspaceId && incoming.revision < state.revision) return;
    const changed = !state || incoming.revision !== state.revision || !online;
    const oldTimer = state?.timer, priorKeepsakes=state?keepsakes(state,today()):null;
    state = incoming; if(state.timer){timerMode=state.timer.mode;duration=state.timer.duration/60;} online = true; if (changed) cache();
    if (oldTimer && oldTimer.id!==state.timer?.id && incoming.sessions.some(s => s.id === oldTimer.id)) onTimerComplete(oldTimer,priorKeepsakes);
    if (initial && state.onboarding?.status==='active' && !location.hash) page=guideSteps[state.onboarding.step]?.page||'now';
    if (initial && state.onboarding?.status==='active' && state.onboarding.step===1 && state.tasks.some(t=>t.lane==='today'&&!t.deleted&&!done(t,today())) && !state.tasks.some(t=>t.lane==='inbox'&&!t.deleted&&!done(t,today()))) taskTab='today';
    if (initial) { duration = state.timer ? state.timer.duration / 60 : state.settings.focusMinutes; timerMode = state.timer?.mode || 'focus'; energy = state.checkins[today()]?.energy || 'medium'; planDate = today(); }
    if (changed && !$('#dialog').open && !document.activeElement?.matches('input,textarea,select')) render();
    updateTimer();
  } catch {
    online = false;
    if (!state) { try { state = JSON.parse(localStorage.getItem('episuite.snapshot')); } catch {} }
    if (state) { state.social ||= initialState().social;planDate ||= today(); render(); }
    else $('#app').innerHTML = `<main class="loading"><h1>Let's reconnect.</h1><p>Episuite needs its local server to open your workspace.</p>${btn('Try again', 'reload', '', 'primary')}</main>`;
  }
}
function applyLook() {
  const s = state.settings;
  const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme:dark)').matches);
  document.body.classList.toggle('dark', dark); document.body.classList.toggle('low-stim', s.lowStim); document.body.classList.toggle('reduced-motion', s.reducedMotion); document.body.classList.toggle('zen', zen);
  // User accent affects decorative surfaces only; default action colors keep reliable contrast.
  document.documentElement.style.setProperty('--personal-accent', s.gamification && s.equipped?.color?.data?.color || s.accent);
  document.documentElement.style.setProperty('--logo-accent', s.gamification && s.equipped?.color?.data?.color || (s.accent && s.accent !== '#316b57' ? s.accent : '#d2ed88'));
  document.body.classList.toggle('bg-custom', Boolean(s.background)); document.documentElement.style.setProperty('--custom-bg', s.background ? `url("${s.background}")` : 'none');
  document.documentElement.style.setProperty('--timer-font', s.timerFont === 'mono' ? 'Consolas,monospace' : s.timerFont === 'serif' ? 'Georgia,serif' : "'Segoe UI',sans-serif");
}
function render() {
  if (!state) return;
  if(!state.settings.gamification||!momentum(state,today()).prefs.feedback)$('#momentum-win')?.remove();
  if (!['now', 'tasks', 'plan', 'social', 'focus', 'capture', 'progress', 'rewards', 'settings'].includes(page)) page = 'now';
  applyLook();
  const totalInbox = state.tasks.filter(t => !t.deleted && !t.completed && t.lane === 'inbox').length;
  $('#app').innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M6 5h21v6H12v3h12v5H12v3h15v6H6z" fill="currentColor"/></svg></span>episuite</div><nav class="nav" aria-label="Main navigation">${navItems.filter(([id]) => id !== 'rewards' || state.settings.gamification).map(([id, symbol, title]) => `<button data-action="nav" data-id="${id}" class="${page === id ? 'active' : ''}" ${page === id ? 'aria-current="page"' : ''}><span class="nav-symbol" aria-hidden="true">${symbol}</span>${title}${id === 'tasks' && totalInbox ? `<span class="count">${totalInbox}</span>` : id === 'capture' && state.notes.length ? `<span class="count">${state.notes.length}</span>` : ''}</button>`).join('')}</nav><div class="side-bottom"><div class="side-note"><span class="eyebrow">WORKSPACE SHORTCUTS</span><p><kbd>N</kbd> New task<br><kbd>C</kbd> Capture a thought<br><kbd>F</kbd> Focus</p></div><nav class="nav" aria-label="Preferences"><button data-action="nav" data-id="settings" class="${page === 'settings' ? 'active' : ''}"><span class="nav-symbol" aria-hidden="true">⚙</span>Settings</button></nav></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb">Workspace <span aria-hidden="true">/</span> ${page === 'settings' ? 'Settings' : navItems.find(n => n[0] === page)?.[2]} <span class="status ${online ? '' : 'offline'}"><span class="status-dot"></span>${online ? 'Synced to your server' : 'Offline · capture available'}</span></div><div class="top-actions">${state.timer && page !== 'focus' ? btn(`<span data-mini-timer>${timeText(remaining(state.timer))}</span> · ${state.timer.mode === 'focus' ? 'Focus' : 'Break'}`, 'nav', 'focus', 'soft') : ''}${btn('+ Capture <span class="kbd">C</span>', 'quick-capture', '', 'secondary')}${btn('Setup guide','guide-start','','text compact guide-entry')}<button data-action="nav" data-id="settings" class="avatar" aria-label="Open settings">${esc(state.settings.gamification && state.settings.equipped?.badge?.icon || (state.settings.name || 'Y')[0].toUpperCase())}</button>${btn('Settings', 'nav', 'settings', 'text compact mobile-settings')}</div></header><main id="main" class="content" tabindex="-1">${guidePanel()}${({ now: nowPage, tasks: tasksPage, plan: planPage, social: () => socialPage(state,today(),{circle:socialCircle,query:socialQuery}), focus: focusPage, capture: capturePage, progress: progressPage, rewards: rewardsPage, settings: settingsPage })[page]()}</main></div></div><nav class="phone-dock" aria-label="Quick phone navigation">${[['now','◉','Now'],['tasks','☷','Tasks'],['plan','▦','Calendar'],['focus','◷','Focus'],['social','♧','Social'],['menu','⋯','More']].map(([id,symbol,label])=>`<button data-action="nav" data-id="${id}" ${page===id?'aria-current="page"':''}><span aria-hidden="true">${symbol}</span>${id==='progress'&&!state.settings.gamification?'Progress':label}</button>`).join('')}</nav>`;
  if ($('#sound-select')) $('#sound-select').value = soundKind;
  mountVideo();
  updateTimer();
}
async function videoStore(value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('episuite-media', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media');
    request.onerror = () => reject(new Error('This browser cannot save the video.'));
    request.onsuccess = () => {
      const db = request.result, transaction = db.transaction('media', value === undefined ? 'readonly' : 'readwrite'), store = transaction.objectStore('media');
      const op = value === undefined ? store.get('background') : value === null ? store.delete('background') : store.put(value, 'background');
      let result; op.onsuccess = () => result = op.result;
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onerror = () => { db.close(); reject(new Error('The video could not be saved.')); };
    };
  });
}
function mountVideo() {
  let video = document.querySelector('#ambient-video');
  const show = videoUrl && page === 'focus' && !state.settings.lowStim && !state.settings.reducedMotion && !matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (!show) { video?.remove(); return; }
  if (!video) { video = document.createElement('video'); video.id = 'ambient-video'; video.muted = true; video.loop = true; video.playsInline = true; video.setAttribute('aria-hidden', 'true'); video.src = videoUrl; document.body.prepend(video); video.play().catch(() => {}); }
}
function heading(title, text, aside = '') { return `<div class="page-heading"><div><div class="date eyebrow">${esc(friendlyDate(today()))}</div><h1>${title}</h1><p>${text}</p></div>${aside}</div>`; }
function momentumPanel(){
  if(!state.settings.gamification)return '';
  const p=momentum(state,today());
  return `<section class="momentum-panel" aria-label="Daily momentum"><div class="momentum-ring" style="--fill:${p.ratio*100}%"><span>${p.achieved?'✓':Math.floor(p.value)}</span></div><div class="momentum-copy"><span class="eyebrow">YOUR SMALL WIN TODAY</span><h3>${p.goal[1]} <button class="level-tag" data-action="nav" data-id="progress" aria-label="See your growth, level ${p.level}, ${p.xp} points">Lv ${p.level} · ${p.xp} pts ↗</button></h3><p>${p.achieved?'You reached your chosen goal. Anything more is optional.':`${p.value} / ${p.goal[2]} ${p.goal[3]==='focus'?'focus minutes':'useful check-offs'}`}</p></div>${btn('Choose my goal','momentum-goal','','text compact')}</section>`;
}
function keepsakePanel(){
  if(!state.settings.gamification||state.settings.lowStim)return '';
  const cards=keepsakes(state,today());
  return `<section class="keepsake-section"><div class="row spread"><h2>Your little collection</h2><span class="small">${cards.filter(c=>c.unlocked).length} / ${cards.length} discovered</span></div><p class="small">Keepsakes appear as you do real work. They stay yours when you rest.</p><div class="keepsake-grid">${cards.map((c,i)=>`<article class="keepsake ${c.unlocked?'':'locked'}" style="--card-color:${['#d2ed88','#f2d892','#b8c6f4','#d4c3e9','#bce1d8'][i]}"><span aria-hidden="true">${c.unlocked?c.symbol:'◇'}</span><h3>${c.name}</h3><p>${c.text}</p><small>${c.unlocked?'Discovered ✓':'Still to discover'}</small></article>`).join('')}</div></section>`;
}
function growthPanel(){
  if(!state.settings.gamification)return '';
  const p=momentum(state,today()),names=['Seed','Sprout','Branch','Bloom','Canopy','Grove'];
  const leaves=Array.from({length:Math.min(8,p.level)},(_,i)=>`<ellipse cx="100" cy="60" rx="13" ry="30" transform="rotate(${i*45} 100 100)" fill="${i%2?'#3156ce':'#c5e77f'}" opacity="${.7+i*.03}"/>`).join('');
  return `<section class="growth-panel"><div class="growth-art" aria-hidden="true"><svg viewBox="0 0 200 200">${leaves}<circle cx="100" cy="100" r="22" fill="#20232d"/><circle cx="100" cy="100" r="9" fill="#d2ed88"/></svg></div><div><span class="eyebrow">YOUR GROWTH · LEVEL ${p.level}</span><h2>${names[Math.min(5,p.level-1)]}</h2><p>${p.xp} growth points from real work. One focus minute = one point; one useful check-off = ten.</p><progress value="${p.into}" max="${p.needed}" aria-label="Growth toward next level"></progress><p class="small">${p.left} points to level ${p.level+1}. Progress stays when you take a day off.</p></div></section>`;
}
function taskRow(t, number = false) {
  const completed = done(t, today()), eligibleAt=nextEligibleAt(t,today()), waiting=eligibleAt&&eligibleAt>Date.now();
  return `<div class="task-row ${completed ? 'completed' : ''}">${number ? `<span class="task-number">${String(number).padStart(2, '0')}</span>` : ''}<button class="checkbox ${completed ? 'checked' : ''}" data-action="complete" data-id="${esc(t.id)}" aria-label="${completed ? 'Undo completion of' : 'Complete'} ${esc(t.title)}" aria-pressed="${completed}">${completed ? '✓' : ''}</button><div class="task-content"><button class="task-title" data-action="edit-task" data-id="${esc(t.id)}">${esc(t.title)}</button><div class="task-meta"><span>${esc(t.category)}</span><span>·</span><span>${t.minutes} min</span>${t.repeat !== 'none' ? `<span>· ${t.repeat==='interval_0.5'?'Twice a day':esc(t.repeat.replace('interval_', 'Every '))}${t.repeat.startsWith('interval_')&&t.repeat!=='interval_0.5'?' days':''}${t.target > 1 ? ` · ${countToday(t, today())}/${t.target}` : ''}</span>` : ''}${waiting?`<span class="habit-waiting">Later today · available after ${new Intl.DateTimeFormat('en',{timeZone:state.settings.timezone,hour:'numeric',minute:'2-digit'}).format(new Date(eligibleAt))}</span>`:''}${t.personIds?.length?peopleChips(state,t.personIds):''}${t.due ? `<span>· ${t.due < today() ? 'Was due ' : 'Due '}${esc(t.due)}</span>` : ''}${t.steps.length ? `<span>· ${t.steps.filter(s => s.done).length}/${t.steps.length} steps</span>` : ''}</div></div><div class="task-tools">${!completed ? btn(t.lane === 'today' ? 'Focus' : 'Today +', t.lane === 'today' ? 'focus-task' : 'today-task', t.id, 'text compact') : ''}${!completed&&countToday(t,today())>0?btn('Undo last','undo-habit',t.id,'text compact'):''}${btn('↕', 'reorder', t.id, 'text compact reorder', 'aria-label="Reorder task"')}${btn('⋯', 'edit-task', t.id, 'text compact', `aria-label="Edit ${esc(t.title)}"`)}</div></div>`;
}
function timerModes() { return `<div class="timer-modes" aria-label="Timer mode">${[['focus', 'Focus'], ['short', 'Short break'], ['long', 'Long break']].map(([id, name]) => `<button data-action="timer-mode" data-id="${id}" class="${timerMode === id ? 'active' : ''}" aria-pressed="${timerMode === id}" ${state.timer ? 'disabled' : ''}>${name}</button>`).join('')}</div>`; }
function durations() { return `<div class="duration" aria-label="Session length">${(timerMode === 'focus' ? [2, 10, 25, 45] : [2, 5, 10, 15]).map(n => `<button data-action="duration" data-id="${n}" class="${duration === n ? 'active' : ''}" aria-pressed="${duration === n}" ${state.timer ? 'disabled' : ''}>${n} min</button>`).join('')}</div>`; }
function timerControls() { return state.timer ? `<div class="row wrap">${btn(state.timer.status === 'paused' ? '▶ Resume' : 'Ⅱ Pause', state.timer.status === 'paused' ? 'resume' : 'pause', '', 'primary')}${btn('Finish', 'finish', '', 'secondary')}${btn('Reset', 'reset', '', 'text')}</div>` : btn(`▶ Start ${duration} min`, 'start', '', 'primary'); }
function actionPicker(){
  const t=pickAction(state,today(),energy,actionChoices);
  if(!t){const first=state.tasks.find(t=>t.id===actionChoices[0]&&!t.deleted&&isDue(t,today()));showDialog('That is enough choosing.',`<p>Start with a task you have seen, add your own, or take a break.</p><div class="dialog-foot">${first?btn('Use first suggestion →','picker-start',first.id,'primary'):''}${btn('+ Add a task','picker-add','','primary')}${btn('Take a break','picker-rest','','secondary')}</div>`);return;}
  actionChoices.push(t.id);
  showDialog('One possible next move',`<span class="eyebrow">${actionChoices.length} OF AT MOST 3 · ${esc(t.category)}</span><div class="picker-card"><h3>${esc(t.title)}</h3><p>${esc(t.steps.find(s=>!s.done)?.title||'Open what you need. Try the first small move.')}</p><span class="pill">${t.minutes} minute estimate · ${esc(t.energy)} energy</span></div><div class="dialog-foot">${btn('Start this for 2 minutes →','picker-start',t.id,'primary')}${actionChoices.length<3?btn('Another suggestion','picker-next','','text'):''}</div><p class="small muted">You can focus on this directly. Your shortlist stays small.</p>`);
}
function returnCue(){
  const p=momentum(state,today()).prefs;
  return `<div class="return-cue"><span>${p.intent?`For: <strong>${esc(p.intent)}</strong>`:'A small start for the life you want.'} <span class="cue-time">· ${esc(p.cue||'When you are ready')}</span></span>${btn('My reason & cue','return-cue','','text compact')}</div>`;
}
function sparkPanel(){
  const p=momentum(state,today()).prefs;if(!p.novelty||state.settings.lowStim)return '';
  const [title,text]=contextualSpark(state,today(),energy);
  return `<section class="daily-spark"><span class="spark-symbol" aria-hidden="true">✳</span><div><span class="eyebrow">TODAY’S STARTER · ONE IDEA, THEN GO</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div></section>`;
}
function nowPage() {return baseNowPage()+socialNow(state,today());}
function baseNowPage() {
  const active=state.timer;
  const t = active?.mode==='focus' ? taskById(active.taskId)||next() : next(), m = metrics(state, today());
  const shortlist = state.tasks.filter(t => !t.deleted && t.lane === 'today' && (isDue(t, today()) || countToday(t, today()) > 0)).sort((a, b) => a.order - b.order);
  const first = t?.steps.find(s => !s.done), completed = shortlist.filter(t => done(t, today())).length;
  const cleared = !t && shortlist.length > 0 && completed === shortlist.length;
  const waitingTask=!t&&shortlist.find(task=>nextEligibleAt(task,today())>Date.now());
  return heading(state.settings.name ? `Find your momentum, ${esc(state.settings.name)}.` : 'Find your momentum.', 'One task. A short burst. Then a break.', `<div class="energy"><span>Energy today</span>${['low', 'medium', 'high'].map(e => `<button data-action="energy" data-id="${e}" class="${energy === e ? 'active' : ''}" aria-pressed="${energy === e}">${e[0].toUpperCase() + e.slice(1)}</button>`).join('')}</div>`) + `${!online ? '<div class="notice warning">The local server is offline. This is your last saved workspace. Capture still works and will sync when the server returns.</div>' : ''}
  <div class="now-grid">
    <section class="focus-card" aria-label="Next action">
      <div class="focus-label"><span class="action-index">${cleared ? '✓' : '01'}</span><span>${active ? 'YOUR SAVED SESSION' : t ? 'NEXT ACTION' : cleared ? 'YOU FOLLOWED THROUGH' : 'MAKE A START'}</span><span class="focus-signal">ONE THING AT A TIME</span></div>
      <h2>${active && active.mode!=='focus' ? 'Space to<br>recharge.' : t ? esc(t.title) : active ? 'Your focus<br>is saved.' : cleared ? 'Shortlist<br>complete.' : waitingTask ? 'A little<br>space.' : 'Start with<br>one thing.'}</h2>
      ${active ? `<p class="hero-description">${active.mode==='focus'?'Your session follows you between devices. Your place is kept.':'A break is underway. Look away, stretch, or get water.'}</p><div class="actions row wrap">${btn(active.mode==='focus'?'Return to my session →':'Return to my break →','nav','focus','primary')}</div>` : t ? `<div class="task-meta"><span>${esc(t.category)}</span><span>${t.minutes} MIN ESTIMATE</span><span>${esc(t.energy)} energy</span></div><div class="first-step"><span>YOUR FIRST MOVE</span>${first ? `<button class="step-start" data-action="step" data-id="${esc(t.id)}" data-step="${esc(first.id)}" aria-label="Complete step ${esc(first.title)}"><span aria-hidden="true">○</span>${esc(first.title)}</button>` : 'Choose one action you can do in the next two minutes.'}</div><div class="actions row wrap">${btn('Start 2-minute burst →', 'burst', t.id, 'primary')}${btn('Make it smaller', 'breakdown', t.id, 'text')}${btn('✓ Done', 'complete', t.id, 'text')}${btn('Choose another move','picker','','text')}</div>` : cleared ? `<p class="hero-description">You finished what you chose for today. Take a break, or leave it here.</p><div class="actions row wrap">${btn('Take a break →', 'break-space', '', 'primary')}${btn('Close the day', 'end-day', '', 'text')}</div>` : `<p class="hero-description">${waitingTask?`${esc(waitingTask.title)} is saved for later today. You don’t need to repeat it right now.`:'Add what you want to do. We’ll keep the next step in view.'}</p><div class="actions row wrap">${btn('+ Add one thing', 'new-task', '', 'primary')}${btn('Pick something for me →', 'picker', '', 'text')}</div>`}
    </section>
    <section class="timer-panel" aria-label="Focus timer"><div class="timer-heading"><span class="eyebrow">${(state.timer?.mode || timerMode) === 'focus' ? 'FOCUS SESSION' : 'BREAK SESSION'}</span><span class="timer-dot" aria-hidden="true"></span></div>${timerModes()}<div class="timer-time" data-timer>${timeText(state.timer ? remaining(state.timer) : duration * 60)}</div><p class="small">${state.timer ? (state.timer.status === 'paused' ? 'Paused. Resume when you’re ready.' : state.timer.mode === 'focus' ? 'Your only job: stay with this task.' : 'Get up. Stretch. Look away.') : timerMode === 'focus' ? 'Two minutes is a valid start.' : 'Get up. Stretch. Look away.'}</p>${state.timer ? timerControls() : durations() + timerControls()}${btn('Open focus space ↗', 'nav', 'focus', 'text compact')}</section>
  </div>
  ${returnCue()}${momentumPanel()}<section class="daily-strip" aria-label="Today’s progress"><div><span class="eyebrow">TODAY, SO FAR</span><strong>${m.completed} <span>${m.completed === 1 ? 'task completed' : 'tasks completed'}</span></strong></div><div class="shortlist-progress"><div class="progress-segments" aria-hidden="true">${Array.from({length:3}, (_,i) => `<span class="${i < completed ? 'complete' : i < shortlist.length ? 'planned' : ''}"></span>`).join('')}</div><span>${completed} of ${shortlist.length} shortlist tasks done</span></div><div class="focus-total"><strong>${m.focus}<span> min</span></strong><span>focus today</span></div></section>
  ${sparkPanel()}<div class="section-title row spread"><h2>Your shortlist <span class="pill">${shortlist.filter(t => !done(t, today())).length} / 3 open</span></h2>${btn('+ Choose a task', 'nav', 'tasks', 'text compact')}</div>
  <section class="task-list">${shortlist.length ? shortlist.map((t, i) => taskRow(t, i + 1)).join('') : `<div class="empty shortlist-empty"><span class="empty-symbol" aria-hidden="true">+</span><div><h3>Keep today small.</h3><p>Choose up to three tasks. Everything else stays in your inbox.</p></div>${btn('Choose your first task →', 'nav', 'tasks', 'secondary')}</div>`}</section>
  <div class="support-grid"><section class="support"><div class="row spread"><h3>Thought parking</h3><span class="kbd">C</span></div><p>Catch the thought. Keep your place.</p><form data-form="capture-inline" class="capture-bar"><input name="text" aria-label="Capture a thought" placeholder="What just popped into your head?" required maxlength="3000">${btn('Save →', 'submit', '', 'soft', 'type="submit" aria-label="Save thought"')}</form></section><section class="support restart-panel"><span class="eyebrow">A FRESH START</span><h3>Lost your thread?</h3><p>Restart with a two-minute session.</p><div class="row wrap">${btn('Help me restart →', 'restart', '', 'secondary')}${btn('Close the day', 'end-day', '', 'text compact')}</div></section></div>`;
}
function tasksPage() {
  let tasks = state.tasks.filter(t => taskTab === 'deleted' ? t.deleted : !t.deleted && (taskTab === 'habits' ? t.repeat !== 'none' : taskTab === 'completed' ? done(t, today()) : t.lane === taskTab && !done(t, today())));
  tasks = tasks.filter(t => (!search || t.title.toLowerCase().includes(search.toLowerCase())) && (!category || t.category === category)).sort((a, b) => a.order - b.order);
  return heading('Your tasks.', 'Collect everything here. Choose just a few for today.', btn('+ New task', 'new-task', '', 'primary')) + `<form class="capture-bar" data-form="quick-task"><span aria-hidden="true">+</span><input name="title" aria-label="Quickly add a task" placeholder="Add a task. Details can wait…" required maxlength="300">${btn('Add to inbox', 'submit', '', 'soft', 'type="submit"')}</form><div class="tabs" aria-label="Task lists">${[['inbox', 'Inbox'], ['today', 'Today'], ['later', 'Someday'], ['habits', 'Habits'], ['completed', 'Done'], ['deleted', 'Recently deleted']].map(([id, name]) => `<button data-action="task-tab" data-id="${id}" class="${taskTab === id ? 'active' : ''}" aria-pressed="${taskTab === id}">${name}</button>`).join('')}</div><div class="filter-row"><input id="task-search" type="search" placeholder="Find a task…" aria-label="Search tasks" value="${esc(search)}"><select id="category-filter" aria-label="Filter by category"><option value="">All categories</option>${state.categories.map(c => `<option ${category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><span class="small muted">${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}</span></div><section class="task-list">${tasks.length ? tasks.map(t => t.deleted ? `<div class="task-row"><div class="task-content"><span class="task-title">${esc(t.title)}</span><p class="small">Safe to bring back.</p></div>${btn('Restore', 'restore', t.id, 'soft compact')}</div>` : taskRow(t)).join('') : `<div class="empty"><h3>${taskTab === 'completed' ? 'Small wins will live here.' : taskTab === 'deleted' ? 'Nothing to restore.' : 'A little breathing room.'}</h3><p>${search || category ? 'Try another search or category.' : taskTab === 'habits' ? 'Create a task with a repeat interval to build a gentle routine.' : 'Add something when it comes to mind. There’s no need to fill the space.'}</p>${taskTab !== 'deleted' ? btn('+ Add a task', 'new-task', '', 'soft') : ''}</div>`}</section><p class="footer-note">Today holds at most three open tasks. Habits can repeat without losing their history.</p>`;
}
function planPage() {
  const calendar = calendarPanel(state,planDate,calendarView,today());
  if(calendarView === 'day') return calendar.toolbar + dayPlanPage() + calendar.list;
  return heading('Your calendar.', 'Make room for the weeks ahead.', btn('+ Add time block','new-block','','secondary') + btn('+ Add commitment','new-commitment','','primary')) + calendar.toolbar + calendar.content + calendar.list;
}
function dayPlanPage() {
  const blocks = schedule(state, planDate), clashes = conflicts(blocks), conflictIds = new Set(clashes.flat());
  return heading('Shape your day.', 'Fixed appointments. Flexible focus. Space between them.', btn('+ Add time block', 'new-block', '', 'primary')) + `<p class="small muted">${esc(friendlyDate(planDate))}</p>${clashes.length ? `<div class="notice warning">${clashes.length} overlapping ${clashes.length === 1 ? 'pair' : 'pairs'}. Edit a block or move your flexible blocks. Fixed appointments stay put.</div>` : ''}<div class="plan-layout"><section class="timeline">${blocks.length ? blocks.map(b => `<article class="timeblock"><div class="time">${clock(b.startMinute)}<br>${b.endMinute !== null ? clock(b.endMinute) : ''}</div><div style="--event-color:${blockColor(b,state.blocks)}" class="block ${b.kind === 'break' ? 'break' : ''}"><div class="row spread"><h3>${esc(b.name)}</h3><span class="pill">${b.mode === 'fixed' ? 'Fixed' : 'Flexible'}</span></div><div class="task-meta"><span>${b.duration} min</span><span>${b.repeat !== 'none' ? b.repeat : ''}</span>${conflictIds.has(b.id) ? '<span style="color:var(--danger)">Overlaps another block</span>' : ''}${b.startMinute === null ? '<span>Start your day to anchor this block</span>' : ''}</div><div class="row wrap">${peopleChips(state,b.personIds||[])}</div>${b.taskIds.map(id => taskById(id)).filter(t => t && !t.deleted).map(t => `<div class="mini-task"><button class="checkbox ${done(t, today()) ? 'checked' : ''}" data-action="complete" data-id="${esc(t.id)}" aria-label="Complete ${esc(t.title)}">${done(t, today()) ? '✓' : ''}</button>${esc(t.title)}</div>`).join('')}<div class="block-actions">${btn('▶ Focus', 'block-focus', b.id, 'text compact')}${btn('Edit', 'edit-block', b.id, 'text compact')}${btn(state.blockFeedback?.[planDate + ':' + b.id] ? '✓ Went well' : 'Check in', 'block-feedback', b.id, 'text compact')}${b.repeat !== 'none' ? btn('Skip this occurrence', 'skip-block', b.id, 'text compact') : ''}${btn(b.repeat !== 'none' ? 'Delete series' : 'Delete', 'delete-block', b.id, 'text compact danger')}</div></div></article>`).join('') : `<div class="empty"><h3>Your day doesn’t need to be packed.</h3><p>Add an appointment or a flexible focus block. Leave room for transitions and breaks.</p>${btn('Add your first block', 'new-block', '', 'soft')}</div>`}</section><aside class="plan-aside"><h3>Your day, your pace.</h3><p class="small">Flexible blocks begin relative to when you start your day. Fixed blocks stay on the clock.</p>${btn(state.wake[planDate] ? 'Re-anchor to now' : 'Start my day', 'wake', '', 'primary', planDate !== today() ? 'disabled' : '')}<details class="plan-tools" ${matchMedia('(min-width:801px)').matches ? 'open' : ''}><summary>Routines & planning tools</summary><div class="stack">${btn('Move flexible blocks +15 min', 'shift', '', 'secondary')}${btn('Save as a routine', 'save-template', '', 'secondary')}${btn('Copy today’s blocks here', 'clone-day', '', 'text', planDate === today() ? 'disabled' : '')}</div><div class="field"><label for="template-select">Saved routines</label><select id="template-select"><option value="">Choose a routine…</option>${state.templates.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></div><div class="row">${btn('Apply routine', 'apply-template', '', 'soft compact')}${btn('Delete routine', 'delete-template', '', 'text compact danger')}</div><hr style="border:0;border-top:1px solid var(--line);margin:23px 0"><p class="small">A 5–10 minute transition is useful space, too. Empty time is allowed.</p>${btn('Calendar connection', 'nav', 'settings', 'text compact')}</details></aside></div>`;
}
function sessionReceipt(){
  if(state.timer)return '';
  const session=state.sessions.filter(s=>s.mode==='focus'&&s.minutes>0&&s.date===today()).at(-1);if(!session)return '';
  const choice=(state.feelings||[]).find(f=>f.sessionId===session.id)?.feeling;
  return `<section class="session-receipt"><span class="eyebrow">YOUR LAST FOCUS · SAVED</span><h3>${session.minutes} minute${session.minutes===1?'':'s'} invested.</h3><p>${esc(taskById(session.taskId)?.title||'Focused time')}${state.settings.gamification?` · +${pointText(session.minutes)}`:''}</p><div class="row wrap">${canLeaveRunway(session.taskId)?btn('Leave a next move','leave-runway',session.taskId,'secondary compact'):''}${btn('See my progress','nav','progress','text compact')}</div><p class="small">How did this experience feel? (optional)</p><div class="feeling-buttons">${[['good','Felt good'],['neutral','Neutral'],['quieter','Too much → quieter']].map(([value,label])=>btn(label,'session-feeling',session.id,'text compact',`data-feeling="${value}" aria-pressed="${choice===value}"`)).join('')}</div>${choice?'<p class="small muted">Saved locally. You can change your choice.</p>':''}</section>`;
}
function sessionRunway(){
  if(!state.timer||state.timer.mode!=='focus')return '';
  return '<div class="session-runway"><progress data-session-progress value="0" max="100" aria-label="Session progress"></progress><p class="small" data-session-invested></p></div>';
}
function focusPage() {
  const focusId = state.timer ? state.timer.taskId : selectedTask === undefined ? next()?.id : selectedTask;
  const t = taskById(focusId);
  const first = t?.steps.find(s => !s.done), m = metrics(state, today()), resting = (state.timer?.mode || timerMode) !== 'focus';
  return heading(resting ? 'Time for a break.' : 'Focus on one thing.', resting ? 'Step away from the screen. Come back when you’re ready.' : 'Keep the next step in sight.', btn(zen ? 'Show workspace' : 'Quiet view', 'zen', '', 'secondary')) + `<div class="focus-layout"><section class="focus-stage">${timerModes()}<h2>${resting ? 'Rest is part of the rhythm.' : t ? esc(t.title) : 'You can start without a task.'}</h2><p class="small">${resting ? 'Stretch, get water, give your eyes a rest.' : 'Make a little progress. It doesn’t need to be perfect.'}</p><div class="timer-time" data-timer style="font-family:var(--timer-font)">${timeText(state.timer ? remaining(state.timer) : duration * 60)}</div>${sessionRunway()}${!state.timer ? durations() : `<p class="small" data-end-time></p>`}<div class="row">${timerControls()}</div>${!state.timer && !resting ? `<div class="focus-task-select"><label for="focus-task-select">What am I working on?</label><select id="focus-task-select"><option value="" ${selectedTask === null ? 'selected' : ''}>Unassigned focus</option>${state.tasks.filter(t => !t.deleted && isDue(t, today())).map(t => `<option value="${esc(t.id)}" ${t.id === (selectedTask === undefined ? next()?.id : selectedTask) ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></div>` : ''}${first && !resting ? `<div class="first-step row"><button class="checkbox" data-action="step" data-id="${esc(t.id)}" data-step="${esc(first.id)}" aria-label="Complete step ${esc(first.title)}"></button><span>${esc(first.title)}</span></div>` : ''}${t && !resting && !done(t, today()) ? btn('✓ Mark task done', 'complete', t.id, 'text') : ''}<details class="focus-options"><summary>Optional sound</summary><div class="sound-controls row"><label for="sound-select" class="small muted">Soundscape</label><select id="sound-select"><option value="off">Off</option><option value="brown">Brown noise</option><option value="rain">Soft rain</option><option value="white">White noise</option></select><input id="sound-volume" type="range" min="0" max="1" step="0.05" value="${state.settings.volume}" aria-label="Soundscape volume"></div></details>${state.settings.gamification && state.settings.equipped?.title ? `<p class="pill">${esc(state.settings.equipped.title.data.title)}</p>` : ''}<p class="small muted">${m.sessions} focus ${m.sessions === 1 ? 'session' : 'sessions'} today · ${m.focus} minutes that count</p>${btn('Fullscreen ↗', 'fullscreen', '', 'text compact')}</section><form class="capture-bar" data-form="capture-inline" style="margin-top:20px"><span aria-hidden="true">⌑</span><input name="text" placeholder="Distracting thought? Park it here…" aria-label="Park a distracting thought" required maxlength="3000">${btn('Park it', 'submit', '', 'soft', 'type="submit"')}</form><p class="footer-note">Pausing is allowed. Partial focus earns credit. Breaks are always free.</p>${sessionReceipt()}</div>`;
}
function capturePage() {
  return heading('Thought parking.', 'Catch ideas and reminders. Organize them later.') + `<form data-form="capture-page" class="stack" style="margin-bottom:28px"><label for="capture-text">What do you want to remember?</label><textarea id="capture-text" name="text" placeholder="Write it here. You don’t have to organize it yet." required maxlength="3000"></textarea><div>${btn('+ Save thought', 'submit', '', 'primary', 'type="submit"')}</div></form>${state.notes.length ? state.notes.map(n => `<article class="note-row"><p>${esc(n.text)}</p><div class="row spread"><span class="small muted">${esc(friendlyDate(dateKey(n.created, state.settings.timezone)))}</span><div class="row">${btn('Make a task', 'note-task', n.id, 'soft compact')}${btn('Remove', 'note-delete', n.id, 'text compact')}</div></div></article>`).join('') : `<div class="empty"><h3>Nothing to hold onto right now.</h3><p>Use “Capture” from anywhere, or press C. You can decide what to do with a thought later.</p></div>`}`;
}
function progressPage() {return baseProgressPage()+socialProgress(state,today());}
function baseProgressPage() {
  const feedback = Object.entries(state.blockFeedback || {}).filter(([key]) => key.startsWith(today() + ':')).map(([, value]) => value);
  const m = metrics(state, today()), days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6)), values = days.map(d => metrics(state, d).focus), max = Math.max(30, ...values);
  return heading('Your momentum.', 'See what you did. No streak to protect.') + growthPanel() + keepsakePanel() + `<div class="metric-grid">${[[m.focus, 'Focus minutes today'], [m.completed, 'Small wins today'], [m.totalFocus, 'Focus minutes, all time'], [m.activeDays, 'Days you showed up']].map(([value, label]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><section class="chart"><div class="row spread"><h2>A week of showing up</h2><span class="small muted">Focus minutes</span></div><div class="chart-bars" role="img" aria-label="${days.map((d, i) => `${d}: ${values[i]} minutes`).join('; ')}">${days.map((d, i) => `<div class="chart-day"><span>${values[i]}m</span><div class="chart-bar" style="height:${Math.max(3, values[i] / max * 120)}px"></div><span>${new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00Z'))}</span></div>`).join('')}</div></section><div class="support-grid"><section class="support green"><h3>Every return counts.</h3><p>${m.totalFocus ? `You’ve made space for ${m.totalFocus} minutes of attention. Short sessions belong in that story, too.` : 'Your first session can be two minutes. Start small and find the rhythm that works for you.'}</p>${btn('Make a little room', 'nav', 'focus', 'secondary')}</section><section class="support"><h3>What helped today?</h3><p>A short reflection can help you find your own patterns.</p>${btn('Reflect & close the day', 'end-day', '', 'secondary')}</section></div><div class="section-title"><h2>Recent focus</h2></div><div class="task-list">${state.sessions.filter(s => s.mode === 'focus').slice(-10).reverse().map(s => `<div class="task-row"><div class="task-content"><span class="task-title">${esc(taskById(s.taskId)?.title || 'Unassigned focus')}</span><p class="small">${s.date} · ${s.minutes===0?'Started · no minutes saved':s.full?'Full session':'Partial progress'}</p></div><span class="pill">${s.minutes} min</span></div>`).join('') || '<div class="empty"><p>Your sessions will appear here.</p></div>'}</div><div class="section-title"><h2>Your reflections</h2>${feedback.length ? `<p class="small muted">${feedback.filter(Boolean).length} of ${feedback.length} blocks felt productive today. Use that to adjust your next plan.</p>` : ''}</div>${Object.entries(state.checkins).filter(([, c]) => c.reflection).sort().reverse().slice(0, 7).map(([day, c]) => `<article class="note-row"><p>${esc(c.reflection)}</p><span class="small muted">${day}</span></article>`).join('') || '<p class="small muted">A reflection is optional. You can simply close the day.</p>'}`;
}
function rewardsPage() {
  if (!state.settings.gamification) return heading('Rewards are switched off.', 'You can use tasks, focus and breaks without coins.') + `<div class="notice">Rewards are optional. Enable “Rewards & gentle goals” in Settings whenever you want to try them.</div>`;
  const m = metrics(state, today());
  const quests = [['start', 'Make a start', 'Focus for at least two minutes.', m.focus >= 2], ['finish', 'One small win', 'Complete one task or habit.', m.completed >= 1], ['return', 'Find your rhythm', `Finish ${state.settings.dailyGoal} focus sessions.`, m.sessions >= state.settings.dailyGoal]];
  return heading('Make it rewarding.', 'Choose what feels good. Ordinary breaks are always free.', `<div><span class="coin-total">◇ ${state.coins}</span><p class="small">coins to enjoy</p></div>`) + `<div class="row spread section-title"><h2>Your rewards</h2>${btn('+ Create a reward', 'new-reward', '', 'secondary')}</div><div class="reward-grid">${state.rewards.map(r => `<article class="reward"><span class="reward-symbol" aria-hidden="true">◇</span><h3>${esc(r.name)}</h3><p>${r.minutes ? `${r.minutes} minute optional reward timer` : 'A reward chosen by you'}</p><div class="row spread"><span class="pill">${r.cost} coins</span>${btn('Enjoy', 'buy', r.id, 'primary compact', state.coins < r.cost ? 'disabled' : '')}${btn('×', 'reward-delete', r.id, 'text compact', 'aria-label="Remove reward"')}</div></article>`).join('')}</div><div class="section-title"><h2>Gentle goals</h2></div><div class="task-list">${quests.map(([id, title, text, achieved]) => { const claimed = state.events.some(e => e.key === `${today()}:${id}`); return `<div class="task-row"><div class="task-content"><h3>${title}</h3><p class="small">${text}</p></div>${claimed ? '<span class="pill">Claimed</span>' : btn('+5 coins', 'quest', id, achieved ? 'soft compact' : 'secondary compact', achieved ? '' : 'disabled')}</div>`; }).join('')}</div><div class="section-title"><h2>A growing collection</h2>${btn('Browse all 55 unlockables', 'collection', '', 'text compact')}</div><p class="small muted">Milestones never expire. A missed day takes nothing away.</p><div class="milestones">${[[15, 'First spark'], [60, 'Finding a rhythm'], [180, 'Making room'], [600, 'Returning to yourself'], [1500, 'A steady practice'], [2700, 'Room to grow']].map(([min, name]) => `<div class="milestone ${m.totalFocus < min ? 'locked' : ''}">${m.totalFocus >= min ? '✓' : '◇'} ${name}<br><span class="small muted">${min} focus minutes</span></div>`).join('')}</div><div class="section-title"><h2>Ready to enjoy</h2></div>${state.redemption ? `<div class="notice row spread"><span>Reward break · <strong data-redeem-timer>${timeText(Math.max(0, (state.redemption.deadline - Date.now()) / 1000))}</strong></span>${btn('Stop & save unused minutes', 'redeem-stop', '', 'secondary compact')}</div>` : ''}<div class="task-list">${state.purchases.filter(p => !p.used && p.minutes).map(p => `<div class="task-row"><span class="task-content">${esc(p.reward)} · ${p.minutes} min</span>${btn('Start break', 'redeem', p.id, 'soft compact')}</div>`).join('') || '<div class="empty"><p>Your timed rewards will wait here. A regular break is always available in Focus.</p></div>'}</div>`;
}
function switchField(name, title, desc) { return `<div class="switch-row"><input type="checkbox" id="s-${name}" name="${name}" ${state.settings[name] ? 'checked' : ''}><label for="s-${name}">${title}<span class="small">${desc}</span></label></div>`; }
function engagementSettings(){
  const p=momentum(state,today()).prefs;
  return `<section class="settings-panel engagement-settings"><h2>Make progress feel good</h2><p class="small">Choose the feedback you enjoy. Low-stimulation mode also quiets these effects.</p><form data-form="engagement">${[['feedback','Acknowledge my effort'],['novelty','A fresh daily starter'],['haptics','A short vibration after a win (supported phones)'],['chime','A soft note after task completion']].map(([key,label])=>`<div class="switch-row"><input type="checkbox" id="eng-${key}" name="${key}" ${p[key]?'checked':''}><label for="eng-${key}">${label}</label></div>`).join('')}${btn('Save encouragement','submit','','secondary','type="submit"')}</form></section>`;
}
function settingsPage() {
  const s = state.settings;
  return heading('Tune your workspace.', 'Adjust the rhythm, the look, and your connections.') + engagementSettings() + `<section class="guide-settings row spread wrap"><div><h3>Keep your workspace within reach</h3><p class="small">Open the same home-server address on every device. Add it to your phone’s home screen for a quick return.</p></div>${btn('Add to my home screen','install-help','','secondary')}</section>` + `<section class="guide-settings row spread wrap"><div><h3>Learn the daily loop</h3><p class="small">Replay the page-by-page guide. Your tasks and preferences stay intact.</p></div>${btn(state.onboarding?.status==='paused'?'Resume setup guide':state.onboarding?.status==='active'?'Restart setup guide':'Replay setup guide',state.onboarding?.status==='active'?'guide-restart':'guide-start','','secondary')}${state.onboarding?.status==='paused'?btn('Start guide from beginning','guide-restart','','text compact'):''}</section><form data-form="settings"><div class="settings-grid"><section class="settings-panel"><h2>Your space</h2>${field('What should we call you?', 'name', s.name, 'text', 'maxlength="60"')}${select('Appearance', 'theme', [['light', 'Daylight'], ['dark', 'Evening'], ['system', 'Follow my device']], s.theme)}${field('Timezone', 'timezone', s.timezone, 'text', 'required')}${select('Timer typeface', 'timerFont', [['sans', 'Simple'], ['mono', 'Monospace'], ['serif', 'Bookish']], s.timerFont)}${switchField('lowStim', 'Less visual stimulation', 'Quiet surfaces and fewer supporting panels.')}${switchField('reducedMotion', 'Reduce motion', 'Remove interface transitions.')}${switchField('gamification', 'Rewards & gentle goals', 'Show coins and milestones. Turn off whenever you prefer.')}</section><section class="settings-panel"><h2>Your rhythm</h2><div class="form-grid">${field('Focus (minutes)', 'focusMinutes', s.focusMinutes, 'number', 'min="1" max="120" required')}${field('Short break', 'shortBreak', s.shortBreak, 'number', 'min="1" max="120" required')}${field('Long break', 'longBreak', s.longBreak, 'number', 'min="1" max="120" required')}${field('Sessions before long break', 'cycles', s.cycles, 'number', 'min="1" max="8" required')}${field('Full-session threshold (%)', 'partialThreshold', s.partialThreshold, 'number', 'min="50" max="100" required')}${field('Daily session goal', 'dailyGoal', s.dailyGoal, 'number', 'min="1" max="10" required')}</div>${switchField('sound', 'A gentle finish sound', 'A single chime when a timer ends.')}${switchField('autoBreak', 'Start a break after focus', 'Move straight into a short or long break.')}${field('Sound volume', 'volume', s.volume, 'range', 'min="0" max="1" step="0.05"')}<p class="small muted">All completed focus minutes earn credit. The threshold only decides whether a session counts as full.</p></section></div><div class="row" style="margin:22px 0">${btn('Save preferences', 'submit', '', 'primary', 'type="submit"')}<span class="error-text" id="settings-error"></span></div></form><div class="settings-grid"><section class="settings-panel"><h2>Keep your data safe</h2><p class="small" style="margin-bottom:17px">Export an Episuite backup, or import an EpiApps / Epimix backup. Import replaces the matching records and saves a server backup first.</p><div class="row wrap"><a class="btn secondary" href="/api/export" download="episuite-backup.json">Export backup ↓</a>${btn('Import backup', 'import', '', 'secondary')}<input id="import-file" type="file" accept="application/json,.json" hidden></div><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>Categories</h3><div class="row wrap" style="margin:15px 0">${state.categories.map(c => `<span class="pill">${esc(c)}${c !== 'Personal' ? `<button data-action="delete-category" data-id="${esc(c)}" aria-label="Remove ${esc(c)}"> ×</button>` : ''}</span>`).join('')}</div><form data-form="category" class="row"><input name="name" aria-label="New category name" placeholder="New category" required maxlength="50">${btn('Add', 'submit', '', 'soft', 'type="submit"')}</form></section><section class="settings-panel"><h2>Calendar connection</h2><p class="small" style="margin-bottom:17px">Export an .ics file from My day, or sync to a CalDAV calendar. Use the full calendar collection URL.</p><form data-form="calendar">${field('Calendar collection URL', 'url', state.calendar.url, 'url')}${field('Username', 'username', state.calendar.username)}${field('Password / app password', 'password', '', 'password', `autocomplete="new-password" placeholder="${state.calendar.configured ? 'Saved; leave blank to keep' : ''}"`)}<div class="row wrap">${btn('Save connection', 'submit', '', 'secondary', 'type="submit"')}${btn('Sync today', 'calendar-sync', '', 'soft')}${btn('Remove synced events', 'calendar-remove', '', 'text compact')}</div></form><p class="small muted" style="margin-top:13px">Credentials stay on your server and are excluded from exports. Live sync needs a reachable CalDAV server.</p></section><section class="settings-panel"><h2>A little help getting started</h2><p class="small" style="margin-bottom:15px">Optional local AI can turn a task into smaller actions. Connect Ollama on your home server (see the Docker setup in the README). Manual steps always work.</p><form data-form="ai-settings">${field('Ollama model', 'ollamaModel', s.ollamaModel)}${btn('Save model', 'submit', '', 'secondary', 'type="submit"')}</form><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>Your background</h3><p class="small">A quiet image, if it helps you. JPG, PNG or WebP, up to 1 MB.</p><input id="background-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose background image" style="margin:14px 0">${btn('Remove background', 'remove-background', '', 'text compact')}<h3 style="margin-top:22px">Optional focus video</h3><p class="small">Muted, behind the focus screen only. Saved on this browser. Up to 30 MB; hidden in low-stimulation or reduced-motion mode.</p><input id="video-file" type="file" accept="video/mp4,video/webm" aria-label="Choose focus background video" style="margin:14px 0">${btn('Remove video', 'remove-video', '', 'text compact')}</section><section class="settings-panel"><h2>Connect your watch</h2><p class="small">The included EpiBlock Zepp app can read your day through <code>/api/v1/day</code>. Point its server setting at this app’s reachable address. See the README for the watch display update and LAN setup.</p><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>Using Episuite</h3><p class="small">Press C to capture, N for a task, and F for focus. In the Focus screen, Space pauses or resumes. Quiet view keeps the rest of the workspace out of sight.</p><p class="small" style="margin-top:15px">Episuite supports your workflow. Its ADHD usefulness score is a simulated usability assessment, not a clinical result.</p></section></div>`;
}
function showDialog(title, content, formName = '', submitLabel = 'Save') {
  delete $('#dialog').dataset.welcome;
  lastFocus = document.activeElement;
  $('#dialog').innerHTML = `<div class="dialog-head"><h2>${title}</h2><button data-action="close-dialog" aria-label="Close dialog">×</button></div>${formName ? `<form data-form="${formName}">` : ''}${content}<div class="error-text" id="dialog-error" role="alert"></div>${formName ? `<div class="dialog-foot">${btn('Cancel', 'close-dialog', '', 'text')}${btn(submitLabel, 'submit', '', 'primary', 'type="submit"')}</div></form>` : ''}`;
  $('#dialog').showModal();
  updateOptionalFields();
  setTimeout(() => ($('#dialog').querySelector('input:not([type=hidden]),textarea,select') || $('#dialog').querySelector('button'))?.focus(), 0);
}
async function installationStatus(){
  const installed=matchMedia('(display-mode:standalone)').matches||navigator.standalone;
  let ready=false;try{ready=Boolean((await navigator.serviceWorker?.getRegistration())?.active);}catch{}
  return '<section class="installation-status"><strong>'+(installed?'Installed on this device':window.isSecureContext?'Secure connection · installation supported':'HTTPS needed for full phone installation')+'</strong><p class="small">'+(ready?'Offline workspace is ready. Saved data can reopen; captures queue until your server returns.':window.isSecureContext?'Offline cache is preparing. Keep the app open briefly, then reopen this panel.':'Tasks, calendar and Social work here while connected. Use your Tailscale HTTPS address for installation.')+'</p></section>';
}
window.addEventListener('appinstalled',()=>{installPrompt=null;toast('Episuite installed. Open it from your home screen.');});
function closeDialog() { $('#dialog').close(); lastFocus?.focus(); }
function taskDialog(id) {
  const t = id ? taskById(id) : { title: '', description: '', category: 'Personal', minutes: 15, energy: 'medium', difficulty: 1, repeat: 'none', target: 1, due: '', lane: page === 'now' ? 'today' : 'inbox', steps: [] };
  showDialog(id ? 'Make this task work for you' : 'One thing on your mind', `<input type="hidden" name="expectedVersion" value="${t.editVersion||0}"><input type="hidden" name="id" value="${esc(id || '')}">${field('What do you want to do?', 'title', t.title, 'text', 'required maxlength="300"')}<div class="form-grid">${select('Where does it belong?', 'lane', [['inbox', 'Inbox'], ['today', 'Today · keep it small'], ['later', 'Someday']], t.lane)}${field('Roughly how many minutes?', 'minutes', t.minutes, 'number', 'min="1" max="480" required')}</div><details class="task-details"><summary>Categories, habits & tiny steps</summary><div class="form-grid">${select('Category', 'category', state.categories.map(c => [c, c]), t.category)}${select('Energy needed', 'energy', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], t.energy)}${select('How much effort?', 'difficulty', [[1, 'Small · 5 coins'], [2, 'Medium · 10 coins'], [3, 'Big · 20 coins']], t.difficulty)}${field('Due date (optional)', 'due', t.due, 'date')}${select('Repeat', 'repeat', [['none', 'Just once'], ['daily', 'Every day'], ['weekly', 'Every week'], ['interval_0.5', 'Twice a day'], ['interval_3', 'Every 3 days'], ['interval_7', 'Every 7 days'], ['custom', 'Custom interval']], /^(none|daily|weekly|interval_0.5|interval_3|interval_7)$/.test(t.repeat) ? t.repeat : 'custom')}${field('Minimum time between daily repeats (minutes)', 'minimumGapMinutes', t.minimumGapMinutes ?? (t.repeat === 'interval_0.5' ? 360 : 0), 'number', 'min="0" max="1440" required')}${field('Custom interval (days)', 'interval', t.repeat.startsWith('interval_') ? t.repeat.slice(9) : 2, 'number', 'min="0.05" max="365" step="0.05"')}</div><div class="field"><label for="task-description">A note to your future self</label><textarea name="description" id="task-description" maxlength="3000">${esc(t.description)}</textarea></div><div class="field"><label for="task-steps">Tiny steps (one per line)</label><textarea name="steps" id="task-steps" placeholder="Open the document\nWrite the first sentence">${esc(t.steps.map(s => s.title).join('\n'))}</textarea></div></details>${id ? `<div class="row wrap">${btn('Break into small steps', 'ai-steps', id, 'soft compact')}${btn('Delete task', 'delete-task', id, 'text compact danger')}</div>` : ''}`, 'task', id ? 'Save task' : 'Add task');
}
function blockDialog(id) {
  const b = id ? state.blocks.find(b => b.id === id) : { name: '', date: planDate, mode: 'fixed', start: '09:00', duration: 30, offset: 0, repeat: 'none', taskIds: [], kind: 'focus' };
  if (b.commitment) { showDialog('Edit commitment', commitmentForm(b,planDate)+colorField(b,state.blocks)+peopleSelector(state,b.personIds||[]) + (b.excludedDates?.length ? '<p class="small muted">Skipped: ' + b.excludedDates.map(esc).join(', ') + '</p>' + btn('Restore skipped occurrences','restore-occurrences',b.id,'text compact') : ''), 'commitment', 'Save commitment'); return; }
  showDialog(id ? 'Adjust this time block' : 'Make a little room', `<input type="hidden" name="expectedVersion" value="${b.editVersion||0}"><input type="hidden" name="id" value="${esc(id || '')}">${field('Block name', 'name', b.name, 'text', 'required maxlength="120"')}<div class="form-grid">${field('Date', 'date', b.date, 'date', 'required')}${select('Timing', 'mode', [['fixed', 'Fixed · appointment'], ['relative', 'Flexible · after my day starts']], b.mode)}${field('Fixed start time', 'start', b.start, 'time', 'required')}${field('Minutes after day starts', 'offset', b.offset, 'number', 'min="0" max="1425" step="15"')}${field('Length (minutes)', 'duration', b.duration, 'number', 'min="5" max="480" required')}${select('Repeat', 'repeat', [['none', 'Only this day'], ['daily', 'Every day'], ['weekly', 'Every week']], b.repeat)}${select('Kind', 'kind', [['focus', 'Focus'], ['break', 'Break / transition']], b.kind)}</div>${colorField(b,state.blocks)}${peopleSelector(state,b.personIds||[])}<label>Tasks in this block</label>${state.tasks.filter(t => !t.deleted && !t.completed).map(t => `<div class="switch-row"><input type="checkbox" name="taskIds" id="b-${esc(t.id)}" value="${esc(t.id)}" ${b.taskIds.includes(t.id) ? 'checked' : ''}><label for="b-${esc(t.id)}">${esc(t.title)}</label></div>`).join('') || '<p class="small muted">You can add tasks later.</p>'}`, 'block', 'Save block');
  updateOptionalFields();
}
function updateOptionalFields() {
  const repeat = $('#dialog #f-repeat'), interval = $('#dialog #f-interval');
  if (repeat && interval) interval.closest('.field').hidden = repeat.value !== 'custom';
  const gap=$('#dialog #f-minimumGapMinutes');if(gap&&repeat){const multi=repeat.value==='interval_0.5'||(repeat.value==='custom'&&Number(interval?.value)<1);gap.closest('.field').hidden=!multi;}
  const mode = $('#dialog #f-mode'), start = $('#dialog #f-start'), offset = $('#dialog #f-offset');
  if (mode && start && offset) { start.closest('.field').hidden = mode.value !== 'fixed'; offset.closest('.field').hidden = mode.value !== 'relative'; }
}
async function onTimerComplete(timer,priorKeepsakes) {
  timerMode=state.timer?.mode||(timer.mode==='focus'?'short':'focus');duration=state.timer?state.timer.duration/60:timerMode==='focus'?state.settings.focusMinutes:state.settings.shortBreak;
  const saved=state.sessions.find(s=>s.id===timer.id);
  const acknowledged=saved?.mode==='focus'&&saved.minutes>0&&showWin(`${saved.minutes} minute${saved.minutes===1?'':'s'} invested.`,`${taskById(saved.taskId)?.title||'Focused time'} · +${pointText(saved.minutes)}. Your effort is saved.`,priorKeepsakes);
  chime();
  if(!acknowledged)toast(timer.mode === 'focus' ? 'A little progress made. Time for a break.' : 'Break finished. Return when you’re ready.');
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification('Episuite', { body: timer.mode === 'focus' ? 'Your focus session is finished. Make room for a break.' : 'Your break is finished. Return when you’re ready.' });
}
function updateTimer() {
  if(state?.timer?.mode==='focus'){
    const seconds=Math.max(0,state.timer.duration-remaining(state.timer));
    const bar=$('[data-session-progress]');if(bar)bar.value=Math.min(100,100*seconds/state.timer.duration);
    const copy=$('[data-session-invested]');if(copy)copy.textContent=seconds<60?'The first minute: open what you need.':`${Math.floor(seconds/60)} minute${seconds<120?'':'s'} invested · stay with the next small move.`;
  }
  if (!state) return;
  const t = state.timer, seconds = t ? remaining(t) : duration * 60;
  document.querySelectorAll('[data-timer],[data-mini-timer]').forEach(el => el.textContent = timeText(seconds));
  const track = $('.timer-track'); if (track && t) track.style.setProperty('--progress', `${(1 - seconds / t.duration) * 100}%`);
  const end = $('[data-end-time]'); if (end && t) end.textContent = t.status === 'paused' ? 'Paused. Your progress is safe.' : `Finishes around ${new Intl.DateTimeFormat('en', { timeZone: state.settings.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(t.deadline))}`;
  if (state.redemption) { const el = $('[data-redeem-timer]'); if (el) el.textContent = timeText(Math.max(0, (state.redemption.deadline - Date.now()) / 1000)); }
  document.querySelectorAll('.focus-stage,.timer-panel').forEach(el => { el.style.boxShadow = state.settings.gamification && !state.settings.lowStim ? state.settings.equipped?.glow?.data?.glow || '' : ''; });
  document.title = t ? `${timeText(seconds)} · Episuite` : 'Episuite · Find your momentum';
}
function ensureAudio() { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); return audio; }
function chime() {
  if (!state.settings.sound) return;
  try { const ctx = ensureAudio(), osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = 660; gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.linearRampToValueAtTime(state.settings.volume * .25, ctx.currentTime + .02); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .8); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .8); } catch {}
}
function soundscape(kind) {
  soundKind = kind;
  if (soundNode) { soundNode.stop(); soundNode.disconnect(); soundNode = null; }
  if (soundGain) { soundGain.disconnect(); soundGain = null; }
  if (kind === 'off') return;
  const ctx = ensureAudio(), buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), channel = buffer.getChannelData(0); let last = 0;
  for (let i = 0; i < channel.length; i++) { const white = Math.random() * 2 - 1; if (kind === 'brown') { last = (last + .02 * white) / 1.02; channel[i] = last * 3.5; } else channel[i] = white * .4; }
  soundNode = ctx.createBufferSource(); soundNode.buffer = buffer; soundNode.loop = true; soundGain = ctx.createGain(); soundGain.gain.value = Number($('#sound-volume')?.value || state.settings.volume) * .2;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = kind === 'rain' ? 2400 : kind === 'brown' ? 450 : 10000; soundNode.connect(filter); filter.connect(soundGain); soundGain.connect(ctx.destination); soundNode.start();
}
async function action(name, id, el) {
  switch (name) {
    case 'install-help': {
      if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return;}
      showDialog('Install Episuite',`${await installationStatus()}<p>Use the same address on your devices to keep this workspace and offline capture queue together.</p><p><strong>iPhone / iPad:</strong> open in Safari, tap Share, then Add to Home Screen.</p><p><strong>Android / desktop:</strong> open the browser menu and choose Install app or Add to Home screen when offered.</p><p class="small">${window.isSecureContext?'If the browser has no install button yet, use its menu. On iPhone, choose Share → Add to Home Screen and keep Open as Web App enabled if shown.':'This address uses plain HTTP. For your Tailscale production setup, open the HTTPS .ts.net address printed by Tailscale Serve. elysium:3210 and a LAN IP work for testing, but cannot enable full phone offline installation.'}</p>`);return;
    }
    case 'session-feeling': await request('/api/engagement/feeling',{sessionId:id,feeling:el.dataset.feeling});$('#momentum-win')?.remove();render();toast(el.dataset.feeling==='quieter'?'Feedback is quieter. Change it any time in Settings.':'Saved. This helps you notice what works.');return;
    case 'leave-runway': {const t=taskById(id);if(!canLeaveRunway(id))return;showDialog('Make the next start easier',`<p>For: ${esc(t.title)}. Leave one action your future self can begin.</p><input type="hidden" name="id" value="${esc(id)}">${field('Next tiny action', 'title','','text','required maxlength="300" placeholder="Open the worksheet at problem two…"')}`,'runway','Save next move');return;}
    case 'return-cue': {const p=momentum(state,today()).prefs;showDialog('A reason to come back',`<p>Pair a tiny start with something you already do. Choose a reason that matters to you.</p>${field('What is this time for?', 'intent',p.intent,'text','maxlength="160" placeholder="Learning, making room for people, building my future…"')}${field('After what everyday moment?', 'cue',p.cue,'text','maxlength="160" placeholder="After breakfast, after class, when I sit down…"')}<p class="small muted">This is a cue you choose, not a notification or obligation.</p>`,'return-cue','Keep my cue');return;}
    case 'picker': actionChoices=[];actionPicker();return;
    case 'picker-next': actionPicker();return;
    case 'picker-add': closeDialog();taskDialog();return;
    case 'picker-rest': closeDialog();return action('break-space');
    case 'picker-start': closeDialog();return action('burst',id);
    case 'win-close': $('#momentum-win')?.remove();return;
    case 'win-break': $('#momentum-win')?.remove();return action('break-space');
    case 'momentum-goal': showDialog('What would feel like enough today?', `<p>Choose a small finish line. You can change it. Missing it takes nothing away.</p><div class="goal-picks">${goalOptions.map(g=>btn(`${g[1]} · ${g[2]} ${g[3]==='focus'?'minutes':'check-off'}`,'momentum-set',g[0],'secondary')).join('')}</div>`);return;
    case 'momentum-set': await request('/api/engagement',{goal:id});closeDialog();render();return;
    case 'burst': {
      $('#momentum-win')?.remove();
      if(state.timer)return action('nav','focus');
      ensureAudio();selectedTask=id||next()?.id||null;timerMode='focus';duration=2;
      await request('/api/timer/start',{mode:'focus',minutes:2,taskId:selectedTask});
      page='focus';location.hash=page;zen=true;render();$('#main')?.focus();window.scrollTo({top:0,behavior:'instant'});return;
    }
    case 'submit': return;
    case 'reload': return load(true);
    case 'guide-start': return guideMove(state.onboarding?.status==='complete'?0:state.onboarding?.step||0);
    case 'guide-restart': return guideMove(0);
    case 'guide-return': return guideMove(state.onboarding?.step||0);
    case 'guide-pause': return guideMove(state.onboarding?.step||0,'paused');
    case 'guide-back': return guideMove(Math.max(0,(state.onboarding?.step||0)-1));
    case 'guide-next': {
      const step=state.onboarding?.step||0;
      if(step<7)return guideMove(step+1);
      const preferences=$('[data-form="settings"]');
      if(preferences){
        if(!preferences.reportValidity())return;
        const data=Object.fromEntries(new FormData(preferences));
        for(const key of ['sound','gamification','lowStim','reducedMotion','autoBreak'])data[key]=preferences.elements[key].checked;
        const timingKey=timerMode==='focus'?'focusMinutes':timerMode==='short'?'shortBreak':'longBreak';
        const oldDuration=state.settings[timingKey];
        await request('/api/settings',data);
        if(!state.timer&&state.settings[timingKey]!==oldDuration)duration=state.settings[timingKey];
      }
      await guideMove(7,'complete');
      showDialog('You have enough to begin.', '<p>Build the system through use. You do not need to finish organizing your whole life today.</p><ol class="daily-loop"><li><strong>Choose one task.</strong> Move it from Inbox to Today.</li><li><strong>Give it a short burst.</strong> Focus for two minutes or more, then take a break.</li><li><strong>Park interruptions.</strong> Capture thoughts instead of switching tasks.</li><li><strong>Close the day.</strong> Keep unfinished work safe for tomorrow.</li></ol><div class="dialog-foot">'+btn('Go to Now →','guide-finish','','primary')+'</div>');return;
    }
    case 'guide-finish': closeDialog(); return action('nav','now');
    case 'guide-two-min': if(state.timer){toast('A session is already active. Pause or finish it first.');return;}timerMode='focus';duration=2;render();toast('Two minutes selected. Start whenever you are ready.');return;
    case 'guide-category': showDialog('Name one part of your life', `<p class="small" style="margin-bottom:18px">Use any name that makes sense to you, such as Work, Learning, Family or Health. Categories help you find related tasks; they do not create more work.</p><div class="field"><label for="guide-category-name">Category name</label><input id="guide-category-name" name="name" required maxlength="50"></div>`, 'category', 'Add category'); return;
    case 'guide-new-task': taskDialog(); if(state.tasks.filter(t=>t.lane==='today'&&!t.deleted&&!done(t,today())).length<3)$('#f-lane').value='today'; return;
    case 'nav': if(id==='menu'){showDialog('Your workspace','<div class="phone-menu">'+navItems.filter(([key])=>key!=='rewards'||state.settings.gamification).map(([key,,label])=>btn(label,'menu-nav',key,'secondary')).join('')+btn('Settings','menu-nav','settings','secondary')+btn('Install Episuite','install-help','','soft')+'</div>');return;} $('#momentum-win')?.remove();page = id; if (page !== 'focus') soundscape('off'); zen = false; location.hash = page; render(); $('#main')?.focus(); window.scrollTo({top:0,behavior:'instant'}); return;
    case 'quick-capture': showDialog('Put it somewhere safe', '<div class="field"><label for="quick-capture">What’s on your mind?</label><textarea id="quick-capture" name="text" required maxlength="3000" placeholder="A thought, an idea, a reminder…"></textarea></div>', 'capture-dialog', 'Save thought'); return;
    case 'new-task': taskDialog(); return;
    case 'edit-task': taskDialog(id); return;
    case 'close-dialog': closeDialog(); return;
    case 'undo-habit': await request(`/api/tasks/${id}/undo`);render();toast('Last completion undone.');return;
    case 'complete': {
      const priorKeepsakes=keepsakes(state,today());
      const wasDone = done(taskById(id), today());
      const result = await request(`/api/tasks/${id}/complete`);
      const isDone = done(taskById(id), today());
      render();
      if (!wasDone && isDone) $('.daily-strip')?.classList.add('win-feedback');
      if(wasDone)$('#momentum-win')?.remove();
      const acknowledged=!wasDone&&showWin(isDone?'One thing finished.':'A useful check-off.',`${taskById(id).title} · +10 growth points${result.result.delta>0?' · +'+result.result.delta+' coins':''}`,priorKeepsakes);
      if(!acknowledged)toast(wasDone ? 'Completion undone.' : `${isDone ? '✓ Task complete.' : '✓ Progress saved.'}${state.settings.gamification && result.result.delta > 0 ? ' +' + result.result.delta + ' coins' : ''}`);
      return;
    }
    case 'today-task': await request(`/api/tasks/${id}`, { lane: 'today' }, 'PATCH'); render(); toast('Made room for it today.'); return;
    case 'focus-task': selectedTask = id; duration = Math.min(state.settings.focusMinutes, taskById(id).minutes); timerMode = 'focus'; page = 'focus'; location.hash = page; render(); return;
    case 'breakdown': taskDialog(id); $('.task-details').open = true; $('#task-steps')?.focus(); return;
    case 'ai-steps': { el.disabled = true; el.textContent = 'Making small steps…'; try { const result = await request('/api/ai/breakdown', { title: $('#f-title').value }); $('.task-details').open = true; $('#task-steps').value = result.steps.join('\n'); } finally { el.disabled = false; el.textContent = 'Break into small steps'; } return; }
    case 'delete-task': await request(`/api/tasks/${id}`, {}, 'DELETE'); closeDialog(); render(); toast('Task moved to recently deleted.', id); return;
    case 'undo': case 'restore': await request(`/api/tasks/${id}/restore`); render(); toast('Task restored to the inbox.'); return;
    case 'reorder': showDialog('Move this task', `<p>Move “${esc(taskById(id).title)}” within its list.</p><div class="dialog-foot">${btn('Move up', 'move-up', id, 'secondary')}${btn('Move down', 'move-down', id, 'secondary')}</div>`); return;
    case 'move-up': case 'move-down': await request(`/api/tasks/${id}/move`, { direction: name === 'move-up' ? 'up' : 'down' }); closeDialog(); render(); return;
    case 'task-tab': taskTab = id; render(); return;
    case 'energy': energy = id; await request('/api/checkin', { energy }); render(); return;
    case 'timer-mode': if (state.timer) return; timerMode = id; duration = id === 'focus' ? state.settings.focusMinutes : id === 'short' ? state.settings.shortBreak : state.settings.longBreak; render(); return;
    case 'break-space': if (!state.timer) { timerMode = 'short'; duration = state.settings.shortBreak; } return action('nav', 'focus');
    case 'duration': duration = Number(id); render(); return;
    case 'start': { ensureAudio(); const selected = $('#focus-task-select')?.value; await request('/api/timer/start', { mode: timerMode, minutes: duration, taskId: selected !== undefined ? selected || null : selectedTask || next()?.id || null }); render(); return; }
    case 'pause': await request('/api/timer/pause'); render(); return;
    case 'resume': ensureAudio(); await request('/api/timer/resume'); render(); return;
    case 'finish': { const priorKeepsakes=keepsakes(state,today()); const result = await request('/api/timer/finish', { early: true }); if(result.result?.mode==='focus'){timerMode='short';duration=state.settings.shortBreak;} render(); const acknowledged=result.result?.mode==='focus'&&result.result.minutes>0&&showWin(`${result.result.minutes} minute${result.result.minutes===1?'':'s'} invested.`,`Your partial progress counts · +${pointText(result.result.minutes)}.`,priorKeepsakes); if(!acknowledged)toast(result.result?.minutes ? `${result.result.minutes} minutes of progress saved.` : 'Session closed. You can begin again.'); return; }
    case 'reset': showDialog('Reset this session?', `<p>This clears the timer. To save partial focus minutes, choose Finish instead.</p><div class="dialog-foot">${btn('Keep going', 'close-dialog', '', 'secondary')}${btn('Reset timer', 'confirm-reset', '', 'primary')}</div>`); return;
    case 'confirm-reset': await request('/api/timer/reset'); closeDialog(); render(); return;
    case 'step': { const t = taskById(id), step=t.steps.find(s=>s.id===el.dataset.step); const steps = t.steps.map(s => s.id === el.dataset.step ? { ...s, done: !s.done } : s); await request(`/api/tasks/${id}`, { steps }, 'PATCH'); render(); if(!step.done)showWin('A small move forward.',`${step.title} · ${steps.filter(s=>s.done).length} of ${steps.length} steps done. Growth points arrive with focus or task completion.`); else toast('Step reopened.'); return; }
    case 'restart': { const t = next(); showDialog('Begin again from here', `<p>Put both feet on the floor. Take a sip of water. Choose a tiny action.</p><div class="support green" style="margin-top:20px"><h3>${t ? esc(t.title) : 'Make room for one task.'}</h3><p>${t?.steps.find(s => !s.done)?.title ? esc(t.steps.find(s => !s.done).title) : 'Open what you need. That can be enough to start.'}</p>${btn('Try just two minutes', 'restart-focus', t?.id || '', 'primary')}${btn('Choose a different task', 'restart-choose', '', 'text')}</div>`); return; }
    case 'restart-choose': closeDialog(); page = 'tasks'; taskTab = 'inbox'; location.hash = page; render(); return;
    case 'restart-focus': closeDialog(); selectedTask = id || null; duration = 2; timerMode = 'focus'; page = 'focus'; location.hash = page; render(); return;
    case 'end-day': {const m=metrics(state,today()); showDialog('Enough for today', `<div class="day-receipt"><span class="eyebrow">YOUR EFFORT, KEPT</span><strong>${m.focus}<small>focus minutes</small></strong><strong>${m.completed}<small>useful check-offs</small></strong></div><p>Unfinished tasks will return to the inbox. No progress or history is lost.</p><div class="field" style="margin-top:20px"><label for="reflection">What helped today? (optional)</label><textarea id="reflection" name="reflection" maxlength="2000" placeholder="A small thing I noticed…"></textarea></div>`, 'end-day', 'Close the day'); return; }
    case 'menu-nav': closeDialog();return action('nav',id);
    case 'social-new-circle': showDialog('Create a circle',circleForm(),'social-circle','Save circle');return;
    case 'social-edit-circle': showDialog('Edit circle',circleForm(state.social.circles.find(c=>c.id===id)),'social-circle','Save circle');return;
    case 'social-circle-filter': socialCircle=id;render();return;
    case 'social-new-person': showDialog('Add someone',personForm(state,null,today()),'social-person','Save person');return;
    case 'social-person': showDialog('Remember your person',personForm(state,state.social.people.find(p=>p.id===id),today()),'social-person','Save person');return;
    case 'social-checkin': showDialog('A connection, kept',checkinForm(state.social.people.find(p=>p.id===id),today()),'social-checkin','Save check-in');return;
    case 'social-task': {const result=await request('/api/social/contact-task',{personId:id});render();toast('Check-in task is in your inbox. Add it to Today when you want.');return;}
    case 'social-plan': closeDialog();showDialog('Make a plan together',commitmentForm({name:'',date:planDate||today(),start:'18:00',duration:60,repeat:'none',weekdays:[],reminderMinutes:30},planDate||today())+colorField()+peopleSelector(state,id?[id]:[]),'social-plan','Save plan');return;
    case 'social-calendar': closeDialog();planDate=id;calendarView='day';return action('nav','plan');
    case 'social-delete-person': case 'social-delete-circle': showDialog(name==='social-delete-person'?'Remove this person?':'Remove this circle?', '<p>'+ (name==='social-delete-person'?'Their check-in history is removed. Existing tasks and calendar blocks stay, with this person unlinked.':'People stay in Social. Only this circle is removed.')+'</p><div class="dialog-foot">'+btn('Keep it','close-dialog','','secondary')+btn('Remove','social-confirm-delete',id,'primary', 'data-kind="'+(name==='social-delete-person'?'people':'circles')+'"')+'</div>');return;
    case 'social-confirm-delete': await request('/api/social/'+el.dataset.kind+'/'+id,{},'DELETE');closeDialog();if(socialCircle===id)socialCircle='';render();return;
    case 'social-delete-checkin': await request('/api/social/checkins/delete',{id});closeDialog();render();toast('Check-in removed.');return;
    case 'new-block': blockDialog(); return;
    case 'new-commitment': showDialog('Add a commitment', commitmentForm(null,planDate)+colorField()+peopleSelector(state), 'commitment', 'Add commitment'); return;
    case 'calendar-view': calendarView = id; render(); return;
    case 'calendar-prev': planDate = moveCalendar(planDate,calendarView,-1); render(); return;
    case 'calendar-next': planDate = moveCalendar(planDate,calendarView,1); render(); return;
    case 'calendar-day': planDate = id; calendarView = 'day'; render(); return;
    case 'restore-occurrences': {const b=state.blocks.find(b=>b.id===id);await request(`/api/blocks/${id}`,{excludedDates:[],expectedVersion:b.editVersion||0},'PATCH');closeDialog();render();toast('Skipped occurrences restored.');return;}
    case 'skip-block': await request(`/api/blocks/skip?date=${planDate}`,{id}); render(); toast('This occurrence was skipped. The rest of the series stays scheduled.'); return;
    case 'calendar-sync-range': { const range=calendarView==='day'?{start:planDate,end:planDate}:calendarRange(planDate,calendarView); el.disabled=true;try{const r=await request('/api/calendar/sync',{date:range.start,end:range.end});toast(`${r.count} events synced.`);}finally{el.disabled=false;}return; }
    case 'calendar-notifications': { if(!('Notification' in window))throw Error('Device notifications are unavailable here. Calendar exports include your reminder alarms.');const permission=await Notification.requestPermission();toast(permission==='granted'?'Device reminders enabled while Episuite is open.':'Device reminders are blocked. You will still see reminders in Episuite.');return; }
    case 'edit-block': blockDialog(id); return;
    case 'delete-block': showDialog('Remove this block or series?', `<p>This removes every occurrence of a repeating block or commitment. Tasks inside it stay in your workspace.</p><div class="dialog-foot">${btn('Keep it', 'close-dialog', '', 'secondary')}${btn('Remove block', 'confirm-delete-block', id, 'primary')}</div>`); return;
    case 'confirm-delete-block': await request(`/api/blocks/${id}`, {}, 'DELETE'); closeDialog(); render(); return;
    case 'plan-today': planDate = today(); render(); return;
    case 'plan-tomorrow': planDate = addDays(today(), 1); render(); return;
    case 'wake': await request(`/api/day/wake?date=${planDate}`); render(); toast('Your flexible day starts here.'); return;
    case 'shift': await request(`/api/schedule/shift?date=${planDate}`, { minutes: 15 }); render(); toast('Flexible blocks moved 15 minutes later.'); return;
    case 'save-template': showDialog('Keep this routine', field('Routine name', 'name', '', 'text', 'required maxlength="120"'), 'template', 'Save routine'); return;
    case 'apply-template': { const id = $('#template-select').value; if (!id) throw new Error('Choose a routine first.'); await request(`/api/templates/apply?date=${planDate}`, { id }); render(); toast('Routine added to your day.'); return; }
    case 'delete-template': { const id = $('#template-select').value; if (!id) throw new Error('Choose a routine first.'); await request('/api/templates/delete', { id }); render(); return; }
    case 'clone-day': await request(`/api/day/clone?date=${planDate}`, { from: today() }); render(); toast('Today’s one-off blocks copied.'); return;
    case 'block-feedback': showDialog('How did this block feel?', '<p>Useful information for your next plan. No right answer.</p><div class="dialog-foot">' + btn('Made progress', 'block-progress', id, 'primary') + btn('Needed more room', 'block-room', id, 'secondary') + '</div>'); return;
    case 'block-progress': case 'block-room': await request('/api/blocks/feedback?date=' + planDate, { id, completed: name === 'block-progress' }); closeDialog(); render(); toast('Noted for your next plan.'); return;
    case 'block-focus': { const b = state.blocks.find(b => b.id === id); selectedTask = b.taskIds[0] || null; duration = Math.min(120, b.duration); timerMode = b.kind === 'break' ? 'short' : 'focus'; page = 'focus'; location.hash = page; render(); return; }
    case 'note-task': await request('/api/notes/convert', { id }); render(); toast('Thought moved to your task inbox.'); return;
    case 'note-delete': await request('/api/notes/delete', { id }); render(); return;
    case 'zen': zen = !zen; render(); return;
    case 'fullscreen': if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); return;
    case 'collection': {
      const response = await fetch('/api/cosmetics'); if (!response.ok) throw new Error('The collection could not be opened.');
      const items = await response.json(), minutes = metrics(state, today()).totalFocus;
      showDialog('Your growing collection', '<p class="small">The original Epidoro collection. Yours to keep, with no streak to lose.</p>' + '<div class="stack" style="margin-top:20px">' + items.map(item => '<div class="row spread"><span>' + esc(item.icon) + ' ' + esc(item.name) + '<br><span class="small muted">' + item.minutes + ' focus minutes · ' + esc(item.type) + '</span></span>' + btn(minutes >= item.minutes ? 'Use' : 'Locked', 'equip', item.id, 'soft compact', minutes >= item.minutes ? '' : 'disabled') + '</div>').join('') + '</div>' + '<div class="dialog-foot">' + btn('Clear equipped items', 'equip', '', 'secondary') + '</div>'); return;
    }
    case 'equip': await request('/api/cosmetics/equip', { id }); closeDialog(); render(); toast('Your space, your choice.'); return;
    case 'new-reward': showDialog('Something to look forward to', field('Reward name', 'name', '', 'text', 'required maxlength="100"') + `<div class="form-grid">${field('Coin cost', 'cost', 20, 'number', 'min="1" max="100000" required')}${field('Timer minutes (0 for no timer)', 'minutes', 10, 'number', 'min="0" max="120" required')}</div>`, 'reward', 'Create reward'); return;
    case 'reward-delete': await request('/api/rewards/delete', { id }); render(); return;
    case 'buy': await request('/api/rewards/buy', { id }); render(); toast('A little reward for you.'); return;
    case 'redeem': await request('/api/redeem/start', { id }); render(); return;
    case 'redeem-stop': await request('/api/redeem/stop'); render(); return;
    case 'quest': await request('/api/quests/claim', { id }); render(); toast('+5 coins. A little encouragement.'); return;
    case 'import': $('#import-file').click(); return;
    case 'delete-category': await request('/api/categories', { name: id, remove: true }); render(); return;
    case 'calendar-sync': { el.disabled = true; el.textContent = 'Syncing…'; try { const r = await request('/api/calendar/sync', { date: today() }); toast(`${r.count} calendar events synced.`); } finally { el.disabled = false; el.textContent = 'Sync today'; } return; }
    case 'calendar-remove': showDialog('Remove today’s synced events?', '<p>This removes only events previously created by Episuite for today. Your blocks and tasks stay in the app.</p><div class="dialog-foot">' + btn('Keep them', 'close-dialog', '', 'secondary') + btn('Remove events', 'calendar-confirm-remove', '', 'primary') + '</div>'); return;
    case 'calendar-confirm-remove': { const result = await request('/api/calendar/delete', { date: today() }); closeDialog(); render(); toast(result.count + ' calendar events removed.'); return; }
    case 'remove-video': await videoStore(null); if (videoUrl) URL.revokeObjectURL(videoUrl); videoUrl = null; mountVideo(); toast('Video removed from this browser.'); return;
    case 'remove-background': await request('/api/settings', { background: '' }); render(); return;
    case 'confirm-import': { await request('/api/import', pendingImport); pendingImport = null; closeDialog(); render(); toast('Imported. Your previous workspace has a server backup.'); return; }
    default: return;
  }
}
let pendingImport;
document.addEventListener('click', async event => {
  if (event.target.closest('.skip')) { event.preventDefault(); $('#main')?.focus(); return; }
  const el = event.target.closest('[data-action]'); if (!el || el.disabled || el.dataset.action === 'submit') return;
  if (busy) return;
  try { busy = true; await action(el.dataset.action, el.dataset.id, el); }
  catch (e) { if ($('#dialog').open) $('#dialog-error').textContent = e.message; else toast(e.message); }
  finally { busy = false; }
});
document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-form]'); if (!form) return; event.preventDefault(); if (busy) return;
  const data = Object.fromEntries(new FormData(form)), type = form.dataset.form;if(data.color==='custom')data.color=data.customColor; const submit = form.querySelector('[type=submit]');
  try {
    busy = true; if (submit) submit.disabled = true;
    if (type.startsWith('capture')) { await saveCapture(data.text); if (type === 'capture-dialog') closeDialog(); else form.reset(); render(); toast(online ? 'Saved. You can come back to it.' : 'Saved on this device. We’ll sync when your server returns.'); }
    else if(type==='runway'){const t=taskById(data.id);if(!t||t.deleted)throw Error('This task is no longer available.');if(t.steps.length>=30)throw Error('This task has 30 steps. Edit its steps to make room.');await request(`/api/tasks/${data.id}`,{steps:[{id:uid(),title:data.title,done:false},...t.steps]},'PATCH');closeDialog();render();toast('A runway for your next start.');}
    else if(type==='return-cue'){await request('/api/engagement',{intent:data.intent,cue:data.cue});closeDialog();render();toast('Your cue is ready.');}
    else if (type === 'engagement') { for(const key of ['feedback','novelty','haptics','chime'])data[key]=form.elements[key].checked; await request('/api/engagement',data); $('#momentum-win')?.remove(); render(); toast('Encouragement saved.'); }
    else if (type === 'quick-task') { await request('/api/tasks', { title: data.title }); form.reset(); render(); toast('Safe in your inbox.'); }
    else if (type === 'task') {
      const old = taskById(data.id);
      data.steps = data.steps.split('\n').map(s => s.trim()).filter(Boolean).map(title => old?.steps.find(s => s.title === title) || { id: uid(), title, done: false });
      if (data.repeat === 'custom') data.repeat = `interval_${data.interval}`;
      data.target = data.repeat.startsWith('interval_') ? Math.max(1, Math.round(1 / Number(data.repeat.slice(9)))) : 1;
      await request(data.id ? `/api/tasks/${data.id}` : '/api/tasks', data, data.id ? 'PATCH' : 'POST'); if(!data.id&&page==='tasks')taskTab=data.lane||'inbox'; closeDialog(); render(); toast('Task saved.');
    }
    else if (type === 'social-circle') {await request(data.id?'/api/social/circles/'+data.id:'/api/social/circles',data,data.id?'PATCH':'POST');closeDialog();render();toast('Circle saved.');}
    else if (type === 'social-person') {data.circleIds=new FormData(form).getAll('circleIds');await request(data.id?'/api/social/people/'+data.id:'/api/social/people',data,data.id?'PATCH':'POST');closeDialog();render();toast('Person saved.');}
    else if (type === 'social-checkin') {await request('/api/social/checkins',data);closeDialog();render();toast('Check-in recorded.');}
    else if (type === 'commitment' || type === 'social-plan') {data.socialPlan=type==='social-plan'; data.personIds=new FormData(form).getAll('personIds');data.commitment=true;data.weekdays=new FormData(form).getAll('weekdays').map(Number);await request(data.id?`/api/blocks/${data.id}`:'/api/blocks',data,data.id?'PATCH':'POST');closeDialog();render();toast('Commitment saved. Occurrences and reminders are ready.'); }
    else if (type === 'block') { data.personIds=new FormData(form).getAll('personIds');data.taskIds = new FormData(form).getAll('taskIds'); await request(data.id ? `/api/blocks/${data.id}` : '/api/blocks', data, data.id ? 'PATCH' : 'POST'); closeDialog(); render(); toast('A little structure added.'); }
    else if (type === 'template') { await request(`/api/templates/save?date=${planDate}`, { name: data.name }); closeDialog(); render(); }
    else if (type === 'end-day') { await request('/api/day/end', { reflection: data.reflection }); closeDialog(); render(); toast('Enough for today. Your tasks are safe.'); }
    else if (type === 'reward') { await request('/api/rewards', data); closeDialog(); render(); }
    else if (type === 'settings') { for (const key of ['sound', 'gamification', 'lowStim', 'reducedMotion', 'autoBreak']) data[key] = form.elements[key].checked; await request('/api/settings', data); if (!state.timer) duration = timerMode === 'focus' ? state.settings.focusMinutes : timerMode === 'short' ? state.settings.shortBreak : state.settings.longBreak; render(); toast('Your preferences are saved.'); }
    else if (type === 'category') { await request('/api/categories', data); if ($('#dialog').open) closeDialog(); render(); toast('Category added. You can use it when editing a task.'); }
    else if (type === 'calendar') { await request('/api/calendar/config', data); render(); toast('Calendar connection saved.'); }
    else if (type === 'ai-settings') { await request('/api/settings', data); toast('Local AI model saved.'); }
  } catch (e) { if ($('#dialog').open) $('#dialog-error').textContent = e.message; else if (type === 'settings') $('#settings-error').textContent = e.message; else toast(e.message); }
  finally { busy = false; if (submit) submit.disabled = false; }
});
document.addEventListener('change', async event => {
  const el = event.target;
  if(el.id==='f-repeat'||el.id==='f-interval'){const repeat=$('#f-repeat'),gap=$('#f-minimumGapMinutes');if(gap&&Number(gap.value)===0&&(repeat?.value==='interval_0.5'||(repeat?.value==='custom'&&Number($('#f-interval')?.value)<1)))gap.value=360;updateOptionalFields();}
  if(el.name==='customColor')formColorChoice(el);
  if (el.id === 'f-repeat' || el.id === 'f-mode') updateOptionalFields();
  if (el.id === 'category-filter') { category = el.value; render(); }
  if (el.id === 'plan-date' && el.value) { planDate = el.value; render(); }
  if (el.id === 'focus-task-select') { selectedTask = el.value || null; render(); }
  if (el.id === 'sound-select') { try { soundscape(el.value); } catch { toast('Audio is unavailable on this device.'); } }
  if (el.id === 'import-file' && el.files[0]) {
    try { if (el.files[0].size > 5_000_000) throw new Error('Choose a backup smaller than 5 MB.'); pendingImport = JSON.parse(await el.files[0].text()); showDialog('Import this backup?', `<p>This replaces the imported task and schedule records. Episuite saves your current data to a backup file on the server first.</p><p class="small" style="margin-top:12px">Active timers will be cleared. Calendar credentials will stay on this machine.</p><div class="dialog-foot">${btn('Cancel', 'close-dialog', '', 'secondary')}${btn('Import & keep a backup', 'confirm-import', '', 'primary')}</div>`); } catch (e) { toast(e.message || 'This backup could not be read.'); } el.value = '';
  }
  if (el.id === 'video-file' && el.files[0]) {
    const file = el.files[0]; if (file.size > 30_000_000 || !['video/mp4', 'video/webm'].includes(file.type)) { toast('Choose an MP4 or WebM video smaller than 30 MB.'); return; }
    try { await videoStore(file); if (videoUrl) URL.revokeObjectURL(videoUrl); videoUrl = URL.createObjectURL(file); mountVideo(); toast('Saved on this browser. Open Focus to see it.'); } catch (e) { toast(e.message); }
  }
  if (el.id === 'background-file' && el.files[0]) {
    const file = el.files[0]; if (file.size > 1_000_000) { toast('Choose an image smaller than 1 MB.'); return; }
    const reader = new FileReader(); reader.onload = async () => { try { await request('/api/settings', { background: reader.result }); render(); } catch (e) { toast(e.message); } }; reader.readAsDataURL(file);
  }
});
function formColorChoice(el){const select=el.form?.elements.color;if(select)select.value='custom';}
document.addEventListener('input', event => {
  if(event.target.name==='customColor')formColorChoice(event.target);
  if(event.target.id==='social-search'){socialQuery=event.target.value;const position=event.target.selectionStart;render();$('#social-search').focus();$('#social-search').setSelectionRange(position,position);}
  if (event.target.id === 'task-search') { search = event.target.value; const position = event.target.selectionStart; render(); $('#task-search').focus(); $('#task-search').setSelectionRange(position, position); }
  if (event.target.id === 'sound-volume' && soundGain) soundGain.gain.value = Number(event.target.value) * .2;
});
document.addEventListener('keydown', async event => {
  if (event.target.matches('input,textarea,select,[contenteditable]') || event.ctrlKey || event.metaKey || event.altKey || $('#dialog').open) return;
  if (event.key.toLowerCase() === 'c') { event.preventDefault(); action('quick-capture'); }
  if (event.key.toLowerCase() === 'n') { event.preventDefault(); taskDialog(); }
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); page = 'focus'; location.hash = page; render(); }
  if (event.code === 'Space' && page === 'focus' && !event.target.matches('button,a')) { event.preventDefault(); try { await action(state.timer ? state.timer.status === 'paused' ? 'resume' : 'pause' : 'start'); } catch (e) { toast(e.message); } }
});
$('#dialog').addEventListener('click', event => { if (event.target === $('#dialog')) { const r = $('#dialog').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(); } });
$('#dialog').addEventListener('close', async () => { const welcome=$('#dialog').dataset.welcome;delete $('#dialog').dataset.welcome;if(lastFocus?.isConnected)lastFocus.focus();if(welcome&&!state.onboarding&&online){try{await request('/api/onboarding',{status:'paused',step:0});render();}catch(e){toast(e.message);}} });
window.addEventListener('hashchange', () => { const destination = location.hash.slice(1) || 'now'; if (destination !== page) { $('#momentum-win')?.remove();page = destination; render(); $('#main')?.focus(); } });
window.addEventListener('online', () => load());
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => { if (state?.settings.theme === 'system') applyLook(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
try { const video = await videoStore(); if (video) videoUrl = URL.createObjectURL(video); } catch {}
await load(true);
if(state&&!state.onboarding&&online)guideWelcome();
setInterval(updateTimer, 1000);
setInterval(()=>{if(!state||!['now','tasks'].includes(page)||$('#dialog').open||document.activeElement?.matches('input,textarea,select'))return;const key=today()+state.tasks.map(t=>isDue(t,today())).join(',');if(key!==eligibilityKey){eligibilityKey=key;render();}},10000);
setInterval(async()=>{if(!state||checkingReminders)return;checkingReminders=true;try{await deliverReminders(state,toast);}finally{checkingReminders=false;}},10000);
setInterval(() => { if (!busy&&!document.hidden) load(); }, 2000);
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').then(r=>r.update()).catch(()=>{});
