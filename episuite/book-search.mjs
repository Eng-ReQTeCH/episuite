import { InputError } from './public/domain.js';

export function createBookSearch(transport = fetch) {
  const cache = new Map();
  let lastRequest = 0;
  return async query => {
    const title = typeof query === 'string' ? query.trim() : '';
    if (title.length < 2 || title.length > 200) throw new InputError('Enter a book title between 2 and 200 characters.');
    const key = title.toLocaleLowerCase(), cached = cache.get(key);
    if (cached?.expires > Date.now()) return cached.results;
    if (Date.now() - lastRequest < 1000) {
      throw Object.assign(new Error('Wait a moment before searching again.'), { status: 429 });
    }
    lastRequest = Date.now();
    const url = new URL('https://openlibrary.org/search.json');
    url.searchParams.set('title', title);
    url.searchParams.set('limit', '12');
    url.searchParams.set('fields', 'key,title,author_name,cover_i,number_of_pages_median,first_publish_year');
    let results;
    try {
      const response = await transport(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Episuite/1.0 (personal self-hosted book tracker)' },
        redirect: 'error', signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw Error();
      const payload = await response.json();
      if (!Array.isArray(payload.docs)) throw Error();
      results = payload.docs.slice(0, 12).filter(book => typeof book.title === 'string').map(book => {
        const sourceId = /^OL\d+W$/.test(book.key) ? '/works/' + book.key : book.key;
        return {
          sourceId: /^\/works\/OL\d+W$/.test(sourceId) ? sourceId : '',
          title: book.title.trim().slice(0, 300),
          author: Array.isArray(book.author_name) ? book.author_name.filter(name => typeof name === 'string').join(', ').slice(0, 300) : '',
          coverId: Number.isSafeInteger(book.cover_i) && book.cover_i > 0 ? book.cover_i : null,
          totalPages: Number.isSafeInteger(book.number_of_pages_median) && book.number_of_pages_median > 0 && book.number_of_pages_median <= 1_000_000 ? book.number_of_pages_median : null,
          year: Number.isInteger(book.first_publish_year) ? book.first_publish_year : null
        };
      }).filter(book => book.title);
    } catch {
      throw Object.assign(new Error('Book search is unavailable. Try again or add the book manually.'), { status: 503 });
    }
    cache.set(key, { results, expires: Date.now() + 300000 });
    if (cache.size > 20) cache.delete(cache.keys().next().value);
    return results;
  };
}
