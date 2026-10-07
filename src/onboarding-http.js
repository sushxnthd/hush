const MAX_BODY=64*1024;

async function readJson(req){
  const chunks=[]; let total=0;
  for await(const chunk of req){ total+=chunk.length; if(total>MAX_BODY) throw Object.assign(new Error('Request body too large'),{status:413}); chunks.push(chunk); }
  if(!chunks.length) return {};
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}
}
function json(res,status,payload){
  const value=JSON.stringify(payload);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-length':Buffer.byteLength(value)});
  res.end(value);
}
function html(res,status,title,message){
  const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const value=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escape(title)}</title><style>body{font:16px system-ui;background:#0b0b0c;color:#f5f5f5;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:520px;padding:32px;border:1px solid #2a2a2d;border-radius:18px;background:#141416}h1{font-size:22px}p{color:#b5b5bb;line-height:1.5}</style></head><body><main class="card"><h1>${escape(title)}</h1><p>${escape(message)}</p></main></body></html>`;
  res.writeHead(status,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'",'content-length':Buffer.byteLength(value)});
  res.end(value);
}
function providerFromPath(pathname,suffix){
  const match=pathname.match(new RegExp(`^/api/onboarding/(google|github)/${suffix}$`));
  return match?.[1]??null;
}
function actionRoute(pathname,suffix){
  const match=pathname.match(new RegExp(`^/api/actions/([^/]+)/${suffix}$`));
  return match?decodeURIComponent(match[1]):null;
}

export async function handleOnboardingRequest({req,res,u,onboarding}){
  if(!u.pathname.startsWith('/api/onboarding/')&&!u.pathname.startsWith('/api/actions')) return false;
  try{
    if(req.method==='GET'&&u.pathname==='/api/onboarding/status'){
      json(res,200,onboarding.status()); return true;
    }
    if(req.method==='POST'&&u.pathname==='/api/onboarding/google/start'){
      const body=await readJson(req); json(res,201,onboarding.startGoogle({connectors:body.connectors,actions:body.actions})); return true;
    }
    if(req.method==='GET'&&u.pathname==='/api/onboarding/callback/google'){
      try{
        await onboarding.completeGoogle({state:u.searchParams.get('state'),code:u.searchParams.get('code'),error:u.searchParams.get('error')});
        html(res,200,'Google connected','Hush has connected Google locally. You can close this tab and return to Hush.');
      }catch(error){ html(res,400,'Google connection failed',error.message||'Authorization failed.'); }
      return true;
    }
    if(req.method==='POST'&&u.pathname==='/api/onboarding/github/start'){
      json(res,201,await onboarding.startGithub()); return true;
    }
    if(req.method==='POST'&&u.pathname==='/api/onboarding/github/poll'){
      const body=await readJson(req); if(!body.sessionId){json(res,400,{error:'sessionId is required'});return true;}
      json(res,200,await onboarding.pollGithub(body.sessionId)); return true;
    }
    const syncProvider=providerFromPath(u.pathname,'sync');
    if(req.method==='POST'&&syncProvider){
      const body=await readJson(req); json(res,200,await onboarding.sync(syncProvider,{connectors:body.connectors,limit:body.limit})); return true;
    }
    const disconnectProvider=providerFromPath(u.pathname,'disconnect');
    if(req.method==='POST'&&disconnectProvider){
      json(res,200,await onboarding.disconnect(disconnectProvider,{remote:true})); return true;
    }

    if(req.method==='GET'&&u.pathname==='/api/actions'){
      json(res,200,{actions:onboarding.actionQueue()}); return true;
    }
    if(req.method==='GET'&&u.pathname==='/api/actions/receipts'){
      json(res,200,{receipts:onboarding.actionReceipts()}); return true;
    }
    if(req.method==='POST'&&u.pathname==='/api/actions/request'){
      const body=await readJson(req);
      if(!body.action){json(res,400,{error:'action is required'});return true;}
      const out=onboarding.requestAction({
        provider:body.provider??'google',action:body.action,agent:body.agent??'unknown-agent',sink:body.sink??null,
        purpose:body.purpose??'unspecified',category:body.category??null,resource:body.resource??'me',arguments:body.arguments??{}
      });
      json(res,out.decision==='reauthorize'?409:201,out); return true;
    }
    const approveId=actionRoute(u.pathname,'approve');
    if(req.method==='POST'&&approveId){ json(res,200,onboarding.approveAction(approveId)); return true; }
    const denyId=actionRoute(u.pathname,'deny');
    if(req.method==='POST'&&denyId){ json(res,200,onboarding.denyAction(denyId)); return true; }
    const executeId=actionRoute(u.pathname,'execute');
    if(req.method==='POST'&&executeId){
      const body=await readJson(req);
      if(!body.agent||!body.sink){json(res,400,{error:'agent and sink are required to execute a bound action'});return true;}
      json(res,200,await onboarding.executeAction({actionId:executeId,agent:String(body.agent),sink:String(body.sink)})); return true;
    }

    json(res,404,{error:'Onboarding/action route not found'}); return true;
  }catch(error){
    const status=Number(error?.status)||(/not configured|not connected|reauth/i.test(String(error?.message))?409:400);
    json(res,status,{error:error?.message||'Onboarding/action request failed'}); return true;
  }
}
