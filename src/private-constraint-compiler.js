import {canonicalize,sha256} from './core.js';

const MAX_ID=96;
const MAX_LABEL=160;
const MAX_ANCHORS=12;
const MAX_ALIAS=80;
const MAX_SOURCE_TEXT=16000;
const MAX_ENUM_VALUES=32;
const OPERATORS=new Set(['eq','neq','gt','gte','lt','lte','between']);
const KINDS=new Set(['number','enum','boolean','date_bucket']);
const RELEASE_OPS=new Set(['identity','compare','bucket']);
const SAFE_SEGMENT=/[^.!?\n]+(?:[.!?]+|$)/g;
const DISCOURSE_BOUNDARY=/\s*,?\s*\b(?:although|however|whereas|even\s+though|but|nevertheless|nonetheless)\b\s*/gi;
const FORBIDDEN_PATH_PARTS=new Set(['__proto__','prototype','constructor']);

export class ConstraintCompilationError extends Error{
  constructor(message,{code='constraint_compilation_failed'}={}){
    super(message);
    this.name='ConstraintCompilationError';
    this.code=code;
  }
}

function text(value){ return String(value??'').trim(); }
function norm(value){ return text(value).toLowerCase().replace(/[^a-z0-9.%+-]+/g,' ').replace(/\s+/g,' ').trim(); }
function uniq(values){ return [...new Set(values)]; }
function boundedText(value,max,label){
  const out=text(value);
  if(!out||out.length>max) throw new ConstraintCompilationError(`${label} is missing or too long.`,{code:'invalid_constraint_contract'});
  return out;
}
function normalizePath(value){
  const raw=text(value);
  if(!raw) return '';
  const parts=raw.split('.');
  if(parts.length>6||parts.some(part=>!part||FORBIDDEN_PATH_PARTS.has(part)||!/^[A-Za-z0-9_-]+$/.test(part))) throw new ConstraintCompilationError('privateField is unsafe.',{code:'invalid_constraint_contract'});
  return parts.join('.');
}
function atPath(value,path){
  if(!path) return value;
  let current=value;
  for(const part of path.split('.')){
    if(current==null||typeof current!=='object'||Array.isArray(current)||!Object.hasOwn(current,part)) throw new ConstraintCompilationError('Constraint privateField is unavailable.',{code:'constraint_source_missing'});
    current=current[part];
  }
  return current;
}
function normalizeWords(values,label,limit=MAX_ANCHORS){
  if(values===undefined) return [];
  if(!Array.isArray(values)||values.length>limit) throw new ConstraintCompilationError(`${label} must be a bounded array.`,{code:'invalid_constraint_contract'});
  return uniq(values.map(value=>boundedText(value,MAX_ALIAS,label)).map(norm).filter(Boolean));
}
function normalizePrivateRef(value){
  const ref=value??{};
  if(typeof ref!=='object'||Array.isArray(ref)) throw new ConstraintCompilationError('privateRef must be an object.',{code:'invalid_constraint_contract'});
  const allowed=new Set(['query','category','tags','label']);
  for(const key of Object.keys(ref)) if(!allowed.has(key)) throw new ConstraintCompilationError('privateRef contains an unsupported selector.',{code:'invalid_constraint_contract'});
  return structuredClone(ref);
}
function normalizeEnumValues(values){
  if(!Array.isArray(values)||!values.length||values.length>MAX_ENUM_VALUES) throw new ConstraintCompilationError('Enum extractor requires a bounded values list.',{code:'invalid_constraint_contract'});
  const out=[];
  const seen=new Set();
  for(const row of values){
    if(!row||typeof row!=='object'||Array.isArray(row)) throw new ConstraintCompilationError('Enum values must be objects.',{code:'invalid_constraint_contract'});
    const value=boundedText(row.value,MAX_ALIAS,'enum value');
    if(seen.has(value)) throw new ConstraintCompilationError('Enum values must be unique.',{code:'invalid_constraint_contract'});
    seen.add(value);
    const label=boundedText(row.label??value,MAX_LABEL,'enum label');
    const aliases=normalizeWords(row.aliases??[value,label],'enum aliases',MAX_ENUM_VALUES);
    out.push({value,label,aliases:uniq([norm(value),norm(label),...aliases]).filter(Boolean)});
  }
  return out;
}
function normalizeExtractor(extractor={}){
  if(!extractor||typeof extractor!=='object'||Array.isArray(extractor)) throw new ConstraintCompilationError('extractor must be an object.',{code:'invalid_constraint_contract'});
  const kind=text(extractor.kind);
  if(!KINDS.has(kind)) throw new ConstraintCompilationError('Unsupported constraint extractor kind.',{code:'invalid_constraint_contract'});
  const common={kind,anchors:normalizeWords(extractor.anchors??[],'anchors')};
  if(kind==='number'){
    const min=extractor.min===undefined?null:Number(extractor.min);
    const max=extractor.max===undefined?null:Number(extractor.max);
    if((min!==null&&!Number.isFinite(min))||(max!==null&&!Number.isFinite(max))||(min!==null&&max!==null&&min>max)) throw new ConstraintCompilationError('Invalid numeric bounds.',{code:'invalid_constraint_contract'});
    return {...common,units:normalizeWords(extractor.units??[],'units'),min,max};
  }
  if(kind==='enum') return {...common,values:normalizeEnumValues(extractor.values)};
  if(kind==='boolean'){
    const truthy=normalizeWords(extractor.truthy??['true','yes','valid','current','enabled','available','ready'],'truthy',MAX_ENUM_VALUES);
    const falsy=normalizeWords(extractor.falsy??['false','no','invalid','expired','disabled','unavailable','not ready'],'falsy',MAX_ENUM_VALUES);
    if(!truthy.length||!falsy.length) throw new ConstraintCompilationError('Boolean extractor requires truthy and falsy aliases.',{code:'invalid_constraint_contract'});
    return {...common,truthy,falsy};
  }
  const granularity=text(extractor.granularity||'month');
  if(!['day','month','year'].includes(granularity)) throw new ConstraintCompilationError('Invalid date bucket granularity.',{code:'invalid_constraint_contract'});
  return {...common,granularity};
}
function normalizeRelease(release={},kind){
  if(!release||typeof release!=='object'||Array.isArray(release)) throw new ConstraintCompilationError('release must be an object.',{code:'invalid_constraint_contract'});
  const op=text(release.op||'identity');
  if(!RELEASE_OPS.has(op)) throw new ConstraintCompilationError('Unsupported release operation.',{code:'invalid_constraint_contract'});
  const label=boundedText(release.label,MAX_LABEL,'release label');
  const unit=release.unit===undefined?'':text(release.unit);
  if(unit.length>32) throw new ConstraintCompilationError('Release unit is too long.',{code:'invalid_constraint_contract'});
  if(op==='compare'){
    const operator=text(release.operator);
    if(!OPERATORS.has(operator)||release.arg===undefined) throw new ConstraintCompilationError('Invalid compare release.',{code:'invalid_constraint_contract'});
    return {op,label,unit,operator,arg:structuredClone(release.arg),trueLabel:text(release.trueLabel||'yes'),falseLabel:text(release.falseLabel||'no')};
  }
  if(op==='bucket'){
    if(kind!=='number'||!Array.isArray(release.edges)||!Array.isArray(release.labels)||release.labels.length!==release.edges.length+1) throw new ConstraintCompilationError('Bucket release requires numeric N edges and N+1 labels.',{code:'invalid_constraint_contract'});
    const edges=release.edges.map(Number);
    if(edges.some(value=>!Number.isFinite(value))||edges.some((value,index)=>index>0&&value<=edges[index-1])) throw new ConstraintCompilationError('Bucket edges must be finite and increasing.',{code:'invalid_constraint_contract'});
    return {op,label,unit,edges,labels:release.labels.map(value=>boundedText(value,MAX_LABEL,'bucket label'))};
  }
  return {op,label,unit};
}

export function normalizeConstraintContract(contract={}){
  if(!contract||typeof contract!=='object'||Array.isArray(contract)) throw new ConstraintCompilationError('Constraint contract must be an object.',{code:'invalid_constraint_contract'});
  const id=boundedText(contract.id,MAX_ID,'contract id');
  if(!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) throw new ConstraintCompilationError('Constraint contract id contains unsafe characters.',{code:'invalid_constraint_contract'});
  const privateRef=normalizePrivateRef(contract.privateRef);
  const privateField=normalizePath(contract.privateField);
  const extractor=normalizeExtractor(contract.extractor);
  const release=normalizeRelease(contract.release,extractor.kind);
  return {v:1,id,privateRef,privateField,extractor,release};
}

function sourceSegments(value){
  const source=text(value);
  if(!source) throw new ConstraintCompilationError('Constraint source is empty.',{code:'constraint_source_missing'});
  if(source.length>MAX_SOURCE_TEXT) throw new ConstraintCompilationError('Constraint source exceeds the local compilation bound.',{code:'constraint_source_too_large'});
  // Contrastive discourse often fuses authoritative task evidence with hearsay,
  // incentives, or personal context. Treat those markers as boundaries, never as
  // a signal that either side is true. Trusted anchors still decide relevance.
  const bounded=source.replace(DISCOURSE_BOUNDARY,'. ');
  return bounded.match(SAFE_SEGMENT)?.map(text).filter(Boolean)??[bounded];
}
function anchorScore(segment,anchors){
  if(!anchors.length) return 1;
  const n=norm(segment);
  let score=0;
  for(const anchor of anchors) if(n.includes(anchor)) score+=1;
  return score;
}
function bestSegments(value,anchors){
  const rows=sourceSegments(value).map(segment=>({segment,score:anchorScore(segment,anchors)}));
  if(!anchors.length) return rows;
  const max=Math.max(...rows.map(row=>row.score));
  if(max===0) throw new ConstraintCompilationError('No source segment satisfies the contract anchors.',{code:'constraint_evidence_missing'});
  return rows.filter(row=>row.score===max);
}
function unitPattern(units){
  if(!units.length) return '';
  return `(?:${units.map(unit=>unit.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')).join('|')})`;
}
function numericCandidates(value,extractor){
  if(typeof value==='number') return Number.isFinite(value)?[value]:[];
  const unit=unitPattern(extractor.units);
  const rows=[];
  for(const {segment} of bestSegments(value,extractor.anchors)){
    const re=unit?new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*${unit}\\b`,'gi'):/(-?\d+(?:\.\d+)?)/g;
    for(const match of segment.matchAll(re)) rows.push(Number(match[1]));
  }
  return uniq(rows.filter(Number.isFinite).filter(candidate=>(extractor.min===null||candidate>=extractor.min)&&(extractor.max===null||candidate<=extractor.max)));
}
function extractNumber(value,extractor){
  const candidates=numericCandidates(value,extractor);
  if(!candidates.length) throw new ConstraintCompilationError('No numeric evidence satisfies the contract.',{code:'constraint_evidence_missing'});
  if(candidates.length!==1) throw new ConstraintCompilationError('Numeric evidence is ambiguous.',{code:'constraint_evidence_ambiguous'});
  return candidates[0];
}
function extractEnum(value,extractor){
  if(typeof value!=='string'&&typeof value!=='number'&&typeof value!=='boolean') throw new ConstraintCompilationError('Enum source must be scalar.',{code:'constraint_source_type'});
  const haystacks=bestSegments(value,extractor.anchors).map(row=>norm(row.segment));
  const matches=[];
  for(const item of extractor.values){
    if(haystacks.some(hay=>item.aliases.some(alias=>hay===alias||hay.includes(alias)))) matches.push(item.value);
  }
  const unique=uniq(matches);
  if(!unique.length) throw new ConstraintCompilationError('No enum evidence satisfies the contract.',{code:'constraint_evidence_missing'});
  if(unique.length!==1) throw new ConstraintCompilationError('Enum evidence is ambiguous.',{code:'constraint_evidence_ambiguous'});
  return unique[0];
}
function extractBoolean(value,extractor){
  if(typeof value==='boolean') return value;
  const haystacks=bestSegments(value,extractor.anchors).map(row=>norm(row.segment));
  const yes=haystacks.some(hay=>extractor.truthy.some(alias=>hay===alias||hay.includes(alias)));
  const no=haystacks.some(hay=>extractor.falsy.some(alias=>hay===alias||hay.includes(alias)));
  if(yes===no) throw new ConstraintCompilationError(yes?'Boolean evidence is ambiguous.':'No boolean evidence satisfies the contract.',{code:yes?'constraint_evidence_ambiguous':'constraint_evidence_missing'});
  return yes;
}
function extractDateBucket(value,extractor){
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) throw new ConstraintCompilationError('Date evidence is unavailable.',{code:'constraint_evidence_missing'});
  const y=date.getUTCFullYear();
  const m=String(date.getUTCMonth()+1).padStart(2,'0');
  const d=String(date.getUTCDate()).padStart(2,'0');
  return extractor.granularity==='year'?String(y):extractor.granularity==='month'?`${y}-${m}`:`${y}-${m}-${d}`;
}
function extractTyped(value,extractor){
  if(extractor.kind==='number') return extractNumber(value,extractor);
  if(extractor.kind==='enum') return extractEnum(value,extractor);
  if(extractor.kind==='boolean') return extractBoolean(value,extractor);
  return extractDateBucket(value,extractor);
}
function compare(value,operator,arg){
  if(operator==='eq') return value===arg;
  if(operator==='neq') return value!==arg;
  if(operator==='gt') return value>arg;
  if(operator==='gte') return value>=arg;
  if(operator==='lt') return value<arg;
  if(operator==='lte') return value<=arg;
  if(operator==='between'){
    if(!Array.isArray(arg)||arg.length!==2) throw new ConstraintCompilationError('between comparison requires [min,max].',{code:'invalid_constraint_contract'});
    return value>=arg[0]&&value<=arg[1];
  }
  throw new ConstraintCompilationError('Unsupported comparison operator.',{code:'invalid_constraint_contract'});
}
function enumLabel(extractor,value){ return extractor.values?.find(item=>item.value===value)?.label??String(value); }
function renderIdentity(value,contract){
  const {extractor,release}=contract;
  const printable=extractor.kind==='enum'?enumLabel(extractor,value):extractor.kind==='boolean'?(value?'yes':'no'):String(value);
  return {value,statement:`${release.label}: ${printable}${release.unit?` ${release.unit}`:''}.`,releaseKind:'identity'};
}
function renderRelease(value,contract){
  const {release}=contract;
  if(release.op==='identity') return renderIdentity(value,contract);
  if(release.op==='compare'){
    const result=compare(value,release.operator,release.arg);
    return {value:result,statement:`${release.label}: ${result?release.trueLabel:release.falseLabel}.`,releaseKind:'compare'};
  }
  let index=0;
  while(index<release.edges.length&&value>=release.edges[index]) index+=1;
  const bucket=release.labels[index];
  return {value:bucket,statement:`${release.label}: ${bucket}.`,releaseKind:'bucket'};
}

export function compilePrivateConstraint(privateValue,rawContract){
  const contract=normalizeConstraintContract(rawContract);
  const selected=atPath(privateValue,contract.privateField);
  const extracted=extractTyped(selected,contract.extractor);
  const released=renderRelease(extracted,contract);
  return {
    v:1,
    contractId:contract.id,
    valueType:typeof released.value,
    value:structuredClone(released.value),
    statement:released.statement,
    releaseKind:released.releaseKind,
    sourceDigest:sha256(canonicalize(selected)),
    contractDigest:sha256(canonicalize(contract)),
    rawSourceIncluded:false,
    rawPrivatePathIncluded:false,
    derivedDisclosure:true
  };
}

export function constraintContractSummary(rawContract){
  const contract=normalizeConstraintContract(rawContract);
  return {
    id:contract.id,
    extractorKind:contract.extractor.kind,
    releaseKind:contract.release.op,
    outputLabel:contract.release.label,
    hasPrivateField:Boolean(contract.privateField),
    selector:{...contract.privateRef}
  };
}
