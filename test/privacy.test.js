import test from 'node:test';
import assert from 'node:assert/strict';
import {DisclosureLedger, TrustRegistry, disclosureCost} from '../src/privacy.js';

test('credentials never disclose exact material',()=>{
  const l=new DisclosureLedger();
  const r=l.evaluate({agent:'claude',purpose:'login',sink:'github.com',category:'credential',level:'exact',atomId:'github-token'});
  assert.equal(r.decision,'deny');
});

test('limited agents can receive low-cost derived context',()=>{
  const l=new DisclosureLedger();
  const r=l.evaluate({agent:'claude',purpose:'trip',sink:'airline.example',category:'finance',level:'derived',atomId:'travel-budget'});
  assert.equal(r.decision,'allow');
});

test('exact sensitive disclosure requires approval even under budget',()=>{
  const tr=new TrustRegistry('trusted'); const l=new DisclosureLedger({trustRegistry:tr});
  const r=l.evaluate({agent:'claude',purpose:'trip',sink:'airline.example',category:'identity',level:'exact',atomId:'passport-number'});
  assert.equal(r.decision,'ask');
});

test('repeating identical disclosure does not double-charge privacy budget',()=>{
  const l=new DisclosureLedger(); const q={agent:'a',purpose:'p',sink:'s',category:'location',level:'coarse',atomId:'home-city'};
  const r1=l.evaluate(q); l.record(q,r1,1000);
  const r2=l.evaluate(q,1001);
  assert.equal(r2.marginalCost,0);
});

test('upgrading coarse to exact only charges marginal information',()=>{
  const tr=new TrustRegistry('trusted'); const l=new DisclosureLedger({trustRegistry:tr,windowMs:999999});
  const q1={agent:'a',purpose:'p',sink:'s',category:'location',level:'coarse',atomId:'home'}; const e1=l.evaluate(q1,1000); l.record(q1,e1,1000);
  const q2={...q1,level:'exact'}; const e2=l.evaluate(q2,1001);
  assert.ok(e2.marginalCost>0); assert.ok(e2.marginalCost<disclosureCost('location','exact'));
});

test('cumulative disclosures eventually hit budget',()=>{
  const l=new DisclosureLedger(); let denied=false;
  for(let i=0;i<20;i++){
    const q={agent:'a',purpose:'research',sink:'sink',category:'general',level:'exact',atomId:`field-${i}`};
    const e=l.evaluate(q,1000+i);
    if(e.decision==='deny'){denied=true;break;}
    l.record({...q,approvedByHuman:e.decision==='ask'},e,1000+i);
  }
  assert.equal(denied,true);
});

test('sink budget prevents concentrating too much disclosure into one destination',()=>{
  const tr=new TrustRegistry('trusted'); const l=new DisclosureLedger({trustRegistry:tr,windowMs:999999}); let last;
  for(let i=0;i<10;i++){
    const q={agent:'a',purpose:'p',sink:'merchant',category:'general',level:'exact',atomId:`x${i}`};
    last=l.evaluate(q,1000+i);
    if(last.decision==='deny') break;
    l.record({...q,approvedByHuman:last.decision==='ask'},last,1000+i);
  }
  assert.equal(last.decision,'deny');
});

test('trust profile changes budgets but never auto-upgrades itself',()=>{
  const tr=new TrustRegistry(); assert.equal(tr.get('a').level,'limited'); tr.set('a','trusted'); assert.equal(tr.get('a').source,'user');
});

test('footprint summarizes agent exposure without raw private values',()=>{
  const l=new DisclosureLedger(); const q={agent:'claude',purpose:'trip',sink:'airline',category:'preference',level:'exact',atomId:'seat'}; const e=l.evaluate(q,1000); l.record(q,e,1000);
  const fp=l.footprint(1001); assert.equal(fp[0].agent,'claude'); assert.equal(fp[0].categories[0],'preference'); assert.equal(JSON.stringify(fp).includes('seat'),false);
});
