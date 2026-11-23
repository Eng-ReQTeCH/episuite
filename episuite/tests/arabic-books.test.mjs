import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createBookSearch } from '../book-search.mjs';
import { bookInput } from '../public/books-domain.js';
import { normalizeBookSearch } from '../public/book-metadata.js';
import { createApp } from '../server.mjs';

test('the reported regional book and Arabic spelling variants resolve with its verified cover even during provider outages', async () => {
  const search=createBookSearch(async()=>{throw Error('Unavailable');});
  for (const query of ['القائد طوني جورج','القَائِد طُوني جُورج','القائد طونى جورج','كتاب القائد توني جورج','The Leader Tony George']) {
    const result=await search(query);
    assert.equal(result[0].title,'القائد');assert.equal(result[0].author,'طوني جورج');
    assert.match(result[0].coverUrl,/static\.wixstatic\.com/);assert.equal(result[0].sourceUrl,'https://www.tonygeorge.com/');assert.equal(result[0].totalPages,null);
  }
});

test('Arabic title plus author searches multiple catalogues, ranks matches, deduplicates spellings and survives Google quota errors', async () => {
  const calls=[];
  const search=createBookSearch(async url=>{
    calls.push(url);
    if(url.hostname==='openlibrary.org') {
      assert.equal(url.searchParams.get('title'),null);assert.equal(url.searchParams.get('q'),'رحلة التعافي أحمد يوسف');
      return {ok:true,json:async()=>({docs:[{key:'OL10W',title:'رحلة التعافي',author_name:['أحمد يوسف'],cover_i:14},{key:'OL11W',title:'An unrelated book'}]})};
    }
    if(url.hostname==='www.googleapis.com')return {ok:false,status:429};
    if(url.hostname==='goodbookshopjo.com')return {ok:true,json:async()=>({resources:{results:{products:[]}}})};
    return {ok:true,json:async()=>({response:{docs:[{identifier:'arabic-recovery',title:'رحلة التعافى',creator:['احمد يوسف']},{identifier:'recovery-notes',title:'رحلة التعافي: ملاحظات',creator:'أحمد يوسف'}]}})};
  });
  const results=await search('رحلة التّعافي أحمد يوسف');
  assert.equal(calls.length,4);assert.equal(results[0].title,'رحلة التعافي');
  assert.equal(results.filter(book=>normalizeBookSearch(book.title)===normalizeBookSearch('رحلة التعافي')).length,1);
  assert.ok(results.some(book=>book.sourceId==='archive:recovery-notes'));
  assert.deepEqual(await search('رحلة التعافى احمد يوسف'),results);assert.equal(calls.length,4);
});

test('regional bookshop discovery supplies covers without inventing an author from its publisher field', async () => {
  const search=createBookSearch(async url=>{
    if(url.hostname!=='goodbookshopjo.com')throw Error('Unavailable');
    return {ok:true,json:async()=>({resources:{results:{products:[
      {id:123,title:'حارب حربك',vendor:'TC Community Egypt',url:'/products/product-875?tracking=test',image:'https://cdn.shopify.com/cover.jpg'},
      {id:124,title:'Unsafe result',url:'https://other-site.com/products/example',image:'javascript:alert(1)'}
    ]}}})};
  });
  const [book]=await search('حارب حربك');assert.equal(book.title,'حارب حربك');assert.equal(book.author,'');assert.equal(book.provider,'The Good Book Shop');
  assert.equal(book.sourceUrl,'https://goodbookshopjo.com/products/product-875');assert.equal(book.totalPages,null);assert.equal(bookInput(book).coverUrl,book.coverUrl);
});

test('Google Books supplies metadata and HTTPS covers when Open Library has no result', async () => {
  const search=createBookSearch(async url=>{
    if(url.hostname==='openlibrary.org')return {ok:true,json:async()=>({docs:[]})};
    if(url.hostname==='archive.org')return {ok:true,json:async()=>({response:{docs:[]}})};
    assert.equal(url.searchParams.get('key'),'test-key');
    return {ok:true,json:async()=>({items:[{id:'book_123',volumeInfo:{title:'A regional book',authors:['Local author'],pageCount:120,publishedDate:'2025-01',imageLinks:{thumbnail:'http://books.google.com/books/content?id=book_123'}}}]})};
  },{googleKey:'test-key'});
  const [book]=await search('A regional book Local author');
  assert.equal(book.sourceId,'google:book_123');assert.match(book.coverUrl,/^https:/);assert.equal(book.totalPages,120);
  assert.equal(bookInput(book).sourceId,book.sourceId);
});

test('new cover metadata rejects unsafe links while older cover IDs remain compatible', () => {
  assert.equal(bookInput({title:'Legacy',coverId:10}).coverId,10);
  for(const coverUrl of ['javascript:alert(1)','data:image/svg+xml,test','http://example.com/cover.jpg','https://localhost/cover','https://127.0.0.1/cover']) {
    assert.throws(()=>bookInput({title:'Unsafe',coverUrl}),/HTTPS/);
  }
  assert.throws(()=>bookInput({title:'Invalid source',sourceId:'untrusted:anything'}),/book result/);
});

test('Arabic book selection, custom cover replacement, restart and backup restore preserve pages and reading history', async () => {
  const directory=await mkdtemp(path.join(tmpdir(),'episuite-arabic-books-'));let app;
  try {
    app=await createApp({dataDir:directory,backgroundInterval:0,bookFetch:async()=>{throw Error('Offline');}});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));let base='http://127.0.0.1:'+app.server.address().port;
    const call=async(endpoint,data,method='POST')=>{const response=await fetch(base+endpoint,{method,headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,data:await response.json()};};
    const found=await call('/api/books/search?q='+encodeURIComponent('القائد طوني جورج'),undefined,'GET');assert.equal(found.status,200);
    const added=await call('/api/books',{...found.data.books[0],totalPages:200});assert.equal(added.status,200);let book=added.data.result;
    await call('/api/books/'+book.id+'/log',{page:20,eventId:'arabic-session',expectedVersion:book.editVersion});
    book=app.getState().reading.books[0];
    assert.equal((await call('/api/books/'+book.id,{coverUrl:'https://example.com/my-edition.jpg',expectedVersion:book.editVersion},'PATCH')).status,200);
    const exported=(await call('/api/export',undefined,'GET')).data;await call('/api/import',exported);
    await app.close();app=await createApp({dataDir:directory,backgroundInterval:0});
    const saved=app.getState().reading.books[0];assert.equal(saved.title,'القائد');assert.equal(saved.coverUrl,'https://example.com/my-edition.jpg');assert.equal(saved.currentPage,20);assert.equal(saved.logs.length,1);
  } finally {
    await app?.close();assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep+'episuite-arabic-books-'));
    await rm(directory,{recursive:true,force:true});
  }
});
