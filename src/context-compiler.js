const MAX_QUERY_LENGTH=240;
const MAX_TASK_LENGTH=1000;
const MAX_TAGS=16;
const MAX_PRIVATE_FIELD_LENGTH=160;
const MAX_PRIVATE_FIELD_DEPTH=6;
const STOPWORDS=new Set(['a','an','and','are','as','at','be','by','can','do','for','from','i','in','is','it','me','my','of','on','or','that','the','this','to','with']);
const SYNONYMS=Object.freeze({
  price:['cost','budget','spend','amount'],cost:['price','budget','spend','amount'],budget:['price','cost','spend','amount'],
  airline:['carrier','flight'],carrier:['airline','flight'],flight:['airline','travel'],
  destination:['location','city','place','travel'],location:['destination','city','place'],city:['location','destination','place'],
  time:['schedule','date'],date:['time','schedule'],schedule:['time','date'],
  email:['contact','mail'],phone:['contact','telephone'],contact:['email','phone','person'],
  repo:['repository','github'],repository:['repo','github']
});
const FORBIDDEN_PRIVATE_FIELD_PARTS=new Set(['__proto__','prototype','constructor']);

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
function rawTokens(value){ return [...new Set(norm(value).split(/\s+/).filter(Boolean).filter(token=>!STOPWORDS.has(token)))]; }
function tokens(value){
  const out=new Set();
  for(const token of rawTokens(value)){
    out.add(token);
    for(const synonym of SYNONYMS[token]??[]) out.add(synonym);
  }
  return [...out];
}

function normalizeRef(ref,{fallbackQuery='',task=''}={}){
  const input=ref??{};
  if(typeof input!=='object'||Array.isArray(input)) throw new ContextSelectionError('privateRef must be an object.',{code:'invalid_private_ref'});
  const allowed=new Set(['query','category','tags','label']);
  for(const key of Object.keys(input)) if(!allowed.has(key)) throw new ContextSelectionError('Unsupported privateRef selector field.',{code:'invalid_private_ref'});

  const query=text(input.query||fallbackQuery);
  const category=text(input.category);
  const label=text(input.label);
  const tags=Array.isArray(input.tags)?input.tags.map(text).filter(Boolean):[];
  if(input.tags!==undefined&&!Array.isArray(input.tags)) throw new ContextSelectionError('privateRef.tags must be an array.',{code:'invalid_private_ref'});
  if(tags.length>MAX_TAGS) throw new ContextSelectionError(`privateRef supports at most ${MAX_TAGS} tags.`,{code:'invalid_private_ref'});
  if(query.length>MAX_QUERY_LENGTH||category.length>MAX_QUERY_LENGTH||label.length>MAX_QUERY_LENGTH||tags.some(tag=>tag.length>MAX_QUERY_LENGTH)) throw new ContextSelectionError('privateRef selector text is too long.',{code:'invalid_private_ref'});
  if(!query&&!category&&!label&&!tags.length&&!text(task)) throw new ContextSelectionError('privateRef requires a selector or task context.',{code:'invalid_private_ref'});
  return {query,category,label,tags};
}

function normalizePrivateField(value){
  const field=text(value);
  if(!field) return '';
  if(field.length>MAX_PRIVATE_FIELD_LENGTH) throw new ContextSelectionError('privateField is too long.',{code:'invalid_private_field'});
  const parts=field.split('.');
  if(parts.length>MAX_PRIVATE_FIELD_DEPTH) throw new ContextSelectionError(`privateField supports at most ${MAX_PRIVATE_FIELD_DEPTH} nested segments.`,{code:'invalid_private_field'});
  if(parts.some(part=>!part||FORBIDDEN_PRIVATE_FIELD_PARTS.has(part)||!/^[A-Za-z0-9_-]+$/.test(part))) throw new ContextSelectionError('privateField contains an unsafe path segment.',{code:'invalid_private_field'});
  return parts.join('.');
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

function tokenScore(record,query,{labelWeight=6,tagWeight=5,categoryWeight=3}={}){
  const q=tokens(query);
  if(!q.length) return 0;
  const labelTokens=new Set(tokens(record.label));
  const categoryTokens=new Set(tokens(record.category));
  const tagTokens=new Set(record.tags.flatMap(tokens));
  let score=0;
  for(const token of q){
    if(labelTokens.has(token)) score+=labelWeight;
    if(tagTokens.has(token)) score+=tagWeight;
    if(categoryTokens.has(token)) score+=categoryWeight;
  }
  return score;
}

function scoreRecord(record,ref,task){
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
    if(queryNorm&&queryNorm===label) score+=24;
    const queryScore=tokenScore(record,ref.query);
    if(queryScore===0) return null;
    score+=queryScore;
  }

  const taskScore=task?tokenScore(record,task,{labelWeight:2,tagWeight:1.5,categoryWeight:1}):0;
  score+=taskScore;
  if(!ref.query&&!ref.category&&!ref.label&&!ref.tags.length&&taskScore===0) return null;
  return score;
}

function roleHint(node){
  const candidate=text(node?.candidate);
  if(!candidate) return '';
  const kind=text(node?.kind);
  const op=text(node?.op);
  if(kind==='matchPrivate') return `preferred ${candidate}`;
  if(kind==='nearPrivate') return `preferred target ${candidate}`;
  if(kind==='preferPrivate') return `preferred ${candidate}`;
  if(/LtePrivate$/.test(op)||/privateGteCandidate$/.test(op)) return `maximum ${candidate}`;
  if(/GtePrivate$/.test(op)||/privateLteCandidate$/.test(op)) return `minimum ${candidate}`;
  return candidate;
}

/**
 * Resolve one user-owned private record from encrypted/non-secret metadata. The
 * optional task context acts only as a local ranking signal and is never returned.
 * Selection remains fail-closed on no match or an unresolved top-score tie.
 */
export function resolvePrivateRef(records,privateRef={},options={}){
  const task=text(options.task);
  if(task.length>MAX_TASK_LENGTH) throw new ContextSelectionError('Task context is too long.',{code:'invalid_task'});
  const ref=normalizeRef(privateRef,{fallbackQuery:options.fallbackQuery,task});
  const candidates=[];
  for(const raw of Array.isArray(records)?records:[]){
    const record=recordMetadata(raw);
    if(!record.path) continue;
    const score=scoreRecord(record,ref,task);
    if(score===null) continue;
    candidates.push({record,score});
  }
  if(!candidates.length) throw new ContextSelectionError('No private context item matches this semantic selector.',{code:'context_not_found',candidateCount:0});
  candidates.sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id));
  const topScore=candidates[0].score;
  const top=candidates.filter(candidate=>Math.abs(candidate.score-topScore)<1e-12);
  if(top.length!==1) throw new ContextSelectionError('Private context selector is ambiguous; refine the task or capability description.',{code:'context_ambiguous',candidateCount:top.length});
  return top[0].record.path;
}

function compilePrivateSlot(records,node,{task='',fallbackQuery=''}={}){
  if(!node||typeof node!=='object'||Array.isArray(node)) throw new ContextSelectionError('Private program clause must be an object.',{code:'invalid_program'});
  if(Object.hasOwn(node,'private')) throw new ContextSelectionError('Semantic private programs must use privateRef or task inference rather than a raw private path.',{code:'raw_path_forbidden'});
  const privateRef=Object.hasOwn(node,'privateRef')?node.privateRef:{};
  const privateField=normalizePrivateField(node.privateField);
  const {privateRef:_,privateField:__,...rest}=node;
  const root=resolvePrivateRef(records,privateRef,{task,fallbackQuery});
  return {...structuredClone(rest),private:privateField?`${root}.${privateField}`:root};
}

function compilePreference(records,node,{task=''}={}){
  if(!node||typeof node!=='object'||Array.isArray(node)) throw new ContextSelectionError('Preference clause must be an object.',{code:'invalid_program'});
  if(Object.hasOwn(node,'private')) throw new ContextSelectionError('Semantic private programs must use privateRef or task inference rather than a raw private path.',{code:'raw_path_forbidden'});
  const kind=text(node.kind);
  if(kind==='lowerPublic'||kind==='higherPublic'){
    if(Object.hasOwn(node,'privateRef')||Object.hasOwn(node,'privateField')) throw new ContextSelectionError('Public-only preferences must not include privateRef or privateField.',{code:'invalid_program'});
    return structuredClone(node);
  }
  return compilePrivateSlot(records,node,{task,fallbackQuery:roleHint(node)});
}

/**
 * Compile a path-free semantic Private Decision Program into the existing bounded
 * PDP language. v2 can use task context to infer a private record when privateRef
 * is omitted. `privateField` optionally binds a safe nested field inside that
 * selected record, enabling bounded computation over structured connector objects
 * without exposing either the connector path or the underlying value.
 */
export function compileSemanticProgram(records,program,{task=''}={}){
  if(!program||typeof program!=='object'||Array.isArray(program)) throw new ContextSelectionError('Semantic private program must be an object.',{code:'invalid_program'});
  if(Object.hasOwn(program,'private')) throw new ContextSelectionError('Semantic private programs must not contain raw private paths.',{code:'raw_path_forbidden'});
  const taskText=text(task);
  if(taskText.length>MAX_TASK_LENGTH) throw new ContextSelectionError('Task context is too long.',{code:'invalid_task'});
  const kind=text(program.kind);

  if(kind==='predicate'||kind==='bucket') return compilePrivateSlot(records,program,{task:taskText});

  if(kind==='choose'){
    if(Object.hasOwn(program,'privateRef')||Object.hasOwn(program,'privateField')) throw new ContextSelectionError('Choose programs attach privateRef/privateField to constraints and private preferences.',{code:'invalid_program'});
    const constraints=Array.isArray(program.constraints)?program.constraints.map(clause=>compilePrivateSlot(records,clause,{task:taskText,fallbackQuery:roleHint(clause)})):[];
    const preferences=Array.isArray(program.preferences)?program.preferences.map(clause=>compilePreference(records,clause,{task:taskText})):[];
    return {
      ...structuredClone(program),
      constraints,
      preferences
    };
  }

  throw new ContextSelectionError('Unsupported semantic private program kind.',{code:'invalid_program'});
}
