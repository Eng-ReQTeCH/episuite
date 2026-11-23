import { dateKey, done, InputError, isDue, toggleCompletion, uid, validDate, removeCompletion, taskProgress } from './domain.js';
import { syncContactCompletion } from './social-domain.js';
import { bookWebUrl } from './book-metadata.js';

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
  const coverId = Object.hasOwn(input, 'coverId') ? input.coverId : existing.coverId ?? null;
  if (coverId !== null && (!Number.isSafeInteger(coverId) || coverId <= 0)) throw new InputError('Choose a valid book cover.');
  const sourceId = text(input.sourceId ?? existing.sourceId, 200);
  if (sourceId && !/^(?:\/works\/OL\d+W|google:[\w-]{1,100}|archive:[\w.-]{1,150}|catalog:[a-z0-9-]{1,100})$/.test(sourceId)) throw new InputError('Choose a valid book result.');
  const coverUrl = bookWebUrl(input.coverUrl ?? existing.coverUrl ?? '');
  const sourceUrl = bookWebUrl(input.sourceUrl ?? existing.sourceUrl ?? '');
  const provider = text(input.provider ?? existing.provider, 80);
  const finishedDate = status === 'finished' ? input.finishedDate ?? existing.finishedDate ?? today : '';
  if (status === 'finished' && (!validDate(finishedDate) || finishedDate > today)) throw new InputError('Choose a finish date up to today.');
  if (input.pinned !== undefined && typeof input.pinned !== 'boolean') throw new InputError('Choose a valid pin setting.');
  if (existing.basePage !== undefined) pageNumber(existing.basePage, 'starting position');
  if (existing.positionAt !== undefined && (!Number.isFinite(existing.positionAt) || existing.positionAt < 0)) throw new InputError('Invalid saved reading position.');
  return {
    id: existing.id || uid(), title, author: text(input.author ?? existing.author, 300),
    sourceId, coverId, coverUrl, sourceUrl, provider, totalPages, currentPage, status, finishedDate,
    createdAt: existing.createdAt || Date.now(), editVersion: existing.editVersion || 0, logs: existing.logs || [],
    pinned: input.pinned ?? existing.pinned ?? false,
    basePage: input.currentPage !== undefined && existing.currentPage !== undefined && currentPage !== existing.currentPage ? currentPage : existing.basePage ?? existing.logs?.[0]?.from ?? currentPage,
    positionAt: input.currentPage !== undefined && existing.currentPage !== undefined && currentPage !== existing.currentPage ? Date.now() : existing.positionAt || 0,
    finishedByLog: status !== existing.status ? '' : existing.finishedByLog || ''
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
  reading.policy ||= 'daily';
  reading.restoreAfterUndo ??= false;
  if (!['daily', 'session', 'target'].includes(reading.policy) || typeof reading.restoreAfterUndo !== 'boolean') throw new InputError('Invalid reading completion policy.');
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
      return { id: log.id, date: log.date, at: log.at, from: log.from, to: log.to, finished: log.finished,
        deleted: Boolean(log.deleted), taskId: typeof log.taskId === 'string' ? log.taskId : '',
        requestPage: log.requestPage ?? log.to, requestDate: log.requestDate ?? log.date,
        requestFinished: log.requestFinished ?? log.finished };
    });
    return normalized;
  });
  reading.credits = reading.credits.map(credit => {
    if (!credit || !validDate(credit.date) || typeof credit.taskId !== 'string' || credit.taskId.length > 300) {
      throw new InputError('Backup contains an invalid reading task receipt.');
    }
    return { date: credit.date, taskId: credit.taskId,
      completionIds: Array.isArray(credit.completionIds) ? credit.completionIds.filter(id => typeof id === 'string') : [],
      suppressed: Boolean(credit.suppressed), legacy: credit.legacy ?? !Array.isArray(credit.completionIds) };
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
  if ('policy' in data) {
    if (!['daily', 'session', 'target'].includes(data.policy)) throw new InputError('Choose a reading completion policy.');
    reading.policy = data.policy;
  }
  if ('restoreAfterUndo' in data) reading.restoreAfterUndo = data.restoreAfterUndo === true;
  reading.taskVersion++;
  return { taskId };
}

export function logReading(state, book, data, today, award) {
  if (typeof data.eventId !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(data.eventId)) throw new InputError('Use a unique reading log ID.');
  const page = pageNumber(data.page, 'page reached'), finished = data.finished === true;
  const date = data.date || today;
  if (!validDate(date) || date > today) throw new InputError('Choose a reading date up to today.');
  const existing = state.reading.books.flatMap(item => item.logs.map(log => ({ bookId: item.id, log }))).find(entry => entry.log.id === data.eventId);
  if (existing) {
    if (existing.bookId !== book.id || (existing.log.requestPage ?? existing.log.to) !== page ||
        (existing.log.requestFinished ?? existing.log.finished) !== finished ||
        (data.date && (existing.log.requestDate ?? existing.log.date) !== date)) {
      throw Object.assign(new InputError('This reading log ID was already used for different progress.'), { status: 409 });
    }
    return { duplicate: true, taskStatus: 'unchanged' };
  }
  if (Number(data.expectedVersion) !== book.editVersion) {
    throw Object.assign(new InputError('This book changed on another device. Reopen its progress form.'), { status: 409 });
  }
  if (book.status !== 'reading' && data.from === undefined) throw new InputError('Reopen this book before logging more reading.');
  const from = pageNumber(data.from ?? book.currentPage, 'starting page');
  if (page <= from) throw new InputError('Enter a page after your starting position. Use Edit session to correct a reading log.');
  if (book.totalPages !== null && page > book.totalPages) throw new InputError('The page reached exceeds the book’s page count.');
  book.basePage ??= book.logs[0]?.from ?? book.currentPage;
  book.positionAt ||= 0;
  const { task, ambiguous } = readingTask(state, date);
  book.logs.push({ id: data.eventId, date, from, to: page, finished, at: Date.now(),
    taskId: task?.id || '', requestPage: page, requestDate: date, requestFinished: finished });
  book.currentPage = Math.max(book.currentPage, page);
  if (finished || page === book.totalPages) {
    book.status = 'finished';
    book.finishedDate = date;
    book.finishedByLog = data.eventId;
  }
  book.editVersion++;
  const result = task ? reconcileReadingTask(state, task.id, date, award, true) : { taskStatus: ambiguous ? 'choose' : 'unlinked' };
  return { duplicate: false, ...result, taskTitle: task?.title || '' };
}

function reconcileReadingTask(state, taskId, date, award, newSession = false) {
  const task = state.tasks.find(item => item.id === taskId && !item.deleted);
  if (!task) return { taskStatus: 'unlinked' };
  const logs = state.reading.books.flatMap(book => book.logs).filter(log => !log.deleted && log.date === date && log.taskId === taskId);
  let receipt = state.reading.credits.find(item => item.date === date && item.taskId === taskId);
  if (!receipt) {
    receipt = { date, taskId, completionIds: [], suppressed: false, legacy: false };
    state.reading.credits.push(receipt);
  }
  if (!Array.isArray(receipt.completionIds) || receipt.legacy) return { taskStatus: 'already', legacy: true, ...taskProgress(task, date) };
  const entries = task.history[date] || [];
  if (receipt.completionIds.some(id => !entries.some(entry => entry.id === id))) receipt.suppressed = true;
  receipt.completionIds = receipt.completionIds.filter(id => entries.some(entry => entry.id === id));
  if (newSession && state.reading.restoreAfterUndo) receipt.suppressed = false;
  const progress = taskProgress(task, date);
  const policy = state.reading.policy || 'daily';
  const desired = logs.length ? policy === 'target' ? Math.max(1, progress.target - (progress.count - entries.length))
    : policy === 'session' ? logs.length : 1 : 0;
  const manualCount = entries.length - receipt.completionIds.length;
  const wantedOwned = Math.max(0, desired - manualCount);
  while (receipt.completionIds.length > wantedOwned) {
    removeCompletion(state, task, date, receipt.completionIds.pop());
  }
  let added = false, status = 'already';
  if (!receipt.suppressed && wantedOwned > receipt.completionIds.length && !done(task, date)) {
    if (!isDue(task, date)) status = 'not-due';
    else {
      while (receipt.completionIds.length < wantedOwned && !done(task, date)) {
        toggleCompletion(state, taskId, date, award);
        receipt.completionIds.push(task.history[date].at(-1).id);
        added = true;
      }
    }
  }
  syncContactCompletion(state, task);
  if (added) status = done(task, date) ? 'completed' : 'recorded';
  if (!logs.length) status = 'removed';
  return { taskStatus: status, ...taskProgress(task, date), manualUndo: receipt.suppressed };
}

function recalculatePosition(book) {
  const logs = book.logs.filter(log => !log.deleted);
  book.currentPage = Math.max(book.basePage || 0, ...logs.filter(log => log.at >= (book.positionAt || 0)).map(log => log.to));
  if (book.finishedByLog || book.status !== 'finished') {
    const finish = logs.filter(log => log.finished || book.totalPages !== null && log.to >= book.totalPages).sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at).at(-1);
    book.status = finish ? 'finished' : 'reading';
    book.finishedDate = finish?.date || '';
    book.finishedByLog = finish?.id || '';
  }
}

export function editReadingLog(state, book, logId, data, today, award, remove = false) {
  if (Number(data.expectedVersion) !== book.editVersion) throw Object.assign(new InputError('This book changed. Reopen its history.'), { status: 409 });
  const log = book.logs.find(item => item.id === logId && !item.deleted);
  if (!log) throw Object.assign(new InputError('Reading session not found.'), { status: 404 });
  const previousDate = log.date, taskId = log.taskId || '';
  if (remove) log.deleted = true;
  else {
    const date = data.date || log.date, from = pageNumber(data.from, 'starting page'), to = pageNumber(data.page, 'page reached');
    if (!validDate(date) || date > today || to <= from || book.totalPages !== null && to > book.totalPages) throw new InputError('Choose a valid past date and page range for this session.');
    Object.assign(log, { date, from, to, finished: data.finished === true });
  }
  recalculatePosition(book);
  book.editVersion++;
  let result = { taskStatus: 'unlinked' };
  if (taskId) {
    result = reconcileReadingTask(state, taskId, previousDate, award);
    if (!remove && previousDate !== log.date) result = reconcileReadingTask(state, taskId, log.date, award);
  }
  return result;
}
