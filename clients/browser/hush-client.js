const DEFAULT_BASE='http://127.0.0.1:8787';

async function request(path,{method='GET',body}={}){
  const base=(await chrome.storage.local.get('hushBaseUrl')).hushBaseUrl||DEFAULT_BASE;
  const url=new URL(path,base.endsWith('/')?base:`${base}/`);
  if(!['127.0.0.1','localhost','[::1]','::1'].includes(url.hostname)) throw new Error('Browser companion only connects to a loopback Hush runtime.');
  const options={method,headers:{accept:'application/json'}};
  if(body!==undefined){options.headers['content-type']='application/json';options.body=JSON.stringify(body);}
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  options.signal=controller.signal;
  try{
    const response=await fetch(url,options);
    const payload=await response.json();
    if(!response.ok&&response.status!==202) throw Object.assign(new Error(payload.error||payload.reason||`Hush request failed (${response.status})`),{payload,status:response.status});
    return payload;
  } finally { clearTimeout(timer); }
}

export const hush={
  status:()=>request('/api/status'),
  pending:()=>request('/api/pending'),
  footprint:()=>request('/api/privacy/footprint'),
  redact:text=>request('/api/redact',{method:'POST',body:{text:String(text??'')}}),
  approve:id=>request(`/api/pending/${encodeURIComponent(id)}/approve`,{method:'POST',body:{}}),
  deny:id=>request(`/api/pending/${encodeURIComponent(id)}/deny`,{method:'POST',body:{}})
};
