import {syncCalDAV} from './caldav.mjs';
import http from 'node:http';
import {rewardConfig, rewardDefaults} from './public/reward-events.js';
import {coinAward} from './random-rewards.mjs';
import {normalizeScreenTime, rewardInput, issueScreenTime, redeemScreenTime, preserveScreenTime} from './screentime.mjs';
import {notificationDefaults, notificationConfig, publicNotifications, enqueueNotification, sendNotification} from './notifications.mjs';
import {dueReminders} from './public/domain.js';
import { readFile, writeFile, mkdir, rename, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {engagementInput,feelingInput} from './public/engagement.js';
import {circleInput,personInput,validatePeople,addCheckin,contactTask,syncContactCompletion,normalizeSocial} from './public/social-domain.js';
import {assignBlockColor,undoLastCompletion} from './public/domain.js';
import { initialState, dateKey, uid, taskInput, blockInput, toggleCompletion, startTimer, pauseTimer, resumeTimer, finishTimer, remaining, schedule, metrics, legacyImport, calendarText, calendarDates, finite, validDate, done, zonedTimestamp } from './public/domain.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export async function createApp({ dataDir = process.env.EPISUITE_DATA_DIR || path.join(root, 'data'), aiUrl = process.env.EPISUITE_OLLAMA_URL || 'http://127.0.0.1:11434/api/generate', notificationFetch = fetch, rewardRandom, backgroundInterval = 30000 } = {}) {
  await mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, 'episuite.json');
  const cosmetics = JSON.parse(await readFile(path.join(root, 'public/cosmetics.json'), 'utf8'));
  let state;
  try { state = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Episuite data cannot be read. Restore a backup before starting.'); state = initialState(); if(process.env.EPISUITE_TIMEZONE){new Intl.DateTimeFormat('en',{timeZone:process.env.EPISUITE_TIMEZONE});state.settings.timezone=process.env.EPISUITE_TIMEZONE;} }
  if (state.version !== 1 || !Array.isArray(state.tasks) || !Array.isArray(state.blocks)) throw new Error('Episuite data has an unsupported format. Restore a valid backup.');
  const defaults = initialState();
  state = { ...defaults, ...state, settings: { ...defaults.settings, ...state.settings }, calendar: { ...defaults.calendar, ...state.calendar } };
  normalizeSocial(state);
  state.rewardEvents = {config:rewardConfig({},state.rewardEvents?.config||rewardDefaults)};
  normalizeScreenTime(state);
  state.notifications ||= {config:{...notificationDefaults},jobs:[]};
  state.notifications.jobs=state.notifications.jobs.filter(j=>!(j.kind==='boosts'&&j.id.startsWith('boost:')&&j.status==='pending'));
  for(const block of state.blocks)assignBlockColor(block,state.blocks.filter(b=>b!==block));
  let queue = Promise.resolve();
  const save = async () => { await writeFile(`${file}.tmp`, JSON.stringify(state, null, 2)); await rename(`${file}.tmp`, file); };
  if(!state.workspaceId){state.workspaceId=uid();await save();}
  const safeState = () => { const result = structuredClone(state); result.screentime={outstanding:Object.keys(state.screentime.keys).length}; result.notifications = publicNotifications(result.notifications); result.calendar.password = ''; result.calendar.configured = Boolean(state.calendar.password); if (result.archivedLegacy) result.archivedLegacy = '[Preserved on server; available in export]'; return result; };
  const mutate = (operation, notify = true) => {
    const job = queue.then(async () => { const before = structuredClone(state); try {
      const result = await operation();
      for(const session of notify?state.sessions.filter(s=>!before.sessions.some(old=>old.id===s.id)):[]){
        enqueueNotification(state,'timer:'+session.id,'timers',session.mode==='focus'?'Focus saved':'Break finished',`${session.minutes} minutes saved${session.coins?' · '+session.coins+' coins':''}.`,Date.now());
      }
      if(notify)for(const task of state.tasks){
        const previous=before.tasks.find(t=>t.id===task.id),known=new Set(Object.values(previous?.history||{}).flat().map(e=>e.id));
        for(const entry of Object.values(task.history||{}).flat().filter(e=>!known.has(e.id)&&e.coins>=250&&['epic','jackpot'].includes(e.rewardTier))){
          enqueueNotification(state,`payout:${task.id}:${entry.rollKey}`,'boosts',entry.rewardTier==='jackpot'?'Jackpot!':'Rare task reward',`${task.title} earned ${entry.coins} coins.`,Date.now());
        }
      }
      for(const list of ['tasks','blocks']){
        const previous=new Map(before[list].map(record=>[record.id,record]));
        for(const record of state[list]){const old=previous.get(record.id);if(!old||JSON.stringify(old)!==JSON.stringify(record))record.editVersion=(Number(old?.editVersion)||0)+1;}
      }
      for(const list of ['people','circles']){const previous=new Map((before.social?.[list]||[]).map(r=>[r.id,r]));for(const record of state.social[list]){const old=previous.get(record.id);if(!old||JSON.stringify(old)!==JSON.stringify(record))record.editVersion=(Number(old?.editVersion)||0)+1;}}
      state.revision++; await save(); return result;
    } catch (e) { state = before; throw e; } });
    queue = job.catch(() => {}); return job;
  };
  const json = (res, value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
  const body = async req => { let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 5_000_000) throw fail('Backup is too large.', 413); } try { const parsed = JSON.parse(raw || '{}'); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error(); return parsed; } catch { throw fail('Send a valid JSON object.'); } };
  async function route(req, res) {
    const url = new URL(req.url, 'http://localhost'), p = url.pathname;
    const date = url.searchParams.get('date') || dateKey(Date.now(), state.settings.timezone);
    if (!validDate(date)) throw fail('Choose a valid date.');
    const expectedOrigin = `http://${req.headers.host}`;
    if (req.headers.origin && req.headers.origin !== expectedOrigin && req.headers.origin !== expectedOrigin.replace('http:', 'https:')) throw fail('Use Episuite from its own address.', 403);
    if (req.headers['sec-fetch-site'] === 'cross-site') throw fail('Cross-site requests are blocked.', 403);
    if (req.method === 'GET' && p === '/api/state') {
      await queue;
      const currentDay = dateKey(Date.now(), state.settings.timezone);
      if (state.lastOpenedDay !== currentDay) await mutate(() => {
        if (state.lastOpenedDay) {
          let kept = 0;
          for (const t of state.tasks.filter(t => t.lane === 'today' && !t.deleted)) {
            if (t.repeat === 'none' && !t.completed) t.lane = 'inbox';
            else if (!done(t, currentDay) && ++kept > 3) t.lane = 'inbox';
          }
        }
        state.lastOpenedDay = currentDay;
      });
      if (state.timer?.status === 'running' && remaining(state.timer) === 0) {
        const expiredId=state.timer.id;
        await mutate(()=>{
          if(state.timer?.id!==expiredId||remaining(state.timer)>0)return null;
          const session=finishTimer(state);
          if(session?.mode==='focus'&&state.settings.autoBreak){
            const count=state.sessions.filter(s=>s.mode==='focus'&&s.full).length,mode=count&&count%state.settings.cycles===0?'long':'short';
            startTimer(state,{mode,minutes:mode==='long'?state.settings.longBreak:state.settings.shortBreak},session.at);
            if(remaining(state.timer)===0)finishTimer(state);
          }
          return session;
        });
      }
      if (state.redemption && state.redemption.deadline <= Date.now()) await mutate(() => { state.redemption = null; });
      const etag=`"${state.workspaceId}:${state.revision}"`;res.setHeader('ETag',etag);
      if(req.headers['if-none-match']===etag){res.writeHead(304,{'Cache-Control':'no-store'});return res.end();}
      return json(res, safeState());
    }
    if (req.method === 'GET' && p === '/api/health') return json(res, { ok: true, app: 'episuite' });
    if (req.method === 'GET' && p === '/api/cosmetics') return json(res, cosmetics);
    if (req.method === 'GET' && p === '/api/export') {
      await queue;
      const data = structuredClone(state); delete data.screentime; for(const purchase of data.purchases)if(purchase.kind==='screentime'){delete purchase.key;purchase.used=true;} data.notifications = publicNotifications(data.notifications); data.notifications.jobs = []; data.calendar.password = ''; if (data.archivedLegacy) {
        // Legacy backups can contain credentials; never include them in a new backup.
        data.archivedLegacy = JSON.parse(JSON.stringify(data.archivedLegacy, (k, v) => /password|token|secret/i.test(k) ? undefined : v));
      }
      return json(res, data);
    }
    if (req.method === 'GET' && p === '/api/calendar.ics') { const text = calendarText(state, date, url.searchParams.get('end') || date); res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="episuite.ics"' }); return res.end(text); }
    if (req.method === 'GET' && p === '/api/v1/day') {
      const blocks = schedule(state, date).map((b, i) => ({ ...b, block_index: i, start: b.startMinute === null ? null : new Date(zonedTimestamp(date, b.startMinute, state.settings.timezone)).toISOString(), end: b.endMinute === null ? null : new Date(zonedTimestamp(date, b.endMinute, state.settings.timezone)).toISOString(), tasks: b.taskIds.map(id => state.tasks.find(t => t.id === id)).filter(t => t && !t.deleted).map(t => ({ id: t.id, title: t.title, block_index: i, status: done(t, date) ? 'completed' : 'pending', duration_minutes: t.minutes })) }));
      return json(res, { day: { wakeup_time: state.wake[date] || null, blocks, tasks: blocks.flatMap(b => b.tasks) } });
    }
    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
      const data = await body(req);
      if (p.startsWith('/api/') && req.method !== 'DELETE' && req.headers['content-type']?.split(';')[0] !== 'application/json') throw fail('Use application/json.', 415);
      if (p === '/api/ai/breakdown') {
        const title = String(data.title || '').slice(0, 300);
        if (!title) throw fail('Choose a task first.');
        try {
          const response = await fetch(aiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(45000), body: JSON.stringify({ model: state.settings.ollamaModel, stream: false, format: 'json', prompt: `Break this task into 3-5 tiny concrete actions. Return ONLY {"steps":["action"]}. Each action should be short and achievable. Task: ${title}` }) });
          if (!response.ok) throw Error(); const result = JSON.parse((await response.json()).response);
          if (!Array.isArray(result.steps) || !result.steps.length) throw Error();
          const steps = result.steps.slice(0, 8).filter(s => typeof s === 'string' && s.trim()).map(s => s.slice(0, 300));
          if (!steps.length) throw Error();
          return json(res, { steps });
        } catch { throw fail('Ollama is unavailable or returned an invalid response. You can add small steps yourself.', 503); }
      }
      const result = await mutate(async () => {
        if(p==='/api/screentime/redeem'){if(req.method!=='POST')throw fail('Use POST to redeem a screentime key.',405);return redeemScreenTime(state,data.key);}
        if(p==='/api/reward-events/config'){state.rewardEvents.config=rewardConfig(data,state.rewardEvents.config);return {ok:true};}
        if(p==='/api/notifications/config'){state.notifications.config=notificationConfig(data,state.notifications.config);state.notifications.jobs=state.notifications.jobs.filter(j=>j.status!=='pending');return {ok:true};}
        if(p==='/api/notifications/test'){
          if(!state.notifications.config.enabled)throw fail('Enable and save a phone connection first.');
          enqueueNotification(state,uid(),'test','Episuite connected','Your phone can now receive Episuite notifications.',Date.now());return {ok:true};
        }
        if(p==='/api/social/circles'&&req.method==='POST'){const c=circleInput(data);if(state.social.circles.some(x=>x.name.toLowerCase()===c.name.toLowerCase()))throw fail('This circle already exists.');state.social.circles.push(c);return c;}
        const circleMatch=p.match(/^\/api\/social\/circles\/([^/]+)$/);
        if(circleMatch){const c=state.social.circles.find(c=>c.id===circleMatch[1]);if(!c)throw fail('Circle not found.',404);if('expectedVersion' in data&&Number(data.expectedVersion)!==(c.editVersion||0))throw fail('This circle changed on another device. Reopen the editor.',409);if(req.method==='DELETE'){state.social.circles=state.social.circles.filter(x=>x.id!==c.id);for(const person of state.social.people)person.circleIds=person.circleIds.filter(id=>id!==c.id);return {ok:true};}const updated=circleInput(data,c);if(state.social.circles.some(x=>x.id!==c.id&&x.name.toLowerCase()===updated.name.toLowerCase()))throw fail('This circle already exists.');Object.assign(c,updated);return c;}
        if(p==='/api/social/people'&&req.method==='POST'){const person=personInput(data,{},state.social);if(person.lastChecked>date)throw fail('Last check-in cannot be in the future.');state.social.people.push(person);return person;}
        const personMatch=p.match(/^\/api\/social\/people\/([^/]+)$/);
        if(personMatch){const person=state.social.people.find(x=>x.id===personMatch[1]);if(!person)throw fail('Person not found.',404);if('expectedVersion' in data&&Number(data.expectedVersion)!==(person.editVersion||0))throw fail('This person changed on another device. Reopen the editor.',409);if(req.method==='DELETE'){state.social.people=state.social.people.filter(x=>x.id!==person.id);state.social.checkins=state.social.checkins.filter(x=>x.personId!==person.id);for(const r of [...state.tasks,...state.blocks])r.personIds=(r.personIds||[]).filter(id=>id!==person.id);return {ok:true};}const updated=personInput(data,person,state.social);if(updated.lastChecked>date)throw fail('Last check-in cannot be in the future.');Object.assign(person,updated);return person;}
        if(p==='/api/social/checkins'&&req.method==='POST')return addCheckin(state,data,date);
        if(p==='/api/social/checkins/delete'){const checkin=state.social.checkins.find(c=>c.id===data.id);if(!checkin)throw fail('Check-in not found.',404);if(checkin.taskId)throw fail('Undo the linked task completion to remove this check-in.');state.social.checkins=state.social.checkins.filter(c=>c.id!==data.id);return {ok:true};}
        if(p==='/api/social/contact-task')return contactTask(state,data.personId,date);
        if(p==='/api/engagement/feeling'){
          const entry=feelingInput(data,state);state.feelings=[...(state.feelings||[]).filter(f=>f.sessionId!==entry.sessionId),entry].slice(-60);
          if(entry.feeling==='quieter')state.engagement=engagementInput({feedback:false,haptics:false,chime:false},state.engagement);
          return entry;
        }
        if(p==='/api/engagement'){state.engagement=engagementInput(data,state.engagement);return state.engagement;}
        if (p === '/api/onboarding') {
          if (!['active', 'paused', 'complete'].includes(data.status) || !Number.isInteger(data.step) || data.step < 0 || data.step > 7 || (data.status === 'complete' && data.step !== 7)) throw fail('Choose a valid guide step.');
          state.onboarding = {status:data.status,step:data.step,startedAt:state.onboarding?.startedAt||Date.now(),updatedAt:Date.now()};
          return state.onboarding;
        }
        if (p === '/api/tasks' && req.method === 'POST') { const task = taskInput(data); validatePeople(state,task.personIds); if (task.lane === 'today' && state.tasks.filter(t => t.lane === 'today' && !t.deleted && !done(t, date)).length >= 3) throw fail('Keep today small: move a task back to your inbox first.'); task.order = Math.max(0, ...state.tasks.map(t => t.order)) + 1; state.tasks.push(task); return task; }
        const taskMatch = p.match(/^\/api\/tasks\/([^/]+)(?:\/(complete|restore|move|undo))?$/);
        if (taskMatch) {
          const [, id, action] = taskMatch, t = state.tasks.find(t => t.id === id);
          if (!t) throw fail('Task not found.', 404);
          if('expectedVersion' in data&&Number(data.expectedVersion)!==(t.editVersion||0))throw fail('This task changed on another device. Your draft is kept. Reopen the editor to load the latest version.',409);
          if(action==='undo'){const delta=undoLastCompletion(state,id,date);syncContactCompletion(state,t);return {delta};}
          if (action === 'complete') {const delta=toggleCompletion(state,id,date,base=>coinAward(state,base,Date.now(),rewardRandom));syncContactCompletion(state,t);const award=delta>0?(t.repeat==='none'?Object.values(t.history).flat().at(-1):t.history[date]?.at(-1)):null;return {delta,award};}
          if (action === 'restore') { t.deleted = false; t.lane = 'inbox'; return t; }
          if (req.method === 'DELETE') { t.deleted = true; return t; }
          if (action === 'move' && data.direction) { const sorted = state.tasks.filter(x => !x.deleted && x.lane === t.lane).sort((a, b) => a.order - b.order); const i = sorted.indexOf(t); const other = sorted[i + (data.direction === 'up' ? -1 : 1)]; if (other) [t.order, other.order] = [other.order, t.order]; return t; }
          if (data.lane === 'today' && t.lane !== 'today' && state.tasks.filter(x => x.lane === 'today' && !x.deleted && !done(x, date)).length >= 3) throw fail('Your shortlist is full. Move one task to your inbox first.');
          const updated = taskInput(data,t);validatePeople(state,updated.personIds);Object.assign(t, updated); return t;
        }
        if (p === '/api/blocks' && req.method === 'POST') { const b = blockInput(data);validatePeople(state,b.personIds);if(data.socialPlan&&!b.personIds.length)throw fail('Choose at least one person for this plan.');assignBlockColor(b,state.blocks); state.blocks.push(b); return b; }
        if (p === '/api/blocks/skip') { const b = state.blocks.find(b => b.id === data.id); if (!b) throw fail('Block not found.', 404); if(b.caldav)throw fail('Skip server events in your calendar client, then sync again.'); if (!schedule(state,date).some(x=>x.id===b.id)) throw fail('This occurrence was not found.'); b.excludedDates = [...new Set([...(b.excludedDates || []), date])]; return {ok:true}; }
        if (p === '/api/blocks/feedback') { if (!state.blocks.some(b => b.id === data.id)) throw fail('Block not found.', 404); state.blockFeedback ||= {}; state.blockFeedback[date + ':' + data.id] = Boolean(data.completed); return { ok: true }; }
        const blockMatch = p.match(/^\/api\/blocks\/([^/]+)$/);
        if (blockMatch) { const b = state.blocks.find(b => b.id === blockMatch[1]); if (!b) throw fail('Block not found.', 404); if('expectedVersion' in data&&Number(data.expectedVersion)!==(b.editVersion||0))throw fail('This block changed on another device. Your draft is kept. Reopen the editor to load the latest version.',409); if(b.caldav?.readOnly)throw fail('Edit recurring or all-day server events in your calendar client, then sync again.'); if (req.method === 'DELETE') { state.blocks = state.blocks.filter(x => x.id !== b.id); return { ok: true }; } if(b.caldav&&data.repeat&&data.repeat!=='none')throw fail('Set recurrence in your calendar client, then sync again.'); const updated=blockInput(data,b);validatePeople(state,updated.personIds);assignBlockColor(updated,state.blocks.filter(x=>x.id!==b.id));Object.assign(b,updated); return b; }
        if (p === '/api/schedule/shift') { const shift = finite(data.minutes, -120, 120, 15); for (const b of state.blocks.filter(b => b.date === date && b.mode === 'relative')) b.shift += shift; return { ok: true }; }
        if (p === '/api/day/wake') { state.wake[date] = Date.now(); return { ok: true }; }
        if (p === '/api/day/end') { for (const t of state.tasks.filter(t => t.lane === 'today' && !t.completed)) t.lane = 'inbox'; state.checkins[date] = { ...state.checkins[date], reflection: String(data.reflection || '').slice(0, 2000), ended: true }; return { ok: true }; }
        if (p === '/api/checkin') { state.checkins[date] = { ...state.checkins[date], energy: ['low', 'medium', 'high'].includes(data.energy) ? data.energy : 'medium' }; return { ok: true }; }
        if (p === '/api/templates/save') { const blocks = state.blocks.filter(b => b.date === date); if (!blocks.length) throw fail('Add a block before saving a routine.'); const name = String(data.name || '').trim().slice(0, 120); if (!name) throw fail('Name your routine.'); state.templates.push({ id: uid(), name, blocks: blocks.map(b => ({ ...b, repeat: 'none' })) }); return { ok: true }; }
        if (p === '/api/templates/apply') { const template = state.templates.find(t => t.id === data.id); if (!template) throw fail('Routine not found.', 404); for (const b of template.blocks) state.blocks.push(blockInput({ ...b, date, taskIds: b.taskIds.filter(id => state.tasks.some(t => t.id === id && !t.deleted)) }, { ...b, id: uid(), shift: 0 })); return { ok: true }; }
        if (p === '/api/templates/delete') { state.templates = state.templates.filter(t => t.id !== data.id); return { ok: true }; }
        if (p === '/api/day/clone') { if (!validDate(data.from) || data.from === date) throw fail('Choose two different dates.'); const blocks = state.blocks.filter(b => b.date === data.from && b.repeat === 'none'); if (!blocks.length) throw fail('There are no one-off blocks to copy.'); for (const b of blocks) state.blocks.push({ ...structuredClone(b), id: uid(), date, shift: 0 }); return { ok: true }; }
        if(p.startsWith('/api/timer/')&&p!=='/api/timer/start'&&'timerId' in data&&data.timerId!==state.timer?.id){
          if(p==='/api/timer/finish'&&!state.timer&&state.sessions.some(s=>s.id===data.timerId))return null;
          throw fail('The session changed on another device. Your workspace has been refreshed.',409);
        }
        if (p === '/api/timer/start') return startTimer(state, data);
        if (p === '/api/timer/pause') return pauseTimer(state);
        if (p === '/api/timer/resume') return resumeTimer(state);
        if (p === '/api/timer/finish') return finishTimer(state, Date.now(), Boolean(data.early));
        if (p === '/api/timer/reset') { state.timer = null; return { ok: true }; }
        if (p === '/api/notes') { const text = String(data.text || '').trim().slice(0, 3000); if (!text) throw fail('Write something to capture.'); const id = typeof data.id === 'string' && /^[a-z0-9-]{1,80}$/i.test(data.id) ? data.id : uid(); if (!state.notes.some(n => n.id === id)) state.notes.unshift({ id, text, created: finite(data.created, 0, Date.now(), Date.now()) }); return { ok: true }; }
        if (p === '/api/notes/convert') { const note = state.notes.find(n => n.id === data.id); if (!note) throw fail('Capture not found.', 404); state.tasks.push(taskInput({ title: note.text, lane: 'inbox' })); state.notes = state.notes.filter(n => n.id !== note.id); return { ok: true }; }
        if (p === '/api/notes/delete') { state.notes = state.notes.filter(n => n.id !== data.id); return { ok: true }; }
        if (p === '/api/categories') { const name = String(data.name || '').trim().slice(0, 50); if (!name) throw fail('Name the category.'); if (data.remove) { state.categories = state.categories.filter(c => c !== name); state.tasks.filter(t => t.category === name).forEach(t => t.category = 'Personal'); } else if (!state.categories.includes(name)) state.categories.push(name); return { ok: true }; }
        if (p === '/api/rewards') { const reward={id:uid(),...rewardInput(data)}; state.rewards.push(reward); return reward; }
        const rewardMatch=p.match(/^\/api\/rewards\/([^/]+)$/);
        if(rewardMatch&&!['buy','delete'].includes(rewardMatch[1])){const reward=state.rewards.find(r=>r.id===rewardMatch[1]);if(!reward)throw fail('Reward not found.',404);if(req.method!=='PATCH')throw fail('Use PATCH to edit a reward.',405);Object.assign(reward,rewardInput(data,reward));return reward;}
        if (p === '/api/rewards/delete') { state.rewards = state.rewards.filter(r => r.id !== data.id); return { ok: true }; }
        if (p === '/api/rewards/buy') { const reward = state.rewards.find(r => r.id === data.id); if (!reward) throw fail('Reward not found.', 404); if (state.coins < reward.cost) throw fail('You need a few more coins for this reward.'); state.coins -= reward.cost;const purchase={id:uid(),reward:reward.name,kind:reward.kind||'personal',minutes:reward.minutes,cost:reward.cost,at:Date.now()};if(purchase.kind==='screentime')issueScreenTime(state,purchase); state.purchases.push(purchase); return {ok:true,purchase}; }
        if (p === '/api/redeem/start') { if (state.redemption) throw fail('Finish your current reward break first.'); const purchase = state.purchases.find(r => r.id === data.id && r.kind!=='screentime' && !r.used && r.minutes > 0); if (!purchase) throw fail('No unused break was found.'); purchase.used = true; state.redemption = { id: purchase.id, deadline: Date.now() + purchase.minutes * 60000, duration: purchase.minutes }; return { ok: true }; }
        if (p === '/api/redeem/stop') { if (state.redemption) { const purchase = state.purchases.find(r => r.id === state.redemption.id); const refund = Math.max(0, Math.floor((state.redemption.deadline - Date.now()) / 60000)); if (purchase && refund) { purchase.minutes = refund; purchase.used = false; } state.redemption = null; } return { ok: true }; }
        if (p === '/api/quests/claim') { const m = metrics(state, date), key = `${date}:${data.id}`; const quests = { start: m.focus >= 2, finish: m.completed >= 1, return: m.sessions >= state.settings.dailyGoal }; if (!quests[data.id]) throw fail('This gentle goal is not complete yet.'); if (state.events.some(e => e.key === key)) throw fail('You already claimed this goal.'); const award={baseCoins:5,coins:5,rewardTier:'fixed'};state.coins += award.coins; state.earned += award.coins; state.events.push({ id: uid(), key, at: Date.now(),...award }); return award; }
        if (p === '/api/cosmetics/equip') {
          if (!data.id) { state.settings.equipped = {}; return { ok: true }; }
          const item = cosmetics.find(c => c.id === data.id);
          if (!item || metrics(state, date).totalFocus < item.minutes) throw fail('This item needs more focus minutes to unlock.');
          state.settings.equipped ||= {}; state.settings.equipped[item.type] = item; return { ok: true };
        }
        if (p === '/api/settings') {
          const s = state.settings;
          for (const key of ['sound', 'gamification', 'reducedMotion', 'lowStim', 'autoBreak']) if (key in data) s[key] = Boolean(data[key]);
          for (const key of ['focusMinutes', 'shortBreak', 'longBreak']) if (key in data) s[key] = finite(data[key], 1, 120, s[key]);
          if ('volume' in data) s.volume = finite(data.volume, 0, 1, s.volume);
          if ('partialThreshold' in data) s.partialThreshold = finite(data.partialThreshold, 50, 100, 90);
          if ('cycles' in data) s.cycles = finite(data.cycles, 1, 8, 4);
          if ('dailyGoal' in data) s.dailyGoal = finite(data.dailyGoal, 1, 10, 2);
          if ('name' in data) s.name = String(data.name).slice(0, 60);
          if ('theme' in data && ['light', 'dark', 'system'].includes(data.theme)) s.theme = data.theme;
          if ('timezone' in data) { try { new Intl.DateTimeFormat('en', { timeZone: data.timezone }); s.timezone = data.timezone; } catch { throw fail('This timezone was not recognized.'); } }
          if ('accent' in data && /^#[\da-f]{6}$/i.test(data.accent)) s.accent = data.accent;
          if ('timerFont' in data && ['sans', 'mono', 'serif'].includes(data.timerFont)) s.timerFont = data.timerFont;
          if ('background' in data) { const value = String(data.background); if (value && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) throw fail('Choose a PNG, JPG or WebP background.'); s.background = value.slice(0, 2000000); }
          if ('ollamaModel' in data) s.ollamaModel = String(data.ollamaModel).slice(0, 100);
          return { ok: true };
        }
        if (p === '/api/import') { await save(); await copyFile(file, path.join(dataDir, `before-import-${Date.now()}.json`)); const imported=legacyImport(data,state); imported.workspaceId=state.workspaceId; imported.notifications=state.notifications; imported.rewardEvents={config:rewardConfig(data.rewardEvents?.config||{},state.rewardEvents.config)}; preserveScreenTime(imported,state); for(const reward of imported.rewards)Object.assign(reward,rewardInput(reward,reward)); if(imported.engagement)imported.engagement=engagementInput(imported.engagement); if(imported.feelings){if(!Array.isArray(imported.feelings))throw fail('Backup feelings must be a list.'); imported.feelings=imported.feelings.slice(-60).map(f=>feelingInput(f,imported));} normalizeSocial(imported);for(const block of imported.blocks)assignBlockColor(block,imported.blocks.filter(b=>b!==block));state=imported; return { ok: true }; }
        if (p === '/api/calendar/config') { const parsed = data.url ? new URL(data.url) : null; if (parsed && !['https:', 'http:'].includes(parsed.protocol)) throw fail('Use an HTTP or HTTPS calendar URL.'); state.calendar.url = String(data.url || '').slice(0, 2000); state.calendar.username = String(data.username || '').slice(0, 300); if (data.password) state.calendar.password = String(data.password).slice(0, 500); return { ok: true }; }
        throw fail('This action was not found.', 404);
      },p!=='/api/import');
      if(p==='/api/screentime/redeem')return json(res,result);
      return json(res, { result, state: safeState() });
    }
    if (req.method !== 'GET') throw fail('Method not supported.', 405);
    const assets = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/domain.js': ['domain.js', 'text/javascript'], '/engagement.js': ['engagement.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'], '/sw.js': ['sw.js', 'text/javascript'], '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'], '/icon.svg': ['icon.svg', 'image/svg+xml'] };
    assets['/calendar.js'] = ['calendar.js', 'text/javascript'];
    assets['/reward-events.js'] = ['reward-events.js', 'text/javascript'];
    assets['/reward-shop.js'] = ['reward-shop.js', 'text/javascript'];
    assets['/social.js'] = ['social.js', 'text/javascript'];
    assets['/social-domain.js'] = ['social-domain.js', 'text/javascript'];
    for(const file of ['icon-192.png','icon-512.png','apple-touch-icon.png'])assets['/'+file]=[file,'image/png'];
    if (!assets[p]) throw fail('Page not found.', 404);
    const [asset, type] = assets[p]; const content = await readFile(path.join(root, 'public', asset));
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" }); res.end(content);
  }
  // CalDAV calls are kept outside the storage queue to avoid blocking normal task capture.
  const server = http.createServer((req, res) => {
    if (['/api/calendar/sync', '/api/calendar/delete'].includes(req.url.split('?')[0]) && req.method === 'POST') {
      routeCalendar(req, res).catch(e => json(res, { error: e.message }, e.status || 502));
    } else route(req, res).catch(e => { if (!res.headersSent) json(res, { error: e.status ? e.message : 'Could not complete this action. Please try again.',...(e.status===409?{state:safeState()}: {}) }, e.status || 500); });
  });
  let calendarQueue=Promise.resolve();
  function routeCalendar(req,res){const job=calendarQueue.then(()=>runCalendar(req,res));calendarQueue=job.catch(()=>{});return job;}
  async function runCalendar(req, res) {
    if (req.headers.origin && ![`http://${req.headers.host}`, `https://${req.headers.host}`].includes(req.headers.origin)) throw fail('Cross-site requests are blocked.', 403);
    const data = await body(req), date = data.date || dateKey(Date.now(), state.settings.timezone);
    if (!validDate(date)) throw fail('Choose a valid date.');
    const dates = calendarDates(date, data.end || date);
    if (!state.calendar.url || !state.calendar.password) throw fail('Save your calendar collection URL and credentials first.');
    const snapshot=structuredClone(state);
    const result=await syncCalDAV(snapshot,dates,req.url.split('?')[0]==='/api/calendar/delete');
    await mutate(()=>{
      if(state.calendar.url!==snapshot.calendar.url)throw fail('Calendar connection changed during sync. Sync again.',409);
      const before=new Map(snapshot.blocks.map(b=>[b.id,JSON.stringify(b)]));
      const after=new Map(result.blocks.map(b=>[b.id,b]));
      for(let i=state.blocks.length-1;i>=0;i--){const b=state.blocks[i];if(before.get(b.id)!==JSON.stringify(b))continue;if(after.has(b.id))Object.assign(b,after.get(b.id));else state.blocks.splice(i,1);}
      for(const b of result.blocks)if(!before.has(b.id)&&!state.blocks.some(x=>x.id===b.id)){assignBlockColor(b,state.blocks);state.blocks.push(b);}
      state.calendar=result.calendar;
    });
    return json(res,{...result,blocks:undefined,calendar:undefined,state:safeState()});
  }
  let runningTick=null, closing=false;
  async function backgroundTick(now=Date.now()) {
    if(closing)return;
    if(runningTick)return runningTick;
    runningTick=(async()=>{
      await queue;
      const reminders=state.notifications.config.enabled&&state.notifications.config.reminders?dueReminders(state,now):[];
      if(state.timer?.status==='running'&&remaining(state.timer,now)===0||reminders.some(r=>!state.notifications.jobs.some(j=>j.id==='reminder:'+r.id)))await mutate(()=>{
        for(const r of reminders)enqueueNotification(state,'reminder:'+r.id,'reminders','Upcoming: '+r.name,`${r.name} starts at ${new Intl.DateTimeFormat('en',{timeZone:state.settings.timezone,hour:'numeric',minute:'2-digit'}).format(new Date(r.startsAt))}${r.location?' · '+r.location:''}.`,now,r.startsAt+60000);
        if(state.timer?.status==='running'&&remaining(state.timer,now)===0){
          const session=finishTimer(state,now);
          if(session?.mode==='focus'&&state.settings.autoBreak){const count=state.sessions.filter(s=>s.mode==='focus'&&s.full).length,mode=count&&count%state.settings.cycles===0?'long':'short';startTimer(state,{mode,minutes:mode==='long'?state.settings.longBreak:state.settings.shortBreak},session.at);if(remaining(state.timer,now)===0)finishTimer(state,now);}
        }
      });
      if(!state.notifications.config.enabled)return;
      for(const snapshot of state.notifications.jobs.filter(j=>j.status==='pending'&&j.nextAt<=now).slice(0,10).map(j=>structuredClone(j))){
        const config=structuredClone(state.notifications.config);
        let error=null;
        if(snapshot.expiresAt>now)try{await sendNotification(config,snapshot,notificationFetch);}catch(e){error=e.message.startsWith('Provider returned HTTP')?e.message:'Delivery failed. Check the connection and credentials.';}
        await mutate(()=>{
          const job=state.notifications.jobs.find(j=>j.id===snapshot.id&&j.status==='pending');if(!job)return;
          job.attempts++;
          if(snapshot.expiresAt<=now){job.status='expired';return;}
          if(!error){job.status='sent';job.sentAt=now;state.notifications.lastSuccess=now;state.notifications.lastError='';}
          else{job.error=error;job.status=job.attempts>=5?'failed':'pending';job.nextAt=now+Math.min(900000,30000*2**(job.attempts-1));state.notifications.lastError=error;}
        });
      }
    })();
    try{await runningTick;}finally{runningTick=null;}
  }
  const worker=backgroundInterval>0?setInterval(()=>backgroundTick().catch(()=>{}),backgroundInterval):null;
  worker?.unref();
  return { server, backgroundTick, getState: () => structuredClone(state), close: async () => {closing=true;clearInterval(worker);await runningTick;const stopped=new Promise(resolve=>server.close(resolve));server.closeAllConnections();await queue;await stopped;} };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3210), host = process.env.HOST || '127.0.0.1';
  const app = await createApp(); app.server.listen(port, host, () => console.log(`Episuite is ready at http://${host}:${port}`));
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{await app.close();process.exit(0);});
}
