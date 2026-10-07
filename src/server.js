import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import {
  getOrCreateKeys, Vault, Store,
  redactSensitive, detectSensitive, issueGrant, verifyGrantToken,
  assertGrantAllows, evaluatePolicy, riskForRequest, createApproval,
  consumeApproval, createReceipt
} from './core.js';
import { DisclosureLedger, TrustRegistry, TRUST_PROFILES } from './privacy.js';
import { McpToolCatalog, evaluateMcpCall, jsonRpcError, sanitizeForwardHeaders } from './mcp.js';
import { scanMcpCatalog } from './scanner.js';
import { ContextKernel } from './context-kernel.js';
import { NATIVE_MCP_TOOLS, callNativeMcpTool, isNativeMcpTool } from './native-mcp.js';
import { ProviderOnboarding } from './provider-onboarding.js';
import { handleOnboardingRequest } from './onboarding-http.js';
import { getOrCreatePlatformRootKey, deriveContextPassphrase } from './platform-key-store.js';
import { resolveHushDataDir } from './runtime-paths.js';
import { acquireRuntimeLock } from './runtime-lock.js';
import { assertLocalHttpRequest, parseTrustedExtensionOrigins, securityHeaders } from './local-http-security.js';
import { LocalClientAuth } from './local-client-auth.js';
import { signReceipt, verifySignedReceiptChain } from './receipt-security.js';
import { handleOwnerContextRequest } from './owner-context-http.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dataDir, migration:dataMigration } = resolveHushDataDir({appRoot:root});
process.chdir(root);
const runtimeLock = acquireRuntimeLock(dataDir);
const { privateKey, publicKey } = getOrCreateKeys(dataDir);
const rootKeyInfo = getOrCreatePlatformRootKey(dataDir);
const vault = new Vault(dataDir, rootKeyInfo.key);
const store = new Store(dataDir);
const port = Number(process.env.PORT || 8787);
const trustedExtensionOrigins=parseTrustedExtensionOrigins(process.env.HUSH_ALLOWED_EXTENSION_ORIGINS||'');
const localAuth=new LocalClientAuth({
  rootKey:rootKeyInfo.key,
  required:process.env.NODE_ENV==='production'||process.env.HUSH_REQUIRE_LOCAL_AUTH==='1',
  allowedExtensionOrigins:trustedExtensionOrigins
});

const trustRegistry = new TrustRegistry('limited');
for (const [agent, profile] of Object.entries(store.load('trust.json', {}))) trustRegistry.set(agent, profile.level ?? profile);
const disclosureLedger = new DisclosureLedger({ trustRegistry });
disclosureLedger.events = store.load('disclosures.json', []);

const contextPassphrase = process.env.HUSH_CONTEXT_PASSPHRASE || deriveContextPassphrase(rootKeyInfo.key);
const contextKernel = new ContextKernel({dir:path.join(dataDir,'context'),passphrase:contextPassphrase});
const providerOnboarding = new ProviderOnboarding({vault,kernel:contextKernel,port});

let startupAudit=verifySignedReceiptChain(store.receipts,publicKey);
if(!startupAudit.valid&&process.env.NODE_ENV==='production') throw new Error(`Hush audit chain failed verification: ${startupAudit.reason}`);
if(startupAudit.valid&&store.receipts.length&&!startupAudit.anchored){
  const anchor=signReceipt(createReceipt({previousHash:store.receipts.at(-1)?.hash??null,request:{agent:'hush-runtime',purpose:'audit-migration',category:'system',action:'receipt_anchor',resource:'local'},decision:'allow',result:{legacyReceiptCount:store.receipts.length}}),privateKey);
  store.addReceipt(anchor);
  startupAudit=verifySignedReceiptChain(store.receipts,publicKey);
}
const auditStatus=()=>verifySignedReceiptChain(store.receipts,publicKey);

const mcpCatalog = new McpToolCatalog();
const mcpApprovals = new Map();
const mcpUpstream = process.env.HUSH_MCP_UPSTREAM || null;
const trustMcpAnnotations = process.env.HUSH_MCP_TRUST_TOOL_ANNOTATIONS === '1';
const configuredBearer = process.env.HUSH_MCP_BEARER_TOKEN || null;
const configuredVaultAuthId = process.env.HUSH_MCP_AUTH_VAULT_ID || null;
const configuredAuthScheme = process.env.HUSH_MCP_AUTH_SCHEME || 'Bearer';
if (mcpUpstream) {
  const protocol = new URL(mcpUpstream).protocol;
  if (!['http:','https:'].includes(protocol)) throw new Error('HUSH_MCP_UPSTREAM must use http or https');
}

const send = (res, status, payload) => {
  const x = JSON.stringify(payload);
  res.writeHead(status, securityHeaders({'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(x)}));
  res.end(x);
};
const sendRpc = (res, payload) => send(res, 200, payload);

async function rawBody(req, max=2e6){
  const chunks=[];
  let total=0;
  for await (const c of req) {
    total += c.length;
    if (total>max) throw Error('Request body too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
async function body(req){
  const b=await rawBody(req,1e6);
  return b.length ? JSON.parse(b.toString()) : {};
}

function receipt(request, decision, grantId=null, result=null){
  const unsigned=createReceipt({previousHash:store.receipts.at(-1)?.hash??null,request,decision,grantId,result});
  const r=signReceipt(unsigned,privateKey);
  store.addReceipt(r);
  return r;
}

function providerActionAudit({phase,ticket,outcome=null}={}){
  if(!ticket?.requestHash) throw new Error('Provider action audit requires a safe action ticket');
  if(!['attempt','outcome'].includes(String(phase))) throw new Error('Unsupported provider action audit phase');
  const request={
    agent:ticket.agent,
    purpose:ticket.purpose,
    category:'provider-action',
    action:ticket.action,
    resource:ticket.resource,
    provider:ticket.adapter,
    sink:ticket.sink,
    requestHash:ticket.requestHash
  };
  const status=phase==='attempt'?'approved':String(outcome?.decision??'error');
  const decision=status==='allow'?'allow':status==='error'?'error':'approved';
  return receipt(request,decision,null,{
    providerAction:true,
    phase,
    status,
    requestHash:ticket.requestHash,
    brokerReceiptHash:phase==='outcome'?(outcome?.receipt?.hash??null):null,
    rawCredentialIncluded:false
  });
}

function persistTrust(){
  const out={};
  for (const [agent, profile] of trustRegistry.profiles.entries()) out[agent]=profile;
  store.save('trust.json', out);
}
function persistDisclosures(){ store.save('disclosures.json', disclosureLedger.events); }

function safeMcpAudit(evaluation){
  return {
    agent:evaluation.request.agent,
    purpose:evaluation.request.purpose,
    category:'mcp',
    action:'tool_call',
    resource:evaluation.request.resource,
    mcp:{tool:evaluation.request.tool,requestHash:evaluation.requestHash,knownTool:Boolean(evaluation.tool)}
  };
}
function validMcpApproval(hash){
  const a=mcpApprovals.get(hash);
  if(!a) return false;
  if(Date.now()>=a.expiresAt){mcpApprovals.delete(hash);return false;}
  return true;
}
function findPendingMcp(hash){
  return [...store.pending.values()].find(x=>x.kind==='mcp'&&x.requestHash===hash&&x.status==='pending')??null;
}
function mcpTargetUrl(incoming){
  const target=new URL(mcpUpstream);
  for(const [k,v] of incoming.searchParams) target.searchParams.set(k,v);
  return target;
}
function responseHeaders(headers){
  const out={};
  for(const [k,v] of headers.entries()){
    const key=k.toLowerCase();
    if(['content-length','content-encoding','transfer-encoding','connection'].includes(key)) continue;
    out[key]=v;
  }
  return securityHeaders(out);
}
function brokeredMcpAuth(){
  let value=null;
  if(configuredVaultAuthId) value=String(vault.resolve(configuredVaultAuthId));
  else if(configuredBearer) value=String(configuredBearer);
  if(!value) return null;
  if(configuredAuthScheme.toLowerCase()==='raw') return value;
  const scheme=configuredAuthScheme.trim();
  return value.toLowerCase().startsWith(`${scheme.toLowerCase()} `)?value:`${scheme} ${value}`;
}
async function fetchMcpUpstream(req,u,raw){
  if(!mcpUpstream) throw Object.assign(new Error('MCP upstream is not configured. Set HUSH_MCP_UPSTREAM.'),{code:'NO_MCP_UPSTREAM'});
  const headers=sanitizeForwardHeaders(req.headers,{brokeredAuth:brokeredMcpAuth()});
  return fetch(mcpTargetUrl(u),{
    method:req.method,
    headers,
    body:['GET','HEAD'].includes(req.method)?undefined:(raw?.length?raw:undefined),
    redirect:'manual'
  });
}
async function pipeMcpResponse(res,upstream){
  res.writeHead(upstream.status,responseHeaders(upstream.headers));
  if(!upstream.body){res.end();return;}
  Readable.fromWeb(upstream.body).pipe(res);
}

async function mcp(req,res,u){
  if(req.method==='GET'||req.method==='DELETE'){
    if(!mcpUpstream){res.writeHead(405,securityHeaders({'allow':'POST'}));res.end();return;}
    const upstream=await fetchMcpUpstream(req,u,null);
    return pipeMcpResponse(res,upstream);
  }
  if(req.method!=='POST'){
    res.writeHead(405,securityHeaders({'allow':'GET, POST, DELETE'}));res.end();return;
  }

  const raw=await rawBody(req);
  let rpc;
  try{rpc=raw.length?JSON.parse(raw.toString()):null}catch{return sendRpc(res,jsonRpcError(null,-32700,'Invalid JSON.'));}
  if(Array.isArray(rpc)) return sendRpc(res,jsonRpcError(null,-32040,'JSON-RPC batches are not supported by the Hush alpha proxy.'));
  if(!rpc||typeof rpc!=='object') return sendRpc(res,jsonRpcError(null,-32600,'Invalid JSON-RPC request.'));

  const envelope=rpc.params?._meta??{};
  const clientInfo=envelope['io.modelcontextprotocol/clientInfo'];
  const agent=String(req.headers['x-hush-agent']||clientInfo?.name||'unknown-agent');
  const purpose=String(req.headers['x-hush-purpose']||'unspecified');
  const requestedVersion=String(req.headers['mcp-protocol-version']||envelope['io.modelcontextprotocol/protocolVersion']||'');
  const modern=requestedVersion==='2026-07-28'||rpc.method==='server/discover';
  const serverMeta={'io.modelcontextprotocol/serverInfo':{name:'hush',version:'0.9.0'}};
  const complete=result=>modern?{...result,resultType:'complete',_meta:{...(result?._meta??{}),...serverMeta}}:result;
  const rpcResult=result=>sendRpc(res,{jsonrpc:'2.0',id:rpc.id,result:complete(result)});

  if(rpc.method==='server/discover') return rpcResult({supportedVersions:['2026-07-28','2025-11-25'],capabilities:{tools:{listChanged:false}},instructions:'Hush provides bounded private computation. Private values are not exposed as MCP tools.'});
  if(rpc.method==='initialize'&&!mcpUpstream) return sendRpc(res,{jsonrpc:'2.0',id:rpc.id,result:{protocolVersion:'2025-11-25',capabilities:{tools:{listChanged:false}},serverInfo:{name:'hush',version:'0.9.0'},instructions:'Hush provides bounded private computation. Private values are not exposed as MCP tools.'}});
  if(rpc.method==='notifications/initialized'){res.writeHead(204,securityHeaders());res.end();return;}
  if(rpc.method==='ping') return rpcResult({});
  if(rpc.method==='tools/list'&&!mcpUpstream) return rpcResult({tools:NATIVE_MCP_TOOLS});

  if(rpc.method==='tools/call'&&isNativeMcpTool(rpc.params?.name)){
    const result=callNativeMcpTool({name:rpc.params.name,args:rpc.params.arguments??{},kernel:contextKernel,agent,sink:`mcp:${agent}`});
    return rpcResult(result);
  }
  if(rpc.method==='tools/call'&&!mcpUpstream) return sendRpc(res,jsonRpcError(rpc.id,-32602,'Unknown tool.'));

  if(rpc.method==='tools/call'){
    const params=rpc.params??{};
    let evaluation=evaluateMcpCall({agent,purpose,params,catalog:mcpCatalog,policy:store.policy,trustAnnotations:trustMcpAnnotations});
    const hadApproval=validMcpApproval(evaluation.requestHash);
    if(hadApproval){
      evaluation=evaluateMcpCall({agent,purpose,params,catalog:mcpCatalog,policy:store.policy,preapprovedHash:evaluation.requestHash,trustAnnotations:trustMcpAnnotations});
    }
    const audit=safeMcpAudit(evaluation);

    if(evaluation.decision==='deny'){
      const r=receipt(audit,'deny',null,{mcp:true,hardDeny:Boolean(evaluation.hardDeny),reason:evaluation.reason});
      return sendRpc(res,jsonRpcError(rpc.id,-32003,'Hush blocked this MCP tool call.',{decision:'deny',reason:evaluation.reason,receiptHash:r.hash}));
    }
    if(evaluation.decision==='ask'){
      let pending=findPendingMcp(evaluation.requestHash);
      if(!pending){
        const id=crypto.randomUUID();
        pending={id,kind:'mcp',request:audit,requestHash:evaluation.requestHash,mcp:{tool:String(params.name||'unknown-tool'),agent,purpose},reason:evaluation.reason,risk:evaluation.request.mcp?.risk??'unknown',createdAt:Date.now(),status:'pending'};
        store.pending.set(id,pending);
      }
      return sendRpc(res,jsonRpcError(rpc.id,-32001,'Hush requires approval for this MCP tool call.',{decision:'ask',pendingId:pending.id,retryAfterApproval:true,reason:evaluation.reason}));
    }

    if(hadApproval) mcpApprovals.delete(evaluation.requestHash);
    const upstream=await fetchMcpUpstream(req,u,raw);
    receipt(audit,upstream.ok?'allow':'error',null,{mcp:true,upstreamStatus:upstream.status,approved:Boolean(hadApproval),credentialBrokered:Boolean(configuredVaultAuthId||configuredBearer)});
    return pipeMcpResponse(res,upstream);
  }

  const upstream=await fetchMcpUpstream(req,u,raw);
  if(rpc.method==='tools/list'&&upstream.ok){
    const contentType=upstream.headers.get('content-type')||'';
    if(contentType.includes('json')){
      const text=await upstream.text();
      try{
        const payload=JSON.parse(text);
        mcpCatalog.ingestListResult(payload);
        if(payload?.result&&Array.isArray(payload.result.tools)) payload.result.tools=[...payload.result.tools.filter(tool=>!isNativeMcpTool(tool?.name)),...NATIVE_MCP_TOOLS];
        res.writeHead(upstream.status,responseHeaders(upstream.headers));res.end(JSON.stringify(payload));return;
      }catch{}
      res.writeHead(upstream.status,responseHeaders(upstream.headers));res.end(text);return;
    }
  }
  return pipeMcpResponse(res,upstream);
}

async function api(req,res,u){
  if(await handleOwnerContextRequest({req,res,u,kernel:contextKernel,send,audit:(action,result)=>receipt({agent:'hush-owner',purpose:'local context management',category:'context',action,resource:'local'},'allow',null,result)})) return;
  if(u.pathname.startsWith('/api/onboarding/')){
    const handled=await handleOnboardingRequest({req,res,u,onboarding:providerOnboarding,auditAction:providerActionAudit});
    if(handled) return;
  }
  if(req.method==='POST'&&u.pathname==='/api/dashboard/launch'){
    const launch=localAuth.issueDashboardLaunch();
    return send(res,201,{path:launch.path,expiresAt:launch.expiresAt});
  }
  if(req.method==='GET'&&u.pathname==='/api/status'){
    const audit=auditStatus();
    return send(res,200,{product:'Hush',version:'0.9.0',vaultItems:vault.list().length,pending:[...store.pending.values()].filter(x=>x.status==='pending').length,receipts:store.receipts.length,disclosures:disclosureLedger.events.length,footprintAgents:disclosureLedger.footprint().length,context:{enabled:true,...contextKernel.stats()},runtime:{stateLocation:'user-data',legacyMigrated:Boolean(dataMigration),singleInstance:true},security:{rootKeyBackend:rootKeyInfo.backend,productionKeyStore:rootKeyInfo.backend!=='restricted-file',localClientAuth:localAuth.required,signedAudit:audit.anchored,auditValid:audit.valid,signedReceipts:audit.signed,legacyUnsignedReceipts:audit.legacyUnsigned},onboarding:providerOnboarding.status(),mcp:{configured:Boolean(mcpUpstream),observedTools:mcpCatalog.list().length,trustToolAnnotations:trustMcpAnnotations,credentialBrokered:Boolean(configuredVaultAuthId||configuredBearer)},chainValid:audit.valid});
  }
  if(req.method==='GET'&&u.pathname==='/api/vault') return send(res,200,{items:vault.list()});
  if(req.method==='GET'&&u.pathname==='/api/pending') return send(res,200,{requests:[...store.pending.values()].filter(x=>x.status==='pending')});
  if(req.method==='GET'&&u.pathname==='/api/receipts'){const audit=auditStatus();return send(res,200,{receipts:store.receipts.slice(-50).reverse(),chainValid:audit.valid,audit});}
  if(req.method==='GET'&&u.pathname==='/api/privacy/footprint') return send(res,200,{agents:disclosureLedger.footprint(),windowMs:disclosureLedger.windowMs});
  if(req.method==='GET'&&u.pathname==='/api/privacy/trust') return send(res,200,{levels:Object.keys(TRUST_PROFILES),profiles:[...trustRegistry.profiles.entries()].map(([agent,p])=>({agent,...p}))});
  if(req.method==='GET'&&u.pathname==='/api/mcp/scan') return send(res,200,scanMcpCatalog(mcpCatalog.list(),{annotationsTrusted:trustMcpAnnotations}));

  if(req.method==='GET'&&u.pathname==='/api/context'){
    return send(res,200,{items:contextKernel.list(),exposure:contextKernel.exposure(),partition:contextKernel.partitionExposure(),jointChoice:contextKernel.jointChoiceExposure()});
  }
  if(req.method==='GET'&&u.pathname==='/api/context/exposure'){
    return send(res,200,{fields:contextKernel.exposure(),partition:contextKernel.partitionExposure(),jointChoice:contextKernel.jointChoiceExposure()});
  }
  if(req.method==='GET'&&u.pathname==='/api/context/sync-bundle'){
    return send(res,200,{bundle:contextKernel.exportCiphertextBundle(),fingerprint:contextKernel.ciphertextFingerprint(),plaintextIncluded:false});
  }
  if(req.method==='POST'&&u.pathname==='/api/context'){
    const b=await body(req);
    if(!b.path||!Object.hasOwn(b,'value')) return send(res,400,{error:'path and value are required'});
    const item=contextKernel.put(String(b.path),b.value,{label:b.label??null,category:String(b.category??'general'),tags:Array.isArray(b.tags)?b.tags:[],domain:b.domain??undefined});
    return send(res,201,{item});
  }
  if(req.method==='POST'&&u.pathname==='/api/context/trajectory'){
    const b=await body(req);
    return send(res,201,contextKernel.beginTrajectory(b));
  }
  if(req.method==='POST'&&u.pathname==='/api/context/decision'){
    const b=await body(req);
    if(!b.trajectoryId||!b.program) return send(res,400,{error:'trajectoryId and program are required'});
    const result=contextKernel.run({trajectoryId:String(b.trajectoryId),agent:String(b.agent??'unknown-agent'),sink:String(b.sink??'unknown-sink'),program:b.program});
    return send(res,result.decision==='allow'?200:403,result);
  }

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
    if(secretHits.some(x=>x.type!=='email')) return send(res,403,{decision:'deny',reason:'Raw secret material detected. Use a Hush reference.',receipt:receipt(r,'deny',null,{reason:'raw-secret'})});
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
    if(x.kind==='mcp'){
      const expiresAt=Date.now()+5*60*1000;
      mcpApprovals.set(x.requestHash,{expiresAt,pendingId:x.id});
      x.status='approved';
      return send(res,200,{approved:true,retry:true,oneShot:true,expiresAt,requestHash:x.requestHash,receipt:receipt(x.request,'approved',null,{mcp:true,approvedByHuman:true,pendingExecution:true})});
    }
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

function dashboardBootstrap(res,u){
  const match=u.pathname.match(/^\/dashboard\/bootstrap\/([^/]+)$/);
  if(!match) return false;
  const session=localAuth.consumeDashboardLaunch(decodeURIComponent(match[1]));
  res.writeHead(303,securityHeaders({'location':'/','set-cookie':session.cookie}));
  res.end();
  return true;
}

function staticFile(res,u){
  const pub=fs.realpathSync(path.join(root,'public'));
  let requested;
  try{requested=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).replace(/^\/+/, '');}
  catch{return false;}
  const candidate=path.resolve(pub,requested);
  const lexical=path.relative(pub,candidate);
  if(lexical==='..'||lexical.startsWith(`..${path.sep}`)||path.isAbsolute(lexical)) return false;
  if(!fs.existsSync(candidate)||fs.statSync(candidate).isDirectory()) return false;
  const real=fs.realpathSync(candidate);
  const relative=path.relative(pub,real);
  if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative)) return false;
  const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'}[path.extname(real).toLowerCase()]??'application/octet-stream';
  res.writeHead(200,securityHeaders({'content-type':type}));fs.createReadStream(real).pipe(res);return true;
}

const server=http.createServer(async(req,res)=>{
  let u=null;
  try{
    assertLocalHttpRequest(req,{allowedExtensionOrigins:trustedExtensionOrigins,auth:localAuth});
    u=new URL(req.url,'http://127.0.0.1');
    if(dashboardBootstrap(res,u)) return;
    if(u.pathname==='/mcp') return await mcp(req,res,u);
    if(u.pathname.startsWith('/api/')) return await api(req,res,u);
    if(staticFile(res,u)) return;
    res.writeHead(404,securityHeaders());res.end('Not found');
  }
  catch(e){
    console.error(e);
    if(u?.pathname==='/mcp') return sendRpc(res,jsonRpcError(null,-32603,e.code==='NO_MCP_UPSTREAM'?e.message:'Hush MCP proxy error.'));
    send(res,Number(e?.status)||500,{error:e.message||'Internal error'});
  }
});
server.listen(port,'127.0.0.1',()=>console.log(`Hush running at http://127.0.0.1:${port}`));

let shuttingDown=false;
function shutdown(){
  if(shuttingDown) return;
  shuttingDown=true;
  server.close(()=>{runtimeLock.release();process.exit(0);});
  setTimeout(()=>{runtimeLock.release();process.exit(1);},5000).unref();
}
process.once('SIGINT',shutdown);
process.once('SIGTERM',shutdown);
process.once('exit',()=>runtimeLock.release());
