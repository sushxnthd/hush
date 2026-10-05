const CONTRAST=/\b(?:however|but|whereas|although|even though|nevertheless|nonetheless)\b/gi;
const ALLOW_RE=/\b(?:can|may|feel free to)\s+(?:share|disclose|discuss|mention|provide|refer)|\b(?:can|may)\s+be\s+(?:shared|disclosed|mentioned)|\bis\s+disclosable\b/i;
const DENY_RE=/\b(?:do not|don't|never|must not|should never)\s+(?:share|disclose|mention|provide|reveal)|\bkeep\b[^.!?;]{0,180}\b(?:private|confidential)\b|\b(?:off[- ]limits|completely private|completely confidential|confidential|private)\b/i;
const LIMITED_RE=/\b(?:only|broad|general|high[- ]level|summary|band|bucket|category|range|country|city|anonymous|anonym(?:ous|ized)|industry|type)\b/i;
const ABSTRACT_KEY_RE=/(?:^|_)(?:band|bucket|category|range|window|summary|country|city|industry|type|role)(?:_|$)/i;
const IDENTITY_PREFIXES=new Set(['customer','client','applicant','traveler','employee','policyholder','student','beneficiary','companion','landlord','opposing','party']);
const STOP=new Set(['my','the','a','an','of','to','for','and','or','their','your','our','is','are','be','in','on','at','with','about']);

function text(v){return String(v??'').trim();}
export function normalizeDisclosureText(v){
  return text(v).normalize('NFKC').toLowerCase()
    .replace(/[‐‑‒–—―]/g,'-')
    .replace(/[‘’‚‛]/g,"'")
    .replace(/[“”„‟]/g,'"')
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ').trim();
}
function stem(t){
  let s=t.toLowerCase();
  if(s.length>4&&s.endsWith('ies'))s=s.slice(0,-3)+'y';
  else if(s.length>4&&s.endsWith('es'))s=s.slice(0,-2);
  else if(s.length>3&&s.endsWith('s')&&!s.endsWith('ss'))s=s.slice(0,-1);
  return s;
}
function tokenSet(v){return new Set(normalizeDisclosureText(v).split(' ').filter(Boolean).filter(x=>!STOP.has(x)).map(stem));}
function human(key){return text(key).replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();}
function alias(value,weight=1){return {value,weight,tokens:tokenSet(value)};}
function dedupeAliases(rows){
  const m=new Map();
  for(const row of rows){const k=[...row.tokens].sort().join(' ');if(k&&!m.has(k))m.set(k,row);else if(k&&m.get(k).weight<row.weight)m.set(k,row);}
  return [...m.values()];
}
function keyParts(key){return text(key).toLowerCase().split(/[_-]+/).filter(Boolean);}

const SPECIAL_ALIASES={
  exact_dob:['exact date of birth','date of birth','dob'],
  exact_gpa:['exact gpa'],
  exact_monthly_income:['exact monthly income'],
  years_experience:['years of experience'],
  debt_to_income_band:['debt to income band','debt to income ratio band'],
  monthly_income_band:['monthly income band'],
  credit_score_band:['credit score band'],
  budget_band:['budget band','budget range'],
  travel_date_window:['travel date window','general date window','date window'],
  preferred_time:['preferred appointment time','preferred time'],
  current_employer:['current employer'],
  current_role:['current role'],
  target_role:['target role'],
  relevant_courses:['relevant courses'],
  research_interests:['research interests'],
  academic_standing:['academic standing'],
  degree_program:['degree program'],
  issue_category:['issue category','category of the issue'],
  product_area:['product area'],
  troubleshooting_steps:['troubleshooting steps'],
  customer_sentiment:['customer sentiment','overall sentiment'],
  private_legal_notes:['private legal notes','legal notes'],
  landlord_private_notes:['private landlord notes','landlord notes'],
  opposing_party_name:["opposing party name","opposing party's name"],
  companion_name:['companion name','names of companions','companions'],
  affected_system_type:['affected system type','type of system affected','kind of system affected'],
  severity_hint:['severity hint'],
  security_question_answer:['security question answer','security question answers'],
  payment_method_last4:['payment method details','payment method'],
  medical_history:['medical history'],
  medical_details:['medical details'],
  exact_itinerary:['exact itinerary'],
  home_address:['home address'],
  hotel_address:['hotel address'],
  ip_address:['ip address','ip addresses'],
  ip_range:['ip range','network range'],
  age_bucket:['age bucket','broad age','age categories'],
  location_country:['location country','country'],
  location_city:['location city','city']
};

export function fieldAliases(key,{mode='allow'}={}){
  const k=text(key).toLowerCase();
  const parts=keyParts(k);
  const rows=[alias(human(k),4)];
  for(const a of SPECIAL_ALIASES[k]??[]) rows.push(alias(a,5));

  // Exact/raw fields must not inherit broad aliases on an allow decision.
  const exactLike=parts.includes('exact')||parts.includes('raw');
  if(mode==='deny'){
    if(exactLike){
      const base=parts.filter(p=>p!=='exact'&&p!=='raw').join(' ');
      if(base)rows.push(alias(base,2));
    }
    const identityTail=parts.at(-1);
    if(['name','email','phone','address','id','number'].includes(identityTail)){
      rows.push(alias(identityTail==='id'?'id':identityTail,2));
      if(parts.length>1&&IDENTITY_PREFIXES.has(parts[0])) rows.push(alias(parts.slice(1).join(' '),3));
    }
    if(k==='exact_dob')rows.push(alias('birth date',2));
  }
  return dedupeAliases(rows);
}

export function policyClauses(policyText){
  const bounded=text(policyText).replace(CONTRAST,'. ');
  return bounded.split(/(?<=[.!?;])\s+|\n+/).map(x=>x.trim()).filter(Boolean).map((clause,index)=>{
    const allow=ALLOW_RE.test(clause);
    const deny=DENY_RE.test(clause);
    const limited=LIMITED_RE.test(clause);
    let polarity='unknown';
    if(deny&&!allow)polarity='deny';
    else if(allow&&!deny)polarity=limited?'limited':'allow';
    else if(deny&&allow)polarity='deny';
    return {index,clause,polarity,limited,tokens:tokenSet(clause)};
  });
}
function aliasScore(a,clause){
  if(!a.tokens.size)return 0;
  for(const t of a.tokens)if(!clause.tokens.has(t))return 0;
  return a.tokens.size*10+a.weight;
}
function strongestMatch(key,clauses,mode){
  const aliases=fieldAliases(key,{mode});
  let best=null;
  for(const clause of clauses){
    if(mode==='allow'&&!['allow','limited'].includes(clause.polarity))continue;
    if(mode==='deny'&&clause.polarity!=='deny')continue;
    for(const a of aliases){
      const score=aliasScore(a,clause);
      if(!score)continue;
      if(!best||score>best.score)best={score,clauseIndex:clause.index,polarity:clause.polarity,alias:a.value};
    }
  }
  return best;
}

export function compileDisclosurePolicy(policyText,fieldKeys){
  const clauses=policyClauses(policyText);
  const fields={};
  for(const rawKey of fieldKeys){
    const key=text(rawKey);
    const allow=strongestMatch(key,clauses,'allow');
    const deny=strongestMatch(key,clauses,'deny');
    let decision='deny';
    let reason='closed_world_default';
    if(allow){
      const limited=allow.polarity==='limited';
      const abstractKey=ABSTRACT_KEY_RE.test(key);
      if(!limited||abstractKey){decision='allow';reason=limited?'explicit_limited_allow':'explicit_allow';}
    }
    if(deny&&(decision!=='allow'||deny.score>=allow.score)){
      decision='deny';reason='explicit_deny';
    }
    fields[key]={decision,reason,allowEvidence:allow,denyEvidence:deny};
  }
  return {v:1,closedWorld:true,clauses:clauses.map(({tokens,...c})=>c),fields};
}

function atomValue(v){
  if(['string','number','boolean'].includes(typeof v))return String(v);
  return null;
}
function valueContains(hay,needle){
  const h=normalizeDisclosureText(hay),n=normalizeDisclosureText(needle);
  if(!n)return false;
  if(h===n)return true;
  if(n.length<4)return false;
  return (` ${h} `).includes(` ${n} `)||h.includes(n);
}
function taintSources(value,deniedAtoms,selfId){
  const hits=[];
  for(const atom of deniedAtoms){
    if(atom.id===selfId)continue;
    const secret=atomValue(atom.value);
    if(secret!==null&&valueContains(value,secret))hits.push(atom.id);
  }
  return hits;
}
function normalizedAtoms(atoms){
  if(!Array.isArray(atoms))throw new Error('atoms must be an array');
  return atoms.map((atom,index)=>{
    if(!atom||typeof atom!=='object')throw new Error('atom must be an object');
    const key=text(atom.key),value=atom.value;
    if(!key||atomValue(value)===null)throw new Error('atom key and scalar value are required');
    return {id:text(atom.id)||`atom_${index}`,key,value,provenance:text(atom.provenance)||key};
  });
}

/**
 * Disclosure Closure Compiler (DCC)
 *
 * Compiles natural-language disclosure policy into an allowlist over structured
 * local atoms, then closes every candidate output over denied-atom provenance.
 * Source prose and attacker text are never release channels.
 */
export function compileDisclosureClosure({policyText,atoms=[]}={}){
  const rows=normalizedAtoms(atoms);
  const policy=compileDisclosurePolicy(policyText,[...new Set(rows.map(r=>r.key))]);
  const classified=rows.map(atom=>({...atom,policy:policy.fields[atom.key]??{decision:'deny',reason:'closed_world_default'}}));
  const denied=classified.filter(x=>x.policy.decision!=='allow');
  const released=[],blocked=[];
  for(const atom of classified){
    if(atom.policy.decision!=='allow'){
      blocked.push({id:atom.id,key:atom.key,reason:atom.policy.reason});
      continue;
    }
    const value=atomValue(atom.value);
    const taint=taintSources(value,denied,atom.id);
    if(taint.length){
      blocked.push({id:atom.id,key:atom.key,reason:'disclosure_closure_taint',taintSources:taint});
      continue;
    }
    released.push({
      id:atom.id,key:atom.key,value:atom.value,
      statement:`${human(atom.key)}: ${value}.`,
      provenance:atom.provenance,
      policyReason:atom.policy.reason,
      taintSources:[],derivedDisclosure:true,rawSourceIncluded:false
    });
  }
  return {
    v:1,closedWorld:true,policy,
    released,blocked,
    text:released.map(r=>r.statement).join('\n'),
    rawSourceIncluded:false,
    attackerCanExpandClosure:false
  };
}
