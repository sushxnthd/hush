import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderOnboarding } from '../src/provider-onboarding.js';

class MemoryVault{
  constructor(){this.items=[];this.n=0;}
  list(){return this.items.map(({value,...x})=>structuredClone(x));}
  put({label,type,value,tags=[]}){const item={id:`v${++this.n}`,label,type,value,tags,createdAt:1};this.items.push(item);const{value:_,...safe}=item;return safe;}
  resolve(id){const item=this.items.find(x=>x.id===id);if(!item)throw new Error('Vault item not found');return item.value;}
  remove(id){const n=this.items.length;this.items=this.items.filter(x=>x.id!==id);return this.items.length!==n;}
}
function response(payload,{ok=true,status=200}={}){return {ok,status,json:async()=>structuredClone(payload)};}
const env={HUSH_GOOGLE_CLIENT_ID:'google-public-client'};

function googleState(started){return new URL(started.authorizationUrl).searchParams.get('state');}

test('Gmail send upgrades scope, requires exact approval, keeps OAuth local and is one-shot',async()=>{
  const vault=new MemoryVault();
  const calls=[];
  let phase='read-token';
  const fetchImpl=async(url,init={})=>{
    const target=String(url);
    calls.push({url:target,init});
    if(target==='https://oauth2.googleapis.com/token'){
      if(phase==='read-token') return response({access_token:'READ-ACCESS',refresh_token:'REFRESH-LOCAL',expires_in:3600,scope:'openid email https://www.googleapis.com/auth/gmail.readonly'});
      return response({access_token:'SEND-ACCESS-LOCAL',refresh_token:'REFRESH-LOCAL',expires_in:3600,scope:'openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'});
    }
    if(target.includes('/gmail/v1/users/me/messages/send')) return response({id:'msg-1',threadId:'thread-1'});
    throw new Error(`unexpected URL ${target}`);
  };
  const onboarding=new ProviderOnboarding({vault,fetchImpl,env,port:8787,now:()=>1000});
  const readStart=onboarding.startGoogle({connectors:['gmail']});
  await onboarding.completeGoogle({state:googleState(readStart),code:'read-code'});

  const needsScope=onboarding.requestAction({action:'send_email',agent:'assistant-A',sink:'gmail',purpose:'send approved note',arguments:{to:'person@example.com',subject:'Hi',body:'Approved body'}});
  assert.equal(needsScope.decision,'reauthorize');
  assert.match(needsScope.requiredScope,/gmail\.send$/);
  const upgradeUrl=new URL(needsScope.authorization.authorizationUrl);
  assert.match(upgradeUrl.searchParams.get('scope'),/gmail\.send/);
  assert.match(upgradeUrl.searchParams.get('scope'),/gmail\.readonly/);

  phase='send-token';
  await onboarding.completeGoogle({state:googleState(needsScope.authorization),code:'send-code'});
  const ticket=onboarding.requestAction({action:'send_email',agent:'assistant-A',sink:'gmail',purpose:'send approved note',arguments:{to:'person@example.com',subject:'Hi',body:'Approved body'}});
  assert.equal(ticket.decision,'ask');
  assert.deepEqual(ticket.argumentKeys,['bcc','body','cc','subject','to'].filter(key=>ticket.argumentKeys.includes(key)).sort());
  const beforeApproval=await onboarding.executeAction({actionId:ticket.actionId,agent:'assistant-A',sink:'gmail'});
  assert.equal(beforeApproval.decision,'ask');

  onboarding.approveAction(ticket.actionId);
  await assert.rejects(()=>onboarding.executeAction({actionId:ticket.actionId,agent:'assistant-B',sink:'gmail'}),/bound to another agent or sink/i);
  const out=await onboarding.executeAction({actionId:ticket.actionId,agent:'assistant-A',sink:'gmail'});
  assert.equal(out.decision,'allow');
  assert.equal(out.result.sent,true);
  assert.equal(JSON.stringify(out).includes('SEND-ACCESS-LOCAL'),false);
  const sendCall=calls.find(call=>call.url.includes('/messages/send'));
  assert.equal(sendCall.init.headers.authorization,'Bearer SEND-ACCESS-LOCAL');
  assert.doesNotMatch(sendCall.init.body,/SEND-ACCESS-LOCAL/);
  await assert.rejects(()=>onboarding.executeAction({actionId:ticket.actionId,agent:'assistant-A',sink:'gmail'}),/already consumed/i);
});

test('Calendar create is approval-gated and exposes only safe provider result metadata',async()=>{
  const vault=new MemoryVault();
  const calls=[];
  const fetchImpl=async(url,init={})=>{
    const target=String(url);calls.push({url:target,init});
    if(target==='https://oauth2.googleapis.com/token') return response({access_token:'CAL-ACCESS-LOCAL',refresh_token:'R',expires_in:3600,scope:'openid email https://www.googleapis.com/auth/calendar.events'});
    if(target.includes('/calendar/v3/calendars/primary/events')) return response({id:'evt-1',status:'confirmed',htmlLink:'https://calendar.google.com/event?eid=evt-1'});
    throw new Error(`unexpected URL ${target}`);
  };
  const onboarding=new ProviderOnboarding({vault,fetchImpl,env,port:8787,now:()=>2000});
  const start=onboarding.startGoogle({connectors:[],actions:['calendar_create']});
  await onboarding.completeGoogle({state:googleState(start),code:'calendar-code'});
  const ticket=onboarding.requestAction({action:'calendar_create',agent:'planner',sink:'calendar',purpose:'schedule approved review',resource:'primary',arguments:{summary:'Review',start:'2026-10-08T10:00:00+05:30',end:'2026-10-08T10:30:00+05:30',timeZone:'Asia/Kolkata'}});
  assert.equal(ticket.decision,'ask');
  onboarding.approveAction(ticket.actionId);
  const out=await onboarding.executeAction({actionId:ticket.actionId,agent:'planner',sink:'calendar'});
  assert.equal(out.decision,'allow');
  assert.equal(out.result.created,true);
  assert.equal(JSON.stringify(out).includes('CAL-ACCESS-LOCAL'),false);
  assert.match(calls.find(call=>call.url.includes('/events')).url,/sendUpdates=none/);
});
