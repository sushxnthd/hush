import {norm} from '../polar-p1/evaluate.mjs';
import {MUST_DERIVE,policyAllowsField,semanticDenyEvidence,policyClauses,provenanceErasedFacts,humanField} from '../pcc-v2/policy_compiler_v2.mjs';

// Development additions learned only after the frozen P2 confirmation failed.
// These are positive paraphrase aliases. Existing exact/semantic deny rules always win.
const EXTRA_ALLOW={
  target_role:[/\brole i m targeting\b/,/\brole i am targeting\b/,/\brole being targeted\b/,/\btarget(?:ed)? role\b/],
  troubleshooting_steps:[/\bsteps (?:i ve|i have|we ve|we have) taken to troubleshoot\b/,/\bsteps taken to troubleshoot\b/,/\btroubleshoot(?:ing)? steps\b/],
  customer_sentiment:[/\bhow i m feeling about the situation\b/,/\bhow i am feeling about the situation\b/,/\bhow the customer feels\b/,/\bfeeling about the situation\b/],
  issue_category:[/\bcategory of the problem\b/,/\bproblem category\b/]
};

function extraAllowEvidence(policy,key){
  const rules=EXTRA_ALLOW[key];
  if(!rules)return false;
  for(const clause of policyClauses(policy)){
    // Only affirmative disclosure clauses can activate an alias.
    if(!/\b(?:can share|may share|can disclose|may disclose|can discuss|may discuss|can mention|may mention|can be shared|is okay to share|okay to share)\b/.test(clause))continue;
    if(rules.some(re=>re.test(clause)))return true;
  }
  return false;
}

export function policyAllowsFieldV3(policy,key){
  // Keep every v2 allow decision.
  if(policyAllowsField(policy,key))return true;
  // Raw/specific concepts remain transform-only.
  if(MUST_DERIVE.has(key))return false;
  // Any exact or semantic deny still dominates every new positive alias.
  if(semanticDenyEvidence(policy,key).length)return false;
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
