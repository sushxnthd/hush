import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderOnboarding, createPkcePair } from '../src/provider-onboarding.js';

class MemoryVault{
  constructor(){this.items=[];this.n=0;}
  list(){return this.items.map(({value,...x})=>structuredClone(x));}
  put({label,type,value,tags=[]}){const item={id:`v${++this.n}`,label,type,value,tags,createdAt:1};this.items.push(item);const{value:_,...safe}=item;return safe;}
  resolve(id){const item=this.items.find(x=>x.id===id);if(!item)throw new Error('Vault item not found');return item.value;}
  remove(id){const n=this.items.length;this.items=this.items.filter(x=>x.id!==id);return this.items.length!==n;}
}

function jsonResponse(payload,{ok=true,status=200}={}){return {ok,status,json:async()=>structuredClone(payload)};}

const env={HUSH_GOOGLE_CLIENT_ID:'google-public-client',HUSH_GITHUB_CLIENT_ID:'github-public-client'};

test('PKCE uses an S256 verifier/challenge pair',()=>{
  const a=createPkcePair(),b=createPkcePair();
  assert.equal(a.method,'S256');
  assert.ok(a.verifier.length>=43);
  assert.equal(a.challenge.length,43);
  assert.notEqual(a.verifier,a.challenge);
  assert.notEqual(a.verifier,b.verifier);
});

test('Google onboarding is scoped, state-bound and never returns token material',async()=>{
  const vault=new MemoryVault();
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url:String(url),init});
    return jsonResponse({access_token:'ACCESS-SECRET',refresh_token:'REFRESH-SECRET',expires_in:3600,token_type:'Bearer',scope:'openid email https://www.googleapis.com/auth/gmail.readonly'});
  };
  const onboarding=new ProviderOnboarding({vault,fetchImpl,env,port:8787,now:()=>1000});
  const started=onboarding.startGoogle({connectors:['gmail']});
  const auth=new URL(started.authorizationUrl);
  assert.equal(auth.hostname,'accounts.google.com');
  assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
  assert.equal(auth.searchParams.get('redirect_uri'),'http://127.0.0.1:8787/api/onboarding/callback/google');
  assert.match(auth.searchParams.get('scope'),/gmail\.readonly/);
  assert.doesNotMatch(auth.searchParams.get('scope'),/calendar/);
  await assert.rejects(()=>onboarding.completeGoogle({state:'wrong',code:'abc'}),/state mismatch/i);
  const state=auth.searchParams.get('state');
  const result=await onboarding.completeGoogle({state,code:'authorization-code'});
  assert.equal(result.provider,'google');
  assert.equal(result.connected,true);
  assert.equal(JSON.stringify(result).includes('ACCESS-SECRET'),false);
  assert.equal(JSON.stringify(vault.list()).includes('ACCESS-SECRET'),false);
  assert.equal(JSON.stringify(vault.list()).includes('REFRESH-SECRET'),false);
  assert.equal(calls.length,1);
  assert.match(String(calls[0].init.body),/code_verifier=/);
});

test('expired Google access token refreshes from encrypted vault without exposing refresh token',async()=>{
  const vault=new MemoryVault();
  let now=1000;
  const replies=[
    {access_token:'A1',refresh_token:'R1',expires_in:1,token_type:'Bearer'},
    {access_token:'A2',expires_in:3600,token_type:'Bearer'}
  ];
  const fetchImpl=async()=>jsonResponse(replies.shift());
  const onboarding=new ProviderOnboarding({vault,fetchImpl,env,port:8787,now:()=>now});
  const start=onboarding.startGoogle({connectors:['gmail']});
  const state=new URL(start.authorizationUrl).searchParams.get('state');
  await onboarding.completeGoogle({state,code:'c'});
  now=70_000;
  assert.equal(await onboarding.accessToken('google'),'A2');
  const status=onboarding.status();
  assert.equal(JSON.stringify(status).includes('R1'),false);
});

test('GitHub device flow enforces provider polling interval and stores token only after authorization',async()=>{
  const vault=new MemoryVault();
  let now=10_000;
  let tokenPolls=0;
  const fetchImpl=async(url)=>{
    if(String(url).includes('/login/device/code')) return jsonResponse({device_code:'device-secret',user_code:'ABCD-EFGH',verification_uri:'https://github.com/login/device',expires_in:900,interval:5});
    tokenPolls++;
    if(tokenPolls===1) return jsonResponse({error:'authorization_pending'});
    return jsonResponse({access_token:'GHU-SECRET',token_type:'bearer'});
  };
  const onboarding=new ProviderOnboarding({vault,fetchImpl,env,now:()=>now});
  const start=await onboarding.startGithub();
  assert.equal(start.userCode,'ABCD-EFGH');
  assert.equal(JSON.stringify(start).includes('device-secret'),false);
  const first=await onboarding.pollGithub(start.sessionId);
  assert.equal(first.status,'pending');
  const tooSoon=await onboarding.pollGithub(start.sessionId);
  assert.equal(tooSoon.status,'pending');
  assert.equal(tokenPolls,1);
  now+=5000;
  const connected=await onboarding.pollGithub(start.sessionId);
  assert.equal(connected.status,'connected');
  assert.equal(JSON.stringify(connected).includes('GHU-SECRET'),false);
  assert.equal(JSON.stringify(vault.list()).includes('GHU-SECRET'),false);
});

test('disconnect removes local connector authority and attempts Google remote revocation',async()=>{
  const vault=new MemoryVault();
  let revokeCalled=false;
  const responses=[{access_token:'A',refresh_token:'R',expires_in:3600}];
  const fetchImpl=async(url)=>{
    if(String(url).startsWith('https://oauth2.googleapis.com/revoke')){revokeCalled=true;return {ok:true,status:200,json:async()=>({})};}
    return jsonResponse(responses.shift());
  };
  const onboarding=new ProviderOnboarding({vault,fetchImpl,env,port:8787,now:()=>1});
  const start=onboarding.startGoogle({connectors:['drive']});
  await onboarding.completeGoogle({state:new URL(start.authorizationUrl).searchParams.get('state'),code:'c'});
  const out=await onboarding.disconnect('google');
  assert.equal(out.localAuthorityRemoved,true);
  assert.equal(out.remoteRevoked,true);
  assert.equal(revokeCalled,true);
  assert.equal(onboarding.status().providers.google.connected,false);
});
