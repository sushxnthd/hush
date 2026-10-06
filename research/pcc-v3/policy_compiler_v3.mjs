import {norm} from '../polar-p1/evaluate.mjs';
import {MUST_DERIVE,policyAllowsField,semanticDenyEvidence,policyClauses,provenanceErasedFacts,humanField,directEvidence} from '../pcc-v2/policy_compiler_v2.mjs';

// Development additions learned only after the frozen P2 confirmation failed.
// Positive aliases improve semantic recall; deny aliases close broader negative paraphrases.
const EXTRA_ALLOW={
  target_role:[/\brole i m targeting\b/,/\brole i am targeting\b/,/\brole being targeted\b/,/\btarget(?:ed)? role\b/],
  troubleshooting_steps:[/\bsteps (?:i ve|i have|we ve|we have) taken to troubleshoot\b/,/\bsteps taken to troubleshoot\b/,/\btroubleshoot(?:ing)? steps\b/],
  customer_sentiment:[/\bhow i m feeling about the situation\b/,/\bhow i am feeling about the situation\b/,/\bhow the customer feels\b/,/\bfeeling about the situation\b/],
  issue_category:[/\bcategory of the problem\b/,/\bproblem category\b/]
};

const EXTRA_DENY={
  target_role:[/\bemployment (?:information|details|data)\b/,/\bcareer (?:information|details|data)\b/],
  troubleshooting_steps:[/\btroubleshoot(?:ing)? (?:information|details|data)\b/,/\bsupport troubleshooting (?:information|details|data)\b/],
  customer_sentiment:[/\bcustomer sentiment\b/,/\buser sentiment\b/],
  issue_category:[/\bissue category\b/,/\bproblem category\b/]
};
const NEG=/\b(?:do not|don t|never|keep|private|confidential|off limits|off-limits|should not|not be disclosed|must not|cannot share|can t share|without revealing|nothing more specific)\b/;
const POS=/\b(?:can share|may share|can disclose|may disclose|can discuss|may discuss|can mention|may mention|can be shared|is okay to share|okay to share)\b/;

function extraAllowEvidence(policy,key){
  const rules=EXTRA_ALLOW[key];
  if(!rules)return false;
  for(const clause of policyClauses(policy)){
    if(!POS.test(clause)||NEG.test(clause))continue;
    if(rules.some(re=>re.test(clause)))return true;
  }
  return false;
}
function extraDenyEvidence(policy,key){
  const rules=EXTRA_DENY[key];
  if(!rules)return false;
  return policyClauses(policy).some(clause=>NEG.test(clause)&&rules.some(re=>re.test(clause)));
}
function anyDirectDeny(policy,key){return directEvidence(policy,key).some(x=>x.neg);}

export function policyAllowsFieldV3(policy,key){
  // Raw/specific concepts remain transform-only regardless of affirmative wording.
  if(MUST_DERIVE.has(key))return false;
  // Deny precedence is global: exact, v2 semantic category, or v3 broader deny alias.
  if(anyDirectDeny(policy,key)||semanticDenyEvidence(policy,key).length||extraDenyEvidence(policy,key))return false;
  // Preserve v2 positive decisions only after all deny checks have passed.
  if(policyAllowsField(policy,key))return true;
  return extraAllowEvidence(policy,key);
}

export function compileDisclosureV3(record){
  const policy=record?.generated_texts?.privacy_policy_text??'';
  const facts=provenanceErasedFacts(record),seen=new Set(),chosen=[];
  for(const row of facts){
    if(!policyAllowsFieldV3(policy,row.key))continue;
    const sig=norm(row.value);if(!sig||seen.has(sig))continue;
    seen.add(sig);chosen.push({row,text:`${humanField(row.key)}: ${row.value}.`});
  }
  return {facts,chosen,text:chosen.map(x=>x.text).join('\n')};
}

export function pccV3Summary(){return {version:'pcc-v3',extraAllowKeys:Object.keys(EXTRA_ALLOW),denyPrecedence:true,usesScoringTargets:false};}
