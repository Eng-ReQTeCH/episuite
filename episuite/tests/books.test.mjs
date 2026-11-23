import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { bookInput, logReading, normalizeReading, readingTask } from '../public/books-domain.js';
import { createBookSearch } from '../book-search.mjs';
import { addDays, dateKey, initialState, taskInput, toggleCompletion } from '../public/domain.js';

const today = dateKey();
const readingState = () => {
  const state = initialState();
  state.tasks.push(taskInput({ title: 'Read books', repeat: 'daily' }));
  const book = bookInput({ title: 'A book', totalPages: 100 });
  book.editVersion = 1;
  state.reading.books.push(book);
  return state;
};
const progress = (book, page, eventId, finished = false) => ({ page, eventId, finished, expectedVersion: book.editVersion });

test('reading progress credits one task per day across books and retries without undoing it', () => {
  const state = readingState(), book = state.reading.books[0], task = state.tasks[0];
  const event = progress(book, 10, 'reading-1');
  assert.equal(logReading(state, book, event, today).taskStatus, 'completed');
  const coins = state.coins;
  assert.equal(logReading(state, book, event, today).duplicate, true);
  assert.equal(state.coins, coins);
  assert.equal(book.logs.length, 1);
  assert.throws(() => logReading(state, book, { ...event, page: 11 }, today), { status: 409 });
  const other = bookInput({ title: 'Second book' });
  state.reading.books.push(other);
  assert.equal(logReading(state, other, progress(other, 8, 'reading-2'), today).taskStatus, 'already');
  assert.equal(task.history[today].length, 1);
  toggleCompletion(state, task.id, today);
  assert.equal(logReading(state, book, progress(book, 20, 'reading-3'), today).taskStatus, 'already');
  assert.equal(task.history[today].length, 0);
  const tomorrow = addDays(today, 1);
  assert.equal(logReading(state, book, progress(book, 25, 'reading-4'), tomorrow).taskStatus, 'completed');
  assert.equal(task.history[tomorrow].length, 1);
});

test('page bounds, stale edits and finished books cannot silently replace progress', () => {
  const state = readingState(), book = state.reading.books[0];
  assert.throws(() => logReading(state, book, progress(book, 101, 'bad-page'), today), /exceeds/);
  assert.throws(() => logReading(state, book, progress(book, 0, 'no-progress'), today), /after/);
  assert.throws(() => logReading(state, book, progress(book, 1.5, 'fraction'), today), /valid/);
  assert.throws(() => logReading(state, book, { ...progress(book, 1, 'stale'), expectedVersion: 0 }, today), { status: 409 });
  logReading(state, book, progress(book, 100, 'finished'), today);
  assert.equal(book.status, 'finished');
  assert.equal(book.finishedDate, today);
  assert.throws(() => logReading(state, book, progress(book, 101, 'closed'), today), /Reopen/);
});

test('task matching permits explicit linking and avoids ambiguous or unrelated reading tasks', () => {
  const state = readingState();
  assert.equal(readingTask(state, today).task.id, state.tasks[0].id);
  state.tasks.push(taskInput({ title: 'Reading practice', repeat: 'daily' }));
  assert.equal(readingTask(state, today).ambiguous, true);
  const book = state.reading.books[0];
  assert.equal(logReading(state, book, progress(book, 5, 'ambiguous'), today).taskStatus, 'choose');
  state.reading.taskId = state.tasks[1].id;
  assert.equal(logReading(state, book, progress(book, 10, 'linked'), today).taskStatus, 'completed');
  state.reading.taskId = 'none';
  assert.equal(logReading(state, book, progress(book, 15, 'disabled'), today).taskStatus, 'unlinked');
  state.reading.taskId = 'auto';
  state.tasks = [taskInput({ title: 'Read emails' })];
  assert.equal(readingTask(state, today).task, null);
  state.tasks = [taskInput({ title: 'Reading email' })];
  assert.equal(readingTask(state, today).task, null);
  state.tasks = [taskInput({ title: 'Read 20 pages', repeat: 'daily' })];
  assert.equal(readingTask(state, today).task.id, state.tasks[0].id);
  state.tasks = [taskInput({ title: 'Reading', repeat: 'weekly' })];
  toggleCompletion(state, state.tasks[0].id, addDays(today, -1));
  assert.equal(logReading(state, book, progress(book, 20, 'rest-day'), today).taskStatus, 'not-due');
});

test('search normalizes cover metadata, caches requests, and reports provider failure', async () => {
  let requests = 0;
  const search = createBookSearch(async url => {
    requests++;
    assert.equal(url.origin, 'https://openlibrary.org');
    assert.equal(url.searchParams.get('q'), 'A book');
    assert.equal(url.searchParams.get('limit'), '12');
    return { ok: true, json: async () => ({ docs: [
      { key: '/works/OL1W', title: 'A book', author_name: ['An author'], cover_i: 12, number_of_pages_median: 200, first_publish_year: 2001 },
      { key: 'OL2W', title: 'Another book', cover_i: 'invalid', number_of_pages_median: -2 }
    ] }) };
  });
  const results = await search(' A book ');
  assert.equal(results[0].coverId, 12);
  assert.equal(results[1].sourceId, '/works/OL2W');
  assert.equal(results[1].totalPages, null);
  assert.deepEqual(await search('A book'), results);
  assert.equal(requests, 1);
  await assert.rejects(search('x'), { status: 400 });
  const unavailable = createBookSearch(async () => { throw Error('Provider failed'); });
  await assert.rejects(unavailable('A title'), { status: 503 });
});

test('older states gain an empty shelf and malformed book backups are rejected', () => {
  const old = initialState();
  delete old.reading;
  normalizeReading(old);
  assert.deepEqual(old.reading.books, []);
  const invalid = readingState();
  invalid.reading.books[0].coverId = 'https://example.com/cover';
  assert.throws(() => normalizeReading(invalid), /cover/);
  const duplicated = readingState();
  duplicated.reading.books.push(structuredClone(duplicated.reading.books[0]));
  assert.throws(() => normalizeReading(duplicated), /invalid book/);
});

test('HTTP book flows preserve history and check-offs through restart and backup restore', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'episuite-books-test-'));
  let app, base;
  const start = async () => {
    app = await createApp({ dataDir: directory, backgroundInterval: 0, bookFetch: async () => ({
      ok: true, json: async () => ({ docs: [{ key: '/works/OL1W', title: 'Test book', cover_i: 10 }] })
    }) });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + app.server.address().port;
  };
  const call = async (endpoint, data, method = 'POST') => {
    const response = await fetch(base + endpoint, {
      method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data)
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    const fixture = initialState();
    fixture.tasks.push(taskInput({ title: 'Reading', repeat: 'daily' }));
    await writeFile(path.join(directory, 'episuite.json'), JSON.stringify(fixture));
    await start();
    assert.equal((await call('/api/books/search?q=Test', undefined, 'GET')).body.books[0].coverId, 10);
    const creation = { title: 'New book', totalPages: 40, currentPage: 5, eventId: 'create-book' };
    const added = await call('/api/books', creation);
    assert.equal(added.status, 200);
    const book = added.body.result;
    await call('/api/books', creation);
    assert.equal(app.getState().reading.books.length, 1);
    const first = await call('/api/books/' + book.id + '/log', progress(book, 10, 'first-http-log'));
    assert.equal(first.body.result.taskStatus, 'completed');
    const stale = await call('/api/books/' + book.id, { title: 'Stale title', expectedVersion: 1 }, 'PATCH');
    assert.equal(stale.status, 409);
    const historical = await call('/api/books', { title: 'Read in the past', status: 'finished', finishedDate: addDays(today, -20) });
    assert.equal(historical.status, 200);
    assert.equal(app.getState().tasks[0].history[today].length, 1);
    const saved = (await call('/api/export', undefined, 'GET')).body;
    await app.close();
    await start();
    assert.equal(app.getState().reading.books[0].currentPage, 10);
    assert.equal(app.getState().reading.books[0].logs.length, 1);
    assert.equal((await call('/api/import', saved)).status, 200);
    const restored = app.getState();
    assert.equal(restored.reading.books.length, 2);
    assert.equal(restored.reading.books[1].finishedDate, addDays(today, -20));
    const retry = await call('/api/books/' + book.id + '/log', progress(book, 10, 'first-http-log'));
    assert.equal(retry.body.result.duplicate, true);
    assert.equal(app.getState().tasks[0].history[today].length, 1);
    assert.equal((await call('/api/books/' + book.id + '/log', {}, 'PATCH')).status, 405);
    assert.equal(JSON.parse(await readFile(path.join(directory, 'episuite.json'), 'utf8')).reading.books.length, 2);
  } finally {
    await app?.close();
    assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep + 'episuite-books-test-'));
    await rm(directory, { recursive: true, force: true });
  }
});
