import {norm} from '../polar-p1/evaluate.mjs';
import {policyClauses,provenanceErasedFacts,humanField,MUST_DERIVE} from '../pcc-v2/policy_compiler_v2.mjs';
import {policyAllowsFieldV3} from '../pcc-v3/policy_compiler_v3.mjs';

const NEG=/\b(?:do not|don t|never|keep|private|confidential|off limits|off-limits|should not|not be disclosed|must not|cannot share|can t share|without revealing)\b/;
const POS=/\b(?:can share|may share|can disclose|may disclose|can discuss|may discuss|can mention|may mention|can be shared|is okay to share|okay to share)\b/;

const BAND_RULES={
  credit_score_band:{
    allow:[/\bcredit score\b[^.]*\b(?:only )?(?:as|in terms of|in) (?:a )?band\b/,/\bcredit score band\b/],
    deny:[/\bcredit score band\b/,/\bband(?:ed)? credit score\b/]
  },
  income_band:{
    allow:[/\bincome\b[^.]*\b(?:only )?(?:as|in terms of|in) (?:an? )?(?:income )?band\b/,/\bincome band\b/],
    deny:[/\bincome band\b/,/\bband(?:ed)? income\b/]
  },
  monthly_income_band:{
    allow:[/\b(?:monthly )?income\b[^.]*\b(?:only )?(?:as|in terms of|in) (?:an? )?(?:monthly )?income band\b/,/\bmonthly income band\b/],
    deny:[/\bmonthly income band\b/,/\bband(?:ed)? monthly income\b/]
  }
};

function explicitBandAllow(policy,key){
  const rule=BAND_RULES[key];if(!rule)return false;
  return policyClauses(policy).some(clause=>POS.test(clause)&&rule.allow.some(re=>re.test(clause)));
}
function explicitBandDeny(policy,key){
  const rule=BAND_RULES[key];if(!rule)return false;
  return policyClauses(policy).some(clause=>NEG.test(clause)&&rule.deny.some(re=>re.test(clause)));
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

export function pccV4Summary(){return {version:'pcc-v4',abstractionAwareBands:Object.keys(BAND_RULES),rawValueOverride:false,usesScoringTargets:false};}
