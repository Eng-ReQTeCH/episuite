import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, browserOptions, waitForCondition } from './browser-runtime.mjs';
import { createApp } from '../server.mjs';
import { initialState, taskInput } from '../public/domain.js';

const directory = await mkdtemp(path.join(tmpdir(), 'episuite-books-browser-'));
let app, browser;
try {
  const fixture = initialState();
  fixture.onboarding = { status: 'complete', step: 7 };
  fixture.settings.sound = false;
  const readingTask = taskInput({ title: 'Reading', repeat: 'daily' });
  const otherTask = taskInput({ title: 'Learn a chapter', repeat: 'daily' });
  fixture.tasks.push(readingTask, otherTask);
  await writeFile(path.join(directory, 'episuite.json'), JSON.stringify(fixture));
  app = await createApp({ dataDir: directory, backgroundInterval: 0, bookFetch: async () => ({
    ok: true,
    json: async () => ({ docs: [
      { key: '/works/OL17930368W', title: 'Atomic Habits', author_name: ['James Clear'], cover_i: 12539702, number_of_pages_median: 322, first_publish_year: 2016 },
      { key: '/works/OL30048054W', title: 'Companion Workbook: Atomic Habits', author_name: ['Julie Ann Price'], cover_i: 15095106, number_of_pages_median: 106, first_publish_year: 2019 }
    ] })
  }) });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch(browserOptions);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const save = async () => {
    await page.locator('#dialog [type="submit"]').click();
    await page.locator('#dialog').waitFor({ state: 'hidden' });
  };
  const search = async () => {
    await page.getByRole('button', { name: 'Add a book', exact: true }).click();
    await page.locator('#book-search-title').fill('Atomic Habits');
    await page.locator('[data-form="book-search"] [type="submit"]').click();
    await page.locator('.book-result').first().waitFor();
  };
  const log = async (bookId, reached) => {
    await page.locator(`[data-book="${bookId}"] [data-action="book-log"]`).click();
    await page.locator('#f-page').fill(String(reached));
    await save();
  };
  await page.goto(base + '/#life');
  await page.locator('.books-panel').waitFor();
  await search();
  assert.equal(await page.locator('.book-result').count(), 2);
  await page.locator('.book-result').first().click();
  assert.equal(await page.locator('#f-title').inputValue(), 'Atomic Habits');
  assert.equal(await page.locator('#f-author').inputValue(), 'James Clear');
  assert.equal(await page.locator('#f-totalPages').inputValue(), '322');
  await page.locator('#f-currentPage').fill('10');
  await save();
  let book = app.getState().reading.books[0];
  assert.equal(book.coverId, 12539702);
  assert.equal(Object.keys(app.getState().tasks[0].history).length, 0, 'Adding a book is separate from logging reading');
  await log(book.id, 25);
  const today = Object.keys(app.getState().tasks[0].history)[0];
  assert.equal(app.getState().tasks[0].history[today].length, 1);
  await log(book.id, 40);
  assert.equal(app.getState().tasks[0].history[today].length, 1);
  await page.reload();
  await page.locator(`[data-book="${book.id}"]`).waitFor();
  assert.match(await page.locator(`[data-book="${book.id}"] .book-position`).innerText(), /Page 40 of 322/);
  await log(book.id, 322);
  await page.locator('.books-finished summary').click();
  assert.equal(app.getState().reading.books[0].status, 'finished');
  assert.ok((await page.locator('.books-finished').innerText()).includes('Atomic Habits'));

  await page.getByRole('button', { name: 'Add a book', exact: true }).click();
  await page.getByRole('button', { name: 'Add manually', exact: true }).click();
  await page.locator('#f-title').fill('A book from last year');
  await page.locator('#f-totalPages').fill('200');
  await page.locator('#f-status').selectOption('finished');
  await page.locator('#f-finishedDate').fill('2024-03-15');
  await save();
  assert.equal(app.getState().reading.books[1].finishedDate, '2024-03-15');
  assert.equal(app.getState().tasks[0].history[today].length, 1);

  await search();
  await page.locator('.book-result').nth(1).click();
  await save();
  const second = app.getState().reading.books[2];
  await page.locator('[data-action="book-task-settings"]').click();
  await page.locator('#f-taskId').selectOption(otherTask.id);
  await save();
  await log(second.id, 5);
  assert.equal(app.getState().tasks[1].history[today].length, 1);

  const directoryOut = fileURLToPath(new URL('../test-results/', import.meta.url));
  await mkdir(directoryOut, { recursive: true });
  await page.locator('#main').focus();
  await page.locator('.books-panel').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#toast')).opacity === '0');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Phone layout fits');
  await page.screenshot({ path: path.join(directoryOut, 'books-phone.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(directoryOut, 'books-desktop.png'), fullPage: true });
  await page.locator('.book-card [data-action="book-details"]').first().click();
  await page.getByRole('button', { name: 'Edit book', exact: true }).click();
  await page.locator('#f-currentPage').fill('3');
  await save();
  await waitForCondition(() => app.getState().reading.books[2].currentPage === 3);
  assert.equal(app.getState().tasks[1].history[today].length, 1, 'Correcting a page gives no extra task credit');
  assert.deepEqual(errors, []);
  console.log('Book browser checks passed: search, choose, pages, finished shelf, past books, task linking, and responsive layout');
} finally {
  await browser?.close();
  await app?.close();
  assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep + 'episuite-books-browser-'));
  await rm(directory, { recursive: true, force: true });
}
