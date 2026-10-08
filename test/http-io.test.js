import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable,PassThrough} from 'node:stream';
import {readRequestBody,readJsonObject} from '../src/http-io.js';
import {readResponseText} from '../src/response-io.js';
import {runtimePolicy} from '../src/runtime-policy.js';

test('normal startup requires auth and OS-backed security; bypass needs explicit development',()=>{
  assert.deepEqual(runtimePolicy({}),{production:true,localClientAuth:true,port:8787});
  assert.equal(runtimePolicy({HUSH_REQUIRE_LOCAL_AUTH:'0'}).localClientAuth,true);
  assert.equal(runtimePolicy({NODE_ENV:'production',HUSH_REQUIRE_LOCAL_AUTH:'0'}).localClientAuth,true);
  assert.equal(runtimePolicy({NODE_ENV:'development'}).localClientAuth,true);
  assert.equal(runtimePolicy({NODE_ENV:'test',HUSH_REQUIRE_LOCAL_AUTH:'0'}).localClientAuth,false);
});
test('invalid ports fail before state is initialized',()=>{
  for(const PORT of ['0','-1','65536','8787abc','1.5','Infinity'])assert.throws(()=>runtimePolicy({PORT}),/PORT/);
  assert.equal(runtimePolicy({PORT:'9001'}).port,9001);
});
test('chunked request limit yields 413 without destroying the response socket',async()=>{
  const req=Readable.from([Buffer.alloc(7),Buffer.alloc(7)]);
  await assert.rejects(readRequestBody(req,{maxBytes:10}),e=>e.status===413);
});
test('declared oversize is rejected before buffering',async()=>{
  const req=new PassThrough();req.headers={'content-length':'900'};
  await assert.rejects(readRequestBody(req,{maxBytes:100}),e=>e.status===413);
  req.end();
});
test('incomplete upload times out and removes listeners',async()=>{
  const req=new PassThrough();
  await assert.rejects(readRequestBody(req,{timeoutMs:20}),e=>e.status===408);
  assert.equal(req.listenerCount('data'),0);
  req.end();
});
test('JSON rejects malformed, null, array and primitive bodies with 400',async()=>{
  for(const body of ['{','null','[]','42','"str"'])await assert.rejects(readJsonObject(Readable.from([Buffer.from(body)])),e=>e.status===400);
  assert.deepEqual(await readJsonObject(Readable.from([])),{});
  assert.deepEqual(await readJsonObject(Readable.from([Buffer.from('{"ok":true}')])),{ok:true});
});
test('streamed response limit cancels input before full allocation',async()=>{
  let cancelled=false;
  const body=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(8));},cancel(){cancelled=true;}});
  await assert.rejects(readResponseText(new Response(body),10),/safety limit/);
  assert.equal(cancelled,true);
});
test('bounded response decoder preserves UTF8 across byte chunks',async()=>{
  const bytes=new TextEncoder().encode('हश 💙');
  const body=new ReadableStream({start(c){for(const byte of bytes)c.enqueue(Uint8Array.of(byte));c.close();}});
  assert.equal(await readResponseText(new Response(body),100),'हश 💙');
});
