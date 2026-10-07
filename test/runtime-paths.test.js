import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultHushDataDir, resolveHushDataDir } from '../src/runtime-paths.js';

function temp(prefix){return fs.mkdtempSync(path.join(os.tmpdir(),prefix));}

test('default data paths live in per-user application storage',()=>{
  assert.equal(defaultHushDataDir({platform:'win32',home:'C:\\Users\\A',env:{LOCALAPPDATA:'C:\\Users\\A\\AppData\\Local'}}),'C:\\Users\\A\\AppData\\Local\\Hush');
  assert.equal(defaultHushDataDir({platform:'darwin',home:'/Users/a',env:{}}),'/Users/a/Library/Application Support/Hush');
  assert.equal(defaultHushDataDir({platform:'linux',home:'/home/a',env:{XDG_DATA_HOME:'/home/a/.xdg'}}),'/home/a/.xdg/hush');
});

test('HUSH_DATA_DIR overrides the platform default',()=>{
  const configured=defaultHushDataDir({platform:'linux',home:'/home/a',env:{HUSH_DATA_DIR:'/tmp/private-hush'}});
  assert.equal(configured,path.resolve('/tmp/private-hush'));
});

test('legacy source-tree data is moved once into user storage',()=>{
  const root=temp('hush-root-');
  const target=temp('hush-parent-')+'/state';
  try{
    fs.mkdirSync(path.join(root,'data'),{recursive:true});
    fs.writeFileSync(path.join(root,'data','marker.txt'),'private-state');
    const resolved=resolveHushDataDir({appRoot:root,platform:'linux',home:'/unused',env:{HUSH_DATA_DIR:target}});
    assert.equal(resolved.dataDir,path.resolve(target));
    assert.ok(resolved.migration);
    assert.equal(fs.readFileSync(path.join(target,'marker.txt'),'utf8'),'private-state');
    assert.equal(fs.existsSync(path.join(root,'data')),false);
    const second=resolveHushDataDir({appRoot:root,platform:'linux',home:'/unused',env:{HUSH_DATA_DIR:target}});
    assert.equal(second.migration,null);
  }finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(path.dirname(target),{recursive:true,force:true});}
});
