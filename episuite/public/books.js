import { escapeHTML as e } from './life.js';
import { readingTask } from './books-domain.js';
import { uid } from './domain.js';

const button = (label, action, id = '', style = 'secondary') =>
  `<button type="button" class="btn ${style} compact" data-action="${action}" data-id="${e(id)}">${label}</button>`;

function cover(book, size = 'M') {
  return `<span class="book-cover">${book.coverId
    ? `<img src="https://covers.openlibrary.org/b/id/${book.coverId}-${size}.jpg?default=false" alt="Cover of ${e(book.title)}" loading="lazy" referrerpolicy="no-referrer">`
    : '<span class="book-cover-placeholder" aria-hidden="true">Aa</span>'}</span>`;
}

function bookCard(book, today) {
  const pagesToday = book.logs.filter(log => log.date === today).reduce((sum, log) => sum + log.to - log.from, 0);
  return `<article class="book-card" data-book="${e(book.id)}">
    ${cover(book)}
    <div class="book-card-content">
      <h3><button class="task-title" data-action="book-details" data-id="${e(book.id)}">${e(book.title)}</button></h3>
      ${book.author ? `<p class="small">${e(book.author)}</p>` : ''}
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
  const current = books.filter(book => book.status === 'reading');
  const finished = books.filter(book => book.status === 'finished').sort((a, b) => b.finishedDate.localeCompare(a.finishedDate));
  const { task, ambiguous } = readingTask(state, today);
  const linkText = task ? 'Daily check-off · ' + task.title : ambiguous ? 'Choose a reading task' : 'Reading task';
  return `<section class="books-panel" aria-labelledby="books-title">
    <div class="board-section-heading">
      <div><h2 id="books-title">Reading.</h2>${books.length ? `<p>${current.length} in progress · ${finished.length} read</p>` : ''}</div>
      <div class="row wrap">${button('Add a book', 'book-add')}${books.length > 2 ? button('All books', 'book-library', '0', 'text') : ''}</div>
    </div>
    ${current.length ? `<div class="book-grid">${current.slice(0, 2).map(book => bookCard(book, today)).join('')}</div>`
      : `<p class="small book-empty">${finished.length ? 'Choose your next book when you’re ready.' : 'Keep your place in a book and build a shelf of what you’ve read.'}</p>`}
    ${current.length > 2 ? button(`See all ${current.length} current books`, 'book-library', '0', 'text') : ''}
    ${finished.length ? `<details class="books-finished"><summary>Books read · ${finished.length}</summary>
      <div class="book-grid">${finished.slice(0, 4).map(book => bookCard(book, today)).join('')}</div>
      ${finished.length > 4 ? button('See full history', 'book-library', '0', 'text') : ''}
    </details>` : ''}
    <div class="book-task-link">${button(e(linkText), 'book-task-settings', '', 'text')}</div>
  </section>`;
}

export function bookTools({ getState, request, render, showDialog, closeDialog, field, select, today, toast }) {
  let matches = [], query = '', selected = null, removal = null;
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
      <label for="book-search-title">Book title</label>
      <div class="row"><input id="book-search-title" name="query" value="${e(query)}" minlength="2" maxlength="200" required autocomplete="off">
      <button class="btn primary compact" type="submit">Search</button></div>
    </form>
    ${results === null ? '' : results.length ? `<div class="book-search-results">${results.map((book, index) => `
      <button type="button" class="book-result" data-action="book-choose" data-id="${index}">
        ${cover(book)}<span><strong>${e(book.title)}</strong><span>${e(book.author) || 'Author unavailable'}</span>
        ${book.year ? `<small>${book.year}</small>` : ''}</span>
      </button>`).join('')}</div>` : '<p class="small">No matches found. Try another title or add the book manually.</p>'}
    <div class="row wrap">${button('Add manually', 'book-manual', '', 'text')}<a class="small" href="https://openlibrary.org" target="_blank" rel="noopener noreferrer">Search and covers from Open Library</a></div>`);
  }

  function bookForm(book, editing = false) {
    selected = book;
    const createId = editing ? '' : uid();
    showDialog(editing ? 'Edit book' : 'Add to your books', `
      ${cover(book)}
      <input type="hidden" name="id" value="${e(editing ? book.id : '')}">
      <input type="hidden" name="expectedVersion" value="${editing ? book.editVersion : 0}">
      <input type="hidden" name="eventId" value="${createId}">
      ${field('Title', 'title', book.title, 'text', 'required maxlength="300"')}
      ${field('Author (optional)', 'author', book.author, 'text', 'maxlength="300"')}
      <div class="form-grid">
        ${field('Total pages (optional)', 'totalPages', book.totalPages ?? '', 'number', 'min="1" max="1000000" step="1"')}
        ${field('Current page', 'currentPage', book.currentPage || 0, 'number', 'min="0" max="1000000" step="1" required')}
      </div>
      ${book.sourceId ? '<p class="small">Check the page count against your edition.</p>' : ''}
      ${select('Shelf', 'status', [['reading', 'Currently reading'], ['finished', 'Already read']], book.status || 'reading')}
      ${field('Finish date (for books already read)', 'finishedDate', book.finishedDate || today(), 'date', `max="${today()}"`)}
      ${editing ? button('Remove book', 'book-remove', book.id, 'text danger') : ''}`,
      'book-save', editing ? 'Save book' : 'Add book');
  }

  function details(book) {
    const logs = book.logs.slice(-12).reverse();
    showDialog(book.title, `${cover(book)}
      <p>${e(book.author)}</p>
      <p>Page ${book.currentPage}${book.totalPages ? ' of ' + book.totalPages : ''}${book.status === 'finished' ? ' · Finished ' + e(book.finishedDate) : ''}</p>
      <div class="row wrap">${book.status === 'reading' ? button('Log pages', 'book-log', book.id, 'primary') : ''}${button('Edit book', 'book-edit', book.id)}</div>
      <h3 class="book-log-heading">Recent reading</h3>
      ${logs.length ? `<ul class="book-log-history">${logs.map(log => `<li><time>${log.date}</time><span>Pages ${log.from}–${log.to} · +${log.to - log.from}</span></li>`).join('')}</ul>`
        : '<p class="small">Your reading logs will appear here.</p>'}
      ${book.logs.length > 12 ? `<p class="small">${book.logs.length} logs saved in total.</p>` : ''}`);
  }

  function library(page = 0) {
    const books = [...getState().reading.books].sort((a, b) => Number(a.status === 'finished') - Number(b.status === 'finished') || b.finishedDate.localeCompare(a.finishedDate) || b.createdAt - a.createdAt);
    const pages = Math.max(1, Math.ceil(books.length / 8));
    page = Math.min(Math.max(page, 0), pages - 1);
    showDialog('Your books', `<div class="book-grid book-library">${books.slice(page * 8, page * 8 + 8).map(book => bookCard(book, today())).join('') || '<p>No books added yet.</p>'}</div>
      ${pages > 1 ? `<div class="row spread">${page ? button('Previous', 'book-library', String(page - 1)) : '<span></span>'}<span>${page + 1} / ${pages}</span>${page < pages - 1 ? button('Next', 'book-library', String(page + 1)) : ''}</div>` : ''}`);
  }

  async function handle(name, id) {
    switch (name) {
      case 'book-add': query = ''; matches = []; searchDialog(); return true;
      case 'book-choose':
        if (matches[Number(id)]) bookForm(matches[Number(id)]);
        return true;
      case 'book-manual': bookForm({ title: query, author: '', totalPages: null, coverId: null, sourceId: '' }); return true;
      case 'book-edit': if (find(id)) bookForm(find(id), true); return true;
      case 'book-details': if (find(id)) details(find(id)); return true;
      case 'book-library': library(Number(id) || 0); return true;
      case 'book-log': {
        const book = find(id);
        if (!book) return true;
        showDialog('Log reading', `<p>${e(book.title)} · Saved at page ${book.currentPage}</p>
          <input type="hidden" name="id" value="${e(book.id)}">
          <input type="hidden" name="expectedVersion" value="${book.editVersion}">
          <input type="hidden" name="eventId" value="${uid()}">
          ${field('Page reached', 'page', '', 'number', `min="${book.currentPage + 1}" max="${book.totalPages || 1000000}" step="1" required`)}
          <label class="book-finished-toggle"><input type="checkbox" name="finished"> I finished this book</label>
          <p class="small">One due reading task gets a check-off when you log pages today.</p>`,
          'book-log', 'Save reading');
        return true;
      }
      case 'book-task-settings': {
        const reading = getState().reading;
        const tasks = getState().tasks.filter(task => !task.deleted);
        showDialog('Reading task', `
          <input type="hidden" name="expectedVersion" value="${reading.taskVersion}">
          ${select('Check off when I read', 'taskId', [['auto', 'Automatically find a reading task'], ['none', 'No task check-off'], ...tasks.map(task => [task.id, task.title])], reading.taskId)}
          <p class="small">Reading logs give at most one automatic check-off per task each day. If several tasks match, choose one here.</p>`,
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
      const payload = { ...data, coverId: selected?.coverId ?? null, sourceId: selected?.sourceId || '' };
      if (data.status === 'finished' && Number(data.currentPage) === 0 && data.totalPages) payload.currentPage = Number(data.totalPages);
      await request(data.id ? '/api/books/' + data.id : '/api/books', payload, data.id ? 'PATCH' : 'POST');
      closeDialog(); render(); toast(data.id ? 'Book saved.' : 'Book added to your shelf.');
      return true;
    }
    if (type === 'book-log') {
      const response = await request('/api/books/' + data.id + '/log', { ...data, finished: form.elements.finished.checked });
      closeDialog(); render();
      const status = response.result.taskStatus;
      toast(status === 'completed' || status === 'recorded' ? 'Reading saved and your reading task checked off.'
        : status === 'choose' ? 'Reading saved. Choose your reading task in the book section.'
          : 'Reading saved.');
      return true;
    }
    if (type === 'book-task') {
      await request('/api/reading/task', data);
      closeDialog(); render(); toast('Reading task saved.');
      return true;
    }
    return false;
  }

  return { handle, submit };
}
