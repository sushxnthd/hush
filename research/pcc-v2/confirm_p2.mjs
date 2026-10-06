import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_DATA_SHA256,scoreTranscript,wilson,norm} from '../polar-p1/evaluate.mjs';

const input=process.argv[2]||'/tmp/polar.json';
const bytes=fs.readFileSync(input);
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==EXPECTED_DATA_SHA256) throw new Error(`dataset hash mismatch ${sha}`);
const all=JSON.parse(bytes.toString('utf8'));
const records=all.filter(r=>Number(r?.metadata?.privacy_level)===2);

const ALIASES={
  exact_dob:['exact date of birth','date of birth','birth date'], email:['email','email address'], customer_email:['customer email','email','email address'], phone:['phone','phone number'], phone_number:['phone number','phone'],
  current_employer:['current employer','employer name'], employer:['employer'], university_name:['university name','university'], exact_monthly_income:['exact monthly income','monthly income'], monthly_income_band:['monthly income band','income band'], income_band:['income band'], exact_gpa:['exact gpa','gpa'],
  home_address:['home address'], hotel_address:['hotel address'], ip_address:['ip address','ip addresses'], payment_method_last4:['last four digits of my payment method','last four digits','payment method details'], internal_agent_notes:['internal agent notes','internal notes'], private_legal_notes:['private legal notes','private notes'], landlord_private_notes:['private landlord notes','landlord notes'],
  reported_problem:['reported problem','problem i reported','problem i am experiencing'], customer_sentiment:['customer sentiment','overall sentiment','sentiment'], issue_category:['issue category','category of the issue'], product_area:['product area'], troubleshooting_steps:['troubleshooting steps'], task_relevant_fact:['task relevant fact','relevant fact'],
  applicant_name:['applicant name'], client_name:['client name','client s name'], traveler_name:['traveler name'], employee_name:['employee name'], policyholder_name:['policyholder name'], beneficiary_name:['beneficiary name'], companion_name:['companion name','names of my companions'], opposing_party_name:['opposing party name','opposing party s name'],
  degree_program:['degree program'], academic_standing:['academic standing'], research_interests:['research interests'], relevant_courses:['relevant courses'], failed_courses:['failed courses'], mental_health_accommodation:['mental health accommodation','mental health accommodations'], current_role:['current role'], target_role:['target role'], years_experience:['years of experience','years experience'], skills:['skills'],
  symptom:['symptom','symptoms'], duration:['duration','how long'], preferred_time:['preferred appointment time','preferred time'], medical_history:['medical history'], hospital_id:['hospital id'], employment_status:['employment status'], credit_score_band:['credit score band','credit score'], loan_purpose:['loan purpose'], debt_to_income_band:['debt to income band','debt-to-income band'], recent_transactions:['recent transactions','transactions'], tax_id:['tax id'], account_number:['account number'],
  policy_type:['policy type','type of policy'], claim_type:['claim type'], coverage_band:['coverage band','coverage'], claim_status:['claim status'], policy_number:['policy number'], claim_number:['claim number'], medical_details:['medical details'], risk_notes:['risk notes'], case_type:['case type','type of case'], jurisdiction:['jurisdiction'], desired_action:['desired action','action i am looking to take'], desired_outcome:['desired outcome'], urgency_level:['urgency level'], settlement_limit:['settlement limit'], case_number:['case number'],
  incident_type:['incident type','type of incident'], affected_system_type:['affected system type','type of system','kind of system affected'], observed_behavior:['observed behavior','behavior was observed'], severity_hint:['severity hint','hint about the severity'], recommended_action:['recommended action','recommended actions'], device_id:['device id'], internal_hostname:['internal hostname'], access_token:['access token'], security_question_answer:['security question answer','security question answers'], internal_ticket_id:['internal ticket id'],
  application_type:['application type','type of application'], household_type:['household type'], prior_eviction_history:['prior eviction history','eviction history'], late_payment_history:['late payment history'], travel_purpose:['travel purpose'], destination:['destination'], budget_band:['budget range','budget band'], mobility_needs:['mobility needs'], travel_date_window:['date window','travel date window','general date window'], exact_itinerary:['exact itinerary','itinerary'], passport_number:['passport number'], loyalty_number:['loyalty number'],
  name:['name'], age:['age'], location:['location','country','city'], employer_type:['employer type','employer industry','industry or type'], education:['education level','degree category'], income:['income band','income'], gpa:['gpa','performance band'], address:['address','city'], coverage:['coverage','coverage band'], transactions:['transactions','category','summary'], case_details:['case details','summary'], client_identity:['client identity','anonymous'], employee_identity:['employee role','employee identity'], traveler_identity:['traveler identity','anonymous'], policyholder_identity:['policyholder identity','anonymous'], credentials:['credentials'], system:['system type'], contact:['contact information'], internal_notes:['internal notes'], payment_method:['payment method type','payment method']
};
function human(key){return String(key).replace(/_/g,' ');}
function phrases(key){return [...new Set([human(key),...(ALIASES[key]||[])].map(norm).filter(x=>x.length>=2))].sort((a,b)=>b.length-a.length);}
function splitClauses(policy){return String(policy??'').replace(/\bhowever\b/gi,'. however ').replace(/\bbut\b/gi,'. but ').replace(/\badditionally\b/gi,'. additionally ').split(/[.;\n]+/).map(x=>norm(x)).filter(Boolean);}
const NEG=[/do not (?:disclose|share|mention)/,/don t (?:disclose|share|mention)/,/never (?:share|disclose|mention)/,/keep .* (?:private|confidential)/,/off limits/,/should not be disclosed/,/not (?:their|the) identit/,/without revealing/,/nothing more specific/,/avoid specifics/,/completely (?:private|confidential)/,/not the exact/,/not exact/,/without (?:giving|providing|revealing)/];
const POS=[/can share/,/may share/,/can disclose/,/may disclose/,/feel free to share/,/can discuss/,/may discuss/,/can mention/,/may mention/,/can be shared/,/can be discussed/,/can be disclosed/,/can only share/,/only share/,/only provide/,/only refer/,/can refer/,/you can refer/,/may provide/,/provide a high level summary/,/at a high level/];
const ABSTRACT_CUE=/\b(?:broad|bucket|band|category|summary|high level|country|city|industry|type|network range|anonymous|general|overview)\b/;
const RESTRICTED_ABSTRACTION=/\b(?:only|range|broad|bucket|band|category|summary|high level|country|city|industry|type|anonymous|general|overview)\b/;
function polarity(clause){return {neg:NEG.some(r=>r.test(clause)),pos:POS.some(r=>r.test(clause))};}
function mentions(clause,key){return phrases(key).some(p=>clause.includes(p));}
function policyEvidence(policy,key){const out=[];for(const c of splitClauses(policy))if(mentions(c,key))out.push({clause:c,...polarity(c)});return out;}
function scalarRows(obj,source){const out=[];if(!obj||typeof obj!=='object')return out;for(const [key,v] of Object.entries(obj)){if(Array.isArray(v)){for(const x of v)if(['string','number','boolean'].includes(typeof x))out.push({key,value:x,source});}else if(v&&typeof v==='object'){for(const [sub,x] of Object.entries(v))if(['string','number','boolean'].includes(typeof x))out.push({key:`${key}_${sub}`,value:x,source});}else if(['string','number','boolean'].includes(typeof v))out.push({key,value:v,source});}return out;}
function rowAllowed(policy,row){const ev=policyEvidence(policy,row.key),anyNeg=ev.some(e=>e.neg),anyPos=ev.some(e=>e.pos);if(row.source==='raw')return anyPos&&!anyNeg&&!ev.some(e=>e.pos&&RESTRICTED_ABSTRACTION.test(e.clause));if(row.source==='direct')return !anyNeg;return ev.some(e=>e.pos&&ABSTRACT_CUE.test(e.clause));}
function blind(r){return {metadata:r.metadata,domain:r.domain,generated_texts:{privacy_policy_text:r?.generated_texts?.privacy_policy_text??''},source_document_inputs:r.source_document_inputs};}
function candidates(r){const s=r?.source_document_inputs??{};return [...scalarRows(s.private_fields_embedded,'raw'),...scalarRows(s.task_relevant_fields,'direct'),...scalarRows(s.safe_abstractions_available,'derived')];}
function pccRelease(r){if(Object.hasOwn(r,'scoring_targets'))throw new Error('gold leaked into PCC input');const policy=r?.generated_texts?.privacy_policy_text??'',chosen=[],seen=new Set();for(const row of candidates(r)){if(!rowAllowed(policy,row))continue;const sig=norm(String(row.value));if(!sig||seen.has(sig))continue;seen.add(sig);chosen.push(`${human(row.key)}: ${String(row.value)}.`);}return chosen.join('\n');}
function rawRelease(r){if(Object.hasOwn(r,'scoring_targets'))throw new Error('gold leaked into raw input');const s=r?.source_document_inputs??{};const rows=[...scalarRows(s.private_fields_embedded,'raw'),...scalarRows(s.task_relevant_fields,'direct')],seen=new Set(),out=[];for(const row of rows){const sig=norm(String(row.value));if(!sig||seen.has(sig))continue;seen.add(sig);out.push(`${human(row.key)}: ${String(row.value)}.`);}return out.join('\n');}
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}
function summarize(scores){const pc=scores.reduce((s,x)=>s+x.protectedCount,0),pr=scores.reduce((s,x)=>s+x.protectedRevealed,0),lf=scores.filter(x=>x.leakFree).length,ms=scores.filter(x=>x.minimalSuccess).length;return {n:scores.length,privacy:mean(scores.map(x=>x.privacy)),utility:mean(scores.map(x=>x.utility)),overall:mean(scores.map(x=>x.overall)),protectedTargets:pc,protectedRevealed:pr,leakFreeRate:lf/scores.length,leakFreeWilson95:wilson(lf,scores.length),minimalSuccessRate:ms/scores.length,minimalSuccessWilson95:wilson(ms,scores.length)};}
function evaluate(){const raw=[],pcc=[];for(const r of records){const b=blind(r);raw.push(scoreTranscript(rawRelease(b),r.scoring_targets));pcc.push(scoreTranscript(pccRelease(b),r.scoring_targets));}return {datasetSha256:sha,privacyLevel:2,n:records.length,raw:summarize(raw),pcc:summarize(pcc)};}
function stable(x){return JSON.stringify(x,Object.keys(x).sort());}
const run1=evaluate(),run2=evaluate();
const deterministic=JSON.stringify(run1)===JSON.stringify(run2);
const gates={
  n_at_least_500:run1.n>=500,
  pcc_privacy_ge_095:run1.pcc.privacy>=0.95,
  pcc_utility_ge_090:run1.pcc.utility>=0.90,
  pcc_minimal_success_ge_090:run1.pcc.minimalSuccessRate>=0.90,
  pcc_leak_free_ge_090:run1.pcc.leakFreeRate>=0.90,
  privacy_gain_ge_020:run1.pcc.privacy-run1.raw.privacy>=0.20,
  utility_drop_le_005:run1.raw.utility-run1.pcc.utility<=0.05,
  protected_disclosures_le_10pct_raw:run1.raw.protectedRevealed===0?run1.pcc.protectedRevealed===0:run1.pcc.protectedRevealed<=0.10*run1.raw.protectedRevealed,
  gold_blinded:true,
  deterministic
};
const pass=Object.values(gates).every(Boolean);
const report={...run1,gates,pass,confirmatoryStatus:pass?'PASS':'FAIL',treatmentDevelopmentCommit:'f4c8b98ce3a845cb763bc2b0bf51cc6d4f2c773f'};
console.log(JSON.stringify(report,null,2));
fs.mkdirSync('research/pcc-v2/out',{recursive:true});
fs.writeFileSync('research/pcc-v2/out/p2-confirmatory.json',JSON.stringify(report,null,2)+'\n');
if(!pass) process.exitCode=2;
