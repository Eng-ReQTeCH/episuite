import {chromium,browserOptions} from './browser-runtime.mjs';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {calendarMock} from '../tests/caldav-helper.mjs';
import {dateKey,addDays} from '../public/domain.js';
const app=await createApp({dataDir:await mkdtemp(path.join(tmpdir(),'episuite-checkins-browser-'))});
const mock=calendarMock();await new Promise(r=>mock.server.listen(0,'127.0.0.1',r));
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+app.server.address().port;
const post=async(url,data={},method='POST')=>{const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(r.status,200,await r.clone().text());return r.json();};
let browser;
try{
 await post('/api/onboarding',{status:'paused',step:0});
 const circle=(await post('/api/social/circles',{name:'Friends'})).result;
 browser=await chromium.launch({...browserOptions});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#social');await page.locator('[data-action="social-new-person"]').first().click();
 await page.locator('#social-name').fill('Sam');await page.locator('[name="circleIds"]').check();await page.locator('[name="autoTask"]').check();
 await page.locator('#dialog [type="submit"]').click();await page.locator('#dialog').waitFor({state:'hidden'});
 assert.equal(app.getState().tasks.filter(t=>t.autoSocialContact).length,1);
 await page.locator('[data-action="nav"][data-id="life"]').first().click();await page.locator('.board-contact').waitFor();
 assert.match(await page.locator('.board-social').innerText(),/Friends/);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/checkins-life-desktop.png',fullPage:true});
 await page.locator('.board-contact [data-action="complete"]').click();await page.waitForFunction(()=>!document.querySelector('.board-contact'));
 assert.equal(app.getState().social.checkins.length,1);
 const task=app.getState().tasks[0];await post('/api/tasks/'+task.id+'/undo');await page.reload();await page.locator('.board-contact').waitFor();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/checkins-life-phone.png',fullPage:true});
 const today=dateKey(Date.now(),app.getState().settings.timezone),next=addDays(today,40),stamp=d=>d.replaceAll('-','');
 const ics=(date,name,extra='')=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//EN\r\nBEGIN:VEVENT\r\nUID:${name}\r\nDTSTART:${stamp(date)}T100000Z\r\nDTEND:${stamp(date)}T110000Z\r\nSUMMARY:${name}\r\n${extra}END:VEVENT\r\nEND:VCALENDAR\r\n`;
 mock.resources.set('/calendar/once.ics',{etag:'"1"',body:ics(today,'One-off meeting')});
 mock.resources.set('/calendar/future.ics',{etag:'"2"',body:ics(next,'Future meeting')});
 mock.resources.set('/calendar/repeat.ics',{etag:'"3"',body:ics(today,'Daily course','RRULE:FREQ=DAILY;COUNT=2\r\n')});
 await post('/api/calendar/config',{url:'http://127.0.0.1:'+mock.server.address().port+'/calendar/',username:'test',password:'secret'});
 await page.goto(base+'/#plan');await page.waitForFunction(()=>document.querySelector('#calendar-sync-status')?.textContent==='Calendar synced automatically');
 assert.equal(await page.getByRole('button',{name:'Sync this range',exact:true}).count(),0);
 assert.equal(app.getState().blocks.find(b=>b.name==='One-off meeting').commitment,false);
 assert.equal(await page.locator('.commitment-row').filter({hasText:'One-off meeting'}).count(),0);
 assert.equal(await page.locator('.commitment-row').filter({hasText:'Daily course'}).count(),1);
 await page.locator('[data-action="calendar-view"][data-id="day"]').click();await page.locator('#plan-date').fill(next);await page.locator('#plan-date').dispatchEvent('change');
 await page.waitForFunction(()=>document.querySelector('.timeblock')?.textContent.includes('Future meeting'));
 assert.ok(app.getState().blocks.some(b=>b.name==='Future meeting'));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(const name of ['now','tasks','plan','social','focus','capture','progress','rewards','settings','life','projects']){
   await page.goto(base+'/#'+name);await page.locator('#main').waitFor();
   assert.equal(await page.locator('details.calm-disclosure').count(),0,name+' has no bottom content drawers');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);
   if(name==='progress'){await page.getByRole('heading',{name:'Connections, kept',exact:true}).waitFor();const metrics=await page.locator('.metric-grid').boundingBox(),chart=await page.locator('.chart').boundingBox();assert.ok(metrics.y<chart.y);assert.equal(await page.locator('.keepsake.locked').count(),0);assert.equal(await page.getByText('Your sessions will appear here.',{exact:true}).count(),0);}
   if(name==='plan'&&await page.locator('.timeblock').count()){const event=await page.locator('.timeline').boundingBox(),tools=await page.locator('.plan-aside').boundingBox();if(width===390)assert.ok(event.y<tools.y,'Appointments precede routines');}
   await page.screenshot({path:'test-results/integrated-'+name+'-'+width+'.png',fullPage:true});
  }
 }
 await post('/api/settings',{theme:'dark'});await page.goto(base+'/#life');await page.locator('body.dark').waitFor();await page.screenshot({path:'test-results/checkins-life-dark-phone.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Automatic social tasks, LIFE OS, calendar auto sync, all-page desktop/phone checks passed');
}finally{await browser?.close();await app.close();mock.server.closeAllConnections();await new Promise(r=>mock.server.close(r));}

