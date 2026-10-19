import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyObservablePrefixClosure} from '../src/observable-fiber.js';

test('accepts observations that factor through each authorized prefix',()=>{
  const rows=[0,1,2].map(secretId=>({secretId,publicInput:'x',authorized:[0,secretId%2],observable:['fixed',secretId%2]}));
  assert.equal(verifyObservablePrefixClosure(rows).safe,true);
});

test('rejects future declassification emitted before authorization',()=>{
  const rows=[
    {secretId:'a',authorized:[0,0],observable:[0,0]},
    {secretId:'b',authorized:[0,1],observable:[1,1]}
  ];
  const result=verifyObservablePrefixClosure(rows);
  assert.equal(result.safe,false);
  assert.equal(result.finalSafe,true);
  assert.equal(result.witness.prefix,1);
});

test('rejects fixed-total work with secret-dependent event order',()=>{
  const rows=[
    {secretId:'a',authorized:[null,null],observable:[{work:0},{work:2}]},
    {secretId:'b',authorized:[null,null],observable:[{work:2},{work:0}]}
  ];
  assert.equal(verifyObservablePrefixClosure(rows).safe,false);
});

test('fails closed on malformed or duplicate worlds',()=>{
  assert.throws(()=>verifyObservablePrefixClosure([]));
  assert.throws(()=>verifyObservablePrefixClosure([{secretId:0,authorized:[0],observable:[0]},{secretId:0,authorized:[0],observable:[0]}]));
});
