import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createApp} from '../server.mjs';

test('installed app navigation opens the shell while cross-site APIs remain blocked',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'episuite-pwa-'));
  const app=await createApp({dataDir:dir,backgroundInterval:0});
  try{
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${app.server.address().port}`;
    // Node fetch rewrites Sec-Fetch-Mode; send the browser metadata verbatim.
    const request=(url,options={})=>new Promise((resolve,reject)=>{
      const req=http.request(base+url,options,res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:{get:name=>res.headers[name]}}));});
      req.on('error',reject);req.end(options.body);
    });
    const headers={'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'};
    for(const url of ['/', '/index.html']){
      const response=await request(url,{headers});
      assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);
    }
    for(const url of ['/api/state','/api/export'])assert.equal((await request(url,{headers})).status,403);
    assert.equal((await request('/',{headers:{...headers,'Sec-Fetch-Dest':'iframe'}})).status,403);
    assert.equal((await request('/',{headers:{...headers,Origin:'https://other.example'}})).status,403);
    assert.equal((await request('/api/settings',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:'Unwanted change'})})).status,403);
    assert.equal((await fetch(base+'/api/state')).status,200);
    assert.notEqual(app.getState().settings.name,'Unwanted change');
  }finally{
    await app.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'episuite-pwa-'));
    await rm(dir,{recursive:true,force:true});
  }
});
