import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,cp,mkdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('Docker COPY instructions package a server that starts with all runtime modules',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const staged=await mkdtemp(path.join(tmpdir(),'episuite-docker-package-'));
  try{
    const dockerfile=await readFile(path.join(root,'Dockerfile'),'utf8');
    for(const line of dockerfile.split(/\r?\n/).filter(line=>/^COPY\s/.test(line))){
      const tokens=line.trim().split(/\s+/).slice(1),destination=tokens.pop();
      assert.ok(!destination.startsWith('/')&&!destination.includes('..'),'COPY destination must remain in /app');
      const target=path.join(staged,destination);await mkdir(target,{recursive:true});
      for(const source of tokens){
        const names=source==='*.mjs'?(await readdir(root)).filter(name=>name.endsWith('.mjs')):[source];
        assert.ok(names.length,'COPY must match at least one file');
        for(const name of names){const sourcePath=path.join(root,name);await cp(sourcePath,(await stat(sourcePath)).isDirectory()?target:path.join(target,path.basename(name)),{recursive:true});}
      }
    }
    // npm ci supplies these dependencies in the image. Use the installed packages
    // so this packaging check stays offline and runs without a Docker daemon.
    await cp(path.join(root,'node_modules'),path.join(staged,'node_modules'),{recursive:true});
    const probe=`import {createApp} from './server.mjs';
      const app=await createApp({dataDir:'./data',backgroundInterval:0});
      try{await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
        const response=await fetch('http://127.0.0.1:'+app.server.address().port+'/api/health');
        if(!response.ok||!(await response.json()).ok)throw Error('Packaged server is unhealthy');
        console.log('Docker packaged server startup passed');
      }finally{await app.close();}`;
    const result=spawnSync(process.execPath,['--input-type=module','-e',probe],{cwd:staged,encoding:'utf8',timeout:30000});
    assert.equal(result.status,0,result.stderr||result.error?.message);
    assert.match(result.stdout,/Docker packaged server startup passed/);
  }finally{
    assert.ok(path.resolve(staged).startsWith(path.resolve(tmpdir())+path.sep+'episuite-docker-package-'));
    await rm(staged,{recursive:true,force:true});
  }
});
