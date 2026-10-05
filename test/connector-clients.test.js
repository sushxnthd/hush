import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';
import {fetchConnectorSnapshot,liveConnectorProviders,syncConnectorToKernel} from '../src/connector-clients.js';

function response(body,status=200){ return {ok:status>=200&&status<300,status,json:async()=>structuredClone(body)}; }
function temp(){ return fs.mkdtempSync(path.join(os.tmpdir(),'hush-live-connectors-')); }

test('live connector registry covers Google context sources plus GitHub',()=>{
  assert.deepEqual(liveConnectorProviders(),['gmail','calendar','drive','contacts','github']);
});

test('gmail client uses bearer auth, fetches bounded metadata, and never returns the token',async()=>{
  const calls=[];
  const fakeFetch=async(url,init)=>{
    calls.push({url:String(url),init});
    const u=new URL(url);
    if(u.pathname==='/gmail/v1/users/me/messages') return response({messages:[{id:'m1'},{id:'m2'}]});
    if(u.pathname.endsWith('/m1')) return response({id:'m1',threadId:'t1',snippet:'hello',labelIds:['INBOX'],payload:{headers:[{name:'Subject',value:'Trip'},{name:'From',value:'a@example.com'}]}});
    if(u.pathname.endsWith('/m2')) return response({id:'m2',threadId:'t2',snippet:'world',payload:{headers:[{name:'Subject',value:'School'}]}});
    return response({},404);
  };
  const snapshot=await fetchConnectorSnapshot({provider:'gmail',accessToken:'top-secret-token',limit:2,fetchImpl:fakeFetch});
  assert.equal(snapshot.provider,'gmail');
  assert.equal(snapshot.collection,'messages');
  assert.equal(snapshot.items.length,2);
  assert.equal(snapshot.items[0].subject,'Trip');
  assert.equal(JSON.stringify(snapshot).includes('top-secret-token'),false);
  assert.equal(calls.length,3);
  assert.ok(calls.every(call=>call.init.headers.authorization==='Bearer top-secret-token'));
  assert.match(calls[0].url,/maxResults=2/);
  assert.match(calls[1].url,/format=metadata/);
});

test('calendar, drive, contacts, and GitHub clients use fixed provider endpoints',async()=>{
  const seen=[];
  const fakeFetch=async(url,init)=>{
    const u=new URL(url); seen.push({u,init});
    if(u.hostname==='www.googleapis.com'&&u.pathname.includes('/calendar/')) return response({items:[{id:'e1',summary:'Exam'}]});
    if(u.hostname==='www.googleapis.com'&&u.pathname==='/drive/v3/files') return response({files:[{id:'f1',name:'Notes'}]});
    if(u.hostname==='people.googleapis.com') return response({connections:[{resourceName:'people/c1',names:[{displayName:'Ada'}]}]});
    if(u.hostname==='api.github.com') return response([{id:7,name:'repo',full_name:'me/repo',private:true}]);
    return response({},404);
  };
  const token='connector-token';
  const calendar=await fetchConnectorSnapshot({provider:'calendar',accessToken:token,fetchImpl:fakeFetch,options:{timeMin:'2026-10-01T00:00:00Z'}});
  const drive=await fetchConnectorSnapshot({provider:'drive',accessToken:token,fetchImpl:fakeFetch});
  const contacts=await fetchConnectorSnapshot({provider:'contacts',accessToken:token,fetchImpl:fakeFetch});
  const github=await fetchConnectorSnapshot({provider:'github',accessToken:token,fetchImpl:fakeFetch});
  assert.equal(calendar.items[0].summary,'Exam');
  assert.equal(drive.items[0].name,'Notes');
  assert.equal(contacts.items[0].displayName,'Ada');
  assert.equal(github.items[0].full_name,'me/repo');
  assert.deepEqual(new Set(seen.map(call=>call.u.hostname)),new Set(['www.googleapis.com','people.googleapis.com','api.github.com']));
  assert.ok(seen.every(call=>call.init.headers.authorization===`Bearer ${token}`));
  const gh=seen.find(call=>call.u.hostname==='api.github.com');
  assert.equal(gh.init.headers['user-agent'],'hush-local-connector');
});

test('syncConnectorToKernel seals fetched provider data without persisting the access token',async()=>{
  const dir=temp();
  const kernel=new ContextKernel({dir,passphrase:'live connector kernel passphrase'});
  const fakeFetch=async()=>response([{id:9,name:'private-repo',full_name:'owner/private-repo',private:true}]);
  const out=await syncConnectorToKernel({kernel,provider:'github',accessToken:'never-persist-this-token',fetchImpl:fakeFetch,limit:1});
  assert.equal(out.created,1);
  assert.equal(out.total,1);
  const persisted=fs.readFileSync(path.join(dir,'sealed-context.json'),'utf8');
  assert.equal(persisted.includes('never-persist-this-token'),false);
  assert.equal(persisted.includes('owner/private-repo'),false);
});

test('live connectors fail closed on unsupported providers, missing tokens, and upstream errors',async()=>{
  await assert.rejects(()=>fetchConnectorSnapshot({provider:'unknown',accessToken:'x',fetchImpl:async()=>response({})}),/Unsupported live connector/);
  await assert.rejects(()=>fetchConnectorSnapshot({provider:'drive',accessToken:'',fetchImpl:async()=>response({})}),/access token is required/);
  await assert.rejects(()=>fetchConnectorSnapshot({provider:'drive',accessToken:'x',fetchImpl:async()=>response({},401)}),/Connector request failed \(401\)/);
});
