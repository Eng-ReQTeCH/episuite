import { escapeHTML as e } from './life.js';
import { readingTask } from './books-domain.js';
import { uid } from './domain.js';
import { normalizeBookSearch } from './book-metadata.js';

const button = (label, action, id = '', style = 'secondary') =>
  `<button type="button" class="btn ${style} compact" data-action="${action}" data-id="${e(id)}">${label}</button>`;

function cover(book, size = 'M') {
  return `<span class="book-cover">${book.coverUrl || book.coverId
    ? `<img src="${e(book.coverUrl || `https://covers.openlibrary.org/b/id/${book.coverId}-${size}.jpg?default=false`)}" alt="Cover of ${e(book.title)}" loading="lazy" referrerpolicy="no-referrer">`
    : '<span class="book-cover-placeholder" aria-hidden="true">Aa</span>'}</span>`;
}

function bookCard(book, today) {
  const pagesToday = book.logs.filter(log => !log.deleted && log.date === today).reduce((sum, log) => sum + log.to - log.from, 0);
  return `<article class="book-card" data-book="${e(book.id)}">
    ${cover(book)}
    <div class="book-card-content">
      <h3><button class="task-title" data-action="book-details" data-id="${e(book.id)}"><bdi>${e(book.title)}</bdi></button></h3>
      ${book.author ? `<p class="small" dir="auto">${e(book.author)}</p>` : ''}
      <p class="small book-position">${book.status === 'finished' ? 'Finished ' + e(book.finishedDate) : 'Page ' + book.currentPage + (book.totalPages ? ' of ' + book.totalPages : '')}</p>
      ${book.totalPages && book.status === 'reading' ? `<progress value="${book.currentPage}" max="${book.totalPages}" aria-label="${e(book.title)} reading progress"></progress>` : ''}
      ${pagesToday ? `<p class="small book-today">${pagesToday} page${pagesToday === 1 ? '' : 's'} read today</p>` : ''}
      <div class="row wrap">
        ${book.status === 'reading' ? button('Log pages', 'book-log', book.id, 'primary') : ''}
        ${button('Details', 'book-details', book.id, 'text')}
      </div>
    </div>
  </article>`;
}

export function booksPanel(state, today) {
  const books = state.reading?.books || [];
  const current = books.filter(book => book.status === 'reading').sort((a,b)=>Number(b.pinned)-Number(a.pinned) || Math.max(0,...b.logs.filter(log=>!log.deleted).map(log=>log.at))-Math.max(0,...a.logs.filter(log=>!log.deleted).map(log=>log.at)));
  const finished = books.filter(book => book.status === 'finished').sort((a, b) => b.finishedDate.localeCompare(a.finishedDate));
  const { task, ambiguous } = readingTask(state, today);
  const policyLabel = { daily: 'Daily check-off', session: 'Session check-off', target: 'Complete target' }[state.reading?.policy || 'daily'];
  const linkText = task ? policyLabel + ' · ' + task.title : ambiguous ? 'Choose a reading task' : 'Reading task';
  return `<section class="books-panel" aria-labelledby="books-title">
    <div class="board-section-heading">
      <div><h2 id="books-title">Reading.</h2>${books.length ? `<p>${current.length} in progress · ${finished.length} read</p>` : ''}</div>
      <div class="row wrap">${button('Add a book', 'book-add')}${books.length ? button('All books', 'book-library', '0', 'text') : ''}</div>
    </div>
    ${current.length ? `<div class="book-grid">${current.slice(0, 2).map(book => bookCard(book, today)).join('')}</div>`
      : `<p class="small book-empty">${finished.length ? 'Choose your next book when you’re ready.' : 'Keep your place in a book and build a shelf of what you’ve read.'}</p>`}
    ${current.length > 2 ? button(`See all ${current.length} current books`, 'book-library-reading', '0', 'text') : ''}
    ${finished.length ? button(`Books read · ${finished.length}`, 'book-library-finished', '0', 'text') : ''}
    <div class="book-task-link">${button(e(linkText), 'book-task-settings', '', 'text')}</div>
  </section>`;
}

export function bookTools({ getState, request, render, showDialog, closeDialog, field, select, today, toast }) {
  let matches = [], query = '', removal = null, logRemoval = null, coverTarget = null;
  let libraryQuery = '', libraryShelf = 'all', librarySort = 'recent';
  const find = id => getState().reading.books.find(book => book.id === id);
  document.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.closest('.book-cover')) return;
    const placeholder = document.createElement('span');
    placeholder.className = 'book-cover-placeholder';
    placeholder.textContent = 'Aa';
    image.parentElement.setAttribute('aria-label', image.alt + ' unavailable');
    image.replaceWith(placeholder);
  }, true);

  function searchDialog(results = null) {
    showDialog('Find your book', `<form data-form="book-search" class="book-search-form">
      <label for="book-search-title">Book title or author</label>
      <div class="row"><input id="book-search-title" name="query" value="${e(query)}" minlength="2" maxlength="200" required autocomplete="off" dir="auto" placeholder="القائد طوني جورج">
      <button class="btn primary compact" type="submit">Search</button></div>
    </form>
    ${results === null ? '' : results.length ? `<div class="book-search-results">${results.map((book, index) => `
      <button type="button" class="book-result" data-action="book-choose" data-id="${index}">
        ${cover(book)}<span><strong dir="auto">${e(book.title)}</strong><span dir="auto">${e(book.author) || 'Author unavailable'}</span>
        <small>${e(book.provider || 'Open Library')}${book.year ? ' · '+book.year : ''}</small></span>
      </button>`).join('')}</div>` : '<p class="small">No matches found. Try another title or add the book manually.</p>'}
    <p class="small">Search by title, author, or both. Arabic spelling variants are matched. If a regional edition is missing, add it manually with a cover link.</p>
    <div class="row wrap">${button('Add manually', 'book-manual', '', 'text')}<span class="small">Open Library · Google Books · Internet Archive · The Good Book Shop · verified author entries</span></div>`);
  }

  function bookForm(book, editing = false, skipDraft = false) {
    const createId = editing ? '' : uid();
    showDialog(editing ? 'Edit book' : 'Add to your books', `
      ${cover(book)}
      <input type="hidden" name="id" value="${e(editing ? book.id : '')}">
      <input type="hidden" name="expectedVersion" value="${editing ? book.editVersion : 0}">
      <input type="hidden" name="eventId" value="${createId}">
      <input type="hidden" name="coverId" value="${book.coverId ?? ''}"><input type="hidden" name="sourceId" value="${e(book.sourceId || '')}">
      <input type="hidden" name="sourceUrl" value="${e(book.sourceUrl || '')}"><input type="hidden" name="provider" value="${e(book.provider || '')}">
      ${field('Title', 'title', book.title, 'text', 'required maxlength="300" dir="auto"')}
      ${field('Author (optional)', 'author', book.author, 'text', 'maxlength="300" dir="auto"')}
      <details><summary>Cover link (optional)</summary>${field('HTTPS cover image URL','coverUrl',book.coverUrl || '', 'url','maxlength="2048" placeholder="https://…"')}<p class="small">Use a direct image link for an edition missing from the catalogues.</p></details>
      <div class="form-grid">
        ${field('Total pages (optional)', 'totalPages', book.totalPages ?? '', 'number', 'min="1" max="1000000" step="1"')}
        ${field('Current page', 'currentPage', book.currentPage || 0, 'number', 'min="0" max="1000000" step="1" required')}
      </div>
      ${book.sourceId ? '<p class="small">Check the page count against your edition.</p>' : ''}
      ${select('Shelf', 'status', [['reading', 'Currently reading'], ['finished', 'Already read']], book.status || 'reading')}
      ${field('Finish date (for books already read)', 'finishedDate', book.finishedDate || today(), 'date', `max="${today()}"`)}
      ${editing ? button('Change cover / book match', 'book-change-cover', book.id) : ''}<label><input type="checkbox" name="pinned" ${book.pinned ? 'checked' : ''}> Pin on Life OS</label>
      ${editing ? button('Remove book', 'book-remove', book.id, 'text danger') : ''}`,
      'book-save', editing ? 'Save book' : 'Add book');
    if (skipDraft) document.querySelector('[data-form="book-save"]').dataset.skipDraft = 'true';
  }

  function details(book, page = 0) {
    const logs = book.logs.filter(log => !log.deleted).sort((a,b)=>b.date.localeCompare(a.date)||b.at-a.at);
    const pages = Math.max(1,Math.ceil(logs.length/8));
    page = Math.max(0,Math.min(page,pages-1));
    showDialog(book.title, `${cover(book)}
      <p>${e(book.author)}</p><p>Page ${book.currentPage}${book.totalPages ? ' of '+book.totalPages : ''}</p>
      ${book.sourceUrl ? `<p class="small"><a href="${e(book.sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(book.provider || 'Book source')} ↗</a></p>` : ''}
      <div class="row wrap">${button('Log pages','book-log',book.id,'primary')}${button('Edit book','book-edit',book.id)}${button(book.pinned?'Unpin from Life OS':'Pin to Life OS','book-pin',book.id,'text')}</div>
      <h3 class="book-log-heading">Reading history · ${logs.length} sessions</h3>
      <ul class="book-log-history">${logs.slice(page*8,page*8+8).map(log=>`<li><div><time>${log.date}</time><p>Pages ${log.from}–${log.to} · +${log.to-log.from}</p></div><div class="row wrap">${button('Edit session','book-log-edit',book.id+':'+log.id,'text')}${button('Delete session','book-log-delete',book.id+':'+log.id,'text')}</div></li>`).join('')}</ul>
      ${pages>1 ? `<div class="row spread">${page?button('Previous sessions','book-history',book.id+':'+(page-1)):''}<span>${page+1}/${pages}</span>${page<pages-1?button('Older sessions','book-history',book.id+':'+(page+1)):''}</div>`:''}`);
  }

  function library(page = 0) {
    const all = getState().reading.books;
    const books = all.filter(book=>(libraryShelf==='all'||book.status===libraryShelf)&&normalizeBookSearch([book.title,book.author].join(' ')).includes(normalizeBookSearch(libraryQuery)));
    const lastRead = book => Math.max(0, ...book.logs.filter(log=>!log.deleted).map(log=>Date.parse(log.date+'T12:00:00Z')));
    const lastLogged = book => Math.max(0,...book.logs.filter(log=>!log.deleted).map(log=>log.at));
    books.sort((a,b)=>librarySort==='title'?a.title.localeCompare(b.title):librarySort==='author'?a.author.localeCompare(b.author):librarySort==='read'?lastRead(b)-lastRead(a)||lastLogged(b)-lastLogged(a)||b.createdAt-a.createdAt:Number(b.pinned)-Number(a.pinned)||b.createdAt-a.createdAt);
    const pages=Math.max(1,Math.ceil(books.length/8));
    page=Math.max(0,Math.min(page,pages-1));
    showDialog('Your books',`<div class="book-library-controls"><label for="book-library-query">Find a book</label><input type="search" id="book-library-query" value="${e(libraryQuery)}" placeholder="Title or author">
      ${select('Shelf','libraryShelf',[['all','All books'],['reading','Currently reading'],['finished','Finished']],libraryShelf)}
      ${select('Sort','librarySort',[['recent','Pinned and newest'],['read','Recently read'],['title','Title'],['author','Author']],librarySort)}</div>
      <p class="small">${books.length} matching books</p><div class="book-grid book-library">${books.slice(page*8,page*8+8).map(book=>bookCard(book,today())).join('')||'<p>No books match this view.</p>'}</div>
      ${pages>1?`<div class="row spread">${page?button('Previous','book-library',String(page-1)):''}<span>${page+1}/${pages}</span>${page<pages-1?button('Next','book-library',String(page+1)):''}</div>`:''}`);
  }

  document.addEventListener('input',event=>{
    if(event.target.id!=='book-library-query')return;
    const position=event.target.selectionStart;
    libraryQuery=event.target.value;library();
    const search=document.querySelector('#book-library-query');search.focus();search.setSelectionRange(position,position);
  });
  document.addEventListener('change',event=>{
    if(event.target.name==='libraryShelf'){libraryShelf=event.target.value;library();}
    if(event.target.name==='librarySort'){librarySort=event.target.value;library();}
  });

  async function handle(name, id) {
    switch (name) {
      case 'book-add': coverTarget = null; query = ''; matches = []; searchDialog(); return true;
      case 'book-choose': {
        const match = matches[Number(id)];
        if (match && coverTarget) {
          const existing = find(coverTarget.id);
          bookForm({ ...existing, ...coverTarget.values, coverId: match.coverId, coverUrl: match.coverUrl || '', sourceId: match.sourceId, sourceUrl: match.sourceUrl || '', provider: match.provider || '', title: match.title, author: match.author, editVersion: Number(coverTarget.values.expectedVersion) }, true, true);
          coverTarget = null;
        } else if (match) bookForm(match);
        return true;
      }
      case 'book-change-cover': {
        const form = document.querySelector('[data-form="book-save"]');
        coverTarget = { id, values: Object.fromEntries(new FormData(form)) };
        coverTarget.values.pinned = form.elements.pinned.checked;
        query = form.elements.title.value;
        searchDialog(); return true;
      }
      case 'book-manual': bookForm({ title: query, author: '', totalPages: null, coverId: null, sourceId: '' }); return true;
      case 'book-edit': if (find(id)) bookForm(find(id), true); return true;
      case 'book-details': if (find(id)) details(find(id)); return true;
      case 'book-pin': {
        const book = find(id);
        await request('/api/books/' + id, { pinned: !book.pinned, expectedVersion: book.editVersion }, 'PATCH');
        render(); details(find(id)); return true;
      }
      case 'book-library': library(Number(id) || 0); return true;
      case 'book-library-reading': libraryShelf = 'reading'; library(); return true;
      case 'book-library-finished': libraryShelf = 'finished'; library(); return true;
      case 'book-history': { const [bookId, page] = id.split(':'); if (find(bookId)) details(find(bookId), Number(page)); return true; }
      case 'book-log-edit': case 'book-log-delete': {
        const [bookId, logId] = id.split(':'), book = find(bookId), log = book?.logs.find(item => item.id === logId && !item.deleted);
        if (!log) return true;
        if (name === 'book-log-delete') {
          logRemoval = { bookId, logId, expectedVersion: book.editVersion, operationId: uid() };
          showDialog('Delete reading session?', `<p>${e(book.title)} · ${log.date} · pages ${log.from}–${log.to}</p><p>Task check-offs created by this session will be reconciled with your other reading.</p>${button('Delete session','book-log-confirm-delete',log.id,'danger')}`);
          return true;
        }
        showDialog('Edit reading session', `<input type="hidden" name="id" value="${e(bookId)}"><input type="hidden" name="logId" value="${e(logId)}">
          <input type="hidden" name="expectedVersion" value="${book.editVersion}"><input type="hidden" name="operationId" value="${uid()}">
          ${field('Reading date','date',log.date,'date',`required max="${today()}"`)}
          ${field('Starting page','from',log.from,'number','min="0" required')}
          ${field('Page reached','page',log.to,'number',`min="1" max="${book.totalPages || 1000000}" required`)}
          <label><input type="checkbox" name="finished" ${log.finished?'checked':''}> Finished the book in this session</label>`, 'book-log-edit','Save session');
        return true;
      }
      case 'book-log-confirm-delete': {
        if (!logRemoval || logRemoval.logId !== id) return true;
        const response = await request('/api/books/' + logRemoval.bookId + '/logs/' + logRemoval.logId, logRemoval, 'DELETE');
        logRemoval = null; closeDialog(); render();
        toast(response.queued ? 'Deletion saved on this device for sync.' : 'Reading session deleted and task check-offs reconciled.');
        return true;
      }
      case 'book-log': {
        const book = find(id);
        if (!book) return true;
        showDialog('Log reading', `<p>${e(book.title)} · Saved at page ${book.currentPage}</p>
          <input type="hidden" name="id" value="${e(book.id)}">
          <input type="hidden" name="expectedVersion" value="${book.editVersion}">
          <input type="hidden" name="eventId" value="${uid()}">
          ${field('Reading date','date',today(),'date',`required max="${today()}"`)}
          ${field('Starting page','from',book.currentPage,'number','min="0" step="1" required')}
          ${field('Page reached', 'page', '', 'number', `min="1" max="${book.totalPages || 1000000}" step="1" required`)}
          <label class="book-finished-toggle"><input type="checkbox" name="finished"> I finished this book</label>
          <p class="small">The reading task uses this session’s date and your selected check-off policy.</p>`,
          'book-log', 'Save reading');
        return true;
      }
      case 'book-task-settings': {
        const reading = getState().reading;
        const tasks = getState().tasks.filter(task => !task.deleted);
        showDialog('Reading task', `
          <input type="hidden" name="expectedVersion" value="${reading.taskVersion}">
          ${select('Check off when I read', 'taskId', [['auto', 'Automatically find a reading task'], ['none', 'No task check-off'], ...tasks.map(task => [task.id, task.title])], reading.taskId)}
          ${select('Completion policy','policy',[['daily','One check-off per day'],['session','One check-off per reading session'],['target','Complete the task’s current target']],reading.policy || 'daily')}
          <label><input type="checkbox" name="restoreAfterUndo" ${reading.restoreAfterUndo?'checked':''}> Let a new session check off reading again after I manually undo it</label>
          <p class="small">Session check-offs respect the task’s repeat schedule and minimum gap. Manual task completions are preserved when sessions are corrected.</p>`,
          'book-task', 'Save reading task');
        return true;
      }
      case 'book-remove':
        if (find(id)) {
          removal = { id, expectedVersion: find(id).editVersion };
          showDialog('Remove book?', `<p>Remove ${e(find(id).title)} and its reading history from your shelf?</p>${button('Remove book', 'book-confirm-remove', id, 'danger')}`);
        }
        return true;
      case 'book-confirm-remove': {
        if (removal?.id !== id) return true;
        await request('/api/books/' + id, { expectedVersion: removal.expectedVersion }, 'DELETE');
        removal = null;
        closeDialog(); render(); toast('Book removed.'); return true;
      }
      default: return false;
    }
  }

  async function submit(type, data, form) {
    if (type === 'book-search') {
      query = data.query.trim();
      const response = await fetch('/api/books/search?q=' + encodeURIComponent(query));
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Book search is unavailable.');
      matches = result.books;
      searchDialog(matches);
      return true;
    }
    if (type === 'book-save') {
      const payload = { ...data, coverId: data.coverId ? Number(data.coverId) : null, sourceId: data.sourceId || '', pinned: form.elements.pinned.checked };
      if (data.status === 'finished' && Number(data.currentPage) === 0 && data.totalPages) payload.currentPage = Number(data.totalPages);
      await request(data.id ? '/api/books/' + data.id : '/api/books', payload, data.id ? 'PATCH' : 'POST');
      closeDialog(); render(); toast(data.id ? 'Book saved.' : 'Book added to your shelf.');
      return true;
    }
    if (type === 'book-log' || type === 'book-log-edit') {
      const endpoint = '/api/books/' + data.id + (type === 'book-log' ? '/log' : '/logs/' + data.logId);
      const response = await request(endpoint, { ...data, finished: form.elements.finished.checked }, type === 'book-log' ? 'POST' : 'PATCH');
      closeDialog(); render();
      const status = response.result.taskStatus, progress = response.result;
      toast(response.queued ? 'Reading saved on this device. It will sync when connected.'
        : progress.manualUndo ? 'Reading saved. Your manual task undo is still in effect.'
        : status === 'recorded' ? `Reading saved · task progress ${progress.count}/${progress.target}.`
        : status === 'completed' ? 'Reading saved and your reading task completed.'
        : status === 'choose' ? 'Reading saved. Choose your reading task in the book section.'
          : 'Reading saved.');
      return true;
    }
    if (type === 'book-task') {
      await request('/api/reading/task', { ...data, restoreAfterUndo: form.elements.restoreAfterUndo.checked });
      closeDialog(); render(); toast('Reading task saved.');
      return true;
    }
    return false;
  }

  return { handle, submit };
}
