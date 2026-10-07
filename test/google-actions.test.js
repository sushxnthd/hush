import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionBroker } from '../src/action-broker.js';
import { GOOGLE_ACTION_SCOPES, registerGoogleActionAdapter } from '../src/google-actions.js';

function json(payload){return {ok:true,status:200,json:async()=>structuredClone(payload)};}

test('Gmail adapter sends through Authorization header and returns only safe provider metadata',async()=>{
  const calls=[];
  const broker=new ActionBroker();
  registerGoogleActionAdapter({broker,getAccessToken:async()=>'ACCESS-TOKEN-SHOULD-STAY-LOCAL',fetchImpl:async(url,init)=>{calls.push({url:String(url),init});return json({id:'m1',threadId:'t1'});}});
  const requested=broker.request({adapter:'google',action:'send_email',agent:'assistant',sink:'gmail',purpose:'send requested note',category:'communication',resource:'me',arguments:{to:'person@example.com',subject:'Hello',body:'Body'}});
  assert.equal(requested.decision,'ask');
  broker.approve(requested.actionId);
  const result=await broker.execute({actionId:requested.actionId,agent:'assistant',sink:'gmail'});
  assert.equal(result.decision,'allow');
  assert.equal(result.result.sent,true);
  assert.equal(JSON.stringify(result).includes('ACCESS-TOKEN-SHOULD-STAY-LOCAL'),false);
  assert.equal(calls.length,1);
  assert.equal(calls[0].init.headers.authorization,'Bearer ACCESS-TOKEN-SHOULD-STAY-LOCAL');
  assert.doesNotMatch(calls[0].init.body,/ACCESS-TOKEN-SHOULD-STAY-LOCAL/);
  const raw=JSON.parse(calls[0].init.body).raw;
  const message=Buffer.from(raw,'base64url').toString('utf8');
  assert.match(message,/To: person@example\.com/);
  assert.match(message,/Subject: Hello/);
});

test('Calendar adapter creates only the approved event and suppresses attendee update mail',async()=>{
  const calls=[];
  const broker=new ActionBroker();
  registerGoogleActionAdapter({broker,getAccessToken:async()=>'A',fetchImpl:async(url,init)=>{calls.push({url:String(url),init});return json({id:'e1',status:'confirmed',htmlLink:'https://calendar.google.com/event?eid=e1'});}});
  const requested=broker.request({adapter:'google',action:'calendar_create',agent:'assistant',sink:'calendar',purpose:'schedule meeting',category:'calendar',resource:'primary',arguments:{summary:'Design review',start:'2026-10-08T10:00:00+05:30',end:'2026-10-08T10:30:00+05:30',timeZone:'Asia/Kolkata'}});
  broker.approve(requested.actionId);
  const result=await broker.execute({actionId:requested.actionId,agent:'assistant',sink:'calendar'});
  assert.equal(result.decision,'allow');
  assert.equal(result.result.created,true);
  assert.match(calls[0].url,/calendars\/primary\/events\?sendUpdates=none$/);
  const body=JSON.parse(calls[0].init.body);
  assert.equal(body.summary,'Design review');
  assert.equal(body.start.timeZone,'Asia/Kolkata');
});

test('action arguments fail closed on header injection invalid recipients and invalid event ranges',()=>{
  const broker=new ActionBroker();
  registerGoogleActionAdapter({broker,getAccessToken:async()=>'A',fetchImpl:async()=>json({})});
  const email=broker.request({adapter:'google',action:'send_email',arguments:{to:'victim@example.com',subject:'ok\r\nBcc: evil@example.com',body:'x'}});
  broker.approve(email.actionId);
  return broker.execute({actionId:email.actionId}).then(result=>{
    assert.equal(result.decision,'error');
    const calendar=broker.request({adapter:'google',action:'calendar_create',arguments:{summary:'x',start:'2026-10-08T11:00:00Z',end:'2026-10-08T10:00:00Z'}});
    broker.approve(calendar.actionId);
    return broker.execute({actionId:calendar.actionId}).then(out=>assert.equal(out.decision,'error'));
  });
});

test('Google action scopes are least-privilege action scopes',()=>{
  assert.equal(GOOGLE_ACTION_SCOPES.send_email,'https://www.googleapis.com/auth/gmail.send');
  assert.equal(GOOGLE_ACTION_SCOPES.calendar_create,'https://www.googleapis.com/auth/calendar.events');
});
