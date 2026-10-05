import crypto from 'node:crypto';

const MODES=new Set(['strict','coarse','pseudonymous']);
const MAX_DEPTH=6;
const MAX_ITEMS=32;
const MAX_STRING=1200;

const SENSITIVE_KEYS=/^(?:id|.*id|name|displayname|fullname|firstname|lastname|username|handle|email|emails|emailaddress|emailaddresses|phone|phones|phonenumber|phonenumbers|address|addresses|street|location|recipient|recipients|from|to|cc|bcc|organizer|owner|owners|account|accountnumber|url|link|webviewlink)$/i;
const FREE_TEXT_KEYS=/^(?:body|text|content|description|snippet|notes|message|summary|subject|title)$/i;
const DATE_KEYS=/(?:date|time|start|end|created|updated|modified|birthday)/i;

const EMAIL=/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE=/(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g;
const URL=/\bhttps?:\/\/[^\s<>{}"']+/gi;
const IPV4=/\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const TOKEN=/\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|AKIA[0-9A-Z]{16})\b/g;

function text(value){ return String(value??''); }
function truncate(value,max=MAX_STRING){ const s=text(value); return s.length<=max?s:`${s.slice(0,max)}…`; }
function keyNorm(key){ return String(key??'').replace(/[^a-z0-9]/gi,'').toLowerCase(); }

function aliasFactory(){
  const maps=new Map();
  const counts=new Map();
  return (kind,value)=>{
    const type=String(kind||'value').toLowerCase();
    const raw=text(value);
    let map=maps.get(type);
    if(!map){ map=new Map(); maps.set(type,map); }
    if(map.has(raw)) return map.get(raw);
    const n=(counts.get(type)??0)+1; counts.set(type,n);
    let alias;
    if(type==='email') alias=`person-${n}@example.invalid`;
    else if(type==='url') alias=`https://example.invalid/resource-${n}`;
    else alias=`[${type}-${n}]`;
    map.set(raw,alias);
    return alias;
  };
}

function coarseNumber(value){
  if(!Number.isFinite(value)) return '[number]';
  if(value===0) return '0';
  const sign=value<0?'-':'';
  const n=Math.abs(value);
  if(n<1) return `${sign}<1`;
  const power=Math.floor(Math.log10(n));
  const lo=10**power;
  const hi=10**(power+1);
  return `${sign}${lo}–${sign}${hi}`;
}

function coarseDate(value){
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}

function replacePatterns(input,alias,transformations){
  let out=truncate(input);
  const replace=(regex,kind)=>{
    out=out.replace(regex,match=>{
      transformations.add(kind);
      return alias(kind,match);
    });
  };
  replace(TOKEN,'credential');
  replace(EMAIL,'email');
  replace(PHONE,'phone');
  replace(URL,'url');
  replace(IPV4,'network');
  return out;
}

function sensitiveKind(key){
  const k=keyNorm(key);
  if(k.includes('email')||k==='from'||k==='to'||k==='cc'||k==='bcc') return 'email';
  if(k.includes('phone')) return 'phone';
  if(k.includes('address')||k==='street'||k==='location') return 'location';
  if(k.includes('url')||k.includes('link')) return 'url';
  if(k.includes('name')||k==='username'||k==='handle'||k==='organizer'||k==='owner'||k==='owners'||k==='recipient'||k==='recipients') return 'person';
  if(k.includes('account')) return 'account';
  if(k.endsWith('id')||k==='id') return 'identifier';
  return 'private';
}

function walk(value,{mode,alias,transformations,depth=0,key=''}){
  if(depth>MAX_DEPTH){ transformations.add('depth-limit'); return '[truncated]'; }
  if(value==null||typeof value==='boolean') return value;

  if(typeof value==='number'){
    if(mode==='strict'){ transformations.add('numeric-mask'); return '[number]'; }
    transformations.add('numeric-coarsening');
    return coarseNumber(value);
  }

  if(typeof value==='string'){
    const maybeDate=DATE_KEYS.test(String(key))?coarseDate(value):null;
    if(maybeDate){
      transformations.add('date-coarsening');
      return maybeDate;
    }
    if(SENSITIVE_KEYS.test(String(key))){
      const kind=sensitiveKind(key);
      transformations.add(`${kind}-pseudonymization`);
      return alias(kind,value);
    }
    if(mode==='strict'){
      transformations.add('text-mask');
      return FREE_TEXT_KEYS.test(String(key))?'[private text]':'[private value]';
    }
    return replacePatterns(value,alias,transformations);
  }

  if(Array.isArray(value)){
    const limited=value.slice(0,MAX_ITEMS).map(item=>walk(item,{mode,alias,transformations,depth:depth+1,key}));
    if(value.length>MAX_ITEMS){ limited.push(`[${value.length-MAX_ITEMS} more items]`); transformations.add('item-limit'); }
    return limited;
  }

  if(typeof value==='object'){
    const out={};
    const entries=Object.entries(value).slice(0,MAX_ITEMS);
    for(const [childKey,childValue] of entries){
      out[childKey]=walk(childValue,{mode,alias,transformations,depth:depth+1,key:childKey});
    }
    if(Object.keys(value).length>MAX_ITEMS){ out._hushOmitted=Object.keys(value).length-MAX_ITEMS; transformations.add('item-limit'); }
    return out;
  }

  transformations.add('unsupported-type');
  return `[${typeof value}]`;
}

/**
 * Produce a bounded sanitized representation for cases where a bounded decision is
 * insufficient. This is best-effort data minimization, not an information-theoretic
 * guarantee: every content-bearing fallback remains approval-gated by ContextKernel.
 */
export function sanitizeContextValue(value,{mode='pseudonymous'}={}){
  const selected=String(mode||'pseudonymous');
  if(!MODES.has(selected)) throw new Error(`Unsupported context sanitization mode: ${selected}`);
  const transformations=new Set();
  const alias=aliasFactory();
  const sanitized=walk(structuredClone(value),{mode:selected,alias,transformations});
  const serialized=JSON.stringify(sanitized);
  return {
    sanitized,
    mode:selected,
    transformations:[...transformations].sort(),
    outputBytes:Buffer.byteLength(serialized),
    digest:crypto.createHash('sha256').update(serialized).digest('hex'),
    requiresApproval:true,
    exactPrivateValuesIntended:false,
    bestEffortTextSanitization:true
  };
}

export function contextSanitizationModes(){ return [...MODES]; }
