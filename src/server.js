import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  getOrCreateKeys, getOrCreateMasterKey, Vault, Store,
  redactSensitive, detectSensitive, issueGrant, verifyGrantToken,
  assertGrantAllows, evaluatePolicy, riskForRequest, createApproval,
  consumeApproval, createReceipt, verifyReceiptChain
} from './core.js';
import { DisclosureLedger, TrustRegistry, TRUST_PROFILES } from './privacy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
process.chdir(root);
fs.mkdirSync(dataDir, { recursive:true });
const { privateKey, publicKey } = getOrCreateKeys(dataDir);
const vault = new Vault(dataDir, getOrCreateMasterKey(dataDir));
const store = new Store(dataDir);
const port = Number(process.env.PORT || 8787);

const trustRegistry = new TrustRegistry('limited');
for (const [agent, profile] of Object.entries(store.load('trust.json', {}))) trustRegistry.set(agent, profile.level ?? profile);
const disclosureLedger = new DisclosureLedger({ trustRegistry });
disclosureLedger.events = store.load('disclosures.json', []);

const send = (res, status, payload) => {
  const x = JSON.stringify(payload);
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(x)});
  res.end(x);
};

async function body(req){
  const chunks=[];
  for await (const c of req) chunks.push(c);
  const b=Buffer.concat(chunks);
  if (b.length>1e6) throw Error('Request body too large');
  return b.length ? JSON.parse(b.toString()) : {};
}

function receipt(request, decision, grantId=null, result=null){
  const r=createReceipt({previousHash:store.receipts.at(-1)?.hash??null,request,decision,grantId,result});
  store.addReceipt(r);
  return r;
}

function persistTrust(){
  const out={};
  for (const [agent, profile] of trustRegistry.profiles.entries()) out[agent]=profile;
  store.save('trust.json', out);
}
function persistDisclosures(){ store.save('disclosures.json', disclosureLedger.events); }

async function api(req,res,u){
  if(req.method==='GET'&&u.pathname==='/api/status') return send(res,200,{product:'Supakeep',version:'0.2.0',vaultItems:vault.list().length,pending:[...store.pending.values()].filter(x=>x.status==='pending').length,receipts:store.receipts.length,disclosures:disclosureLedger.events.length,footprintAgents:disclosureLedger.footprint().length,chainValid:verifyReceiptChain(store.receipts)});
  if(req.method==='GET'&&u.pathname==='/api/vault') return send(res,200,{items:vault.list()});
  if(req.method==='GET'&&u.pathname==='/api/pending') return send(res,200,{requests:[...store.pending.values()].filter(x=>x.status==='pending')});
  if(req.method==='GET'&&u.pathname==='/api/receipts') return send(res,200,{receipts:store.receipts.slice(-50).reverse(),chainValid:verifyReceiptChain(store.receipts)});
  if(req.method==='GET'&&u.pathname==='/api/privacy/footprint') return send(res,200,{agents:disclosureLedger.footprint(),windowMs:disclosureLedger.windowMs});
  if(req.method==='GET'&&u.pathname==='/api/privacy/trust') return send(res,200,{levels:Object.keys(TRUST_PROFILES),profiles:[...trustRegistry.profiles.entries()].map(([agent,p])=>({agent,...p}))});

  if(req.method==='POST'&&u.pathname==='/api/redact'){
    const b=await body(req), r=redactSensitive(String(b.text??''));
    return send(res,200,{redacted:r.text,detected:r.secrets.map(({value,...x})=>x),count:r.secrets.length});
  }
  if(req.method==='POST'&&u.pathname==='/api/vault'){
    const b=await body(req);
    if(!b.label||!b.value) return send(res,400,{error:'label and value are required'});
    return send(res,201,{item:vault.put({label:String(b.label),type:String(b.type??'secret'),value:String(b.value)})});
  }
  if(req.method==='DELETE'&&u.pathname.startsWith('/api/vault/')){
    const ok=vault.remove(u.pathname.split('/').pop());
    return send(res,ok?200:404,{ok});
  }
  if(req.method==='POST'&&u.pathname==='/api/grants') return send(res,201,issueGrant(await body(req),privateKey));

  if(req.method==='POST'&&u.pathname==='/api/privacy/trust'){
    const b=await body(req);
    if(!b.agent||!b.level) return send(res,400,{error:'agent and level are required'});
    try { const profile=trustRegistry.set(String(b.agent),String(b.level)); persistTrust(); return send(res,200,{agent:String(b.agent),...profile}); }
    catch(e){ return send(res,400,{error:e.message}); }
  }

  if(req.method==='POST'&&u.pathname==='/api/privacy/disclose'){
    const b=await body(req), r=b.request??b;
    const evaluation=disclosureLedger.evaluate(r);
    const auditRequest={agent:r.agent,purpose:r.purpose,category:'privacy',action:'disclose',resource:r.sink,privacy:{category:r.category,level:r.level,atomIdHash:crypto.createHash('sha256').update(String(r.atomId??'')).digest('hex')}};
    if(evaluation.decision==='deny') return send(res,403,{...evaluation,receipt:receipt(auditRequest,'deny',null,{privacy:true,reason:evaluation.reason})});
    if(evaluation.decision==='ask'){
      const id=crypto.randomUUID(), x={id,kind:'disclosure',request:auditRequest,disclosureRequest:r,evaluation,createdAt:Date.now(),status:'pending',risk:'privacy',reason:evaluation.reason};
      store.pending.set(id,x);
      return send(res,202,{decision:'ask',pending:x});
    }
    const event=disclosureLedger.record(r,evaluation); persistDisclosures();
    return send(res,200,{decision:'allow',evaluation,event,receipt:receipt(auditRequest,'allow',null,{privacy:true,privacyCost:event.cost})});
  }

  if(req.method==='POST'&&u.pathname==='/api/evaluate'){
    const b=await body(req),r=b.request??{},secretHits=detectSensitive(JSON.stringify(r));
    if(secretHits.some(x=>x.type!=='email')) return send(res,403,{decision:'deny',reason:'Raw secret material detected. Use a Supakeep reference.',receipt:receipt(r,'deny',null,{reason:'raw-secret'})});
    let g=null;
    if(b.grantToken){
      try{g=verifyGrantToken(b.grantToken,publicKey);if(store.revokedGrants.has(g.id))throw Error('Grant revoked');assertGrantAllows(g,r,store.grantUses.get(g.id)??0)}
      catch(e){return send(res,403,{decision:'deny',reason:e.message,receipt:receipt(r,'deny',g?.id??null,{reason:e.message})})}
    }
    const p=evaluatePolicy(store.policy,r),risk=riskForRequest(r);
    if(p.decision==='deny') return send(res,403,{...p,risk,receipt:receipt(r,'deny',g?.id??null,{reason:p.reason})});
    if(p.decision==='ask'){
      const id=crypto.randomUUID(),x={id,kind:'action',request:r,grantId:g?.id??null,grantToken:b.grantToken??null,risk,reason:p.reason,createdAt:Date.now(),status:'pending'};
      store.pending.set(id,x);return send(res,202,{decision:'ask',risk,pending:x});
    }
    if(g)store.grantUses.set(g.id,(store.grantUses.get(g.id)??0)+1);
    return send(res,200,{decision:'allow',risk,receipt:receipt(r,'allow',g?.id??null,{simulated:true})});
  }

  const m=u.pathname.match(/^\/api\/pending\/([^/]+)\/(approve|deny)$/);
  if(req.method==='POST'&&m){
    const x=store.pending.get(m[1]);
    if(!x||x.status!=='pending') return send(res,404,{error:'Pending request not found'});
    if(m[2]==='deny'){x.status='denied';return send(res,200,{denied:true,receipt:receipt(x.request,'deny',x.grantId,{deniedByHuman:true})})}
    if(x.kind==='disclosure'){
      const approved={...x.disclosureRequest,approvedByHuman:true};
      const fresh=disclosureLedger.evaluate(approved);
      if(fresh.decision==='deny'){x.status='denied';return send(res,409,{error:'Disclosure is no longer within budget.',evaluation:fresh})}
      const event=disclosureLedger.record(approved,fresh);persistDisclosures();x.status='approved';
      return send(res,200,{approved:true,event,receipt:receipt(x.request,'allow',null,{approvedByHuman:true,privacy:true,privacyCost:event.cost})});
    }
    const a=createApproval(x.request);consumeApproval(a,x.request);
    if(x.grantToken){const g=verifyGrantToken(x.grantToken,publicKey);assertGrantAllows(g,x.request,store.grantUses.get(g.id)??0);store.grantUses.set(g.id,(store.grantUses.get(g.id)??0)+1)}
    x.status='approved';return send(res,200,{approved:true,receipt:receipt(x.request,'allow',x.grantId,{approvedByHuman:true,simulated:true})});
  }

  return send(res,404,{error:'Not found'});
}

function staticFile(res,u){
  const pub=path.join(root,'public'),p=path.resolve(pub,u.pathname==='/'?'index.html':u.pathname.slice(1));
  if(!p.startsWith(pub)||!fs.existsSync(p)||fs.statSync(p).isDirectory()) return false;
  const type={'.html':'text/html; charset=utf-8'}[path.extname(p)]??'application/octet-stream';
  res.writeHead(200,{'content-type':type,'x-content-type-options':'nosniff'});fs.createReadStream(p).pipe(res);return true;
}

http.createServer(async(req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  try{if(u.pathname.startsWith('/api/'))return await api(req,res,u);if(staticFile(res,u))return;res.writeHead(404);res.end('Not found')}
  catch(e){console.error(e);send(res,500,{error:e.message||'Internal error'})}
}).listen(port,'127.0.0.1',()=>console.log(`Supakeep running at http://127.0.0.1:${port}`));
