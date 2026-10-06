window.initHushIntegrityPass=()=>{
  if(window.__hushIntegrityPass)return;window.__hushIntegrityPass=true;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  const toc=$('.nav-here');
  if(toc){
    const desired=[['#memo','Mission'],['#what','What we do'],['#production','Evidence'],['#writing','Writing'],['#careers','Roadmap']];
    $$('a',toc).forEach(a=>a.remove());
    desired.forEach(([href,label],i)=>{const a=document.createElement('a');a.href=href;a.textContent=label;a.style.setProperty('--j',i);a.style.setProperty('--t',i*5);toc.append(a)});
  }

  const note=$('.hero .note');
  if(note){
    const text=$('.note-text',note)||$$('span',note)[1]; const cta=$('.note-cta',note);
    if(text)text.textContent='AgentCIBench · 8/8 frozen gates passed';
    if(cta)cta.innerHTML='See evidence <span aria-hidden="true" class="arrow">↗</span>';
    note.href='#production';
  }
  const dek=$('.hero .dek');
  if(dek)dek.textContent='One user-owned trust layer for private context, cross-AI memory and scoped authority across models.';

  const field=$('.hero .field');
  if(field){
    const still=$('.still',field), film=$('.film',field);
    if(still)still.src='https://supermemory.ai/brand/media/field-still.webp';
    if(film){film.poster='https://supermemory.ai/brand/media/field-poster.webp';let src=$('source',film);if(!src){src=document.createElement('source');film.append(src)}src.src='https://supermemory.ai/brand/media/field.mp4';src.type='video/mp4'}
  }
  const featureMedia=[['learn','Private context'],['carry','Cross-AI memory'],['scale','Scoped authority']];
  $$('#what video[data-tile]').forEach((v,i)=>{const slug=featureMedia[i]?.[0];if(!slug)return;v.poster=`https://supermemory.ai/what/${slug}.jpg`;let sources=$$('source',v);if(!sources.length){v.innerHTML=`<source src="https://supermemory.ai/what/${slug}-av1.mp4" type='video/mp4; codecs="av01.0.05M.08"'><source src="https://supermemory.ai/what/${slug}.mp4" type="video/mp4">`} });
  const ctaArt=$('.cta-art');if(ctaArt)ctaArt.src='https://supermemory.ai/brand/media/cta-dawn.jpg';
  const whatRows=$$('#what .row');
  const whatCopy=[
    ['Private computation instead of disclosure.','Hush runs bounded predicates, ranking, filtering and selection against sealed private state, returning the useful result without handing the model the underlying private facts.'],
    ['One approved memory, across models.','Provider-neutral memory stays user-owned, approval-gated and portable across supported AI providers instead of becoming the property of one model vendor.'],
    ['Scoped authority without handing over secrets.','Signed Grants, exact-action approvals and secretless brokerage let agents act with narrow authority while long-lived credentials remain outside model context.']
  ];
  whatRows.forEach((row,i)=>{const c=whatCopy[i];if(!c)return;const dt=$('dt',row),dd=$('dd',row);if(dt)dt.textContent=c[0];if(dd)dd.textContent=c[1]});

  const prod=$('#production');
  if(prod){
    const eyebrow=$('h2.eyebrow',prod);if(eyebrow)eyebrow.textContent='Research evidence';
    const creed=$('.creed',prod);if(creed)creed.innerHTML='The thesis is measurable: preserve <b>usefulness</b> while reducing what an AI ever gets to <b>see</b>.';
    const latency=$('.stat[style*="grid-area: latency"]',prod);
    if(latency)latency.innerHTML=`<span class="stat-label">Paired personalization<small>Scientific Superiority Protocol v1 · 4,000 tasks</small></span><table class="integrity-ledger"><thead><tr><th>Path</th><th>Utility</th><th>Exact attrs</th></tr></thead><tbody><tr><th>Hush</th><td class="best">100.000%</td><td class="best">0.000</td></tr><tr><th>Coarse</th><td>84.125%</td><td>0.938</td></tr><tr><th>Raw exact</th><td>100.000%</td><td>2.000</td></tr></tbody></table>`;
    const tokens=$('.stat[style*="grid-area: tokens"]',prod);
    if(tokens)tokens.innerHTML=`<span class="stat-label">Adaptive reconstruction<small>512 independently generated 16-bit secrets</small></span><span class="integrity-big">0% <small>exact recovery</small></span><div class="integrity-micro"><i></i><span>8 answers released · 256 candidates remain</span></div>`;
    const orgs=$('.stat[style*="grid-area: orgs"]',prod);
    if(orgs)orgs.innerHTML=`<span class="stat-label">Frozen scientific gates<small>AgentCIBench · 50-case external holdout</small></span><span class="stat-n">8<span class="stat-unit">/8</span></span><div class="gate-strip" aria-label="Eight of eight scientific gates passed">${'<i></i>'.repeat(8)}</div>`;
    const bench=$('.stat-bench',prod);
    if(bench)bench.innerHTML=`<div class="bench-half"><div class="verdict">Frozen AgentCIBench</div><span class="stat-n">15.4<span class="stat-unit">%</span></span><p>relative reduction in exact protected-context violation vs the matched semantic-only retriever</p><div class="evidence-meta"><b>95.07%</b> completeness · <b>6–0</b> paired leak-free wins · p = <b>.03125</b></div></div><div class="bench-half"><div class="verdict">Pinned AgentLeak detector</div><span class="stat-n">0<span class="stat-unit">%</span></span><p>credential-canary leakage on the Hush secretless-action path</p><div class="evidence-meta"><b>100%</b> task success · <b>50</b> paired production-ActionBroker traces</div></div>`;
    const ours=$('.stat-ours',prod);
    if(ours)ours.innerHTML=`<span class="stat-label">Privacy × utility</span><div class="research-dashboard"><div class="research-head"><div><span class="integrity-kicker">Preregistered internal protocol</span><h3>Same utility. Less private input.</h3></div><span class="protocol-stamp">4 task families · 4,000 paired tasks</span></div><div class="research-summary"><div><strong>100%</strong><span>Hush oracle agreement</span></div><div><strong>0.000</strong><span>exact private attrs / Hush task</span></div><div><strong>7.01×10<sup>−192</sup></strong><span>paired Hush vs coarse p</span></div></div><div class="research-viz"><div class="research-panel"><div class="research-panel-title"><span>Oracle agreement</span><span>higher is better</span></div><div class="metric-row"><span>Hush</span><i class="metric-track"><i class="metric-fill" style="--w:100%"></i></i><b>100%</b></div><div class="metric-row"><span>Raw</span><i class="metric-track"><i class="metric-fill raw" style="--w:100%"></i></i><b>100%</b></div><div class="metric-row"><span>Coarse</span><i class="metric-track"><i class="metric-fill coarse" style="--w:84.125%"></i></i><b>84.125%</b></div><div class="reconstruction-strip"><div class="recon-arm"><strong>100%</strong><span>unprotected exact recovery<br>16.00 answers · 1 candidate</span><i class="recon-line"><i style="--w:100%"></i></i></div><span class="recon-vs">vs</span><div class="recon-arm hush"><strong>0%</strong><span>Hush exact recovery<br>8.00 answers · 256 candidates</span><i class="recon-line"><i style="--w:50%"></i></i></div></div></div><div class="research-panel"><div class="research-panel-title"><span>Exact private attrs / task</span><span>lower is better</span></div><div class="private-inputs"><div class="col hush" style="--v:0"><b>0.000</b><i></i><span>Hush</span></div><div class="col" style="--v:.469"><b>0.938</b><i></i><span>Coarse</span></div><div class="col" style="--v:1"><b>2.000</b><i></i><span>Raw exact</span></div></div><div class="research-panel-title" style="margin-top:18px"><span>External validation</span><span>frozen / pinned</span></div><div class="metric-row"><span>Completeness</span><i class="metric-track"><i class="metric-fill" style="--w:95.07%"></i></i><b>95.07%</b></div><div class="metric-row"><span>Violation</span><i class="metric-track"><i class="metric-fill" style="--w:79.6%"></i></i><b>79.60%</b></div></div></div><div class="research-foot"><b>Claim boundary.</b> The 4,000-task result is an internal synthetic paired protocol; AgentCIBench is an independently originated frozen holdout; AgentLeak is a pinned independent detector over Hush-generated action traces. None is a security certification or independent third-party reproduction.</div></div>`;
    const said=$('.said',prod);if(said){const q=$('blockquote',said),cap=$('figcaption',said);if(q)q.textContent='On 4,000 paired bounded-personalization tasks, Hush matched the oracle on every task while exposing zero exact private input attributes to the agent path.';if(cap)cap.textContent='Scientific Superiority Protocol v1 · synthetic paired evaluation'}
  }

  const security=$('#security');
  if(security){
    const secTitle=$('.sec-title',security),secText=$('.sec-text',security),seals=$$('.hush-seals li',security);
    if(secTitle)secTitle.textContent='Privacy is cumulative, not per prompt.';
    if(secText)secText.textContent='Encrypted local context, cross-agent reconstruction accounting, signed scoped Grants, secretless action brokerage and tamper-evident receipts share one user-controlled policy boundary. Hush remains research software, not a security certification.';
    ['CUMULATIVE PRIVACY','SCOPED GRANTS','SECRETLESS ACTIONS'].forEach((x,i)=>{if(seals[i])seals[i].textContent=x});
  }
  const cta=$('.cta');if(cta){const t=$('.cta-text',cta);if(t)t.textContent='Put one user-owned trust layer between the agent and the private context, memory and authority it should never receive wholesale.'}

  const entries=$$('#writing .entry');
  const papers=[
    ['01','Scientific Superiority v1: 4,000 paired tasks, zero exact private inputs','internal protocol','https://github.com/sushxnthd/hush/blob/main/research/SUPERIORITY_RESULTS_V1.md'],
    ['02','AgentCIBench confirmatory v1: all 8 frozen scientific gates passed','external holdout','https://github.com/sushxnthd/hush/blob/main/research/results/AGENTCIBENCH_CONFIRMATORY_V1.md'],
    ['03','Lineage-aware context boundary: 97.01% completeness on the development pool','development','https://github.com/sushxnthd/hush/blob/main/research/AGENTCIBENCH_CONTEXT_BOUNDARY_DEV_V1F.md']
  ];
  entries.forEach((a,i)=>{const p=papers[i];if(!p)return;const n=$('.entry-n',a),t=$('.entry-title',a);if(n)n.textContent=p[0];if(t)t.textContent=p[1];a.dataset.kind=p[2];a.href=p[3];a.target='_blank';a.rel='noopener noreferrer'});
  const researchMore=$('#writing .more');if(researchMore){researchMore.textContent='Read the research ';const arrow=document.createElement('span');arrow.className='arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';researchMore.append(arrow);researchMore.href='https://github.com/sushxnthd/hush/tree/main/research';researchMore.target='_blank';researchMore.rel='noopener noreferrer'}

  const roadmap=$('#careers');if(roadmap){const h=$('h2',roadmap),p=$('.body',roadmap),a=$('.more',roadmap);if(h)h.textContent='v1.2';if(p)p.textContent='The convergence release unifies encrypted private context, bounded computation, cross-AI memory, scoped Grants, secretless actions, receipts and revocation. Remaining release gates center on OS-backed key handling, zero-terminal onboarding, the consumer trust surface, protocol hardening, semantic/end-to-end leakage evaluation and independent reproduction.';if(a){a.textContent='Read the acceptance contract ';const ar=document.createElement('span');ar.className='arrow';ar.setAttribute('aria-hidden','true');ar.textContent='↗';a.append(ar);a.href='V1_2_ACCEPTANCE.md'}}

  const animated=$$('#production .stat');
  if(reduce)animated.forEach(el=>el.classList.add('integrity-in'));
  else{const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('integrity-in');io.unobserve(e.target)}}),{threshold:.16,rootMargin:'0px 0px -8% 0px'});animated.forEach(el=>io.observe(el))}

  dispatchEvent(new Event('resize'));
};