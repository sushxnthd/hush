import {hush} from './hush-client.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let lastRedacted='';

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

async function resolvePending(id,decision){
  setError('');
  try{
    if(decision==='approve') await hush.approve(id); else await hush.deny(id);
    await refresh();
  }catch(error){ setError(error?.message||'Could not resolve approval.'); }
}
window.resolvePending=resolvePending;

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
  }catch(error){
    setConnected(false,'offline');
    $('waiting').textContent='–';$('receipts').textContent='–';$('footprint').textContent='–';
    $('pending').innerHTML='<div class="empty">Start Hush on this device to review approvals.</div>';
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

refresh();
setInterval(refresh,5000);
