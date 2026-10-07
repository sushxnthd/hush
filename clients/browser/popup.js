import {hush} from './hush-client.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let lastRedacted='';
let githubPolling=false;

function setConnected(ok,label){
  $('dot').classList.toggle('on',ok);
  $('connection').textContent=label;
}
function setError(message=''){ $('error').textContent=message; }
function describePending(item){
  const request=item.request??{};
  const agent=request.agent||item.mcp?.agent||'AI';
  const action=item.kind==='disclosure'?'private disclosure':item.mcp?.tool||request.action||item.kind||'action';
  const resource=request.resource||item.disclosureRequest?.sink||item.mcp?.purpose||'';
  return {agent,action,resource};
}
function openExternal(url){
  const value=String(url||'');
  if(!/^https:\/\//i.test(value)) throw new Error('Provider returned an unsafe authorization URL');
  if(globalThis.chrome?.tabs?.create) chrome.tabs.create({url:value});
  else window.open(value,'_blank','noopener,noreferrer');
}

async function resolvePending(id,decision){
  setError('');
  try{
    if(decision==='approve') await hush.approve(id); else await hush.deny(id);
    await refresh();
  }catch(error){ setError(error?.message||'Could not resolve approval.'); }
}
window.resolvePending=resolvePending;

function providerRow(name,connection,configured){
  const title=name==='google'?'Google':'GitHub';
  const connected=Boolean(connection?.connected);
  const state=connected?(connection.needsReauth?'Re-auth required':'Connected'):(configured?'Not connected':'App setup required');
  const actions=connected
    ? `<div class="actions"><button data-provider-action="sync" data-provider="${name}">Sync</button><button class="ghost" data-provider-action="disconnect" data-provider="${name}">Disconnect</button></div>`
    : `<div class="actions"><button data-provider-action="connect" data-provider="${name}" ${configured?'':'disabled'}>${connection?.needsReauth?'Reconnect':'Connect'}</button></div>`;
  const detail=connected&&connection.connectors?.length?` · ${connection.connectors.map(esc).join(', ')}`:'';
  return `<div class="row"><div><b>${title}</b> <span class="badge ${connected&&!connection.needsReauth?'on':''}">${esc(state)}</span><div class="meta">Credentials stay local${detail}</div></div>${actions}</div>`;
}

async function renderProviders(){
  const status=await hush.onboardingStatus();
  $('providers').innerHTML=providerRow('google',status.providers?.google,status.configured?.google)+providerRow('github',status.providers?.github,status.configured?.github);
  document.querySelectorAll('[data-provider-action]').forEach(button=>button.addEventListener('click',()=>providerAction(button.dataset.provider,button.dataset.providerAction)));
}

async function providerAction(provider,action){
  setError('');
  try{
    if(action==='connect'&&provider==='google'){
      const started=await hush.startGoogle();
      openExternal(started.authorizationUrl);
      $('deviceFlow').textContent='Complete Google consent in the opened tab, then return here.';
      return;
    }
    if(action==='connect'&&provider==='github'){
      const started=await hush.startGithub();
      await chrome.storage.local.set({hushGithubFlow:{sessionId:started.sessionId,userCode:started.userCode,verificationUri:started.verificationUri,expiresAt:started.expiresAt}});
      $('deviceFlow').innerHTML=`GitHub code: <span class="code">${esc(started.userCode)}</span><br>Enter it in the opened GitHub tab.`;
      openExternal(started.verificationUri);
      pollGithub();
      return;
    }
    if(action==='sync'){
      $('deviceFlow').textContent=`Syncing ${provider} into your private Context Kernel…`;
      await hush.syncProvider(provider);
      $('deviceFlow').textContent=`${provider==='google'?'Google':'GitHub'} synced locally.`;
      await refresh();
      return;
    }
    if(action==='disconnect'){
      await hush.disconnectProvider(provider);
      $('deviceFlow').textContent=`${provider==='google'?'Google':'GitHub'} access removed from Hush.`;
      await refresh();
    }
  }catch(error){ setError(error?.message||`${provider} ${action} failed.`); }
}

async function pollGithub(){
  if(githubPolling) return;
  const stored=(await chrome.storage.local.get('hushGithubFlow')).hushGithubFlow;
  if(!stored?.sessionId) return;
  if(stored.expiresAt&&Date.now()>=stored.expiresAt){ await chrome.storage.local.remove('hushGithubFlow'); $('deviceFlow').textContent='GitHub connection expired. Start again.'; return; }
  githubPolling=true;
  try{
    const result=await hush.pollGithub(stored.sessionId);
    if(result.status==='connected'){
      await chrome.storage.local.remove('hushGithubFlow');
      $('deviceFlow').textContent='GitHub connected locally.';
      await refresh();
      return;
    }
    $('deviceFlow').innerHTML=`Waiting for GitHub authorization. Code: <span class="code">${esc(stored.userCode)}</span>`;
    setTimeout(()=>{githubPolling=false;pollGithub();},Math.max(5000,Number(result.retryAfterMs||5000)));
  }catch(error){
    await chrome.storage.local.remove('hushGithubFlow');
    setError(error?.message||'GitHub authorization failed.');
  }finally{
    if(githubPolling) githubPolling=false;
  }
}

async function refresh(){
  setError('');
  try{
    const [status,pending,footprint]=await Promise.all([hush.status(),hush.pending(),hush.footprint()]);
    setConnected(true,'local');
    $('waiting').textContent=String(status.pending??pending.requests?.length??0);
    $('receipts').textContent=String(status.receipts??0);
    $('footprint').textContent=String(status.footprintAgents??footprint.agents?.length??0);
    const rows=pending.requests??[];
    $('pending').innerHTML=rows.length?rows.map(item=>{
      const x=describePending(item);
      return `<div class="row"><div><b>${esc(x.agent)} · ${esc(x.action)}</b><div class="meta">${esc(item.reason||item.risk||'Approval required')}${x.resource?` · ${esc(x.resource)}`:''}</div></div><div class="actions"><button data-id="${esc(item.id)}" data-decision="approve">Allow once</button><button class="deny" data-id="${esc(item.id)}" data-decision="deny">Deny</button></div></div>`;
    }).join(''):'<div class="empty">Nothing waiting.</div>';
    document.querySelectorAll('[data-decision]').forEach(button=>button.addEventListener('click',()=>resolvePending(button.dataset.id,button.dataset.decision)));
    await renderProviders();
  }catch(error){
    setConnected(false,'offline');
    $('waiting').textContent='–';$('receipts').textContent='–';$('footprint').textContent='–';
    $('pending').innerHTML='<div class="empty">Start Hush on this device to review approvals.</div>';
    $('providers').innerHTML='<div class="empty">Start Hush to manage connections.</div>';
    setError(error?.message||'Local Hush runtime is unavailable.');
  }
}

$('redact').addEventListener('click',async()=>{
  setError('');
  try{
    const result=await hush.redact($('input').value);
    lastRedacted=String(result.redacted??'');
    $('output').textContent=`Detected ${result.count??0}\n\n${lastRedacted}`;
  }catch(error){ setError(error?.message||'Redaction failed.'); }
});

$('copy').addEventListener('click',async()=>{
  if(!lastRedacted) return;
  try{ await navigator.clipboard.writeText(lastRedacted); $('copy').textContent='Copied'; setTimeout(()=>$('copy').textContent='Copy result',900); }
  catch{ setError('Clipboard permission was unavailable.'); }
});

refresh().then(pollGithub);
setInterval(refresh,5000);
