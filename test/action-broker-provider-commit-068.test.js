import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ActionBroker} from '../src/action-broker.js';

// Research-only loopback provider. Single Node event-loop ordering, NOT a
// real provider's durable serializable transaction or external attestation.
function provider(file,{commitGate=true}={}){
  const load=()=>{
    try{
      const s=JSON.parse(readFileSync(file,'utf8'));
      if(s?.v!==1||typeof s.revoked!=='boolean'||!Array.isArray(s.pending)||
         !Number.isSafeInteger(s.effects)||s.effects<0) return null;
      return s;
    }catch{return null;}
  };
  const save=s=>{
    const temp=file+'.'+randomBytes(8).toString('hex')+'.tmp';
    writeFileSync(temp,JSON.stringify(s),{mode:0o600});
    renameSync(temp,file);
  };
  const server=createServer(async(req,res)=>{
    const send=(status,obj)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(obj));};
    let body='';
    for await(const chunk of req) body+=chunk.toString('utf8');
    const state=load();
    if(!state) return send(503,{status:'STATE_UNAVAILABLE'});
    if(req.url==='/enqueue'&&req.method==='POST'){
      let request;
      try{request=JSON.parse(body);}catch{return send(400,{status:'INVALID'});}
      if(typeof request.credential!=='string'||!request.credential.startsWith('HUSH068_TEST_'))
        return send(400,{status:'INVALID'});
      if(state.revoked) return send(403,{status:'REVOKED'});
      state.pending.push('queued'); // never persist a credential
      save(state);
      return send(202,{status:'QUEUED'});
    }
    if(req.url==='/revoke'&&req.method==='POST'){
      state.revoked=true;
      save(state);
      return send(200,{status:'REVOKED'});
    }
    if(req.url==='/commit'&&req.method==='POST'){
      if(!state.pending.length) return send(409,{status:'NO_PENDING'});
      if(commitGate&&state.revoked) return send(403,{status:'REVOKED_AT_COMMIT'});
      state.pending.shift();
      state.effects++;
      save(state);
      return send(200,{status:'COMMITTED'});
    }
    if(req.url==='/state'&&req.method==='GET')
      return send(200,{revoked:state.revoked,pending:state.pending.length,effects:state.effects});
    return send(404,{status:'UNKNOWN'});
  });
  return {server,load,save};
}

async function listen(server){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return 'http://127.0.0.1:'+server.address().port;
}
async function stop(server){await new Promise(resolve=>server.close(resolve));}
async function post(base,path){
  const r=await fetch(base+path,{method:'POST'});
  return {code:r.status,body:await r.json()};
}
async function get(base){return (await fetch(base+'/state')).json();}
async function approvedBrokerEnqueue(base,secret){
  const broker=new ActionBroker({secretResolver:async()=>secret});
  broker.registerAdapter({name:'provider068',actions:['enqueue'],execute:async({credentials})=>{
    const r=await fetch(base+'/enqueue',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({credential:credentials[0]})});
    if(r.status!==202) throw new Error('provider refused enqueue');
    return {accepted:true};
  }});
  const ticket=broker.request({adapter:'provider068',action:'enqueue',agent:'test068',sink:'local068',
    credentialRefs:['opaque068']});
  broker.approve(ticket.actionId);
  const outcome=await broker.execute({actionId:ticket.actionId,agent:'test068',sink:'local068'});
  assert.equal(JSON.stringify(outcome).includes(secret),false);
  return outcome;
}

async function fixture(run,{commitGate=true}={}){
  const dir=mkdtempSync(join(tmpdir(),'hush068-'));
  const file=join(dir,'provider-state.json');
  writeFileSync(file,JSON.stringify({v:1,revoked:false,pending:[],effects:0}));
  let active=provider(file,{commitGate});
  let base;
  const ctx={base:null,file,async restart(){
    await stop(active.server);
    active=provider(file,{commitGate});
    base=await listen(active.server);
    ctx.base=base;
  }};
  try{base=await listen(active.server);ctx.base=base;await run(ctx);}
  finally{await stop(active.server);rmSync(dir,{recursive:true,force:true});}
}

test('HUSH-068: revocation before provider commit denies queued effect, including after restart',async()=>{
  for(const bit of ['zero','one']){
    await fixture(async(ctx)=>{
      let {base,file}=ctx;
      const secret='HUSH068_TEST_'+bit;
      assert.equal((await approvedBrokerEnqueue(base,secret)).decision,'allow');
      assert.equal((await post(base,'/revoke')).code,200);
      assert.equal((await post(base,'/commit')).code,403);
      assert.equal((await get(base)).effects,0);
      const persisted=JSON.parse(readFileSync(file,'utf8'));
      assert.equal(persisted.revoked,true);
      assert.equal(persisted.effects,0);
      assert.equal(JSON.stringify(persisted).includes(secret),false);
      await ctx.restart();
      base=ctx.base;
      assert.equal((await post(base,'/commit')).code,403);
      assert.equal((await get(base)).effects,0);
    });
  }
});

test('HUSH-068: commit before revocation is allowed, later replay denied',async()=>{
  for(const bit of ['zero','one']){
    await fixture(async({base})=>{
      assert.equal((await approvedBrokerEnqueue(base,'HUSH068_TEST_'+bit)).decision,'allow');
      assert.equal((await post(base,'/commit')).code,200);
      assert.equal((await post(base,'/revoke')).code,200);
      assert.equal((await post(base,'/commit')).code,409);
      assert.equal((await get(base)).effects,1);
    });
  }
});

test('HUSH-068: provider rejects enqueue after revocation',async()=>{
  await fixture(async({base})=>{
    assert.equal((await post(base,'/revoke')).code,200);
    assert.equal((await approvedBrokerEnqueue(base,'HUSH068_TEST_zero')).decision,'error');
    assert.equal((await get(base)).effects,0);
  });
});

test('HUSH-068: enqueue-only authorization check leaks delayed effect (negative control)',async()=>{
  await fixture(async({base})=>{
    assert.equal((await approvedBrokerEnqueue(base,'HUSH068_TEST_zero')).decision,'allow');
    assert.equal((await post(base,'/revoke')).code,200);
    assert.equal((await post(base,'/commit')).code,200);
    assert.equal((await get(base)).effects,1);
  },{commitGate:false});
});

test('HUSH-068: missing provider authorization state fails closed at commit',async()=>{
  await fixture(async({base,file})=>{
    assert.equal((await approvedBrokerEnqueue(base,'HUSH068_TEST_one')).decision,'allow');
    unlinkSync(file);
    assert.equal((await post(base,'/commit')).code,503);
  });
});
