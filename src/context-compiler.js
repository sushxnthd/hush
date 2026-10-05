const MAX_QUERY_LENGTH=240;
const MAX_TAGS=16;

export class ContextSelectionError extends Error {
  constructor(message,{code='context_selection_failed',candidateCount=undefined}={}){
    super(message);
    this.name='ContextSelectionError';
    this.code=code;
    if(candidateCount!==undefined) this.candidateCount=candidateCount;
  }
}

function text(value){ return String(value??'').trim(); }
function norm(value){ return text(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
function tokens(value){ return [...new Set(norm(value).split(/\s+/).filter(Boolean))]; }

function normalizeRef(ref){
  if(!ref||typeof ref!=='object'||Array.isArray(ref)) throw new ContextSelectionError('A semantic privateRef object is required.',{code:'invalid_private_ref'});
  const allowed=new Set(['query','category','tags','label']);
  for(const key of Object.keys(ref)) if(!allowed.has(key)) throw new ContextSelectionError('Unsupported privateRef selector field.',{code:'invalid_private_ref'});

  const query=text(ref.query);
  const category=text(ref.category);
  const label=text(ref.label);
  const tags=Array.isArray(ref.tags)?ref.tags.map(text).filter(Boolean):[];
  if(ref.tags!==undefined&&!Array.isArray(ref.tags)) throw new ContextSelectionError('privateRef.tags must be an array.',{code:'invalid_private_ref'});
  if(tags.length>MAX_TAGS) throw new ContextSelectionError(`privateRef supports at most ${MAX_TAGS} tags.`,{code:'invalid_private_ref'});
  if(query.length>MAX_QUERY_LENGTH||category.length>MAX_QUERY_LENGTH||label.length>MAX_QUERY_LENGTH||tags.some(tag=>tag.length>MAX_QUERY_LENGTH)) throw new ContextSelectionError('privateRef selector text is too long.',{code:'invalid_private_ref'});
  if(!query&&!category&&!label&&!tags.length) throw new ContextSelectionError('privateRef requires query, category, label, or tags.',{code:'invalid_private_ref'});
  return {query,category,label,tags};
}

function recordMetadata(record){
  return {
    id:text(record?.id),
    path:text(record?.path),
    label:text(record?.label),
    category:text(record?.category),
    tags:Array.isArray(record?.tags)?record.tags.map(text).filter(Boolean):[],
    partitionProtected:Boolean(record?.partitionProtected)
  };
}

function scoreRecord(record,ref){
  const category=norm(record.category);
  const label=norm(record.label);
  const tagSet=new Set(record.tags.map(norm));

  if(ref.category&&category!==norm(ref.category)) return null;
  if(ref.label&&label!==norm(ref.label)) return null;
  for(const tag of ref.tags) if(!tagSet.has(norm(tag))) return null;

  let score=0;
  if(ref.category) score+=20;
  if(ref.label) score+=30;
  score+=ref.tags.length*12;

  if(ref.query){
    const queryNorm=norm(ref.query);
    const q=tokens(ref.query);
    if(!q.length) return null;
    const labelTokens=new Set(tokens(record.label));
    const categoryTokens=new Set(tokens(record.category));
    const tagTokens=new Set(record.tags.flatMap(tokens));
    if(queryNorm&&queryNorm===label) score+=24;
    for(const token of q){
      if(labelTokens.has(token)) score+=6;
      if(tagTokens.has(token)) score+=5;
      if(categoryTokens.has(token)) score+=3;
    }
    if(score===0) return null;
  }
  return score;
}

/**
 * Resolve one user-owned private record from non-secret metadata. Selection is
 * intentionally fail-closed: no match or a top-score tie returns no private path.
 * Error messages expose only aggregate candidate counts, never record paths.
 */
export function resolvePrivateRef(records,privateRef){
  const ref=normalizeRef(privateRef);
  const candidates=[];
  for(const raw of Array.isArray(records)?records:[]){
    const record=recordMetadata(raw);
    if(!record.path) continue;
    const score=scoreRecord(record,ref);
    if(score===null) continue;
    candidates.push({record,score});
  }
  if(!candidates.length) throw new ContextSelectionError('No private context item matches this semantic selector.',{code:'context_not_found',candidateCount:0});
  candidates.sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id));
  const topScore=candidates[0].score;
  const top=candidates.filter(candidate=>candidate.score===topScore);
  if(top.length!==1) throw new ContextSelectionError('Private context selector is ambiguous; refine the capability description.',{code:'context_ambiguous',candidateCount:top.length});
  return top[0].record.path;
}

function compilePrivateSlot(records,node){
  if(!node||typeof node!=='object'||Array.isArray(node)) throw new ContextSelectionError('Private program clause must be an object.',{code:'invalid_program'});
  if(Object.hasOwn(node,'private')) throw new ContextSelectionError('Semantic private programs must use privateRef rather than a raw private path.',{code:'raw_path_forbidden'});
  if(!Object.hasOwn(node,'privateRef')) throw new ContextSelectionError('Semantic private program clause requires privateRef.',{code:'private_ref_required'});
  const {privateRef,...rest}=node;
  return {...structuredClone(rest),private:resolvePrivateRef(records,privateRef)};
}

/**
 * Compile a path-free semantic Private Decision Program into the existing bounded
 * PDP language. The compiled program is intended to stay inside ContextKernel.
 */
export function compileSemanticProgram(records,program){
  if(!program||typeof program!=='object'||Array.isArray(program)) throw new ContextSelectionError('Semantic private program must be an object.',{code:'invalid_program'});
  if(Object.hasOwn(program,'private')) throw new ContextSelectionError('Semantic private programs must not contain raw private paths.',{code:'raw_path_forbidden'});
  const kind=text(program.kind);

  if(kind==='predicate'||kind==='bucket') return compilePrivateSlot(records,program);

  if(kind==='choose'){
    if(Object.hasOwn(program,'privateRef')) throw new ContextSelectionError('Choose programs attach privateRef to constraints and preferences.',{code:'invalid_program'});
    const constraints=Array.isArray(program.constraints)?program.constraints.map(clause=>compilePrivateSlot(records,clause)):[];
    const preferences=Array.isArray(program.preferences)?program.preferences.map(clause=>compilePrivateSlot(records,clause)):[];
    return {
      ...structuredClone(program),
      constraints,
      preferences
    };
  }

  throw new ContextSelectionError('Unsupported semantic private program kind.',{code:'invalid_program'});
}
