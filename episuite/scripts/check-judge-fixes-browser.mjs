import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, browserOptions, waitForCondition } from './browser-runtime.mjs';
import { createApp } from '../server.mjs';
import { initialState, taskInput, dateKey, addDays } from '../public/domain.js';
import { bookInput, logReading } from '../public/books-domain.js';

const directory = await mkdtemp(path.join(tmpdir(), 'episuite-judge-fixes-'));
let app, browser;
try {
  const state = initialState(), today = dateKey(), yesterday = addDays(today,-1);
  state.onboarding = { status:'complete',step:7 }; state.settings.sound=false;
  const activity=taskInput({title:'Correct my exercise',repeat:'daily'}), queued=taskInput({title:'An unrelated queued task'}), waiting=taskInput({title:'Waiting exercise',repeat:'daily',workStatus:'waiting',waitingFor:'A replacement shoe'});
  state.tasks.push(activity,queued,waiting);
  const older=bookInput({title:'Resumed older book',totalPages:100});older.createdAt=Date.now()-100000;
  const newer=bookInput({title:'Newly added book',totalPages:100});
  state.reading.books.push(older,newer);logReading(state,older,{page:20,eventId:'first-reading',expectedVersion:0},today);
  await writeFile(path.join(directory,'episuite.json'),JSON.stringify(state));
  app=await createApp({dataDir:directory,backgroundInterval:0});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+app.server.address().port;
  browser=await chromium.launch(browserOptions);
  const context=await browser.newContext({viewport:{width:1100,height:850}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  const save=async()=>{await page.locator('#dialog [type="submit"]').click();await page.locator('#dialog').waitFor({state:'hidden'}).catch(async error=>{throw Error(error.message+'\n'+await page.locator('#dialog').innerText());});};
  const close=()=>page.getByRole('button',{name:'Close dialog',exact:true}).click();
  const search=async title=>{await page.goto(base+'/#tasks');await page.locator('#task-search').fill(title);};
  const history=async date=>{await search(activity.title);await page.locator('.task-more summary').click();await page.locator('[data-action="task-history"]').click();if(date!==today){await page.locator('#f-date').fill(date);await page.getByRole('button',{name:'View this day',exact:true}).click();}};

  await page.goto(base+'/#now');await page.locator('[data-action="quick-capture"]').first().click();
  await page.locator('#quick-capture').fill('Recover this thought');await page.keyboard.press('Escape');await page.reload();
  await page.locator('[data-action="quick-capture"]').first().click();assert.equal(await page.locator('#quick-capture').inputValue(),'Recover this thought');await save();
  await page.locator('[data-action="quick-capture"]').first().click();assert.equal(await page.locator('#quick-capture').inputValue(),'');await close();
  await page.goto(base+'/#tasks');await page.locator('[data-action="new-task"]').click();await page.locator('#f-title').fill('An unfinished task');await page.keyboard.press('Escape');await page.reload();await page.locator('[data-action="new-task"]').click();
  assert.equal(await page.locator('#f-title').inputValue(),'An unfinished task');await page.getByRole('button',{name:'Discard draft',exact:true}).click();await close();
  await page.goto(base+'/#capture');await page.locator('[data-form="capture-page"] [name="text"]').fill('Capture page draft');await page.reload();
  assert.equal(await page.locator('[data-form="capture-page"] [name="text"]').inputValue(),'Capture page draft');
  await page.locator('[data-form="capture-page"] [type="submit"]').click();await waitForCondition(()=>app.getState().notes.some(note=>note.text==='Capture page draft'));
  await page.reload();assert.equal(await page.locator('[data-form="capture-page"] [name="text"]').inputValue(),'');
  await page.goto(base+'/#now');await page.locator('[data-action="choose-priority"]').click();await page.locator('#f-outcome').fill('Recover my daily outcome');await page.keyboard.press('Escape');await page.reload();
  await page.locator('[data-action="choose-priority"]').click();assert.equal(await page.locator('#f-outcome').inputValue(),'Recover my daily outcome');await save();
  await page.goto(base+'/#plan');await page.locator('.page-heading [data-action="new-event"]').click();await page.locator('#commit-name').fill('Recover calendar draft');await page.keyboard.press('Escape');await page.reload();
  await page.locator('.page-heading [data-action="new-event"]').click();assert.equal(await page.locator('#commit-name').inputValue(),'Recover calendar draft');await page.getByRole('button',{name:'Discard draft',exact:true}).click();await close();

  await page.goto(base+'/#projects');await page.getByRole('button',{name:'New project',exact:true}).click();await page.locator('#f-title').fill('Judge project');await save();
  const project=app.getState().projects[0];await page.getByRole('button',{name:'Add task',exact:true}).click();
  assert.equal(await page.locator('#f-projectId').inputValue(),project.id);await page.locator('#f-title').fill('Project first step');await save();
  await page.locator('[data-action="project-tasks"]').click();await page.locator('#dialog .project-tasks').waitFor();await page.getByRole('button',{name:'Make next',exact:true}).click();
  await waitForCondition(()=>Boolean(app.getState().projects[0].nextTaskId));
  await search(waiting.title);await page.getByRole('button',{name:'Filters',exact:true}).click();await page.locator('#task-status-filter').selectOption('waiting');
  assert.ok((await page.locator('.task-list').innerText()).includes('A replacement shoe'));
  await page.locator('#task-status-filter').selectOption('');await page.locator('#task-search').fill('');await page.locator('#project-filter').selectOption(project.id);
  assert.equal(await page.locator('.task-list .task-row').count(),1);await page.locator('#project-filter').selectOption('');

  await history(today);await page.locator('#f-date').fill(yesterday);await save();
  assert.equal(app.getState().tasks[0].history[yesterday].length,1);const coins=app.getState().coins;
  await history(yesterday);await page.getByRole('button',{name:'Correct entry',exact:true}).click();await page.locator('#f-date').fill(addDays(today,-2));await save();
  assert.equal(app.getState().tasks[0].history[addDays(today,-2)].length,1);assert.equal(app.getState().coins,coins);
  await history(addDays(today,-2));await page.getByRole('button',{name:'Correct entry',exact:true}).click();await page.locator('#f-action').selectOption('remove');await save();assert.equal(app.getState().coins,0);

  await page.goto(base+'/#life');await page.getByRole('button',{name:'All books',exact:true}).click();await page.locator('#f-librarySort').selectOption('read');
  assert.ok((await page.locator('.book-library .book-card').first().innerText()).includes(older.title));await close();
  await page.locator(`#main [data-book="${older.id}"] [data-action="book-details"]`).first().click();await page.getByRole('button',{name:'Edit session',exact:true}).click();
  await page.locator('#f-page').fill('100');await page.locator('[name="finished"]').check();await save();assert.equal(app.getState().reading.books[0].status,'finished');

  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);await search(queued.title);await page.locator('.task-row .checkbox').click();
  await page.goto(base+'/#focus');await page.locator('[data-action="start"]').click();await page.locator('[data-action="pause"]').waitFor();
  const timerId=await page.evaluate(()=>JSON.parse(localStorage.getItem('episuite.snapshot')).timer.id);
  await page.getByRole('button',{name:'Review saved changes',exact:true}).click();await page.getByRole('button',{name:'Discard change',exact:true}).click();await page.getByRole('button',{name:'Discard change',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('episuite.snapshot')).timer.id),timerId);
  await page.reload();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('episuite.snapshot')).timer.id),timerId);
  await page.locator('[data-action="reset"]').click();await page.locator('[data-action="confirm-reset"]').click();
  await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>!document.querySelector('.status.offline'));
  await page.locator('[data-action="start"]').click();await waitForCondition(()=>Boolean(app.getState().timer));const sharedId=app.getState().timer.id;
  await context.setOffline(true);await page.locator('[data-action="pause"]').click();await page.locator('[data-action="resume"]').waitFor();
  await app.backgroundTick(app.getState().timer.deadline+1000);
  assert.ok(app.getState().sessions.some(session=>session.id===sharedId&&session.automatic));await page.reload();
  await page.locator('[data-action="resume"]').click();await page.locator('[data-action="pause"]').waitFor();await page.locator('[data-action="finish"]').click();await page.locator('[data-action="start"]').waitFor();
  await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await waitForCondition(()=>app.getState().sessions.some(session=>session.id===sharedId)&&!app.getState().timer);
  assert.equal(app.getState().sessions.filter(session=>session.id===sharedId).length,1);
  await page.setViewportSize({width:390,height:844});await search(waiting.title);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('Judge-fix browser checks passed: draft recovery, project task entry, waiting filters, dated corrections, reading finish, recent reading, offline timer preservation and continuity');
} finally {
  await browser?.close();await app?.close();
  assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep+'episuite-judge-fixes-'));
  await rm(directory,{recursive:true,force:true});
}
