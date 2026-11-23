import { InputError } from './public/domain.js';
import { normalizeBookSearch, bookWebUrl } from './public/book-metadata.js';
import { regionalBooks } from './regional-books.mjs';

const text = value => typeof value === 'string' ? value.trim().slice(0,300) : '';
const names = value => (Array.isArray(value) ? value : [value]).map(text).filter(Boolean).join(', ').slice(0,300);
const pages = value => Number.isSafeInteger(value) && value > 0 && value <= 1000000 ? value : null;
const cover = value => { try { return bookWebUrl(typeof value === 'string' ? value.replace(/^http:/,'https:') : ''); } catch { return ''; } };
const terms = value => normalizeBookSearch(value).split(' ').filter(word => !['كتاب','الكاتب','للكاتب','تاليف'].includes(word));
const score = (book, words) => {
  const title = normalizeBookSearch(book.title), author = normalizeBookSearch(book.author);
  const haystack = [title,author,...(book.aliases || []).map(normalizeBookSearch)].join(' ');
  return words.reduce((sum,word) => sum + (haystack.includes(word) ? 10 : 0) + (title.includes(word) ? 2 : 0), 0);
};

export function createBookSearch(transport = fetch, { googleKey = process.env.EPISUITE_GOOGLE_BOOKS_KEY || '' } = {}) {
  const cache = new Map();
  let lastRequest = 0;
  async function json(url) {
    const response = await transport(url, { headers: { Accept:'application/json', 'User-Agent':'Episuite/1.0 (personal self-hosted book tracker)' }, redirect:'error', signal:AbortSignal.timeout(6500) });
    if (!response.ok) throw Error('Catalogue unavailable.');
    return response.json();
  }
  async function openLibrary(query) {
    const url = new URL('https://openlibrary.org/search.json');
    url.searchParams.set('q',query); url.searchParams.set('limit','12');
    url.searchParams.set('fields','key,title,author_name,cover_i,number_of_pages_median,first_publish_year');
    const payload = await json(url);
    if (!Array.isArray(payload.docs)) throw Error('Invalid catalogue response.');
    return payload.docs.slice(0,12).map(book => {
      const sourceId = /^OL\d+W$/.test(book.key) ? '/works/'+book.key : book.key;
      return { sourceId:/^\/works\/OL\d+W$/.test(sourceId) ? sourceId : '', title:text(book.title), author:names(book.author_name),
        coverId:Number.isSafeInteger(book.cover_i) && book.cover_i > 0 ? book.cover_i : null, coverUrl:'',
        totalPages:pages(book.number_of_pages_median), year:Number.isInteger(book.first_publish_year) ? book.first_publish_year : null,
        provider:'Open Library', sourceUrl:/^\/works\/OL\d+W$/.test(sourceId) ? 'https://openlibrary.org'+sourceId : '' };
    }).filter(book => book.title);
  }
  async function googleBooks(query) {
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q',query);url.searchParams.set('maxResults','12');url.searchParams.set('printType','books');
    if (googleKey) url.searchParams.set('key',googleKey);
    const payload = await json(url);
    if (payload.items !== undefined && !Array.isArray(payload.items) || payload.error) throw Error('Invalid catalogue response.');
    return (payload.items || []).slice(0,12).filter(book => /^[\w-]{1,100}$/.test(book.id)).map(book => {
      const info = book.volumeInfo || {};
      return { sourceId:'google:'+book.id, title:text(info.title), author:names(info.authors), coverId:null,
        coverUrl:cover(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail), totalPages:pages(info.pageCount),
        year:/^\d{4}/.test(info.publishedDate) ? Number(info.publishedDate.slice(0,4)) : null,
        provider:'Google Books',sourceUrl:'https://books.google.com/books?id='+book.id };
    }).filter(book => book.title);
  }
  async function archive(query) {
    const url = new URL('https://archive.org/advancedsearch.php');
    const words = terms(query).slice(0,20).map(word => '"'+word+'"');
    url.searchParams.set('q','mediatype:texts AND ('+words.join(' AND ')+')');url.searchParams.set('output','json');url.searchParams.set('rows','12');
    for (const field of ['identifier','title','creator','year']) url.searchParams.append('fl[]',field);
    const payload = await json(url);
    if (!Array.isArray(payload.response?.docs)) throw Error('Invalid catalogue response.');
    return payload.response.docs.slice(0,12).filter(book => /^[\w.-]{1,150}$/.test(book.identifier)).map(book => ({
      sourceId:'archive:'+book.identifier,title:names(book.title),author:names(book.creator),coverId:null,
      coverUrl:'https://archive.org/services/img/'+encodeURIComponent(book.identifier),totalPages:null,
      year:/^\d{4}$/.test(String(book.year)) ? Number(book.year) : null,
      provider:'Internet Archive',sourceUrl:'https://archive.org/details/'+encodeURIComponent(book.identifier)
    })).filter(book => book.title);
  }
  async function regionalShop(query) {
    const url = new URL('https://goodbookshopjo.com/search/suggest.json');
    url.searchParams.set('q',query);url.searchParams.set('resources[type]','product');url.searchParams.set('resources[limit]','10');
    url.searchParams.set('resources[options][unavailable_products]','show');
    const payload = await json(url);
    if (!Array.isArray(payload.resources?.results?.products)) throw Error('Invalid regional catalogue response.');
    return payload.resources.results.products.slice(0,10).filter(book=>Number.isSafeInteger(book.id) && book.id > 0).flatMap(book=>{
      let source;
      try { source=new URL(book.url,'https://goodbookshopjo.com'); } catch { return []; }
      if (source.origin !== 'https://goodbookshopjo.com' || !source.pathname.startsWith('/products/')) return [];
      source.search='';source.hash='';
      const authorTag = Array.isArray(book.tags) ? book.tags.find(tag=>typeof tag==='string' && /^(?:author|الكاتب|المؤلف|تأليف)\s*:/i.test(tag)) : '';
      return [{sourceId:'catalog:goodbookshopjo-'+book.id,title:text(book.title),author:text(authorTag?.replace(/^[^:]+:\s*/,'')),
        coverId:null,coverUrl:cover(book.featured_image?.url || book.image),totalPages:null,year:null,
        provider:'The Good Book Shop',sourceUrl:source.href}];
    }).filter(book=>book.title);
  }
  return async query => {
    const title = typeof query === 'string' ? query.trim().replace(/\s+/g,' ') : '';
    if (title.length < 2 || title.length > 200) throw new InputError('Enter a book title or author between 2 and 200 characters.');
    const key = normalizeBookSearch(title), words = terms(title), cached = cache.get(key);
    if (!words.length) throw new InputError('Enter the book title or author.');
    if (cached?.expires > Date.now()) return structuredClone(cached.results);
    const regional = regionalBooks.filter(book => words.every(word => normalizeBookSearch([book.title,book.author,...book.aliases].join(' ')).includes(word)));
    const specific = regional.filter(book => normalizeBookSearch(title).includes(normalizeBookSearch(book.title)) && terms(book.author).some(word=>words.includes(word)) || book.aliases.some(alias=>normalizeBookSearch(title)===normalizeBookSearch(alias)));
    if (specific.length) return specific.map(({aliases,...book})=>({...book}));
    if (Date.now()-lastRequest < 1000) throw Object.assign(Error('Wait a moment before searching again.'),{status:429});
    lastRequest = Date.now();
    const arabic = /[\u0600-\u06ff]/.test(title), cleaned = title.normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640\u200b-\u200f]/g,'');
    let candidates = regional.map(({aliases,...book})=>({...book})), succeeded = regional.length ? 1 : 0;
    if (arabic) {
      for (const result of await Promise.allSettled([openLibrary(cleaned),googleBooks(cleaned),archive(cleaned),regionalShop(cleaned)])) {
        if (result.status === 'fulfilled') { succeeded++; candidates.push(...result.value); }
      }
    } else {
      try { candidates.push(...await openLibrary(cleaned)); succeeded++; } catch {}
      if (!candidates.length) for (const result of await Promise.allSettled([googleBooks(cleaned),archive(cleaned)])) {
        if (result.status === 'fulfilled') { succeeded++; candidates.push(...result.value); }
      }
    }
    if (!succeeded) throw Object.assign(Error('Book catalogues are unavailable. Try again or add the book manually.'),{status:503});
    const distinct = new Map();
    for (const book of candidates.sort((a,b)=>score(b,words)-score(a,words))) {
      const id = normalizeBookSearch(book.title)+'|'+normalizeBookSearch(book.author);
      const previous = distinct.get(id);
      if (!previous || !(previous.coverId || previous.coverUrl) && (book.coverId || book.coverUrl)) distinct.set(id,book);
    }
    const results = [...distinct.values()].slice(0,12);
    cache.set(key,{results,expires:Date.now()+(results.length ? 300000 : 30000)});
    if (cache.size > 20) cache.delete(cache.keys().next().value);
    return structuredClone(results);
  };
}
