import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_DATA_SHA256,scoreTranscript,wilson,norm,reveals} from '../polar-p1/evaluate.mjs';

const input=process.argv[2]||'/tmp/polar.json';
const bytes=fs.readFileSync(input);
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==EXPECTED_DATA_SHA256) throw new Error(`dataset hash mismatch ${sha}`);
const records=JSON.parse(bytes.toString('utf8')).filter(r=>Number(r?.metadata?.privacy_level)===1&&String(r?.metadata?.privacy_type)==='explicit_field_constraints');

const A={
 exact_dob:['exact date of birth','date of birth','birth date'],email:['email','email address'],customer_email:['customer email','email','email address'],phone:['phone','phone number'],phone_number:['phone number','phone'],
 current_employer:['current employer','employer name','employer'],employer:['employer'],university_name:['university name','university'],exact_monthly_income:['exact monthly income','monthly income'],exact_gpa:['exact gpa','gpa'],home_address:['home address','address'],hotel_address:['hotel address'],ip_address:['ip address','ip addresses'],
 payment_method_last4:['last four digits of my payment method','last four digits','payment method details','payment method'],internal_agent_notes:['internal agent notes','internal notes'],private_legal_notes:['private legal notes','private notes'],landlord_private_notes:['private landlord notes','landlord notes'],
 reported_problem:['reported problem','problem i reported','problem i am experiencing','problem'],customer_sentiment:['customer sentiment','overall sentiment','sentiment'],issue_category:['issue category','category of the issue'],product_area:['product area'],troubleshooting_steps:['troubleshooting steps'],
 task_relevant_fact:['task relevant fact','relevant fact','case details','case detail'],applicant_name:['applicant name'],client_name:['client name','client s name'],traveler_name:['traveler name'],employee_name:['employee name'],policyholder_name:['policyholder name'],beneficiary_name:['beneficiary name'],companion_name:['companion name','names of my companions'],opposing_party_name:['opposing party name','opposing party s name'],
 degree_program:['degree program'],academic_standing:['academic standing'],research_interests:['research interests'],relevant_courses:['relevant courses'],failed_courses:['failed courses'],mental_health_accommodation:['mental health accommodation','mental health accommodations'],current_role:['current role'],target_role:['target role'],years_experience:['years of experience','years experience'],skills:['skills'],
 symptom:['symptom','symptoms'],duration:['duration','how long'],preferred_time:['preferred appointment time','preferred time'],medical_history:['medical history'],hospital_id:['hospital id'],employment_status:['employment status'],credit_score_band:['credit score band','credit score'],loan_purpose:['loan purpose'],debt_to_income_band:['debt to income band','debt-to-income band'],recent_transactions:['recent transactions','transactions'],tax_id:['tax id'],account_number:['account number'],
 policy_type:['policy type','type of policy'],claim_type:['claim type'],coverage_band:['coverage band','coverage'],claim_status:['claim status'],policy_number:['policy number'],claim_number:['claim number'],medical_details:['medical details'],risk_notes:['risk notes'],case_type:['case type','type of case'],jurisdiction:['jurisdiction'],desired_action:['desired action','action i am looking to take','action i m looking to take'],desired_outcome:['desired outcome'],urgency_level:['urgency level'],settlement_limit:['settlement limit'],case_number:['case number'],
 incident_type:['incident type','type of incident'],affected_system_type:['affected system type','type of system','kind of system affected'],observed_behavior:['observed behavior','behavior was observed'],severity_hint:['severity hint','hint about the severity'],recommended_action:['recommended action','recommended actions'],device_id:['device id'],internal_hostname:['internal hostname'],access_token:['access token'],security_question_answer:['security question answer','security question answers'],internal_ticket_id:['internal ticket id'],
 application_type:['application type','type of application'],household_type:['household type'],prior_eviction_history:['prior eviction history','eviction history'],late_payment_history:['late payment history'],travel_purpose:['travel purpose'],destination:['destination'],budget_band:['budget range','budget band'],mobility_needs:['mobility needs'],travel_date_window:['date window','travel date window','general date window'],exact_itinerary:['exact itinerary','itinerary'],passport_number:['passport number'],loyalty_number:['loyalty number'],name:['name']
};
// Concepts for which a policy-authorized abstraction must never be mistaken for
// permission to disclose the raw/specific value.
const MUST_DERIVE=new Set(['current_employer','employer','medical_history','medical_details','ip_address','recent_transactions','exact_gpa','exact_monthly_income','home_address','hotel_address','payment_method_last4','exact_itinerary']);
const NEG=/\b(?:do not|don t|never|keep|private|confidential|off limits|off-limits|should not|not be disclosed|without revealing|nothing more specific)\b/;
const POS=/\b(?:can share|may share|can disclose|may disclose|feel free to share|can discuss|may discuss|can mention|may mention|can be shared|can be discussed|can be disclosed|only share|only provide|can refer|may provide|provide a high level|high level summary)\b/;
const human=k=>String(k).replace(/_/g,' ');
function phrases(k){return [...new Set([human(k),...(A[k]||[])].map(norm))].filter(Boolean).sort((a,b)=>b.length-a.length);}
function clauses(p){return String(p??'').replace(/\bhowever\b/gi,'. however ').replace(/\bbut\b/gi,'. but ').replace(/\badditionally\b/gi,'. additionally ').split(/[.;\n]+/).map(norm).filter(Boolean);}
function evidence(policy,key){return clauses(policy).filter(c=>phrases(key).some(p=>c.includes(p))).map(c=>({c,pos:POS.test(c),neg:NEG.test(c)}));}
function allowed(policy,key){
 const ev=evidence(policy,key); if(!ev.length)return false;
 if(key==='task_relevant_fact') return ev.some(x=>x.pos&&/high level summary|high level/.test(x.c)&&/case details?/.test(x.c));
 if(MUST_DERIVE.has(key))return false;
 return ev.some(x=>x.pos&&!x.neg);
}
function rows(obj){
 const out=[]; if(!obj||typeof obj!=='object')return out;
 for(const [key,v] of Object.entries(obj)){
  if(Array.isArray(v)){for(const x of v)if(['string','number','boolean'].includes(typeof x))out.push({key,value:x});}
  else if(v&&typeof v==='object'){for(const [sub,x] of Object.entries(v))if(['string','number','boolean'].includes(typeof x))out.push({key:`${key}_${sub}`,value:x});}
  else if(['string','number','boolean'].includes(typeof v))out.push({key,value:v});
 }
 return out;
}
function sourceFacts(r){
 const s=r?.source_document_inputs??{};
 // Erase benchmark provenance before policy evaluation.
 const all=[...rows(s.private_fields_embedded),...rows(s.task_relevant_fields)],seen=new Set(),out=[];
 for(const x of all){const sig=`${x.key}\0${norm(x.value)}`;if(!seen.has(sig)){seen.add(sig);out.push(x);}}
 return out;
}
function release(r){
 const policy=r?.generated_texts?.privacy_policy_text??'',facts=sourceFacts(r),seen=new Set(),chosen=[];
 for(const row of facts){if(!allowed(policy,row.key))continue;const sig=norm(row.value);if(!sig||seen.has(sig))continue;seen.add(sig);chosen.push({row,text:`${human(row.key)}: ${row.value}.`});}
 return {facts,chosen,text:chosen.map(x=>x.text).join('\n')};
}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
function summarize(a){const pt=a.reduce((s,x)=>s+x.protectedCount,0),pr=a.reduce((s,x)=>s+x.protectedRevealed,0),lf=a.filter(x=>x.leakFree).length,ms=a.filter(x=>x.minimalSuccess).length;return {n:a.length,privacy:mean(a.map(x=>x.privacy)),utility:mean(a.map(x=>x.utility)),overall:mean(a.map(x=>x.overall)),protectedTargets:pt,protectedRevealed:pr,leakFreeRate:lf/a.length,leakFreeWilson95:wilson(lf,a.length),minimalSuccessRate:ms/a.length,minimalSuccessWilson95:wilson(ms,a.length)};}
const scores=[],miss=new Map(),leak=new Map(),leakExamples=[],missExamples=[]; const inc=(m,k)=>m.set(k,(m.get(k)||0)+1);
for(const r of records){
 const rel=release(r),sc=scoreTranscript(rel.text,r.scoring_targets);scores.push(sc);const p=r.generated_texts?.privacy_policy_text??'';
 for(const t of r.scoring_targets?.allowed_values??[]){if(!reveals(rel.text,t)){const m=rel.facts.filter(x=>reveals(String(x.value),t)||reveals(t,String(x.value)));for(const x of m)inc(miss,x.key);if(missExamples.length<20)missExamples.push({domain:r.domain,target:t,matches:m.map(x=>({key:x.key,value:x.value,allowed:allowed(p,x.key),evidence:evidence(p,x.key)})),policy:p});}}
 for(const t of r.scoring_targets?.do_not_disclose_values??[]){if(reveals(rel.text,t)){const m=rel.chosen.filter(x=>reveals(String(x.row.value),t)||reveals(t,String(x.row.value)));for(const x of m)inc(leak,x.row.key);if(leakExamples.length<20)leakExamples.push({domain:r.domain,target:t,matches:m.map(x=>({key:x.row.key,value:x.row.value,evidence:evidence(p,x.row.key)})),policy:p});}}
}
const result={datasetSha256:sha,p1Cases:records.length,provenanceErased:true,benchmarkSafeAbstractionsUsed:false,pcc:summarize(scores),topMissKeys:[...miss].sort((a,b)=>b[1]-a[1]).slice(0,30),topLeakKeys:[...leak].sort((a,b)=>b[1]-a[1]).slice(0,30),missExamples,leakExamples};
console.log(JSON.stringify(result,null,2));fs.mkdirSync('research/pcc-v2/out',{recursive:true});fs.writeFileSync('research/pcc-v2/out/dev-eval-blind.json',JSON.stringify(result,null,2)+'\n');
