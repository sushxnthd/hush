import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,createKeys,sealWorkspace,openWorkspace,validateEnvelope,validateWorkspace,buildContext,inspectText,sampleWorkspace,saveNote} from '../assets/workspace-core.js';

test('browser workspace round-trip saves ciphertext only and authenticates its header',async()=>{
  const data=emptyWorkspace();data.notes.push({id:'note-1',title:'PRIVATE-TITLE-CANARY',text:'PRIVATE-TEXT-CANARY',createdAt:Date.now()});
  const keys=await createKeys('synthetic test-only passphrase');
  assert.equal(keys.key.extractable,false);
  const sealed=await sealWorkspace(data,keys,1);assert.equal(JSON.stringify(sealed).includes('CANARY'),false);
  const opened=await openWorkspace(sealed,'synthetic test-only passphrase');assert.deepEqual(opened.data,data);
  await assert.rejects(openWorkspace({...sealed,revision:2},'synthetic test-only passphrase'),/Could not unlock/);
  await assert.rejects(openWorkspace(sealed,'incorrect passphrase'),/Could not unlock/);
  const altered={...sealed,ciphertext:(sealed.ciphertext[0]==='A'?'B':'A')+sealed.ciphertext.slice(1)};
  await assert.rejects(openWorkspace(altered,'synthetic test-only passphrase'),/Could not unlock/);
});
test('saving the same workspace generates fresh nonces and ciphertext',async()=>{
  const keys=await createKeys('nonce isolation test passphrase'),data=emptyWorkspace();
  const a=await sealWorkspace(data,keys,1),b=await sealWorkspace(data,keys,1);
  assert.notEqual(a.iv,b.iv);assert.notEqual(a.ciphertext,b.ciphertext);
});
test('backup rejects unsupported derivation, malformed nonce and oversized records before use',()=>{
  assert.throws(()=>validateEnvelope({format:'other'}),/supported/);
  assert.throws(()=>validateWorkspace({version:1,notes:[],memories:[{id:'x',title:'x',text:'x',createdAt:1,status:'unilaterally-approved'}],activity:[]}),/Invalid/);
  const duplicate={version:1,notes:[{id:'x',title:'x',text:'x',createdAt:1}],memories:[{id:'x',title:'x',text:'x',createdAt:1,status:'approved'}],activity:[]};
  assert.throws(()=>validateWorkspace(duplicate),/Invalid/);
});
test('prepared context includes only explicitly selected approved memory, never private notes',()=>{
  const data=sampleWorkspace();data.notes[0].text='PRIVATE-NOTE-CANARY';
  const text=buildContext(data,['sample-memory'],'Draft a short trip plan.');
  assert.ok(text.includes('Keep answers concise'));assert.equal(text.includes('PRIVATE-NOTE-CANARY'),false);assert.equal(text.includes('Prefer quieter places'),false);
  assert.throws(()=>buildContext(data,['sample-pending'],'Draft a plan'),/approved/);
  assert.throws(()=>buildContext(data,['missing'],'Draft a plan'),/approved/);
  data.memories[0].status='rejected';assert.throws(()=>buildContext(data,['sample-memory'],'Draft a plan'),/approved/);
  assert.ok(!buildContext(data,[],'A standalone task').includes('User-approved context'));
});
test('heuristic redaction removes known patterns and leaves ordinary text intact',()=>{
  const found=inspectText('Email alex@example.com. api_key=qa-test-token. Keep the tone concise.');
  assert.equal(found.count,2);assert.equal(found.redacted.includes('alex@example.com'),false);assert.equal(found.redacted.includes('qa-test-token'),false);assert.ok(found.redacted.includes('Keep the tone concise'));
  assert.deepEqual(inspectText('Ordinary text.'),{redacted:'Ordinary text.',count:0});
});
test('editing a private note preserves identity and leaves approved memory unchanged',async()=>{
  const data=sampleWorkspace(),note=data.notes[0],createdAt=note.createdAt;
  const originalMemory=structuredClone(data.memories);
  saveNote(data,{id:note.id,title:'Updated private note',text:'NEW-PRIVATE-EDIT-CANARY'},createdAt+10);
  assert.equal(data.notes.length,1);assert.equal(data.notes[0].id,'sample-note');assert.equal(data.notes[0].createdAt,createdAt);assert.equal(data.notes[0].updatedAt,createdAt+10);
  assert.deepEqual(data.memories,originalMemory);assert.ok(!buildContext(data,['sample-memory'],'Write a summary').includes('NEW-PRIVATE-EDIT-CANARY'));
  const keys=await createKeys('synthetic note editing test phrase'),sealed=await sealWorkspace(data,keys,2);
  assert.ok(!JSON.stringify(sealed).includes('NEW-PRIVATE-EDIT-CANARY'));
  assert.deepEqual((await openWorkspace(sealed,'synthetic note editing test phrase')).data,data);
});
test('a removed note cannot be recreated accidentally by saving a stale editor',()=>{
  const data=emptyWorkspace();assert.throws(()=>saveNote(data,{id:'removed-note',title:'Old title',text:'Old text'}),/no longer exists/);assert.deepEqual(data.notes,[]);
  assert.throws(()=>saveNote(data,{title:' ',text:'body'}),/note limits/);
  assert.throws(()=>saveNote(data,{title:'title',text:'x'.repeat(20001)}),/note limits/);
});
