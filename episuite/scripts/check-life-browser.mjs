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
let browser;const nativeNow=Date.now;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.LIFE_BROWSER||'C:/Users/Monty/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(12000);await page.goto(base+'/#tasks');await page.locator('.task-row').first().waitFor();assert.equal(await page.locator('.task-row').count(),4);assert.equal(await page.locator('[data-action="task-tab"][data-id="later"]').count(),0);
 await page.locator('[data-action="unselect-task"]').click();assert.equal(await page.locator('.task-row').count(),4);await page.locator('.task-row').filter({hasText:'German study'}).locator('[data-action="complete"]').click();
 await page.locator('.task-row').filter({hasText:'Old someday'}).locator('[data-action="task-history"]').click();await page.locator('#dialog .heat-grid').waitFor();await page.locator('#dialog [data-action="close-dialog"]').click();
 await page.locator('[data-action="nav"][data-id="life"]').first().click();await page.locator('#main h1').filter({hasText:'LIFE OS'}).waitFor();assert.equal(await page.locator('.board-graph').count(),0);await page.locator('[data-action="life-add"]').first().click();await page.locator('[name="graphs"][value="all"]').check();await page.locator('#dialog [type="submit"]').click();await page.locator('.board-graph').waitFor();
 await page.locator('[data-action="new-shortcut"]').first().click();await page.locator('#f-name').fill('German companion');await page.locator('#f-url').fill(base+'/german');await page.locator('#dialog [type="submit"]').click();await page.locator('.shortcut a').waitFor();assert.equal(await page.locator('.shortcut a').getAttribute('href'),base+'/german');assert.equal(await page.locator('.shortcut img,.shortcut-fallback').count(),1);
 await page.locator('.shortcut-menu summary').click();await page.locator('[data-action="edit-shortcut"]').click();await page.locator('#f-name').fill('Deutsch companion');await page.locator('#dialog [type="submit"]').click();await page.locator('.shortcut').filter({hasText:'Deutsch companion'}).waitFor();
 await page.locator('[data-action="automation-setup"]').click();await page.locator('[data-action="automation-token"]').click();await page.locator('[aria-label="Automation token"]').waitFor();assert.equal((await page.locator('[aria-label="Automation token"]').inputValue()).length,64);await page.locator('#dialog [data-action="close-dialog"]').click();
 await page.locator('[data-action="nav"][data-id="focus"]').first().click();await page.locator('[data-action="duration"][data-id="2"]').click();await page.locator('[data-action="start"]').first().click();await page.locator('[data-action="float-timer"]').waitFor();
 // Real browser API: this creates a separate always-on-top document, not an in-page mock.
 const popupPromise=context.waitForEvent('page');await page.locator('[data-action="float-timer"]').click();const popup=await popupPromise;await popup.locator('[data-floating-time]').waitFor();assert.match(await popup.locator('[data-floating-time]').innerText(),/\d+:\d+/);
 // Simulate the hidden opener while the genuine PiP window remains open.
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{get:()=>true,configurable:true}));
 const remoteTimer=app.getState().timer.id;
 await post('/api/timer/pause',{timerId:remoteTimer});await popup.locator('[data-action="resume"]').waitFor();
 await popup.locator('[data-action="resume"]').click();await popup.locator('[data-action="pause"]').waitFor();
 await post('/api/settings',{autoBreak:true});
 // Advance the isolated server and opener clocks past the real deadline.
 const offset=app.getState().timer.deadline-nativeNow()+100;
 Date.now=()=>nativeNow()+offset;
 await page.evaluate(offset=>{const nativeNow=Date.now;Date.now=()=>nativeNow()+offset;},offset);
 await popup.locator('.eyebrow').filter({hasText:'BREAK'}).waitFor();
 await page.evaluate(()=>{delete document.hidden;});
 await popup.locator('[data-action="pause"]').click();await popup.locator('[data-action="resume"]').waitFor();assert.equal(app.getState().timer.status,'paused');await popup.locator('[data-action="resume"]').click();await popup.locator('[data-action="pause"]').waitFor();await popup.locator('[data-action="finish"]').click();await popup.locator('[data-action="float-break"]').waitFor();await popup.locator('[data-action="float-break"]').click();await popup.locator('.eyebrow').filter({hasText:'BREAK'}).waitFor();await popup.close();assert.equal(app.getState().timer.mode,'short');
 // Unsupported browser path remains actionable.
 await page.evaluate(()=>Object.defineProperty(window,'documentPictureInPicture',{value:undefined,configurable:true}));await page.locator('[data-action="float-timer"]').click();await page.getByText('Keep the timer visible',{exact:true}).waitFor();await page.locator('#dialog [data-action="close-dialog"]').click();
 await page.locator('[data-action="nav"][data-id="life"]').first().click();await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await page.screenshot({path:fileURLToPath(new URL('../test-results/life-desktop.png',import.meta.url)),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.dispatchEvent(new Event('resize')));await page.reload();await page.locator('.mini-grid').first().waitFor();assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.heat-scroll')].every(el=>el.scrollLeft+el.clientWidth>=el.scrollWidth-2)),'Phone grids open at latest days');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Phone layout must fit');await page.screenshot({path:fileURLToPath(new URL('../test-results/life-phone.png',import.meta.url)),fullPage:true});assert.deepEqual(errors,[]);console.log('Life OS browser checks passed');
}finally{Date.now=nativeNow;await browser?.close();await app.close();}
