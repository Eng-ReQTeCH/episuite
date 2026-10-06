import {calendarMock} from './caldav-helper.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server.mjs';
import {initialState,blockInput,schedule,calendarText,calendarDates,dueReminders,zonedTimestamp,legacyImport} from '../public/domain.js';
import {calendarRange,moveCalendar,calendarPanel} from '../public/calendar.js';
const course = extra => blockInput({name:'Course',date:'2026-10-01',endDate:'2026-10-31',start:'09:00',duration:90,commitment:true,repeat:'weekdays',weekdays:[0,1],...extra});
test('Sunday and Monday commitment respects start, end and skipped occurrences',()=>{
  const s=initialState();s.blocks=[course()];
  for(const [day,count] of [['2026-09-28',0],['2026-10-01',0],['2026-10-04',1],['2026-10-05',1],['2026-10-06',0],['2026-10-11',1],['2026-11-01',0]])assert.equal(schedule(s,day).length,count,day);
  s.blocks[0].excludedDates=['2026-10-04'];assert.equal(schedule(s,'2026-10-04').length,0);assert.equal(schedule(s,'2026-10-05').length,1);
  assert.throws(()=>course({weekdays:[]}));assert.throws(()=>course({weekdays:[7]}));assert.throws(()=>course({endDate:'2026-09-30'}));assert.throws(()=>course({reminderMinutes:-1}));assert.throws(()=>course({mode:'relative'}));
});
test('reminders use the workspace timezone and include the previous day for overnight events',()=>{
  const s=initialState();s.blocks=[course()];
  const start=zonedTimestamp('2026-10-04',540,s.settings.timezone);
  assert.equal(dueReminders(s,start-16*60000).length,0);assert.equal(dueReminders(s,start-15*60000).length,1);assert.equal(dueReminders(s,start+1).length,0);
  s.blocks=[course({date:'2026-10-04',start:'23:45',reminderMinutes:0,duration:60,repeat:'none'})];
  // Reminders that have already started are never delivered as late reminders.
  assert.equal(dueReminders(s,zonedTimestamp('2026-10-05',0,s.settings.timezone)).length,0);
  s.blocks=[course({date:'2026-10-05',start:'00:05',repeat:'none',reminderMinutes:15})];
  assert.equal(dueReminders(s,zonedTimestamp('2026-10-04',1430,s.settings.timezone)).length,1);
});
test('range export emits all occurrences, alarms and escaped metadata; backup keeps recurrence',()=>{
  const s=initialState();s.blocks=[course({location:'Room, 2',description:'Bring notes;\nJoin online'})];
  const text=calendarText(s,'2026-10-01','2026-10-31');
  assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,8);assert.equal((text.match(/BEGIN:VALARM/g)||[]).length,8);assert.match(text,/TRIGGER:-PT15M/);assert.match(text,/LOCATION:Room\\, 2/);assert.match(text,/DESCRIPTION:Bring notes\\;\\nJoin online/);
  const restored=legacyImport(s,initialState());assert.equal(schedule(restored,'2026-10-05').length,1);
  s.blocks=[course({reminderMinutes:null})];assert.equal(legacyImport(s,initialState()).blocks[0].reminderMinutes,null);assert.equal(blockInput({name:'Edit'},s.blocks[0]).reminderMinutes,null);assert.doesNotMatch(calendarText(s,'2026-10-04'),/BEGIN:VALARM/);
  assert.throws(()=>calendarDates('2026-10-06','2026-10-05'));assert.throws(()=>calendarDates('2026-01-01','2028-01-01'));
});
test('calendar navigation handles month/year transitions and leap years',()=>{
  assert.deepEqual(calendarRange('2028-02-15','month'),{start:'2028-02-01',end:'2028-02-29'});
  assert.deepEqual(calendarRange('2026-10-06','week'),{start:'2026-10-04',end:'2026-10-10'});
  assert.equal(moveCalendar('2026-12-31','month',1),'2027-01-01');assert.equal(moveCalendar('2026-01-31','month',1),'2026-02-01');
  const s=initialState();s.blocks=[course()];const panel=calendarPanel(s,'2026-10-06','month','2026-10-06');assert.match(panel.content,/October 2026/);assert.match(panel.list,/Sunday, Monday/);assert.match(panel.content,/Course/);
});
test('commitment CRUD, skips, range sync reconciliation and restart integrate',async()=>{
  const observed=[];
  const {server:mock}=calendarMock(observed);
  await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
  const dataDir=await mkdtemp(path.join(tmpdir(),'episuite-commitments-'));let app=await createApp({dataDir});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));let base=`http://127.0.0.1:${app.server.address().port}`;
  const call=async(endpoint,data,method='POST')=>{const r=await fetch(base+endpoint,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(r.status,200,await r.clone().text());return r.json();};
  try{
    const added=await call('/api/blocks',course());const id=added.result.id;
    await call('/api/calendar/config',{url:`http://127.0.0.1:${mock.address().port}/calendar/`,username:'test',password:'test'});
    const range={date:'2026-10-04',end:'2026-10-12'};
    assert.equal((await call('/api/calendar/sync',range)).count,4);assert.ok(observed.every(e=>e.body.includes('BEGIN:VALARM')));
    await call('/api/blocks/skip?date=2026-10-05',{id});
    assert.equal((await call('/api/calendar/sync',range)).count,3);assert.equal(observed.filter(e=>e.method==='DELETE').length,1);
    await call(`/api/blocks/${id}`,{name:'Renamed course',start:'10:00'},'PATCH');
    await app.close();app=await createApp({dataDir});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;
    assert.equal(schedule(app.getState(),'2026-10-05').length,0);assert.equal(schedule(app.getState(),'2026-10-11')[0].name,'Renamed course');
    const exportResponse=await fetch(base+'/api/calendar.ics?date=2026-10-04&end=2026-10-12');assert.equal((await exportResponse.text()).match(/BEGIN:VEVENT/g).length,3);
    await call(`/api/blocks/${id}`,{},'DELETE');assert.equal((await call('/api/calendar/sync',range)).count,0);assert.equal(observed.filter(e=>e.method==='DELETE').length,4);
  }finally{await app.close();mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));}
});
