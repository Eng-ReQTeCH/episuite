import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {initialState,taskInput,blockInput,addDays,dateKey} from '../public/domain.js';
import {personInput,circleInput} from '../public/social-domain.js';
let require=createRequire(import.meta.url),chromium;
try{({chromium}=require('playwright'));}catch{require=createRequire('C:/Users/Monty/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');({chromium}=require('playwright'));}
const out=fileURLToPath(new URL('../test-results/page-layouts/',import.meta.url)),day=dateKey(),fixtures=[];
const pages=['life','now','tasks','plan','social','focus','capture','progress','rewards','settings'];
async function fixture(populated){
 const state=initialState();state.onboarding={status:'complete',step:7};state.settings.sound=false;
 if(populated){
  state.settings.name='Monty';state.coins=210;state.earned=350;
  const titles=['Practice German for ten minutes','Clear one corner of my desk','Take a short walk','Read a few pages','Work on my personal project','Water the plants','Plan meals for the weekend','Book the dentist','Reply to the course tutor','Learn one song on guitar','Back up my photos','Review my notes','Sort the kitchen drawer','Stretch for five minutes'];
  state.tasks=titles.map((title,i)=>{const t=taskInput({title,lane:i<3?'today':'inbox',repeat:i<6?'daily':'none',category:['Learning','Home','Health','Learning','Work'][i%5],minutes:[10,5,15,10,25][i%5],steps:i===0?[{id:'step0',title:'Open the German companion',done:false},{id:'step1',title:'Review yesterday’s words',done:false}]:[]},{id:`task-${i}`,order:i});if(i<6)for(let j=1;j<=3+i;j++)t.history[addDays(day,-j)]=[{id:`${i}-${j}`,at:Date.parse(addDays(day,-j)+'T12:00:00Z'),coins:0}];return t;});
  state.tasks[8].due=addDays(day,-1);state.tasks.push(taskInput({title:'Old task to restore'},{id:'deleted-task',deleted:true}));
  state.sessions=Array.from({length:25},(_,i)=>({id:`session-${i}`,mode:'focus',taskId:state.tasks[i%6].id,date:addDays(day,-Math.floor(i/2)),minutes:10+(i%4)*5,at:Date.now()-i*43200000,coins:2,full:true}));
  state.notes=['Idea for the German study companion','Ask about the weekend hiking route','A book I want to read next','Remember to bring the camera','Try a shorter morning routine','A thought about the personal project','Check the class timetable','Music to learn on guitar'].map((text,i)=>({id:`note-${i}`,text,created:Date.now()-i*3600000}));
  state.social.circles=['Friends','Family','Learning'].map((name,i)=>circleInput({name,color:['#7053b4','#2c856d','#bc6b40'][i]},{id:`circle-${i}`}));
  state.social.people=['Sam','Maya','Omar','Lena','Daniel','Nour','Alex'].map((name,i)=>personInput({name,circleIds:[`circle-${i%3}`],everyDays:14,lastChecked:addDays(day,-(i+1)*4),notes:['Ask about the new course.','Enjoys walks and coffee.','Working on a new project.'][i%3]},{id:`person-${i}`},state.social));
  state.blocks=Array.from({length:9},(_,i)=>blockInput({name:['German practice','Walk outside','Project time','Coffee with Sam','Guitar practice'][i%5],date:addDays(day,Math.floor(i/3)),start:`${String(9+(i%3)*3).padStart(2,'0')}:00`,duration:45,taskIds:[state.tasks[i%6].id],personIds:i===3?['person-0']:[]}));
  state.rewards.push(...[['Guitar time',20,20],['Watch an episode',40,30],['Coffee outside',25,0],['Gaming break',30,20]].map(([name,cost,minutes],i)=>({id:`reward-${i}`,name,cost,minutes,kind:'personal'})));
  state.life={visits:Object.fromEntries(Array.from({length:12},(_,i)=>[addDays(day,-i),1])),shortcuts:[{id:'german',name:'German companion',url:'https://german.example.com'}],board:{graphs:['task:task-0','task:task-2','focus','all'],showFlame:true,showShortcuts:true,showTotals:false,graphAccent:'#22c55e'}};
 }
 const dataDir=await mkdtemp(path.join(tmpdir(),'page-layout-'));await writeFile(path.join(dataDir,'episuite.json'),JSON.stringify(state));const app=await createApp({dataDir,backgroundInterval:0});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const f={app,base:`http://127.0.0.1:${app.server.address().port}`,name:populated?'populated':'empty'};fixtures.push(f);return f;
}
let browser;const metrics=[];
try{
 const populated=await fixture(true),empty=await fixture(false);
 browser=await chromium.launch({headless:true,executablePath:process.env.LIFE_BROWSER||'C:/Users/Monty/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/favicon.ico',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" rx="5" fill="#22c55e"/></svg>'}));
 await page.goto(populated.base+'/#tasks');await page.locator('.task-streak').first().waitFor();
 const row=page.locator('.task-row').filter({hasText:'Practice German for ten minutes'});assert.equal(await row.locator('.task-streak').getAttribute('data-streak'),'3');assert.equal(await row.locator('.task-streak').getAttribute('data-active'),'false');
 await row.locator('[data-action="complete"]').click();await page.locator('[data-action="task-tab"][data-id="habits"]').click();await page.waitForFunction(()=>[...document.querySelectorAll('.task-row')].find(r=>r.textContent.includes('Practice German for ten minutes'))?.querySelector('.task-streak')?.dataset.streak==='4');assert.equal(await row.locator('.task-streak').getAttribute('data-active'),'true');await row.locator('[data-action="complete"]').click();await page.waitForFunction(()=>[...document.querySelectorAll('.task-row')].find(r=>r.textContent.includes('Practice German for ten minutes'))?.querySelector('.task-streak')?.dataset.streak==='3');
 await page.locator('#toast.show').waitFor();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#toast')).opacity==='0');
 for(const f of fixtures)for(const [screen,width,height] of [['desktop',1440,1000],['phone',390,844]]){
  await page.setViewportSize({width,height});await page.goto(f.base+'/#life');await page.reload();await page.locator('.status').filter({hasText:'Synced to your server'}).waitFor({state:'attached'});await page.locator('#main h1').waitFor();const directory=path.join(out,f.name,screen);await mkdir(directory,{recursive:true});
  for(const id of pages){
   await page.goto(f.base+'/#'+id);await page.locator('#main h1').first().waitFor();if(id==='tasks')await page.locator('[data-action="task-tab"][data-id="all"]').click();await page.locator('#main').focus();await page.evaluate(()=>window.scrollTo(0,0));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${f.name}/${screen}/${id} overflows`);
   metrics.push({fixture:f.name,screen,page:id,...await page.locator('#main').evaluate(el=>({height:Math.round(el.scrollHeight),visibleButtons:[...el.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).length}))});
   await page.screenshot({path:path.join(directory,id+'.png')});await page.screenshot({path:path.join(directory,id+'.full.png'),fullPage:true});
  }
  await page.goto(f.base+'/#plan');for(const view of ['month','day','week','agenda']){await page.locator(`[data-action="calendar-view"][data-id="${view}"]`).click();await page.locator(`[data-action="calendar-view"][data-id="${view}"][aria-pressed="true"]`).waitFor();if(f.name==='empty'){assert.equal((await(await fetch(f.base+'/api/state')).json()).blocks.length,0);await page.waitForFunction(()=>document.querySelectorAll('.calendar-event,.calendar-day-count,.timeblock').length===0);}await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(directory,'calendar-'+view+'.full.png'),fullPage:true});}
 }
 // Exercise the real controls behind progressive disclosure, not only their screenshots.
 await page.goto(populated.base+'/#settings');await page.locator('#settings-section').selectOption('rhythm');await page.locator('#f-focusMinutes').fill('30');await page.locator('[data-form="settings"] [type="submit"]').click();await page.waitForFunction(async()=> (await(await fetch('/api/state')).json()).settings.focusMinutes===30);assert.equal(populated.app.getState().settings.focusMinutes,30);
 await page.locator('#settings-section').selectOption('data');await page.locator('[data-form="category"] input').fill('Creative');await page.locator('[data-form="category"] [type="submit"]').click();await page.waitForFunction(()=>[...document.querySelectorAll('.pill')].some(n=>n.textContent.includes('Creative')));
 await page.locator('#settings-section').selectOption('phone');assert.ok(await page.locator('[name="ntfyUrl"]').isVisible());assert.equal(await page.locator('[name="botToken"]').isVisible(),false);await page.locator('[name="provider"]').selectOption('telegram');assert.equal(await page.locator('[name="ntfyUrl"]').isVisible(),false);assert.ok(await page.locator('[name="botToken"]').isVisible());await page.locator('#main').focus();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,'settings-phone-connection.png'),fullPage:true});
 await page.goto(populated.base+'/#tasks');await page.locator('[data-action="task-tab"][data-id="all"]').click();assert.ok(await page.locator('.task-row:visible').count()<=6);await page.locator('#task-search').fill('Stretch for five minutes');assert.equal(await page.locator('.task-row:visible').count(),1);await page.locator('.task-more summary').click();await page.locator('.task-more-menu [data-action="task-history"]').click();await page.locator('#dialog .heat-grid').waitFor();await page.locator('#dialog [data-action="close-dialog"]').click();
 await page.goto(populated.base+'/#capture');await page.locator('#capture-search').fill('guitar');assert.equal(await page.locator('.note-row:visible').count(),1);
 await page.goto(populated.base+'/#progress');await page.locator('[data-disclosure="progress-collection"]>summary').click();assert.ok(await page.locator('.growth-panel').isVisible());
 await page.goto(populated.base+'/#focus');await page.locator('[data-action="start"]').first().click();await page.locator('[data-action="pause"]').waitFor();await page.screenshot({path:path.join(out,'focus-active-phone.png'),fullPage:true});
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'metrics.json'),JSON.stringify(metrics,null,2));console.log('Page layout browser checks passed');
}finally{await browser?.close();for(const f of fixtures)await f.app.close();}
