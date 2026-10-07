import test from 'node:test';
import assert from 'node:assert/strict';
import {HushClient,HushClientError,HUSH_DEFAULT_BASE_URL,isLoopbackHushUrl} from '../src/client-sdk.js';

function fake(handler){
  return async(url,options={})=>{
    const out=await handler(new URL(url),options);
    const status=out.status??200;
    return new Response(JSON.stringify(out.body??{}),{status,headers:{'content-type':'application/json'}});
  };
}

test('client defaults to the local Hush runtime and rejects remote endpoints',()=>{
  const client=new HushClient({fetchImpl:fake(async()=>({body:{ok:true}}))});
  assert.equal(client.baseUrl.href,HUSH_DEFAULT_BASE_URL+'/');
  assert.equal(isLoopbackHushUrl('http://localhost:8787'),true);
  assert.equal(isLoopbackHushUrl('https://example.com'),false);
  assert.throws(()=>new HushClient({baseUrl:'https://example.com',fetchImpl:()=>{}}),/Remote Hush endpoints are disabled/i);
});

test('native auth token is attached to local API requests but never to the URL',async()=>{
  let seen;
  const client=new HushClient({authToken:'local-control-secret',fetchImpl:fake(async(url,options)=>{seen={url,options};return {body:{ok:true}};})});
  await client.status();
  assert.equal(seen.options.headers.authorization,'Hush local-control-secret');
  assert.equal(seen.url.href.includes('local-control-secret'),false);
});

test('status and pending use the expected local API routes',async()=>{
  const seen=[];
  const client=new HushClient({fetchImpl:fake(async(url,options)=>{seen.push([url.pathname,options.method]);return {body:{path:url.pathname}};})});
  assert.deepEqual(await client.status(),{path:'/api/status'});
  assert.deepEqual(await client.pending(),{path:'/api/pending'});
  assert.deepEqual(seen,[['/api/status','GET'],['/api/pending','GET']]);
});

test('202 ask responses are returned instead of treated as transport failures',async()=>{
  const client=new HushClient({fetchImpl:fake(async()=>({status:202,body:{decision:'ask',pending:{id:'p1'}}}))});
  const out=await client.request('/api/evaluate',{method:'POST',body:{request:{action:'send'}}});
  assert.equal(out.decision,'ask');
});

test('structured Hush errors retain status and payload',async()=>{
  const client=new HushClient({fetchImpl:fake(async()=>({status:403,body:{decision:'deny',reason:'blocked'}}))});
  await assert.rejects(()=>client.status(),error=>{
    assert.equal(error instanceof HushClientError,true);
    assert.equal(error.status,403);
    assert.equal(error.payload.reason,'blocked');
    return true;
  });
});

test('approval ids are URL encoded and approval remains a POST',async()=>{
  let seen;
  const client=new HushClient({fetchImpl:fake(async(url,options)=>{seen={path:url.pathname,method:options.method,body:options.body};return {body:{approved:true}};})});
  const out=await client.approve('id with/slash');
  assert.equal(out.approved,true);
  assert.equal(seen.path,'/api/pending/id%20with%2Fslash/approve');
  assert.equal(seen.method,'POST');
  assert.equal(seen.body,'{}');
});

test('Google consent requires an explicit capability selection',async()=>{
  let calls=0;
  const client=new HushClient({fetchImpl:fake(async()=>{calls+=1;return {body:{}};})});
  assert.throws(()=>client.startGoogle(),/Select at least one Google connector or action/i);
  assert.equal(calls,0);
  let sent;
  const selected=new HushClient({fetchImpl:fake(async(_url,options)=>{sent=JSON.parse(options.body);return {body:{authorizationUrl:'https://accounts.google.com/test'}};})});
  await selected.startGoogle(['gmail'],[]);
  assert.deepEqual(sent,{connectors:['gmail'],actions:[]});
});

test('redaction sends text only to the local runtime',async()=>{
  let request;
  const client=new HushClient({fetchImpl:fake(async(url,options)=>{request={url,options};return {body:{redacted:'safe',count:1}};})});
  const out=await client.redact('secret');
  assert.equal(out.redacted,'safe');
  assert.equal(request.url.hostname,'127.0.0.1');
  assert.equal(JSON.parse(request.options.body).text,'secret');
});

test('oversized redaction input fails before network access',async()=>{
  let calls=0;
  const client=new HushClient({fetchImpl:fake(async()=>{calls+=1;return {body:{}};})});
  assert.throws(()=>client.redact('x'.repeat(300000)),/too large/i);
  assert.equal(calls,0);
});

test('request timeout fails closed with a stable client error',async()=>{
  const client=new HushClient({timeoutMs:100,fetchImpl:async(_url,{signal})=>new Promise((resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
  })});
  await assert.rejects(()=>client.status(),error=>error instanceof HushClientError&&/cancelled or timed out/i.test(error.message));
});
