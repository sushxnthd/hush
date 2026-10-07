window.captureHushHomeFidelity=()=>{
  if(window.__hushFidelityCaptured)return;window.__hushFidelityCaptured=true;
  const prod=document.querySelector('#production');if(!prod)return;
  const q=area=>prod.querySelector(`.stat[style*="grid-area: ${area}"]`);
  window.__hushSourceCards={latency:q('latency')?.cloneNode(true),tokens:q('tokens')?.cloneNode(true),orgs:q('orgs')?.cloneNode(true),bench:prod.querySelector('.stat-bench')?.cloneNode(true)};
};

window.initHushHomeFidelity=()=>{
  if(window.__hushHomeFidelity)return;window.__hushHomeFidelity=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];

  const statement=$('.hero .statement');
  if(statement)statement.textContent='Hush is building the user-owned trust layer for private context across every AI.';
  const dek=$('.hero .dek');
  if(dek)dek.textContent='Private context, memory and scoped authority across every model.';

  const prod=$('#production'),saved=window.__hushSourceCards||{};
  if(prod){
    const restore=(area,node)=>{const cur=prod.querySelector(`.stat[style*="grid-area: ${area}"]`);if(cur&&node){const fresh=node.cloneNode(true);cur.replaceWith(fresh);return fresh}return cur};
    const latency=restore('latency',saved.latency);
    const tokens=restore('tokens',saved.tokens);
    const orgs=restore('orgs',saved.orgs);
    const bench=prod.querySelector('.stat-bench');
    if(bench&&saved.bench)bench.replaceWith(saved.bench.cloneNode(true));

    if(latency){
      const label=$('.stat-label',latency);if(label)label.innerHTML='Secretless actions<small>50 paired AgentLeak traces</small>';
      const rows=$$('tbody tr',latency);if(rows[0]){const c=$$('td',rows[0]);if(c[0])c[0].textContent='0%';if(c[1])c[1].textContent='100%'}if(rows[1]){const c=$$('td',rows[1]);if(c[0])c[0].textContent='100%';if(c[1])c[1].textContent='100%'}
    }
    if(tokens){const label=$('.stat-label',tokens);if(label)label.innerHTML='Bounded decisions<small>160 connector-backed cases</small>';const n=$('.stat-n',tokens);if(n)n.innerHTML='160<span class="stat-unit">/160</span>'}
    if(orgs){const label=$('.stat-label',orgs);if(label)label.innerHTML='Frozen scientific gates<small>AgentCIBench · external holdout</small>';const n=$('.stat-n',orgs);if(n)n.innerHTML='8<span class="stat-unit">/8</span>';if(!$('.gate-strip',orgs)){const g=document.createElement('div');g.className='gate-strip';g.setAttribute('aria-label','Eight of eight frozen scientific gates passed');g.innerHTML='<i></i>'.repeat(8);orgs.append(g)}}

    const restoredBench=$('.stat-bench',prod);
    if(restoredBench){
      const halves=$$('.bench-half',restoredBench);
      if(halves[0])halves[0].innerHTML='<div class="verdict">Pinned AgentLeak detector</div><span class="stat-n">0<span class="stat-unit">%</span></span><p>credential-canary leakage with 100% task success across 50 paired ActionBroker traces</p>';
      if(halves[1])halves[1].innerHTML='<div class="verdict">Frozen AgentCIBench</div><span class="stat-n">95.07<span class="stat-unit">%</span></span><p>completeness · 15.4% relative reduction in exact protected-context violation · 6–0 paired leak-free wins</p>';
    }

    const ours=prod.querySelector('.stat-ours');
    if(ours)ours.innerHTML=`<div class="ours-head"><span class="stat-label">Scientific Superiority v1<small>4,000 paired bounded-personalization tasks</small></span><dl class="pair"><div><dt>Oracle agreement</dt><dd><span class="stat-n sm">100<span class="stat-unit">%</span></span><span class="delta">vs 84.125% coarse</span></dd></div><div><dt>Exact private attrs</dt><dd><span class="stat-n sm">0.000</span><span class="delta">vs 0.938 coarse</span></dd></div></dl></div><figure class="fidelity-bench"><div class="fidelity-bench-head"><div><div class="fidelity-bench-kicker">Figure 1 · privacy × utility</div><h4 class="fidelity-bench-title">Same task utility with less exact private input</h4></div><div class="fidelity-bench-tag">preregistered internal protocol</div></div><div class="fidelity-panels"><div class="fidelity-panel"><div class="fidelity-panel-label"><span>Oracle agreement</span><span>higher is better</span></div><div class="fidelity-row hush"><span>Hush</span><span class="fidelity-track"><i style="--w:100%"></i></span><b>100%</b></div><div class="fidelity-row"><span>Coarse</span><span class="fidelity-track"><i style="--w:84.125%"></i></span><b>84.125%</b></div><div class="fidelity-row"><span>Raw</span><span class="fidelity-track"><i style="--w:100%"></i></span><b>100%</b></div></div><div class="fidelity-panel"><div class="fidelity-panel-label"><span>Exact private attrs / task</span><span>lower is better</span></div><div class="fidelity-row hush"><span>Hush</span><span class="fidelity-track"><i style="--w:0%"></i></span><b>0.000</b></div><div class="fidelity-row"><span>Coarse</span><span class="fidelity-track"><i style="--w:46.9%"></i></span><b>0.938</b></div><div class="fidelity-row"><span>Raw</span><span class="fidelity-track"><i style="--w:100%"></i></span><b>2.000</b></div></div></div><div class="fidelity-recon"><div><strong>100%</strong><span>unprotected exact recovery<br>16 answers · 1 candidate</span><span class="fidelity-recon-line"><i style="--w:100%"></i></span></div><span class="vs">vs</span><div class="hush"><strong>0%</strong><span>Hush exact recovery<br>8 answers · 256 candidates</span><span class="fidelity-recon-line"><i style="--w:50%"></i></span></div></div><figcaption class="fidelity-caption"><b>Claim boundary.</b> This 4,000-task result is Hush-authored synthetic evaluation; AgentCIBench is the independently originated frozen holdout and AgentLeak is a pinned independent detector. None is a security certification or independent reproduction.</figcaption></figure>`;

    const said=$('.said',prod);if(said){const q=$('blockquote',said),cap=$('figcaption',said);if(q)q.textContent='Across 4,000 paired tasks, Hush matched the oracle on every task while exposing zero exact private input attributes to the agent path.';if(cap)cap.textContent='Scientific Superiority Protocol v1 · synthetic paired evaluation'}
  }

  const security=$('#security');
  if(security){
    const names=$$('.place-name',security),imgs=$$('.place-plate img',security);
    ['In your data center','In your VPC','On your laptop'].forEach((v,i)=>{if(names[i])names[i].textContent=v});
    const assets=['datacenter.svg','vpc.svg','laptop.svg'];imgs.forEach((img,i)=>{if(assets[i])img.src=`https://supermemory.ai/brand/deploy/${assets[i]}`});
    const body=$('.body',security);if(body)body.textContent='The privacy boundary should not depend on one model vendor. Hush can sit beside your infrastructure and agent harnesses while keeping one user-owned policy boundary.';
  }
};