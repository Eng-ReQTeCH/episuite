import {addDays,dateKey} from '../public/domain.js';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
let require=createRequire(import.meta.url),chromium;try{({chromium}=require('playwright'));}catch{require=createRequire('C:/Users/Monty/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');({chromium}=require('playwright'));}
const app=await createApp({dataDir:await mkdtemp(path.join(tmpdir(),'life-browser-')),backgroundInterval:0});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
const post=async(p,data)=>{const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(r.status,200);return r.json();};
await post('/api/onboarding',{status:'paused',step:0});for(const [title,lane] of [['Old inbox','inbox'],['Old someday','later'],['Selected task','today']])await post('/api/tasks',{title,lane});await post('/api/tasks',{title:'German study',repeat:'daily',category:'German'});
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.LIFE_BROWSER||'C:/Users/Monty/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(12000);
 await page.goto(base+'/#plan');await page.locator('[data-action="calendar-view"][data-id="month"]').click();await page.locator('.calendar-month').waitFor();assert.equal(await page.locator('.calendar-cell.is-today').count(),1);assert.ok(await page.locator('.calendar-today-label').isVisible());assert.ok(await page.locator('.calendar-cell.is-past').count()>0);assert.equal(await page.locator('.calendar-cell.is-today.is-past').count(),0);assert.ok(await page.locator('.past-days-gray').count());
 await page.goto(base+'/#settings');await page.locator('#settings-section').selectOption('calendar');await page.locator('[name="calendarPastStyle"]').selectOption('cross');await page.locator('[data-form="calendar-appearance"] [type="submit"]').click();await page.waitForFunction(async()=> (await(await fetch('/api/state')).json()).settings.calendarPastStyle==='cross');
 await page.goto(base+'/#plan');await page.locator('[data-action="calendar-view"][data-id="month"]').click();await page.locator('.past-days-cross').waitFor();assert.equal(await page.locator('.is-past').first().evaluate(el=>getComputedStyle(el,'::after').pointerEvents),'none');await page.locator('.is-past .calendar-date').first().click();await page.locator('.timeline').waitFor();
 await page.reload();assert.equal((await(await fetch(base+'/api/state')).json()).settings.calendarPastStyle,'cross');const invalid=await fetch(base+'/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({calendarPastStyle:'bad'})});assert.equal(invalid.status,400);assert.equal((await(await fetch(base+'/api/state')).json()).settings.calendarPastStyle,'cross');
 console.log('Calendar past-day appearance browser checks passed');
}finally{await browser?.close();await app.close();}
