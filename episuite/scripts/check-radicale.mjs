import {spawn} from 'node:child_process';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {syncCalDAV} from '../caldav.mjs';
import {initialState,blockInput} from '../public/domain.js';
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const dir=await mkdtemp(path.join(tmpdir(),'episuite-radicale-'));
const config=path.join(dir,'config');await writeFile(config,`[server]\nhosts = 127.0.0.1:${port}\n[auth]\ntype = none\n[rights]\ntype = owner_only\n[storage]\nfilesystem_folder = ${dir.replaceAll('\\','/')}/collections\n[logging]\nlevel = error\n`);
const bundledPython=path.join(process.env.USERPROFILE||'', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const python=process.env.RADICALE_PYTHON||(existsSync(bundledPython)?bundledPython:'python');
const child=spawn(python,['-m','radicale','--config',config],{env:{...process.env,PYTHONPATH:path.resolve('test-results/radicale-runtime')},windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';child.stderr.on('data',b=>log+=b);child.stdout.on('data',b=>log+=b);
try{
 const base=`http://127.0.0.1:${port}/test/calendar/`;const auth={Authorization:'Basic '+Buffer.from('test:testing').toString('base64')};
 let ready=false;for(let i=0;i<100;i++){try{await fetch(base,{headers:auth});ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(ready,log);
 const made=await fetch(base,{method:'MKCALENDAR',headers:{...auth,'Content-Type':'application/xml'},body:'<?xml version="1.0"?><c:mkcalendar xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:"><d:set><d:prop><d:displayname>Testing</d:displayname></d:prop></d:set></c:mkcalendar>'});assert.equal(made.status,201,await made.text());
 let s=initialState();s.calendar={...s.calendar,url:base,username:'test',password:'testing'};s.blocks=[blockInput({name:'Course',date:'2026-10-04',start:'09:00',commitment:true,reminderMinutes:15})];
 const sync=async()=>{const r=await syncCalDAV(s,['2026-10-04','2026-10-05']);s={...s,blocks:r.blocks,calendar:r.calendar};return r;};
 assert.equal((await sync()).uploaded,1);assert.equal((await sync()).uploaded,0);
 const remote='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//EN\r\nBEGIN:VEVENT\r\nUID:radicale-test\r\nDTSTART:20261004T100000Z\r\nDTEND:20261004T110000Z\r\nSUMMARY:Remote appointment\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
 assert.equal((await fetch(base+'remote.ics',{method:'PUT',headers:{...auth,'Content-Type':'text/calendar'},body:remote})).status,201);
 assert.equal((await sync()).imported,1);const imported=s.blocks.find(b=>b.caldav);assert.equal(imported.start,'13:00');imported.name='Edited in Episuite';assert.equal((await sync()).uploaded,1);assert.match(await (await fetch(base+'remote.ics',{headers:auth})).text(),/Edited in Episuite/);
 s.blocks=s.blocks.filter(b=>!b.caldav);assert.equal((await sync()).deleted,1);assert.equal((await fetch(base+'remote.ics',{headers:auth})).status,404);
 console.log('Radicale two-way checks passed');
}finally{child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));}
