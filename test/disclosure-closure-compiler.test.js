import test from 'node:test';
import assert from 'node:assert/strict';
import {compileDisclosurePolicy,compileDisclosureClosure,policyClauses} from '../src/disclosure-closure-compiler.js';

const atom=(key,value)=>({key,value,provenance:`profile.${key}`});

test('policy polarity separates explicit allows from explicit denials',()=>{
  const policy="You can share my symptoms, how long I've been experiencing them, and my preferred appointment time. However, please keep my name, email, phone number, exact date of birth, hospital ID, and employer completely private.";
  const p=compileDisclosurePolicy(policy,['symptom','preferred_time','name','email','phone','exact_dob','hospital_id','employer']);
  assert.equal(p.fields.symptom.decision,'allow');
  assert.equal(p.fields.preferred_time.decision,'allow');
  for(const k of ['name','email','phone','exact_dob','hospital_id','employer']) assert.equal(p.fields[k].decision,'deny',k);
});

test('positive list containing band fields does not suppress other explicitly allowed fields',()=>{
  const policy='You can share my employment status, monthly income band, credit score band, loan purpose, and debt-to-income band. However, keep my exact monthly income and account number private.';
  const p=compileDisclosurePolicy(policy,['employment_status','monthly_income_band','credit_score_band','loan_purpose','debt_to_income_band','exact_monthly_income','account_number']);
  for(const k of ['employment_status','monthly_income_band','credit_score_band','loan_purpose','debt_to_income_band']) assert.equal(p.fields[k].decision,'allow',k);
  assert.equal(p.fields.exact_monthly_income.decision,'deny');
  assert.equal(p.fields.account_number.decision,'deny');
});

test('closed world denies identifiers omitted from an explicit policy',()=>{
  const p=compileDisclosurePolicy('You can share incident type and severity hint. Never share access token.',['incident_type','severity_hint','email','phone','access_token']);
  assert.equal(p.fields.incident_type.decision,'allow');
  assert.equal(p.fields.severity_hint.decision,'allow');
  assert.equal(p.fields.access_token.decision,'deny');
  assert.equal(p.fields.email.decision,'deny');
  assert.equal(p.fields.phone.decision,'deny');
});

test('role-qualified identity names resolve to generic policy denials',()=>{
  const p=compileDisclosurePolicy("You can share case type. Keep my client's name and opposing party's name confidential.",['case_type','client_name','opposing_party_name']);
  assert.equal(p.fields.case_type.decision,'allow');
  assert.equal(p.fields.client_name.decision,'deny');
  assert.equal(p.fields.opposing_party_name.decision,'deny');
});

test('exact source does not inherit a transformed broad allow',()=>{
  const p=compileDisclosurePolicy('You can disclose my age in broad categories. For IP addresses, only the network range can be shared.',['exact_age','age_bucket','ip_address','ip_range']);
  assert.equal(p.fields.exact_age.decision,'deny');
  assert.equal(p.fields.age_bucket.decision,'allow');
  assert.equal(p.fields.ip_address.decision,'deny');
  assert.equal(p.fields.ip_range.decision,'allow');
});

test('disclosure closure blocks an allowed atom that contains denied atom material',()=>{
  const r=compileDisclosureClosure({
    policyText:'You can share the summary. Keep account number private.',
    atoms:[atom('summary','Loan requested by account ACCT-44321.'),atom('account_number','ACCT-44321')]
  });
  assert.equal(r.released.length,0);
  assert.equal(r.blocked.find(x=>x.key==='summary').reason,'disclosure_closure_taint');
  assert.equal(r.text.includes('ACCT-44321'),false);
});

test('safe allowed atoms survive while denied atoms have no release path',()=>{
  const r=compileDisclosureClosure({
    policyText:'You can share my current role, skills, years of experience, and target role. However, keep my name, email, exact date of birth, current employer name, and university name private.',
    atoms:[atom('current_role','ML Engineer'),atom('skills','Python'),atom('years_experience',4),atom('target_role','Research Engineer'),atom('name','Asha Singh'),atom('email','asha@example.com'),atom('exact_dob','2002-04-11'),atom('current_employer','Acme AI')]
  });
  assert.deepEqual(r.released.map(x=>x.key),['current_role','skills','years_experience','target_role']);
  assert.equal(r.text.includes('asha@example.com'),false);
  assert.equal(r.attackerCanExpandClosure,false);
});

test('contrastive clauses are compiled independently',()=>{
  const clauses=policyClauses('You can share destination and budget range, but never share passport number or hotel address.');
  assert.ok(clauses.some(c=>c.polarity==='allow'));
  assert.ok(clauses.some(c=>c.polarity==='deny'));
});
