import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';
import {normalizeConnectorSnapshot,supportedConnectorProviders} from '../src/connectors.js';

function temp(){ return fs.mkdtempSync(path.join(os.tmpdir(),'hush-connectors-')); }
function kernel(dir=temp()){ return new ContextKernel({dir,passphrase:'connector ingestion test passphrase'}); }

test('connector registry covers the first Hush 1.0 source families',()=>{
  assert.deepEqual(supportedConnectorProviders(),['gmail','calendar','drive','contacts','github','generic']);
});

test('gmail snapshot is normalized into encrypted context without plaintext source ids or message content on disk',()=>{
  const dir=temp();
  const k=kernel(dir);
  const result=k.ingestConnectorSnapshot({provider:'gmail',items:[{
    id:'msg-secret-123',threadId:'thread-9',subject:'Private travel plan',from:'friend@example.com',snippet:'Meet me in Kyoto',body:'Hotel confirmation ABC-123',labelIds:['INBOX']
  }]});
  assert.deepEqual(result,{provider:'gmail',collection:'messages',received:1,created:1,updated:0,removed:0,total:1,replace:true});
  assert.deepEqual(k.connectorStats(),[{provider:'gmail',collection:'messages',items:1}]);

  const persisted=fs.readFileSync(path.join(dir,'sealed-context.json'),'utf8');
  for(const secret of ['msg-secret-123','Private travel plan','friend@example.com','Meet me in Kyoto','Hotel confirmation ABC-123','connector.gmail.messages']){
    assert.equal(persisted.includes(secret),false,`persisted bundle leaked ${secret}`);
  }

  const listed=k.list();
  assert.equal(listed.length,1);
  assert.equal(Object.hasOwn(listed[0],'source'),false);
  assert.equal(Object.hasOwn(listed[0],'value'),false);
});

test('replace imports update stable records and remove stale connector items',()=>{
  const k=kernel();
  const first=k.ingestConnectorSnapshot({provider:'calendar',items:[
    {id:'event-a',summary:'Physics exam',start:'2026-10-10T09:00:00+05:30'},
    {id:'event-b',summary:'Dentist',start:'2026-10-11T17:00:00+05:30'}
  ]});
  assert.equal(first.created,2);
  const paths=new Map(k.list().map(item=>[item.label,item.path]));

  const second=k.ingestConnectorSnapshot({provider:'calendar',items:[
    {id:'event-a',summary:'Physics exam moved',start:'2026-10-10T10:00:00+05:30'}
  ]});
  assert.equal(second.created,0);
  assert.equal(second.updated,1);
  assert.equal(second.removed,1);
  assert.equal(second.total,1);
  assert.equal(k.list()[0].path,paths.get('Physics exam'));
  assert.equal(k.list()[0].label,'Physics exam moved');
});

test('generic connector values can be used by path-free semantic private queries',()=>{
  const k=kernel();
  k.ingestConnectorSnapshot({provider:'generic',collection:'preferences',items:[{
    id:'travel-budget',label:'Travel budget',category:'finance',tags:['travel','budget'],value:1500
  }]});
  const t=k.beginTrajectory({purpose:'travel eligibility',maxBits:1,sinkMaxBits:1});
  const out=k.runSemantic({trajectoryId:t.trajectoryId,agent:'travel-agent',sink:'travel.example',program:{
    kind:'predicate',privateRef:{query:'travel budget'},op:'gte',value:1000
  }});
  assert.equal(out.decision,'allow');
  assert.equal(out.result,true);
  const wire=JSON.stringify(out);
  assert.equal(wire.includes('travel-budget'),false);
  assert.equal(wire.includes('connector.generic.preferences'),false);
  assert.equal(wire.includes('1500'),false);
});

test('connector snapshots fail closed on unknown providers and duplicate source ids',()=>{
  assert.throws(()=>normalizeConnectorSnapshot({provider:'unknown',items:[]}),/Unsupported connector provider/);
  assert.throws(()=>normalizeConnectorSnapshot({provider:'drive',items:[{id:'same',name:'a'},{id:'same',name:'b'}]}),/duplicate source ids/);
});
