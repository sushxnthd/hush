import {norm} from '../polar-p1/evaluate.mjs';

export const FIELD_ALIASES={
 exact_dob:['exact date of birth','date of birth','birth date'],email:['email','email address'],customer_email:['customer email','email','email address'],phone:['phone','phone number'],phone_number:['phone number','phone'],
 current_employer:['current employer','employer name','employer'],employer:['employer'],university_name:['university name','university'],exact_monthly_income:['exact monthly income','monthly income'],exact_gpa:['exact gpa','gpa'],home_address:['home address','address'],hotel_address:['hotel address'],ip_address:['ip address','ip addresses'],
 payment_method_last4:['last four digits of my payment method','last four digits','payment method details','payment method'],internal_agent_notes:['internal agent notes','internal notes'],private_legal_notes:['private legal notes','private notes'],landlord_private_notes:['private landlord notes','landlord notes'],
 reported_problem:['reported problem','problem i reported','problem i am experiencing','problem'],customer_sentiment:['customer sentiment','overall sentiment','sentiment','how i am feeling about the situation','how i m feeling about the situation'],issue_category:['issue category','category of the issue','category of the problem','category of my problem'],product_area:['product area'],troubleshooting_steps:['troubleshooting steps','steps i have taken to troubleshoot','steps i ve taken to troubleshoot','steps we have taken to troubleshoot','steps we ve taken to troubleshoot','steps taken to troubleshoot'],
 task_relevant_fact:['task relevant fact','relevant fact','case details','case detail'],applicant_name:['applicant name'],client_name:['client name','client s name'],traveler_name:['traveler name'],employee_name:['employee name'],policyholder_name:['policyholder name'],beneficiary_name:['beneficiary name'],companion_name:['companion name','names of my companions'],opposing_party_name:['opposing party name','opposing party s name'],
 degree_program:['degree program'],academic_standing:['academic standing'],research_interests:['research interests'],relevant_courses:['relevant courses'],failed_courses:['failed courses'],mental_health_accommodation:['mental health accommodation','mental health accommodations'],current_role:['current role'],target_role:['target role','role i am targeting','role i m targeting','role being targeted'],years_experience:['years of experience','years experience'],skills:['skills'],
 symptom:['symptom','symptoms'],duration:['duration','how long'],preferred_time:['preferred appointment time','preferred time'],medical_history:['medical history'],hospital_id:['hospital id'],employment_status:['employment status'],credit_score_band:['credit score band','credit score'],loan_purpose:['loan purpose'],debt_to_income_band:['debt to income band','debt-to-income band'],recent_transactions:['recent transactions','transactions'],tax_id:['tax id'],account_number:['account number'],
 policy_type:['policy type','type of policy'],claim_type:['claim type'],coverage_band:['coverage band','coverage'],claim_status:['claim status'],policy_number:['policy number'],claim_number:['claim number'],medical_details:['medical details'],risk_notes:['risk notes'],case_type:['case type','type of case'],jurisdiction:['jurisdiction'],desired_action:['desired action','action i am looking to take','action i m looking to take'],desired_outcome:['desired outcome'],urgency_level:['urgency level'],settlement_limit:['settlement limit'],case_number:['case number'],
 incident_type:['incident type','type of incident'],affected_system_type:['affected system type','type of system','kind of system affected'],observed_behavior:['observed behavior','behavior was observed'],severity_hint:['severity hint','hint about the severity'],recommended_action:['recommended action','recommended actions'],device_id:['device id'],internal_hostname:['internal hostname'],access_token:['access token'],security_question_answer:['security question answer','security question answers'],internal_ticket_id:['internal ticket id'],
 application_type:['application type','type of application'],household_type:['household type'],prior_eviction_history:['prior eviction history','eviction history'],late_payment_history:['late payment history'],travel_purpose:['travel purpose'],destination:['destination'],budget_band:['budget range','budget band'],mobility_needs:['mobility needs'],travel_date_window:['date window','travel date window','general date window'],exact_itinerary:['exact itinerary','itinerary'],passport_number:['passport number'],loyalty_number:['loyalty number'],name:['name']
};

// Raw/specific concepts that require a derived contract rather than direct release.
export const MUST_DERIVE=new Set(['current_employer','employer','medical_history','medical_details','ip_address','recent_transactions','exact_gpa','exact_monthly_income','home_address','hotel_address','payment_method_last4','exact_itinerary']);

// Fixed before P2 evaluation. Categories are intentionally conservative and deny-first.
export const SEMANTIC_CATEGORIES=[
 {terms:['contact information','contact details','contact info','ways to contact','contact data'],fields:['email','customer_email','phone','phone_number','home_address','hotel_address']},
 {terms:['personal identifiers','personally identifying information','personally identifiable information','identity information','identifying information','identity details','pii'],fields:['name','applicant_name','client_name','traveler_name','employee_name','policyholder_name','beneficiary_name','companion_name','opposing_party_name','exact_dob','email','customer_email','phone','phone_number','home_address','hotel_address','passport_number','tax_id','hospital_id','account_number','policy_number','claim_number','case_number','device_id','loyalty_number']},
 {terms:['financial information','financial details','financial data','banking information','banking details','payment information','payment details'],fields:['exact_monthly_income','credit_score_band','debt_to_income_band','recent_transactions','tax_id','account_number','payment_method_last4','budget_band']},
 {terms:['medical information','medical details','medical data','health information','health data','health details','health records'],fields:['medical_history','medical_details','symptom','mental_health_accommodation','hospital_id']},
 {terms:['employment information','employment details','employment data','work history','employer information'],fields:['current_employer','employer','employment_status','current_role','years_experience']},
 {terms:['education information','educational information','education records','academic information','academic records'],fields:['university_name','degree_program','academic_standing','research_interests','relevant_courses','failed_courses','exact_gpa']},
 {terms:['location information','location details','location data','address information','address details'],fields:['home_address','hotel_address','destination']},
 {terms:['security credentials','credentials','authentication information','authentication details','security secrets','access credentials'],fields:['access_token','security_question_answer','internal_hostname','device_id']},
 {terms:['transaction information','transaction details','transaction history'],fields:['recent_transactions','payment_method_last4','account_number']},
 {terms:['travel documents','travel identification','travel identifiers'],fields:['passport_number','loyalty_number','exact_itinerary','traveler_name','companion_name']},
 {terms:['legal identifiers','legal case identifiers','case identifiers'],fields:['case_number','client_name','opposing_party_name']},
 {terms:['insurance identifiers','insurance identification','claim identifiers'],fields:['policy_number','claim_number','policyholder_name','beneficiary_name']}
];

const NEG=/\b(?:do not|don t|never|keep|private|confidential|off limits|off-limits|should not|not be disclosed|must not|cannot share|can t share|without revealing|nothing more specific)\b/;
const POS=/\b(?:can share|may share|can disclose|may disclose|feel free to share|can discuss|may discuss|can mention|may mention|can be shared|can be discussed|can be disclosed|only share|only provide|can refer|may provide|provide a high level|high level summary|is okay to share|okay to share)\b/;

export const humanField=k=>String(k).replace(/_/g,' ');
export function fieldPhrases(key){return [...new Set([humanField(key),...(FIELD_ALIASES[key]||[])].map(norm))].filter(Boolean).sort((a,b)=>b.length-a.length);}
export function policyClauses(policy){return String(policy??'').replace(/\bhowever\b/gi,'. however ').replace(/\bbut\b/gi,'. but ').replace(/\badditionally\b/gi,'. additionally ').replace(/\bexcept\b/gi,'. except ').split(/[.;\n]+/).map(norm).filter(Boolean);}
export function directEvidence(policy,key){return policyClauses(policy).filter(c=>fieldPhrases(key).some(p=>c.includes(p))).map(c=>({clause:c,pos:POS.test(c),neg:NEG.test(c)}));}
export function semanticDenyEvidence(policy,key){
 const out=[];
 for(const clause of policyClauses(policy)){
   if(!NEG.test(clause))continue;
   for(const category of SEMANTIC_CATEGORIES){
     if(!category.fields.includes(key))continue;
     if(category.terms.some(t=>clause.includes(norm(t)))) out.push({clause,category:category.terms[0]});
   }
 }
 return out;
}
export function policyAllowsField(policy,key){
 const ev=directEvidence(policy,key);
 if(key==='task_relevant_fact') return ev.some(x=>x.pos&&!x.neg&&/high level summary|high level/.test(x.clause)&&/case details?/.test(x.clause));
 if(MUST_DERIVE.has(key)) return false;
 if(semanticDenyEvidence(policy,key).length) return false;
 return ev.some(x=>x.pos&&!x.neg);
}
export function scalarRows(obj){
 const out=[]; if(!obj||typeof obj!=='object')return out;
 for(const [key,v] of Object.entries(obj)){
   if(Array.isArray(v)){for(const x of v)if(['string','number','boolean'].includes(typeof x))out.push({key,value:x});}
   else if(v&&typeof v==='object'){for(const [sub,x] of Object.entries(v))if(['string','number','boolean'].includes(typeof x))out.push({key:`${key}_${sub}`,value:x});}
   else if(['string','number','boolean'].includes(typeof v))out.push({key,value:v});
 }
 return out;
}
export function provenanceErasedFacts(record){
 const s=record?.source_document_inputs??{};
 const all=[...scalarRows(s.private_fields_embedded),...scalarRows(s.task_relevant_fields)],seen=new Set(),out=[];
 for(const x of all){const sig=`${x.key}\0${norm(x.value)}`;if(!seen.has(sig)){seen.add(sig);out.push(x);}}
 return out;
}
export function compileDisclosure(record){
 const policy=record?.generated_texts?.privacy_policy_text??'',facts=provenanceErasedFacts(record),seen=new Set(),chosen=[];
 for(const row of facts){
   if(!policyAllowsField(policy,row.key))continue;
   const sig=norm(row.value); if(!sig||seen.has(sig))continue;
   seen.add(sig); chosen.push({row,text:`${humanField(row.key)}: ${row.value}.`});
 }
 return {facts,chosen,text:chosen.map(x=>x.text).join('\n')};
}
