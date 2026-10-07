import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createReceipt } from '../src/core.js';
import { signReceipt, verifySignedReceiptChain } from '../src/receipt-security.js';

const keys=crypto.generateKeyPairSync('ed25519');
const privateKey=keys.privateKey.export({type:'pkcs8',format:'pem'});
const publicKey=keys.publicKey.export({type:'spki',format:'pem'});

test('signed receipt chain verifies and tampering fails',()=>{
  const first=signReceipt(createReceipt({request:{action:'read'},decision:'allow'}),privateKey);
  const second=signReceipt(createReceipt({previousHash:first.hash,request:{action:'send'},decision:'ask'}),privateKey);
  assert.equal(verifySignedReceiptChain([first,second],publicKey).valid,true);
  const tampered=structuredClone(second);tampered.decision='allow';
  assert.equal(verifySignedReceiptChain([first,tampered],publicKey).valid,false);
  const forged=structuredClone(second);forged.signature=crypto.randomBytes(64).toString('base64url');
  assert.equal(verifySignedReceiptChain([first,forged],publicKey).valid,false);
});

test('one signed receipt anchors a valid legacy unsigned prefix',()=>{
  const legacy=createReceipt({request:{action:'read'},decision:'allow'});
  const anchor=signReceipt(createReceipt({previousHash:legacy.hash,request:{category:'system',action:'receipt_anchor',resource:'local'},decision:'allow',result:{migration:true}}),privateKey);
  const result=verifySignedReceiptChain([legacy,anchor],publicKey);
  assert.equal(result.valid,true);
  assert.equal(result.legacyUnsigned,1);
  assert.equal(result.signed,1);
  assert.equal(result.anchored,true);
});

test('unsigned receipts after signing begins are rejected',()=>{
  const first=signReceipt(createReceipt({request:{action:'read'},decision:'allow'}),privateKey);
  const second=createReceipt({previousHash:first.hash,request:{action:'read'},decision:'allow'});
  const result=verifySignedReceiptChain([first,second],publicKey);
  assert.equal(result.valid,false);
  assert.equal(result.reason,'unsigned-receipt');
});
