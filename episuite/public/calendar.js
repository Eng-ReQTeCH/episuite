import { addDays, schedule, conflicts, dueReminders, blockColor, calendarPalette } from './domain.js';
export function colorField(block = {}, blocks = []) {
 const names=['Blue','Berry','Teal','Amber','Violet','Rose','Ocean','Olive'];
 const selected=block.color?(calendarPalette.includes(block.color)?block.color:'custom'):'';
 return `<div class="field color-field"><label for="event-color">Accent color</label><div class="row"><select id="event-color" name="color"><option value="" ${!selected?'selected':''}>Choose automatically</option>${calendarPalette.map((c,i)=>`<option value="${c}" ${selected===c?'selected':''}>${names[i]}</option>`).join('')}<option value="custom" ${selected==='custom'?'selected':''}>Custom color</option></select><input type="color" name="customColor" value="${blockColor(block,blocks)}" aria-label="Custom accent color"></div><p class="small muted">The same accent follows every occurrence.</p></div>`;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (text, action, id = '') => `<button class="btn secondary compact" data-action="${action}" data-id="${esc(id)}">${text}</button>`;
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const clock = n => n == null ? 'Flexible' : `${String(Math.floor(n / 60) % 24).padStart(2,'0')}:${String(n % 60).padStart(2,'0')}`;
export function calendarRange(date, view) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (view === 'week') { const start = addDays(date, -weekday); return {start, end:addDays(start, 6)}; }
  if (view === 'agenda') return {start:date, end:addDays(date, 29)};
  const start = date.slice(0,7) + '-01';
  const next = new Date(`${start}T12:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
  return {start, end:addDays(next.toISOString().slice(0,10), -1)};
}
export function moveCalendar(date, view, direction) {
  if (view !== 'month') return addDays(date, direction * (view === 'week' ? 7 : view === 'agenda' ? 30 : 1));
  const d = new Date(`${date.slice(0,7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + direction); return d.toISOString().slice(0,10);
}
export function calendarPanel(state, date, view, today) {
  const range = view === 'day' ? {start:date,end:date} : calendarRange(date,view);
  const toolbar = `<div class="filter-row calendar-toolbar">${button('← Previous','calendar-prev')}${button('Today','plan-today')}${button('Next →','calendar-next')}<input id="plan-date" type="date" value="${date}" aria-label="Calendar date"><div class="row wrap">${['month','week','agenda','day'].map(v=>`<button class="btn ${view===v?'soft':'secondary'} compact" data-action="calendar-view" data-id="${v}" aria-pressed="${view===v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div><a class="btn text compact" href="/api/calendar.ics?date=${range.start}&end=${range.end}">Export this range ↓</a>${button('Sync this range','calendar-sync-range')}</div>`;
  let content = '';
  if (view !== 'day') {
    let start = range.start, end = range.end;
    if (view === 'month') { start = addDays(start,-new Date(`${start}T12:00:00Z`).getUTCDay()); end = addDays(end,6-new Date(`${end}T12:00:00Z`).getUTCDay()); }
    const days = [];
    for (let day=start;day<=end;day=addDays(day,1)) {
      const blocks = schedule(state,day), clash = conflicts(blocks).length;
      days.push(`<section class="calendar-cell ${day===today?'is-today':''} ${day.slice(0,7)!==date.slice(0,7)&&view==='month'?'outside-month':''}"><button class="calendar-date" data-action="calendar-day" data-id="${day}" ${day===today?'aria-current="date"':''}>${esc(new Intl.DateTimeFormat('en',{day:'numeric',month:view==='month'?'short':'long',weekday:view==='month'?undefined:'short',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z')))}</button>${clash?'<span class="small calendar-clash">Overlapping events</span>':''}${blocks.map(b=>`<button style="--event-color:${blockColor(b,state.blocks)}" class="calendar-event ${b.commitment?'commitment-event':''}" data-action="edit-block" data-id="${esc(b.id)}"><span>${clock(b.startMinute)}${b.endMinute!=null?'–'+clock(b.endMinute):''}</span><strong>${esc(b.name)}</strong>${b.location?`<span>${esc(b.location)}</span>`:''}</button>`).join('')}${!blocks.length&&view!=='month'?'<p class="small muted">Room to breathe.</p>':''}</section>`);
    }
    content = `<div class="calendar-period"><h2>${esc(view==='month'?new Intl.DateTimeFormat('en',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')):range.start+' – '+range.end)}</h2><p class="small muted">${esc(state.settings.timezone)} · Select a date to plan that day.</p></div><div class="calendar-scroll"><div class="calendar-grid calendar-${view}">${view==='month'||view==='week'?weekdays.map(d=>`<div class="calendar-weekday">${d.slice(0,3)}</div>`).join(''):''}${days.join('')}</div></div>`;
  }
  const commitments = state.blocks.filter(b=>b.commitment);
  const list = `<section class="commitments-panel"><div class="row spread wrap"><h2>Commitments</h2>${button('+ Add commitment','new-commitment')}</div><p class="small muted">Save the schedule once. Every occurrence appears automatically.</p>${commitments.length?commitments.map(b=>`<article class="commitment-row" style="--event-color:${blockColor(b,state.blocks)}"><div><h3>${esc(b.name)}</h3><p class="small">${esc(b.repeat==='weekdays'?b.weekdays.map(d=>weekdays[d]).join(', '):b.repeat==='none'?'Once':b.repeat==='daily'?'Every day':'Every '+weekdays[new Date(b.date+'T12:00:00Z').getUTCDay()])} · ${esc(b.start)} · ${b.duration} min</p><p class="small muted">${b.date}${b.endDate?' → '+b.endDate:' · No end date'}${b.reminderMinutes!=null?' · Reminder '+b.reminderMinutes+' min before':''}${b.location?' · '+esc(b.location):''}</p></div><div class="row">${button('Edit series','edit-block',b.id)}${button('Remove series','delete-block',b.id)}</div></article>`).join(''):'<p class="small">Courses, appointments, exercise — keep your recurring plans here.</p>'}<div class="row wrap">${button('Enable device reminders','calendar-notifications')}<span class="small muted">In-app reminders work while Episuite is open. Export alarms to your calendar for reminders when it is closed.</span></div></section>`;
  return {toolbar,content,list,range};
}
export function commitmentForm(b, date) {
  b ||= {name:'',date,start:'09:00',duration:60,repeat:'weekdays',weekdays:[],reminderMinutes:15};
  const input = (label,name,value,type='text',attrs='')=>`<div class="field"><label for="commit-${name}">${label}</label><input id="commit-${name}" name="${name}" value="${esc(value)}" type="${type}" ${attrs}></div>`;
  return `<input type="hidden" name="id" value="${esc(b.id||'')}"><input type="hidden" name="expectedVersion" value="${b.editVersion||0}"><input type="hidden" name="mode" value="fixed">${input('Commitment name','name',b.name,'text','required maxlength="120"')}<div class="form-grid">${input('Starts on','date',b.date,'date','required')}${input('Ends on (optional)','endDate',b.endDate||'','date')}${input('Start time','start',b.start,'time','required')}${input('Length (minutes)','duration',b.duration,'number','min="5" max="480" required')}<div class="field"><label for="commit-repeat">Repeat</label><select id="commit-repeat" name="repeat">${[['weekdays','Selected weekdays'],['daily','Every day'],['weekly','Weekly on the start day'],['none','Once']].map(([v,l])=>`<option value="${v}" ${b.repeat===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label for="commit-reminder">Reminder</label><select id="commit-reminder" name="reminderMinutes">${[['','No reminder'],[0,'At start'],[5,'5 minutes before'],[15,'15 minutes before'],[30,'30 minutes before'],[60,'1 hour before'],[1440,'1 day before'],...(![null,undefined,0,5,15,30,60,1440].includes(b.reminderMinutes)?[[b.reminderMinutes,b.reminderMinutes+' minutes before']]:[])].map(([v,l])=>`<option value="${v}" ${String(b.reminderMinutes??'')===String(v)?'selected':''}>${l}</option>`).join('')}</select></div></div><fieldset class="commitment-days"><legend>Weekdays</legend>${weekdays.map((d,i)=>`<label><input type="checkbox" name="weekdays" value="${i}" ${b.weekdays?.includes(i)?'checked':''}> ${d.slice(0,3)}</label>`).join('')}</fieldset>${input('Location or meeting link (optional)','location',b.location||'','text','maxlength="300"')}<div class="field"><label for="commit-description">Notes</label><textarea id="commit-description" name="description" maxlength="3000">${esc(b.description||'')}</textarea></div><p class="small muted">Edits apply to the entire series. Use the day view to skip one occurrence.</p>`;
}
export async function deliverReminders(state, toast) {
  for (const reminder of dueReminders(state)) {
    const key = `episuite-reminder:${state.workspaceId || 'local'}:${reminder.id}`;
    try { if(localStorage.getItem(key))continue; localStorage.setItem(key,String(Date.now())); } catch { continue; }
    const minutes = Math.max(0,Math.ceil((reminder.startsAt-Date.now())/60000));
    const body = `${reminder.name} ${minutes?'starts in '+minutes+' min':'starts now'}${reminder.location?' · '+reminder.location:''}`;
    toast(body);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { const registration = await navigator.serviceWorker?.getRegistration(); if(registration)await registration.showNotification('Episuite commitment',{body,tag:key,data:{url:'/\u0023plan'}});else new Notification('Episuite commitment',{body,tag:key}); } catch { /* The in-app reminder remains available. */ }
    }
  }
}
