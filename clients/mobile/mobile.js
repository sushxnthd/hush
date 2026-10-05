const BASE='http://127.0.0.1:8787';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

async function request(path,{method='GET',body}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),4000);
  try{
    const response=await fetch(new URL(path,BASE),{
      method,
      signal:controller.signal,
      headers:{accept:'application/json',...(body!==undefined?{'content-type':'application/json'}:{})},
      ...(body!==undefined?{body:JSON.stringify(body)}:{})
    });
    const payload=await response.json();
    if(!response.ok&&response.status!==202) throw new Error(payload.error||payload.reason||'Hush request failed');
    return payload;
  }finally{clearTimeout(timer);}
}

function connected(ok){ $('dot').classList.toggle('on',ok); $('state').textContent=ok?'on device':'offline'; }
async function resolve(id,decision){
  await request(`/api/pending/${encodeURIComponent(id)}/${decision}`,{method:'POST',body:{}});
  refresh();
}

async function refresh(){
  try{
    const [status,pending,footprint]=await Promise.all([request('/api/status'),request('/api/pending'),request('/api/privacy/footprint')]);
    connected(true);
    $('waiting').textContent=status.pending??0;
    $('receipts').textContent=status.receipts??0;
    $('footprint').textContent=status.footprintAgents??footprint.agents?.length??0;
    const rows=pending.requests??[];
    $('pending').innerHTML=rows.length?rows.map(item=>{
      const requestData=item.request??{};
      const agent=requestData.agent||item.mcp?.agent||'AI';
      const action=item.kind==='disclosure'?'private disclosure':item.mcp?.tool||requestData.action||item.kind||'action';
      const detail=item.reason||item.risk||requestData.resource||'';
      return `<div class="row"><div><b>${esc(agent)} · ${esc(action)}</b><div class="meta">${esc(detail)}</div></div><div><button data-id="${esc(item.id)}" data-choice="approve">Allow once</button> <button class="deny" data-id="${esc(item.id)}" data-choice="deny">Deny</button></div></div>`;
    }).join(''):'<div class="empty">Nothing waiting.</div>';
    document.querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',()=>resolve(button.dataset.id,button.dataset.choice)));
  }catch{
    connected(false);
    $('waiting').textContent='–';$('receipts').textContent='–';$('footprint').textContent='–';
    $('pending').innerHTML='<div class="empty">The on-device Hush core is not running.</div>';
  }
}

refresh();
setInterval(refresh,5000);
