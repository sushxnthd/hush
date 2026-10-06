import {norm} from '../polar-p1/evaluate.mjs';
import {policyClauses,provenanceErasedFacts,humanField,MUST_DERIVE} from '../pcc-v2/policy_compiler_v2.mjs';
import {policyAllowsFieldV3} from '../pcc-v3/policy_compiler_v3.mjs';

const POS=/\b(?:can share|may share|can disclose|may disclose|can discuss|may discuss|can mention|may mention|can be shared|is okay to share|okay to share)\b/;
const PRE_DENY='(?:do not|don t|never|keep|must not|should not|cannot|can t)';
const POST_DENY='(?:private|confidential|off limits|off-limits|must not be disclosed|should not be disclosed|must not be shared|should not be shared|cannot be shared|can t be shared)';

const BAND_RULES={
  credit_score_band:{
    allow:[/\bcredit score\b[^.]*\b(?:only )?(?:as|in terms of|in) (?:a )?band\b/,/\bcredit score band\b/],
    objects:['credit score band','banded credit score']
  },
  income_band:{
    allow:[/\bincome\b[^.]*\b(?:only )?(?:as|in terms of|in) (?:an? )?(?:income )?band\b/,/\bincome band\b/],
    objects:['income band','banded income']
  },
  monthly_income_band:{
    allow:[/\b(?:monthly )?income\b[^.]*\b(?:only )?(?:as|in terms of|in) (?:an? )?(?:monthly )?income band\b/,/\bmonthly income band\b/],
    objects:['monthly income band','banded monthly income']
  }
};

function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function explicitBandAllow(policy,key){
  const rule=BAND_RULES[key];if(!rule)return false;
  return policyClauses(policy).some(clause=>POS.test(clause)&&rule.allow.some(re=>re.test(clause)));
}
function objectScopedBandDeny(clause,object){
  const o=esc(object);
  // Bind negative force to the abstraction object itself. This intentionally does
  // not treat a later phrase such as "never the exact amount" as a denial of a
  // previously permitted band.
  const before=new RegExp(`\\b${PRE_DENY}\\b(?:\\s+\\w+){0,6}\\s+${o}\\b`);
  const after=new RegExp(`\\b${o}\\b(?:\\s+\\w+){0,6}\\s+\\b${POST_DENY}\\b`);
  return before.test(clause)||after.test(clause);
}
function explicitBandDeny(policy,key){
  const rule=BAND_RULES[key];if(!rule)return false;
  return policyClauses(policy).some(clause=>rule.objects.some(object=>objectScopedBandDeny(clause,object)));
}

export function policyAllowsFieldV4(policy,key){
  if(MUST_DERIVE.has(key))return false;
  // A direct denial of the abstraction itself is absolute.
  if(explicitBandDeny(policy,key))return false;
  // A user may deny an exact value while explicitly permitting only its abstraction.
  // The override applies only to the already-derived band field, never the raw source.
  if(explicitBandAllow(policy,key))return true;
  return policyAllowsFieldV3(policy,key);
}

export function compileDisclosureV4(record){
  const policy=record?.generated_texts?.privacy_policy_text??'';
  const facts=provenanceErasedFacts(record),seen=new Set(),chosen=[];
  for(const row of facts){
    if(!policyAllowsFieldV4(policy,row.key))continue;
    const sig=norm(row.value);if(!sig||seen.has(sig))continue;
    seen.add(sig);chosen.push({row,text:`${humanField(row.key)}: ${row.value}.`});
  }
  return {facts,chosen,text:chosen.map(x=>x.text).join('\n')};
}

export function pccV4Summary(){return {version:'pcc-v4',abstractionAwareBands:Object.keys(BAND_RULES),rawValueOverride:false,objectScopedDeny:true,usesScoringTargets:false};}
