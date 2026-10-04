import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {Vault} from '../src/core.js';

test('vault list never exposes secret value but internal broker can resolve by id',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'supakeep-vault-'));
  try{
    const vault=new Vault(dir,crypto.randomBytes(32));
    const item=vault.put({label:'MCP token',type:'credential',value:'super-secret-token'});
    const listed=vault.list();
    assert.equal(listed.length,1);
    assert.equal('value' in listed[0],false);
    assert.equal(JSON.stringify(listed).includes('super-secret-token'),false);
    assert.equal(vault.resolve(item.id),'super-secret-token');
    assert.throws(()=>vault.resolve('missing'),/not found/i);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
