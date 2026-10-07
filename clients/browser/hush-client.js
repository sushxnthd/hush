const DEFAULT_BASE='http://127.0.0.1:8787';

async function request(path,{method='GET',body}={}){
  const base=(await chrome.storage.local.get('hushBaseUrl')).hushBaseUrl||DEFAULT_BASE;
  const url=new URL(path,base.endsWith('/')?base:`${base}/`);
  if(!['127.0.0.1','localhost','[::1]','::1'].includes(url.hostname)) throw new Error('Browser companion only connects to a loopback Hush runtime.');
  const options={method,headers:{accept:'application/json'}};
  if(body!==undefined){options.headers['content-type']='application/json';options.body=JSON.stringify(body);}
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  options.signal=controller.signal;
  try{
    const response=await fetch(url,options);
    const payload=await response.json();
    if(!response.ok&&response.status!==202) throw Object.assign(new Error(payload.error||payload.reason||`Hush request failed (${response.status})`),{payload,status:response.status});
    return payload;
  } finally { clearTimeout(timer); }
}

const provider=value=>{
  const name=String(value||'').toLowerCase();
  if(!['google','github'].includes(name)) throw new Error('Unsupported provider');
  return name;
};
const selectedGoogle=(connectors=[],actions=[])=>{
  const c=[...new Set((connectors??[]).map(String).filter(Boolean))];
  const a=[...new Set((actions??[]).map(String).filter(Boolean))];
  if(!c.length&&!a.length) throw new Error('Choose at least one Google permission before connecting.');
  return {connectors:c,actions:a};
};

async function requestAction(input){
  try{return await request('/api/onboarding/actions/request',{method:'POST',body:input});}
  catch(error){
    if(error?.status===409&&error?.payload?.decision==='reauthorize') return error.payload;
    throw error;
  }
}

export const hush={
  status:()=>request('/api/status'),
  pending:()=>request('/api/pending'),
  footprint:()=>request('/api/privacy/footprint'),
  redact:text=>request('/api/redact',{method:'POST',body:{text:String(text??'')}}),
  approve:id=>request(`/api/pending/${encodeURIComponent(id)}/approve`,{method:'POST',body:{}}),
  deny:id=>request(`/api/pending/${encodeURIComponent(id)}/deny`,{method:'POST',body:{}}),
  onboardingStatus:()=>request('/api/onboarding/status'),
  startGoogle:(connectors=[],actions=[])=>request('/api/onboarding/google/start',{method:'POST',body:selectedGoogle(connectors,actions)}),
  startGithub:()=>request('/api/onboarding/github/start',{method:'POST',body:{}}),
  pollGithub:sessionId=>request('/api/onboarding/github/poll',{method:'POST',body:{sessionId}}),
  syncProvider:(name,connectors)=>request(`/api/onboarding/${provider(name)}/sync`,{method:'POST',body:{connectors,limit:50}}),
  disconnectProvider:name=>request(`/api/onboarding/${provider(name)}/disconnect`,{method:'POST',body:{}}),
  actions:()=>request('/api/onboarding/actions'),
  actionReceipts:()=>request('/api/onboarding/actions/receipts'),
  requestAction,
  approveAction:id=>request(`/api/onboarding/actions/${encodeURIComponent(id)}/approve`,{method:'POST',body:{}}),
  denyAction:id=>request(`/api/onboarding/actions/${encodeURIComponent(id)}/deny`,{method:'POST',body:{}}),
  executeAction:(id,{agent,sink})=>request(`/api/onboarding/actions/${encodeURIComponent(id)}/execute`,{method:'POST',body:{agent,sink}})
};
