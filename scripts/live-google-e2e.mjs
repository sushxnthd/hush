import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Vault} from '../src/core.js';
import {ProviderOnboarding} from '../src/provider-onboarding.js';

const required=name=>{const value=String(process.env[name]||'').trim();if(!value)throw new Error(`${name} is required`);return value;};
const startedAt=new Date().toISOString();
const work=fs.mkdtempSync(path.join(os.tmpdir(),'hush-live-google-e2e-'));
let report;
try{
  const clientId=required('HUSH_GOOGLE_CLIENT_ID');
  const refreshToken=required('HUSH_GOOGLE_REFRESH_TOKEN');
  const recipient=required('HUSH_E2E_EMAIL');
  const rootKey=crypto.randomBytes(32);
  const vault=new Vault(work,rootKey);
  const onboarding=new ProviderOnboarding({vault,env:{HUSH_GOOGLE_CLIENT_ID:clientId}});
  onboarding._save('google',{
    provider:'google',access_token:'expired-forced-refresh',refresh_token:refreshToken,token_type:'Bearer',connectedAt:Date.now(),authorizedAt:Date.now(),expiresAt:Date.now()-1,
    connectors:[],actions:['send_email','calendar_create'],scopes:['https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/calendar.events'],needsReauth:false
  });

  const suffix=crypto.randomBytes(6).toString('hex');
  const email=onboarding.requestAction({provider:'google',action:'send_email',agent:'hush-production-e2e',sink:'google:gmail-test',purpose:'production-e2e',resource:'me',arguments:{to:recipient,subject:`Hush production E2E ${suffix}`,body:`Automated Hush production verification ${suffix}.`}});
  assert.equal(email.decision,'ask');
  const emailApproved=onboarding.approveAction(email.actionId);
  assert.equal(emailApproved.decision,'allow');
  const emailResult=await onboarding.executeAction({actionId:email.actionId,agent:'hush-production-e2e',sink:'google:gmail-test'});
  assert.equal(emailResult.decision,'consumed');
  assert.equal(emailResult.result.sent,true);
  await assert.rejects(()=>onboarding.executeAction({actionId:email.actionId,agent:'hush-production-e2e',sink:'google:gmail-test'}),/consumed|not executable|already/i);

  const start=new Date(Date.now()+30*60*1000),end=new Date(start.getTime()+15*60*1000);
  const calendar=onboarding.requestAction({provider:'google',action:'calendar_create',agent:'hush-production-e2e',sink:'google:calendar-test',purpose:'production-e2e',resource:'primary',arguments:{calendarId:'primary',summary:`Hush production E2E ${suffix}`,description:`Automated verification ${suffix}`,start:start.toISOString(),end:end.toISOString()}});
  assert.equal(calendar.decision,'ask');
  onboarding.approveAction(calendar.actionId);
  const calendarResult=await onboarding.executeAction({actionId:calendar.actionId,agent:'hush-production-e2e',sink:'google:calendar-test'});
  assert.equal(calendarResult.decision,'consumed');
  assert.equal(calendarResult.result.created,true);

  const serialized=JSON.stringify({email:emailResult,calendar:calendarResult});
  assert.equal(serialized.includes(refreshToken),false);
  assert.equal(serialized.includes('expired-forced-refresh'),false);
  const receipts=onboarding.actionReceipts();
  assert.ok(receipts.length>=4);
  assert.equal(JSON.stringify(receipts).includes(refreshToken),false);

  report={schema:'hush.live-google-e2e.v1',status:'pass',startedAt,completedAt:new Date().toISOString(),gmail:{sent:true,id:emailResult.result.id??null},calendar:{created:true,id:calendarResult.result.id??null},oauthRefreshExercised:true,separateApprovalAndExecution:true,replayRejected:true,credentialLeakage:false,receiptCount:receipts.length};
}catch(error){report={schema:'hush.live-google-e2e.v1',status:'fail',startedAt,completedAt:new Date().toISOString(),error:error?.message||String(error)};process.exitCode=1;}
finally{fs.rmSync(work,{recursive:true,force:true});}
fs.mkdirSync('dist/evidence',{recursive:true});
fs.writeFileSync('dist/evidence/live-google-e2e.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
