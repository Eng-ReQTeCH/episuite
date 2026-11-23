import { dateKey, done, InputError, isDue, toggleCompletion, uid, validDate } from './domain.js';
import { syncContactCompletion } from './social-domain.js';

const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

function pageNumber(value, name, optional = false) {
  if (optional && (value === '' || value === null || value === undefined)) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > 1_000_000 || (optional && number === 0)) {
    throw new InputError('Enter a valid ' + name + '.');
  }
  return number;
}

export function bookInput(input, existing = {}, today = dateKey()) {
  const title = text(input.title ?? existing.title, 300);
  if (!title) throw new InputError('Give the book a title.');
  const status = input.status ?? existing.status ?? 'reading';
  if (!['reading', 'finished'].includes(status)) throw new InputError('Choose a valid reading status.');
  const totalPages = pageNumber(input.totalPages ?? existing.totalPages, 'page count', true);
  const currentPage = pageNumber(input.currentPage ?? existing.currentPage ?? 0, 'current page');
  if (totalPages !== null && currentPage > totalPages) throw new InputError('The current page exceeds the book’s page count.');
  const coverId = input.coverId ?? existing.coverId ?? null;
  if (coverId !== null && (!Number.isSafeInteger(coverId) || coverId <= 0)) throw new InputError('Choose a valid book cover.');
  const sourceId = text(input.sourceId ?? existing.sourceId, 80);
  if (sourceId && !/^\/works\/OL\d+W$/.test(sourceId)) throw new InputError('Choose a valid book result.');
  const finishedDate = status === 'finished' ? input.finishedDate ?? existing.finishedDate ?? today : '';
  if (status === 'finished' && (!validDate(finishedDate) || finishedDate > today)) throw new InputError('Choose a finish date up to today.');
  return {
    id: existing.id || uid(), title, author: text(input.author ?? existing.author, 300),
    sourceId, coverId, totalPages, currentPage, status, finishedDate,
    createdAt: existing.createdAt || Date.now(), editVersion: existing.editVersion || 0, logs: existing.logs || []
  };
}

export function normalizeReading(state) {
  const reading = state.reading ?? { books: [], taskId: 'auto', taskVersion: 0, credits: [] };
  if (!reading || typeof reading !== 'object' || Array.isArray(reading) || !Array.isArray(reading.books) || !Array.isArray(reading.credits)) {
    throw new InputError('Backup contains invalid reading data.');
  }
  if (typeof reading.taskId !== 'string' || reading.taskId.length > 300 || !Number.isSafeInteger(reading.taskVersion) || reading.taskVersion < 0) {
    throw new InputError('Backup contains invalid reading task settings.');
  }
  const ids = new Set(), events = new Set();
  reading.books = reading.books.map(book => {
    if (!book || typeof book.id !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(book.id) || ids.has(book.id) || !Array.isArray(book.logs)) {
      throw new InputError('Backup contains an invalid book.');
    }
    ids.add(book.id);
    const normalized = bookInput(book, book, dateKey(Date.now(), state.settings.timezone));
    if (!Number.isFinite(book.createdAt) || book.createdAt <= 0) throw new InputError('Backup contains an invalid book creation date.');
    if (!Number.isSafeInteger(book.editVersion) || book.editVersion < 0) throw new InputError('Backup contains an invalid book version.');
    normalized.logs = book.logs.map(log => {
      if (!log || typeof log.id !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(log.id) || events.has(log.id) ||
          !validDate(log.date) || !Number.isFinite(log.at) || !Number.isSafeInteger(log.from) || !Number.isSafeInteger(log.to) ||
          log.from < 0 || log.to <= log.from || log.to > 1_000_000 || typeof log.finished !== 'boolean') {
        throw new InputError('Backup contains an invalid reading log.');
      }
      events.add(log.id);
      return { id: log.id, date: log.date, at: log.at, from: log.from, to: log.to, finished: log.finished };
    });
    return normalized;
  });
  reading.credits = reading.credits.map(credit => {
    if (!credit || !validDate(credit.date) || typeof credit.taskId !== 'string' || credit.taskId.length > 300) {
      throw new InputError('Backup contains an invalid reading task receipt.');
    }
    return { date: credit.date, taskId: credit.taskId };
  });
  state.reading = reading;
}

export function readingTask(state, today) {
  const taskId = state.reading?.taskId ?? 'auto';
  if (taskId === 'none') return { task: null, ambiguous: false };
  if (taskId !== 'auto') return { task: state.tasks.find(task => task.id === taskId && !task.deleted) || null, ambiguous: false };
  const readingTitle = /\breading\b|\bread\b.*\b(?:books?|pages?|chapters?)\b|\bread(?:\s+daily|\s+for\s+\d+\s*(?:minutes?|mins?|m))?\s*$/iu;
  const messages = /\b(?:emails?|messages?|mail|notifications?)\b/iu;
  const candidates = state.tasks.filter(task => !task.deleted &&
    (task.repeat !== 'none' || !task.completed || task.history?.[today]?.length) &&
    ((readingTitle.test(task.title) && !messages.test(task.title)) || /قراءة|اقرأ/u.test(task.title)));
  return { task: candidates.length === 1 ? candidates[0] : null, ambiguous: candidates.length > 1 };
}

export function updateReadingTask(state, data) {
  const reading = state.reading;
  if (Number(data.expectedVersion) !== reading.taskVersion) {
    throw Object.assign(new InputError('The reading task setting changed on another device. Reopen it.'), { status: 409 });
  }
  const taskId = text(data.taskId, 300);
  if (!['auto', 'none'].includes(taskId) && !state.tasks.some(task => task.id === taskId && !task.deleted)) {
    throw new InputError('Choose an existing task.');
  }
  reading.taskId = taskId;
  reading.taskVersion++;
  return { taskId };
}

export function logReading(state, book, data, today, award) {
  if (typeof data.eventId !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(data.eventId)) throw new InputError('Use a unique reading log ID.');
  const page = pageNumber(data.page, 'page reached'), finished = data.finished === true;
  const existing = state.reading.books.flatMap(item => item.logs.map(log => ({ bookId: item.id, log }))).find(entry => entry.log.id === data.eventId);
  if (existing) {
    if (existing.bookId !== book.id || existing.log.to !== page || existing.log.finished !== finished) {
      throw Object.assign(new InputError('This reading log ID was already used for different progress.'), { status: 409 });
    }
    return { duplicate: true, taskStatus: 'unchanged' };
  }
  if (Number(data.expectedVersion) !== book.editVersion) {
    throw Object.assign(new InputError('This book changed on another device. Reopen its progress form.'), { status: 409 });
  }
  if (book.status !== 'reading') throw new InputError('Reopen this book before logging more reading.');
  if (page <= book.currentPage) throw new InputError('Enter a page after your saved position. Use Edit book to correct a page number.');
  if (book.totalPages !== null && page > book.totalPages) throw new InputError('The page reached exceeds the book’s page count.');
  book.logs.push({ id: data.eventId, date: today, from: book.currentPage, to: page, finished, at: Date.now() });
  book.currentPage = page;
  if (finished || page === book.totalPages) {
    book.status = 'finished';
    book.finishedDate = today;
  }
  book.editVersion++;
  const { task, ambiguous } = readingTask(state, today);
  let taskStatus = ambiguous ? 'choose' : 'unlinked';
  if (task) {
    const credited = state.reading.credits.some(receipt => receipt.date === today && receipt.taskId === task.id);
    if (credited || done(task, today)) taskStatus = 'already';
    else if (!isDue(task, today)) taskStatus = 'not-due';
    else {
      toggleCompletion(state, task.id, today, award);
      syncContactCompletion(state, task);
      taskStatus = done(task, today) ? 'completed' : 'recorded';
    }
    if (!credited && ['completed', 'recorded', 'already'].includes(taskStatus)) {
      state.reading.credits.push({ date: today, taskId: task.id });
    }
  }
  return { duplicate: false, taskStatus, taskTitle: task?.title || '' };
}
