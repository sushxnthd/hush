import {sanitizeContextValue} from './context-sanitizer.js';

const WORD=/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;
const DEFAULT_MIN_TOKENS=7;
const DEFAULT_MIN_CHARS=24;

function norm(value){return String(value??'').normalize('NFKC').toLowerCase();}
function collect(value,out=[],depth=0){
  if(depth>8||value==null||typeof value==='boolean') return out;
  if(typeof value==='string'||typeof value==='number'){
    const text=String(value).trim();
    if(text) out.push(text);
    return out;
  }
  if(Array.isArray(value)){
    for(const item of value.slice(0,256)) collect(item,out,depth+1);
    return out;
  }
  if(typeof value==='object'){
    for(const item of Object.values(value).slice(0,256)) collect(item,out,depth+1);
  }
  return out;
}
function words(text){
  const out=[];
  for(const match of String(text??'').matchAll(WORD)) out.push({v:norm(match[0]),start:match.index,end:match.index+match[0].length});
  return out;
}
function mergeSpans(spans=[]){
  const sorted=[...spans].filter(s=>s.end>s.start).sort((a,b)=>a.start-b.start||b.end-a.end);
  const merged=[];
  for(const span of sorted){
    const last=merged.at(-1);
    if(!last||span.start>last.end) merged.push({...span});
    else last.end=Math.max(last.end,span.end);
  }
  return merged;
}
function copiedSpans(output,source,{minTokens=DEFAULT_MIN_TOKENS,minChars=DEFAULT_MIN_CHARS}={}){
  const a=words(output),b=words(source);
  const byToken=new Map();
  for(let j=0;j<b.length;j++){
    const xs=byToken.get(b[j].v)??[];xs.push(j);byToken.set(b[j].v,xs);
  }
  const spans=[];
  for(let i=0;i<a.length;i++){
    for(const j of byToken.get(a[i].v)??[]){
      let n=0;
      while(i+n<a.length&&j+n<b.length&&a[i+n].v===b[j+n].v)n++;
      if(n>=minTokens){
        const start=a[i].start,end=a[i+n-1].end;
        if(end-start>=minChars) spans.push({start,end});
      }
    }
  }
  return mergeSpans(spans);
}
function redact(text,spans){
  const merged=mergeSpans(spans);
  if(!merged.length)return {text,matches:0};
  let out='',cursor=0;
  for(const span of merged){out+=text.slice(cursor,span.start)+'[HUSH:PRIVATE]';cursor=span.end;}
  out+=text.slice(cursor);
  return {text:out,matches:merged.length};
}

/**
 * Deterministically removes copied spans from locally protected context before egress.
 * Defaults (7 contiguous tokens / 24 chars) were selected only on the opened
 * PrivacyLens development subset and frozen by v3 Amendment 1 before holdout access.
 */
export function guardOutboundValue(value,{protectedValues=[],mode='pseudonymous',minTokens=DEFAULT_MIN_TOKENS,minChars=DEFAULT_MIN_CHARS}={}){
  const sources=[...new Set((protectedValues??[]).flatMap(v=>collect(v)).filter(Boolean))];
  let matches=0;
  const walk=(item,depth=0)=>{
    if(depth>8)return '[HUSH:TRUNCATED]';
    if(typeof item==='string'){
      const spans=[];
      for(const source of sources)spans.push(...copiedSpans(item,source,{minTokens,minChars}));
      const result=redact(item,spans);
      matches+=result.matches;
      return result.text;
    }
    if(Array.isArray(item))return item.map(x=>walk(x,depth+1));
    if(item&&typeof item==='object'){
      const out={};
      for(const [key,child] of Object.entries(item))out[key]=walk(child,depth+1);
      return out;
    }
    return item;
  };
  const guarded=walk(structuredClone(value));
  const sanitized=sanitizeContextValue(guarded,{mode});
  return {...sanitized,protectedMatches:matches,protectedSourceCount:sources.length,verbatimPrivateCopyGuard:true};
}
