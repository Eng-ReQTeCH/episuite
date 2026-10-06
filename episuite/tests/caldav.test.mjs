import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarMock} from './caldav-helper.mjs';
import {syncCalDAV} from '../caldav.mjs';
import {initialState,blockInput} from '../public/domain.js';
const ics=(name='Remote',extra='')=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//EN\r\nBEGIN:VEVENT\r\nUID:remote\r\nDTSTART:20261004T060000Z\r\nDTEND:20261004T070000Z\r\nSUMMARY:${name}\r\n${extra}END:VEVENT\r\nEND:VCALENDAR\r\n`;
test('two-way sync is idempotent and preserves remote edits, deletion, conflicts and recurrence',async()=>{
 const {server,resources}=calendarMock();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let s=initialState();s.calendar={...s.calendar,url:`http://127.0.0.1:${server.address().port}/calendar/`,username:'u',password:'p'};
 const sync=async()=>{const r=await syncCalDAV(s,['2026-10-04','2026-10-05']);s={...s,blocks:r.blocks,calendar:r.calendar};return r;};
 try{
  s.blocks.push(blockInput({name:'Course',date:'2026-10-04',start:'11:00',commitment:true}));
  resources.set('/calendar/remote.ics',{body:ics(),etag:'"external1"'});
  let r=await sync();assert.equal(r.uploaded,1);assert.equal(r.imported,1);assert.equal(s.blocks.length,2);assert.equal(s.blocks.find(b=>b.caldav).start,'09:00');
  r=await sync();assert.equal(r.uploaded,0);assert.equal(resources.size,2);assert.equal(s.blocks.length,2);
  let external=s.blocks.find(b=>b.caldav);external.name='Local edit';r=await sync();assert.equal(r.uploaded,1);assert.match(resources.get('/calendar/remote.ics').body,/SUMMARY:Local edit/);
  external=s.blocks.find(b=>b.caldav);external.name='Concurrent local';resources.set('/calendar/remote.ics',{body:ics('Concurrent remote'),etag:'"external2"'});r=await sync();assert.equal(r.conflicts.length,1);assert.match(resources.get('/calendar/remote.ics').body,/Concurrent remote/);
  external=s.blocks.find(b=>b.caldav);external.name='Local edit';r=await sync();assert.equal(r.conflicts.length,0);assert.equal(s.blocks.find(b=>b.caldav).name,'Concurrent remote');
  resources.set('/calendar/remote.ics',{body:ics('Moved').replaceAll('20261004','20261005'),etag:'"moved"'});await sync();assert.equal(s.blocks.filter(b=>b.caldav).length,1);assert.equal(s.blocks.find(b=>b.caldav).date,'2026-10-05');
  resources.delete('/calendar/remote.ics');await sync();assert.equal(s.blocks.length,1);
  resources.set('/calendar/repeat.ics',{body:ics('Weekly','RRULE:FREQ=DAILY;COUNT=2\r\n'),etag:'"repeat"'});await sync();assert.equal(s.blocks.filter(b=>b.caldav).length,2);assert.ok(s.blocks.filter(b=>b.caldav).every(b=>b.caldav.readOnly));
  await sync();assert.match(resources.get('/calendar/repeat.ics').body,/RRULE:FREQ=DAILY;COUNT=2/);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('server edits and deletions reconcile original local commitments without duplicate blocks',async()=>{
 const {server,resources}=calendarMock();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let s=initialState();s.calendar={...s.calendar,url:`http://127.0.0.1:${server.address().port}/calendar/`,username:'u',password:'p'};
 s.blocks=[blockInput({name:'Original',date:'2026-10-04',start:'09:00',commitment:true})];
 const sync=async()=>{const r=await syncCalDAV(s,['2026-10-04']);s={...s,blocks:r.blocks,calendar:r.calendar};return r;};
 try{
  await sync();const [url,remote]=[...resources][0];resources.set(url,{body:remote.body.replace('SUMMARY:Original','SUMMARY:Server edit'),etag:'"edited"'});
  assert.equal((await sync()).imported,1);assert.equal(s.blocks.length,1);assert.equal(s.blocks[0].name,'Server edit');assert.equal((await sync()).uploaded,0);
  s.blocks[0].name='Local competing edit';resources.set(url,{body:remote.body.replace('SUMMARY:Original','SUMMARY:Another server edit'),etag:'"edited-again"'});assert.equal((await sync()).conflicts.length,1);assert.equal(s.blocks[0].name,'Local competing edit');
  s.blocks[0].name='Server edit';await sync();resources.delete(url);await sync();assert.equal(s.blocks.length,0);assert.equal(resources.size,0);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
