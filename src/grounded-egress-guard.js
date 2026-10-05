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
  if(!out.tokens.length)return {coverage:0,overlap:0,jaccard:0,weightedCoverage:0,matched:new Set()};
  let best={coverage:0,overlap:0,jaccard:0,weightedCoverage:0,matched:new Set()};
  for(const src of profiles){
    let overlap=0,weighted=0;
    const matched=new Set();
    for(const token of out.tokens){
      if(!src.set.has(token))continue;
      overlap++;weighted+=tokenWeight(token);matched.add(token);
    }
    if(!overlap)continue;
    const coverage=overlap/out.tokens.length;
    const union=new Set([...out.tokens,...src.tokens]).size;
    const jaccard=overlap/union;
    const weightedCoverage=weighted/Math.max(1,out.weight);
    const score=weightedCoverage+0.25*coverage+0.1*jaccard;
    const bestScore=best.weightedCoverage+0.25*best.coverage+0.1*best.jaccard;
    if(score>bestScore)best={coverage,overlap,jaccard,weightedCoverage,matched};
  }
  return best;
}
function shouldBlock(score,{minOverlapTokens,minCoverage,minWeightedCoverage,minJaccard}){
  if(score.overlap<minOverlapTokens)return false;
  if(score.coverage>=minCoverage&&score.weightedCoverage>=minWeightedCoverage)return true;
  return score.weightedCoverage>=Math.min(0.95,minWeightedCoverage+0.15)&&score.jaccard>=minJaccard;
}
function informationScore(token){
  let score=tokenWeight(token.v);
  if(/^\d/.test(token.raw))score+=0.75;
  if(/^\p{Lu}/u.test(token.raw))score+=0.35;
  if(token.v.length>=10)score+=0.25;
  return score;
}
function surgicalSpans(segment,matched,{maskFraction,minMaskTokens,maxMaskTokens}){
  const candidates=contentTokens(segment).filter(token=>matched.has(token.v));
  if(!candidates.length)return [];
  const stems=[...new Set(candidates.map(token=>token.v))];
  const representative=new Map();
  for(const token of candidates){
    const prior=representative.get(token.v);
    if(!prior||informationScore(token)>informationScore(prior))representative.set(token.v,token);
  }
  const ranked=[...representative.values()].sort((a,b)=>informationScore(b)-informationScore(a)||b.raw.length-a.raw.length||a.start-b.start);
  const wanted=Math.min(maxMaskTokens,Math.max(minMaskTokens,Math.ceil(stems.length*maskFraction)));
  const selected=new Set(ranked.slice(0,wanted).map(token=>token.v));
  return candidates.filter(token=>selected.has(token.v)).map(token=>({start:token.start,end:token.end}));
}
function mergeSpans(spans){
  const sorted=spans.slice().sort((a,b)=>a.start-b.start||a.end-b.end);
  const merged=[];
  for(const span of sorted){
    const last=merged.at(-1);
    if(!last||span.start>last.end)merged.push({...span});
    else last.end=Math.max(last.end,span.end);
  }
  return merged;
}
function redactSpans(text,spans,label='[HUSH:PRIVATE]'){
  if(!spans.length)return text;
  let out='',cursor=0;
  for(const span of mergeSpans(spans)){out+=text.slice(cursor,span.start)+label;cursor=span.end;}
  return out+text.slice(cursor);
}
function guardString(text,profiles,options){
  const spans=[];let matches=0,maxScore={coverage:0,overlap:0,jaccard:0,weightedCoverage:0,matched:new Set()};
  for(const seg of segments(text)){
    if(seg.text.length<options.minChars)continue;
    const score=bestGrounding(seg.text,profiles);
    if(score.weightedCoverage>maxScore.weightedCoverage)maxScore=score;
    if(!shouldBlock(score,options))continue;
    matches++;
    if(options.redactionStrategy==='clause'){
      spans.push({start:seg.start,end:seg.end});
      continue;
    }
    for(const span of surgicalSpans(seg.text,score.matched,options))spans.push({start:seg.start+span.start,end:seg.start+span.end});
  }
  return {text:redactSpans(text,spans,options.redactionStrategy==='clause'?'[HUSH:PRIVATE CONTEXT]':'[HUSH:PRIVATE]'),matches,maxScore};
}

/**
 * Source-grounded local egress defense.
 *
 * A clause is considered for redaction only when it is substantially grounded
 * in protected context that has already entered the local agent. The default
 * "surgical" strategy then masks a small, high-information subset of the
 * source-grounded content words instead of deleting the whole clause. This
 * preserves unrelated task content and sentence structure while removing the
 * identifying or predicate-bearing evidence that made the clause private.
 */
export function guardGroundedOutboundValue(value,{
  protectedValues=[],mode='pseudonymous',minOverlapTokens=4,minCoverage=0.62,
  minWeightedCoverage=0.66,minJaccard=0.18,minChars=20,
  redactionStrategy='surgical',maskFraction=0.4,minMaskTokens=2,maxMaskTokens=6
}={}){
  if(!['surgical','clause'].includes(redactionStrategy))throw new Error(`Unsupported grounded redaction strategy: ${redactionStrategy}`);
  if(!Number.isFinite(maskFraction)||maskFraction<=0||maskFraction>1)throw new Error('maskFraction must be in (0, 1]');
  const profiles=sourceProfiles(protectedValues);
  let matches=0,maxWeightedCoverage=0;
  const walk=(item,depth=0)=>{
    if(depth>8)return '[HUSH:TRUNCATED]';
    if(typeof item==='string'){
      const result=guardString(item,profiles,{minOverlapTokens,minCoverage,minWeightedCoverage,minJaccard,minChars,redactionStrategy,maskFraction,minMaskTokens,maxMaskTokens});
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
  return {...sanitized,groundedMatches:matches,protectedProfileCount:profiles.length,maxGroundedWeightedCoverage:maxWeightedCoverage,groundedContextGuard:true,groundedRedactionStrategy:redactionStrategy};
}
