import {sanitizeContextValue} from './context-sanitizer.js';

const WORD=/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;
const STOP=new Set(`a an and are as at be been being but by can could did do does doing for from had has have having he her hers herself him himself his how i if in into is it its itself may me might more most my myself no nor not of on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves`.split(/\s+/));

function norm(value){return String(value??'').normalize('NFKC').toLowerCase();}
function stem(token){
  let t=norm(token).replace(/[’']s$/,'');
  if(t.length>6&&t.endsWith('ies'))t=t.slice(0,-3)+'y';
  else if(t.length>6&&t.endsWith('ing'))t=t.slice(0,-3);
  else if(t.length>5&&t.endsWith('ed'))t=t.slice(0,-2);
  else if(t.length>5&&t.endsWith('es'))t=t.slice(0,-2);
  else if(t.length>4&&t.endsWith('s')&&!t.endsWith('ss'))t=t.slice(0,-1);
  return t;
}
function contentTokens(text){
  const out=[];
  for(const match of String(text??'').matchAll(WORD)){
    const raw=match[0],v=stem(raw);
    if(!v||STOP.has(v)||(/^\D+$/.test(v)&&v.length<3))continue;
    out.push({v,start:match.index,end:match.index+raw.length,raw});
  }
  return out;
}
function collect(value,out=[],depth=0){
  if(depth>8||value==null||typeof value==='boolean')return out;
  if(typeof value==='string'||typeof value==='number'){
    const s=String(value).trim();if(s)out.push(s);return out;
  }
  if(Array.isArray(value)){for(const item of value.slice(0,256))collect(item,out,depth+1);return out;}
  if(typeof value==='object')for(const item of Object.values(value).slice(0,256))collect(item,out,depth+1);
  return out;
}
function segments(text){
  const s=String(text??'');
  const out=[];
  const re=/[^.!?;\n]+(?:[.!?;]+|\n|$)/g;
  let m;
  while((m=re.exec(s))!==null){
    const raw=m[0];
    const lead=raw.search(/\S/);
    if(lead<0)continue;
    const trail=raw.length-raw.trimEnd().length;
    const start=m.index+lead,end=m.index+raw.length-trail;
    if(end>start)out.push({start,end,text:s.slice(start,end)});
  }
  if(!out.length&&s.trim()){
    const start=s.search(/\S/);out.push({start,end:s.trimEnd().length,text:s.trim()});
  }
  return out;
}
function uniqueTokens(text){return [...new Set(contentTokens(text).map(t=>t.v))];}
function tokenWeight(token){
  if(/^\d/.test(token))return 1.8;
  if(token.length>=9)return 1.6;
  if(token.length>=6)return 1.3;
  return 1;
}
function profile(text){
  const tokens=uniqueTokens(text);
  return {tokens,set:new Set(tokens),weight:tokens.reduce((s,t)=>s+tokenWeight(t),0)};
}
function sourceProfiles(protectedValues){
  const texts=[...new Set((protectedValues??[]).flatMap(v=>collect(v)).map(x=>String(x).trim()).filter(Boolean))];
  const profiles=[];
  for(const text of texts){
    for(const seg of segments(text)){
      const p=profile(seg.text);
      if(p.tokens.length>=2)profiles.push(p);
    }
    const whole=profile(text);
    if(whole.tokens.length>=2)profiles.push(whole);
  }
  return profiles;
}
function bestGrounding(text,profiles){
  const out=profile(text);
  if(!out.tokens.length)return {coverage:0,overlap:0,jaccard:0,weightedCoverage:0};
  let best={coverage:0,overlap:0,jaccard:0,weightedCoverage:0};
  for(const src of profiles){
    let overlap=0,weighted=0;
    for(const token of out.tokens)if(src.set.has(token)){overlap++;weighted+=tokenWeight(token);}
    if(!overlap)continue;
    const coverage=overlap/out.tokens.length;
    const union=new Set([...out.tokens,...src.tokens]).size;
    const jaccard=overlap/union;
    const weightedCoverage=weighted/Math.max(1,out.weight);
    const score=weightedCoverage+0.25*coverage+0.1*jaccard;
    const bestScore=best.weightedCoverage+0.25*best.coverage+0.1*best.jaccard;
    if(score>bestScore)best={coverage,overlap,jaccard,weightedCoverage};
  }
  return best;
}
function shouldBlock(score,{minOverlapTokens,minCoverage,minWeightedCoverage,minJaccard}){
  if(score.overlap<minOverlapTokens)return false;
  if(score.coverage>=minCoverage&&score.weightedCoverage>=minWeightedCoverage)return true;
  return score.weightedCoverage>=Math.min(0.95,minWeightedCoverage+0.15)&&score.jaccard>=minJaccard;
}
function guardString(text,profiles,options){
  const spans=[];let maxScore={coverage:0,overlap:0,jaccard:0,weightedCoverage:0};
  for(const seg of segments(text)){
    if(seg.text.length<options.minChars)continue;
    const score=bestGrounding(seg.text,profiles);
    if(score.weightedCoverage>maxScore.weightedCoverage)maxScore=score;
    if(shouldBlock(score,options))spans.push({start:seg.start,end:seg.end});
  }
  if(!spans.length)return {text,matches:0,maxScore};
  spans.sort((a,b)=>a.start-b.start||a.end-b.end);
  const merged=[];
  for(const span of spans){
    const last=merged.at(-1);
    if(!last||span.start>last.end)merged.push({...span});
    else last.end=Math.max(last.end,span.end);
  }
  let out='',cursor=0;
  for(const span of merged){out+=text.slice(cursor,span.start)+'[HUSH:PRIVATE CONTEXT]';cursor=span.end;}
  out+=text.slice(cursor);
  return {text:out,matches:merged.length,maxScore};
}

/**
 * Source-grounded local egress defense.
 *
 * It does not try to decide whether arbitrary text is sensitive. Instead it
 * asks a narrower question Hush can answer locally: is an outbound clause
 * substantially grounded in protected context that entered through trusted
 * local source channels? High-overlap clauses are removed before the normal
 * pseudonymizing sanitizer runs. This catches paraphrased/context-derived facts
 * that exact-copy matching misses while leaving unrelated output untouched.
 */
export function guardGroundedOutboundValue(value,{
  protectedValues=[],mode='pseudonymous',minOverlapTokens=4,minCoverage=0.62,
  minWeightedCoverage=0.66,minJaccard=0.18,minChars=20
}={}){
  const profiles=sourceProfiles(protectedValues);
  let matches=0,maxWeightedCoverage=0;
  const walk=(item,depth=0)=>{
    if(depth>8)return '[HUSH:TRUNCATED]';
    if(typeof item==='string'){
      const result=guardString(item,profiles,{minOverlapTokens,minCoverage,minWeightedCoverage,minJaccard,minChars});
      matches+=result.matches;maxWeightedCoverage=Math.max(maxWeightedCoverage,result.maxScore.weightedCoverage);
      return result.text;
    }
    if(Array.isArray(item))return item.map(x=>walk(x,depth+1));
    if(item&&typeof item==='object'){
      const out={};for(const [key,child] of Object.entries(item))out[key]=walk(child,depth+1);return out;
    }
    return item;
  };
  const guarded=walk(structuredClone(value));
  const sanitized=sanitizeContextValue(guarded,{mode});
  return {...sanitized,groundedMatches:matches,protectedProfileCount:profiles.length,maxGroundedWeightedCoverage:maxWeightedCoverage,groundedContextGuard:true};
}
