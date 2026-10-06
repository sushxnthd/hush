import {norm} from '../polar-p1/evaluate.mjs';
import {policyClauses,provenanceErasedFacts,humanField,MUST_DERIVE,directEvidence,semanticDenyEvidence} from '../pcc-v2/policy_compiler_v2.mjs';
import {policyAllowsFieldV4} from '../pcc-v4/policy_compiler_v4.mjs';

const POS=/\b(?:can share|may share|can disclose|may disclose|can discuss|may discuss|can mention|may mention|can be shared|can provide|may provide|provide|describe|can describe|may describe)\b/;
const NEG=/\b(?:do not|don t|doesn t|never|keep|private|confidential|off limits|off-limits|should not|not be disclosed|must not|cannot share|can t share|without revealing|nothing more specific)\b/;

const EXTRA_SAFE_ALLOW={
  task_relevant_fact:[
    /\bhigh level (?:summary|overview) of (?:the )?(?:legal issue|case|case issue)\b/,
    /\bsummar(?:y|ize) (?:of )?(?:the )?(?:legal issue|case)\b/
  ],
  travel_date_window:[
    /\bgeneral window of travel dates\b/,
    /\bgeneral travel date window\b/,
    /\bgeneral window for travel dates\b/
  ]
};

function explicitSafeAllow(policy,key){
  const rules=EXTRA_SAFE_ALLOW[key];if(!rules)return false;
  return policyClauses(policy).some(clause=>POS.test(clause)&&!NEG.test(clause)&&rules.some(re=>re.test(clause)));
}
function explicitDirectDeny(policy,key){return directEvidence(policy,key).some(x=>x.neg);}

export function policyAllowsFieldV5(policy,key){
  // Raw exact concepts remain transform-only. V5 only routes to separately stored coarse facts.
  if(MUST_DERIVE.has(key))return false;
  // Any explicit or semantic denial of the coarse field still wins.
  if(explicitDirectDeny(policy,key)||semanticDenyEvidence(policy,key).length)return false;
  if(policyAllowsFieldV4(policy,key))return true;
  return explicitSafeAllow(policy,key);
}

export function compileDisclosureV5(record){
  const policy=record?.generated_texts?.privacy_policy_text??'';
  const facts=provenanceErasedFacts(record),seen=new Set(),chosen=[];
  for(const row of facts){
    if(!policyAllowsFieldV5(policy,row.key))continue;
    const sig=norm(row.value);if(!sig||seen.has(sig))continue;
    seen.add(sig);chosen.push({row,text:`${humanField(row.key)}: ${row.value}.`});
  }
  return {facts,chosen,text:chosen.map(x=>x.text).join('\n')};
}

export function pccV5Summary(){return {version:'pcc-v5',abstractionRouting:['task_relevant_fact','travel_date_window'],rawExactRelease:false,denyPrecedence:true,usesScoringTargets:false};}
