import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getOrCreatePlatformRootKey } from './platform-key-store.js';

export const DEFAULT_POLICY={version:1,rules:[
{id:'deny-secret-export',match:{category:'secrets',action:'export_raw'},decision:'deny',reason:'Raw secrets never leave Hush.'},
{id:'ask-purchase',match:{category:'money',action:'purchase'},decision:'ask',reason:'Purchases require approval by default.'},
{id:'ask-send',match:{category:'communication',action:'send'},decision:'ask',reason:'External sends require approval by default.'},
{id:'ask-delete',match:{category:'destructive',action:'delete'},decision:'ask',reason:'Destructive actions require approval by default.'},
{id:'allow-read',match:{action:'read'},decision:'allow',reason:'Read-only action.'}],defaultDecision:'ask'};

export function canonicalize(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return`[${v.map(canonicalize).join(',')}]`;return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(v[k])}`).join(',')}}`}
export const sha256=s=>crypto.createHash('sha256').update(s).digest('hex');
const b64=x=>Buffer.from(x).toString('base64url'); const unb64=x=>Buffer.from(x,'base64url');

function atomicWrite(file,data,{mode=0o600}={}){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const temp=`${file}.${process.pid}.${crypto.randomBytes(5).toString('hex')}.tmp`;
  const payload=Buffer.isBuffer(data)?data:Buffer.from(String(data));
  const fd=fs.openSync(temp,'wx',mode);
  try{ fs.writeFileSync(fd,payload); fs.fsyncSync(fd); }
  finally{ fs.closeSync(fd); }
  fs.renameSync(temp,file);
  try{fs.chmodSync(file,mode);}catch{}
  try{
    const dirFd=fs.openSync(path.dirname(file),'r');
    try{fs.fsyncSync(dirFd);}finally{fs.closeSync(dirFd);}
  }catch{}
}
function atomicWriteJson(file,value){ atomicWrite(file,JSON.stringify(value,null,2)); }

export function encryptJson(v,key){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv),ct=Buffer.concat([c.update(Buffer.from(JSON.stringify(v))),c.final()]);return{v:1,iv:iv.toString('base64url'),tag:c.getAuthTag().toString('base64url'),ciphertext:ct.toString('base64url')}}
export function decryptJson(v,key){const d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(v.iv,'base64url'));d.setAuthTag(Buffer.from(v.tag,'base64url'));return JSON.parse(Buffer.concat([d.update(Buffer.from(v.ciphertext,'base64url')),d.final()]).toString())}

export function getOrCreateKeys(dir){
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const rootKey=getOrCreatePlatformRootKey(dir).key;
  const legacyPriv=path.join(dir,'grant-private.pem');
  const encPriv=path.join(dir,'grant-private.enc.json');
  const pub=path.join(dir,'grant-public.pem');
  if(!fs.existsSync(encPriv)){
    let privatePem,publicPem;
    if(fs.existsSync(legacyPriv)&&fs.existsSync(pub)){
      privatePem=fs.readFileSync(legacyPriv,'utf8');
      publicPem=fs.readFileSync(pub,'utf8');
    }else{
      const k=crypto.generateKeyPairSync('ed25519');
      privatePem=k.privateKey.export({type:'pkcs8',format:'pem'});
      publicPem=k.publicKey.export({type:'spki',format:'pem'});
    }
    atomicWriteJson(encPriv,encryptJson({privatePem},rootKey));
    atomicWrite(pub,publicPem,{mode:0o644});
    if(fs.existsSync(legacyPriv)) fs.rmSync(legacyPriv,{force:true});
  }
  const privateKey=decryptJson(JSON.parse(fs.readFileSync(encPriv,'utf8')),rootKey)?.privatePem;
  const publicKey=fs.readFileSync(pub,'utf8');
  if(typeof privateKey!=='string') throw Error('Encrypted signing key is invalid');
  const probe=Buffer.from('hush-signing-key-self-test');
  if(!crypto.verify(null,probe,publicKey,crypto.sign(null,probe,privateKey))) throw Error('Hush signing keypair failed self-test');
  return{privateKey,publicKey,privateKeyStorage:'encrypted-under-platform-root'};
}
export function getOrCreateMasterKey(dir){return getOrCreatePlatformRootKey(dir).key}

export function issueGrant(input,privateKey,now=Date.now()){const ttl=Math.max(1000,Math.min(Number(input.ttlMs??900000),86400000));const grant={v:1,id:input.id??crypto.randomUUID(),subject:input.subject??'local-user',agent:String(input.agent||'unknown-agent'),purpose:String(input.purpose||'unspecified'),actions:[...new Set(input.actions??[])].sort(),resources:[...new Set(input.resources??[])].sort(),constraints:{maxAmount:input.constraints?.maxAmount??null,currency:input.constraints?.currency??null,merchants:[...new Set(input.constraints?.merchants??[])].sort(),recipients:[...new Set(input.constraints?.recipients??[])].sort()},issuedAt:now,expiresAt:now+ttl,maxUses:Math.max(1,Number(input.maxUses??1))};const payload=b64(canonicalize(grant)),sig=crypto.sign(null,Buffer.from(payload),privateKey).toString('base64url');return{grant,token:`${payload}.${sig}`}}
export function verifyGrantToken(token,publicKey,now=Date.now()){const p=String(token||'').split('.');if(p.length!==2)throw Error('Malformed grant token');if(!crypto.verify(null,Buffer.from(p[0]),publicKey,unb64(p[1])))throw Error('Invalid grant signature');const g=JSON.parse(unb64(p[0]).toString());if(g.v!==1)throw Error('Unsupported grant version');if(now>=g.expiresAt)throw Error('Grant expired');return g}
const scope=(list,v)=>list.includes('*')||list.includes(v);
export function assertGrantAllows(g,r,useCount=0){if(g.agent!==r.agent)throw Error('Grant is bound to another agent');if(g.purpose!==r.purpose)throw Error('Grant is bound to another purpose');if(!scope(g.actions,r.action))throw Error('Action is outside grant scope');if(!scope(g.resources,r.resource))throw Error('Resource is outside grant scope');if(useCount>=g.maxUses)throw Error('Grant use limit exceeded');const c=g.constraints??{};if(r.amount!=null&&c.maxAmount!=null&&Number(r.amount)>Number(c.maxAmount))throw Error('Amount exceeds grant limit');if(r.currency&&c.currency&&r.currency!==c.currency)throw Error('Currency is outside grant scope');if(r.merchant&&c.merchants?.length&&!c.merchants.includes(r.merchant))throw Error('Merchant is outside grant scope');if(r.recipient&&c.recipients?.length&&!c.recipients.includes(r.recipient))throw Error('Recipient is outside grant scope');return true}

const DETECTORS=[['openai_api_key',/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],['github_token',/\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g],['aws_access_key',/\bAKIA[0-9A-Z]{16}\b/g],['private_key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],['bearer_token',/\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gi],['email',/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi]];
export function detectSensitive(text){const hits=[];for(const[type,re]of DETECTORS){re.lastIndex=0;let m;while((m=re.exec(text))!==null)hits.push({type,value:m[0],start:m.index,end:m.index+m[0].length})}return hits.sort((a,b)=>a.start-b.start||b.end-a.end)}
export function redactSensitive(text){const hits=detectSensitive(text),chosen=[],used=[];for(const h of hits){if(used.some(([s,e])=>h.start<e&&h.end>s))continue;used.push([h.start,h.end]);chosen.push({...h,id:crypto.randomUUID()})}let out=text;for(const s of chosen.sort((a,b)=>b.start-a.start))out=out.slice(0,s.start)+`{{HUSH:${s.type}:${s.id}}}`+out.slice(s.end);return{text:out,secrets:chosen.map(({start,end,...x})=>x)}}

function matches(m={},r={}){return Object.entries(m).every(([k,e])=>e==='*'||r[k]===e||(Array.isArray(e)&&e.includes(r[k])))}
export function evaluatePolicy(policy,r){for(const rule of policy.rules??[])if(matches(rule.match,r))return{decision:rule.decision,ruleId:rule.id,reason:rule.reason??null};return{decision:policy.defaultDecision??'ask',ruleId:null,reason:'No specific policy matched.'}}
export function riskForRequest(r){if(r.category==='secrets')return'critical';if(r.category==='money'||r.category==='destructive')return'high';if(r.action==='send'||r.action==='write')return'medium';return'low'}

export const requestHash=r=>sha256(canonicalize(r));
export function createApproval(r,ttlMs=300000){return{id:crypto.randomUUID(),requestHash:requestHash(r),createdAt:Date.now(),expiresAt:Date.now()+ttlMs,consumedAt:null}}
export function consumeApproval(a,r){if(!a)throw Error('Approval not found');if(a.consumedAt)throw Error('Approval already used');if(Date.now()>=a.expiresAt)throw Error('Approval expired');if(a.requestHash!==requestHash(r))throw Error('Approval does not match this exact action');a.consumedAt=Date.now();return true}
export function createReceipt({previousHash=null,request,decision,grantId=null,result=null}){const x={v:1,id:crypto.randomUUID(),at:Date.now(),previousHash,grantId,request,decision,result};x.hash=sha256(canonicalize(x));return x}
export function verifyReceiptChain(list){let prev=null;for(const r of list){const{hash,...body}=r;if(body.previousHash!==prev||sha256(canonicalize(body))!==hash)return false;prev=hash}return true}

export class Vault{constructor(dir,key){this.file=path.join(dir,'vault.json');this.key=key;this.items=this.load()}load(){if(!fs.existsSync(this.file))return[];return decryptJson(JSON.parse(fs.readFileSync(this.file,'utf8')),this.key)}save(){atomicWriteJson(this.file,encryptJson(this.items,this.key))}list(){return this.items.map(({value,...x})=>x)}put({label,type='secret',value,tags=[]}){const x={id:crypto.randomUUID(),label,type,value,tags,createdAt:Date.now()};this.items.push(x);this.save();const{value:_,...safe}=x;return safe}resolve(id){const x=this.items.find(item=>item.id===id);if(!x)throw Error('Vault item not found');return x.value}remove(id){const n=this.items.length;this.items=this.items.filter(x=>x.id!==id);if(this.items.length===n)return false;this.save();return true}}

class DurableMap extends Map{
  constructor(entries,onChange){super();this.onChange=onChange;for(const [k,v] of entries)super.set(k,v)}
  set(k,v){super.set(k,v);this.onChange?.();return this}
  delete(k){const changed=super.delete(k);if(changed)this.onChange?.();return changed}
  clear(){if(this.size){super.clear();this.onChange?.()}}
}
class DurableSet extends Set{
  constructor(values,onChange){super();this.onChange=onChange;for(const v of values)super.add(v)}
  add(v){const before=this.size;super.add(v);if(this.size!==before)this.onChange?.();return this}
  delete(v){const changed=super.delete(v);if(changed)this.onChange?.();return changed}
  clear(){if(this.size){super.clear();this.onChange?.()}}
}

export class Store{
  constructor(dir){
    this.dir=dir;fs.mkdirSync(dir,{recursive:true,mode:0o700});
    this.authorityFile=path.join(dir,'authority-state.enc.json');
    this.authorityKey=getOrCreatePlatformRootKey(dir).key;
    const authority=this.loadProtectedAuthority();
    const persist=()=>this.saveProtectedAuthority();
    this.grantUses=new DurableMap(Object.entries(authority.grantUses??{}).map(([k,v])=>[k,Number(v)||0]),persist);
    this.revokedGrants=new DurableSet(authority.revokedGrants??[],persist);
    this.pending=new Map();
    this.receipts=this.load('receipts.json',[]);
    this.policy=this.load('policy.json',DEFAULT_POLICY);
  }
  loadProtectedAuthority(){
    if(!fs.existsSync(this.authorityFile)) return {v:1,grantUses:{},revokedGrants:[]};
    const value=decryptJson(JSON.parse(fs.readFileSync(this.authorityFile,'utf8')),this.authorityKey);
    if(value?.v!==1||typeof value.grantUses!=='object'||!Array.isArray(value.revokedGrants)) throw Error('Invalid encrypted authority state');
    return value;
  }
  saveProtectedAuthority(){
    const value={v:1,grantUses:Object.fromEntries(this.grantUses??[]),revokedGrants:[...(this.revokedGrants??[])].sort()};
    atomicWriteJson(this.authorityFile,encryptJson(value,this.authorityKey));
  }
  load(f,d){const p=path.join(this.dir,f);return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):structuredClone(d)}
  save(f,v){atomicWriteJson(path.join(this.dir,f),v)}
  addReceipt(r){this.receipts.push(r);this.save('receipts.json',this.receipts)}
}
