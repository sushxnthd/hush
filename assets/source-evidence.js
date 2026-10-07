window.captureHushSourceEvidence=()=>{
  if(window.__hushSourceEvidence)return;
  const proof=document.querySelector('#production .proof');
  if(proof)window.__hushSourceEvidence=proof.cloneNode(true);
};

window.initHushSourceEvidence=()=>{
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const prod=$('#production'),source=window.__hushSourceEvidence;
  if(!prod||!source)return;
  const current=$('.proof',prod);if(current)current.replaceWith(source.cloneNode(true));
  const proof=$('.proof',prod);if(!proof)return;

  const eyebrow=$('h2.eyebrow',prod);if(eyebrow)eyebrow.textContent='Research evidence';
  const creed=$('.creed',prod);if(creed)creed.innerHTML='The thesis is measurable: preserve <b>usefulness</b> while reducing what an AI ever gets to <b>see</b>.';

  const card=area=>proof.querySelector(`.stat[style*="grid-area: ${area}"]`);
  const latency=card('latency'),tokens=card('tokens'),orgs=card('orgs'),bench=$('.stat-bench',proof),ours=$('.stat-ours',proof);

  if(latency){
    const label=$('.stat-label',latency);if(label)label.innerHTML='Privacy × utility<small>Scientific Superiority v1 · 4,000 paired tasks</small>';
    const heads=$$('thead th',latency);if(heads[1])heads[1].textContent='Oracle';if(heads[2])heads[2].textContent='Exact attrs';
    const rows=$$('tbody tr',latency),vals=[['Hush','100.000','0.000'],['Coarse','84.125','0.938']];
    rows.forEach((row,i)=>{const v=vals[i];if(!v)return;const th=$('th',row),td=$$('td',row);if(th)th.textContent=v[0];if(td[0])td[0].innerHTML=`<span class="ms" style="--t:${160+i*120}ms">${v[1]}<i>%</i></span>`;if(td[1])td[1].innerHTML=`<span class="ms" style="--t:${220+i*120}ms">${v[2]}</span>`});
  }

  if(tokens){
    const label=$('.stat-label',tokens);if(label)label.innerHTML='Bounded decisions<small>Gmail · Calendar · Drive · GitHub</small>';
    const n=$('.stat-n',tokens);if(n)n.innerHTML='160<span class="stat-unit">/160</span>';
  }

  if(orgs){
    const label=$('.stat-label',orgs);if(label)label.innerHTML='Credential leakage<small>AgentLeak · 50 paired ActionBroker traces</small>';
    const n=$('.stat-n',orgs);if(n)n.innerHTML='0<span class="stat-unit">%</span>';
  }

  if(bench){
    const halves=$$('.bench-half',bench);
    if(halves[0])halves[0].innerHTML='<div class="verdict">Pinned AgentLeak detector</div><span class="stat-n">0<span class="stat-unit">%</span></span><p>credential-canary leakage with 100% task success across 50 Hush-generated paired ActionBroker traces</p>';
    if(halves[1])halves[1].innerHTML='<div class="verdict">Frozen AgentCIBench holdout</div><span class="stat-n">95.07<span class="stat-unit">%</span></span><p>completeness · 15.4% relative reduction in exact protected-context violation against the matched semantic-only retriever</p>';
    if(halves[0]){
      const label=$('.stat-label',halves[0]);if(label)label.innerHTML='Frozen external holdout<small>AgentCIBench confirmatory v1 · 50 cases</small>';
      const q=$('.verdict',halves[0]);if(q)q.textContent='Pinned AgentLeak detector';
      const a=$('.more',halves[0]);if(a){a.href='https://github.com/sushxnthd/hush/blob/main/research/results/AGENTCIBENCH_CONFIRMATORY_V1.md';a.target='_blank';a.rel='noopener noreferrer';a.innerHTML='Read the result<span class="arrow" aria-hidden="true">↗</span>'}
    }
    if(halves[1]){
      const label=$('.stat-label',halves[1]);if(label)label.innerHTML='Pre-specified scientific gates<small>Scientific Superiority v1</small>';
      const n=$('.stat-n',halves[1]);if(n)n.innerHTML='95.07<span class="stat-unit">%</span>';
      const rank=$('.stat-rank',halves[1]);if(rank){rank.setAttribute('aria-label','Eight of eight pre-specified scientific gates passed');const bars=$$('.bar',rank);bars.forEach((b,i)=>{b.classList.add('us');b.style.setProperty('--h',`${38+i*8.5}%`);b.style.setProperty('--i',i);b.innerHTML=''})}
      const a=$('.more',halves[1]);if(a){a.href='https://github.com/sushxnthd/hush/blob/main/research/SUPERIORITY_RESULTS_V1.md';a.target='_blank';a.rel='noopener noreferrer';a.innerHTML='See the research<span class="arrow" aria-hidden="true">↗</span>'}
    }
  }

  if(ours){
    const headLabel=$('.ours-head .stat-label',ours);if(headLabel)headLabel.innerHTML='Scientific Superiority v1<small>preregistered internal protocol · reproducible CI run</small>';
    const pair=$$('.ours-head .pair > div',ours);
    if(pair[0]){const dt=$('dt',pair[0]),n=$('.stat-n',pair[0]),d=$('.delta',pair[0]);if(dt)dt.textContent='Oracle agreement';if(n)n.innerHTML='100<span class="stat-unit">%</span>';if(d)d.textContent='vs 84.125% coarse'}
    if(pair[1]){const dt=$('dt',pair[1]),n=$('.stat-n',pair[1]),d=$('.delta',pair[1]);if(dt)dt.textContent='Exact private attrs';if(n)n.textContent='0.000';if(d)d.textContent='vs 0.938 coarse'}

    const fig=$('.cost-curve',ours),kicker=$('.cost-curve-kicker',ours),title=$('.cost-curve-title',ours),legend=$('.cost-curve-legend',ours),svg=$('.cost-curve-svg',ours),caption=$('.cost-curve-caption',ours),foot=$('.cost-curve-foot',ours),switcher=$('.token-view-switch',ours),buttons=$$('.token-view-button',ours),thumb=$('.token-view-thumb',ours);
    if(fig)fig.style.setProperty('--cc-fs','#8f949a');
    if(kicker)kicker.textContent='Figure 1 · measured benchmark outcomes';
    if(title)title.textContent='Hush privacy, utility and reconstruction results';
    if(caption)caption.textContent='Exact values from the preregistered internal protocol. Use the source-shaped tabs to switch between the three measured endpoints; no synthetic interpolation or certification claim is implied.';
    if(foot)foot.innerHTML='<a href="https://github.com/sushxnthd/hush/blob/main/research/SUPERIORITY_RESULTS_V1.md" target="_blank" rel="noopener noreferrer">The reproducible research run ↗</a>';

    const views={
      utility:{name:'Utility',y:[80,85,90,95,100],labels:['Hush','Coarse','Raw exact','Governed'],baseline:[null,84.125,100,100],hush:[100,null,null,null],fmt:v=>`${Number(v).toFixed(v%1?3:0)}%`,axis:'oracle agreement'},
      privacy:{name:'Privacy',y:[0,.5,1,1.5,2],labels:['Hush','Coarse','Raw exact','Governed'],baseline:[null,.938,2,2],hush:[0,null,null,null],fmt:v=>Number(v).toFixed(v%1?3:0),axis:'exact private attrs / task'},
      recovery:{name:'Recovery',y:[0,25,50,75,100],labels:['Unprotected','Hush rotation','Hush revision'],baseline:[100,null,null],hush:[null,0,0],fmt:v=>`${Number(v).toFixed(0)}%`,axis:'exact secret recovery'}
    };
    const keys=['utility','privacy','recovery'];
    if(buttons.length>=3){buttons.slice(0,3).forEach((b,i)=>{b.innerHTML=views[keys[i]].name;b.dataset.hushView=keys[i];b.removeAttribute('data-cc-tab')});buttons.slice(3).forEach(b=>b.remove())}

    const render=viewKey=>{
      const v=views[viewKey]||views.utility;if(!svg)return;
      const W=760,H=430,L=70,R=728,T=34,B=344;const n=v.labels.length;const xs=v.labels.map((_,i)=>n===1?(L+R)/2:L+(R-L)*i/(n-1));const min=Math.min(...v.y),max=Math.max(...v.y);const yval=x=>B-(x-min)/(max-min||1)*(B-T);
      let out='';
      v.y.forEach(t=>{const y=yval(t);out+=`<g><line class="cc-grid" x1="${L}" y1="${y}" x2="${R}" y2="${y}"></line><text class="cc-tick-label cc-tick-label--y" x="${L-10}" y="${y+3.5}" text-anchor="end">${v.fmt(t)}</text></g>`});
      out+=`<line class="cc-axis" x1="${L}" y1="${T}" x2="${L}" y2="${B}"></line><line class="cc-axis" x1="${L}" y1="${B}" x2="${R}" y2="${B}"></line>`;
      xs.forEach((x,i)=>{out+=`<g><line class="cc-tick" x1="${x}" y1="${B}" x2="${x}" y2="${B+4}"></line><text class="cc-tick-label" x="${x}" y="${B+20}" text-anchor="end" transform="rotate(-32 ${x} ${B+20})">${v.labels[i]}</text></g>`});
      out+=`<text class="cc-axis-title" x="${(L+R)/2}" y="414" text-anchor="middle">${v.axis}</text>`;
      const basePts=[],hushPts=[];v.baseline.forEach((val,i)=>{if(val!==null)basePts.push([xs[i],yval(val),i,val])});v.hush.forEach((val,i)=>{if(val!==null)hushPts.push([xs[i],yval(val),i,val])});
      if(basePts.length>1)out+=`<polyline class="cc-line cc-line--fs" points="${basePts.map(p=>`${p[0]},${p[1]}`).join(' ')}"></polyline>`;
      if(hushPts.length>1)out+=`<polyline class="cc-line cc-line--smfs" points="${hushPts.map(p=>`${p[0]},${p[1]}`).join(' ')}"></polyline>`;
      basePts.forEach(([x,y])=>{out+=`<circle class="cc-marker cc-marker--fs" cx="${x}" cy="${y}" r="4.2"></circle>`});
      hushPts.forEach(([x,y])=>{out+=`<rect class="cc-marker cc-marker--smfs" x="${x-4}" y="${y-4}" width="8" height="8"></rect>`});
      svg.innerHTML=out;
      if(legend)legend.innerHTML='<span class="cc-legend-item cc-legend-item--fs"><span class="cc-swatch cc-swatch--fs"></span>Baselines</span><span class="cc-legend-item cc-legend-item--smfs"><span class="cc-swatch cc-swatch--smfs"></span>Hush</span>';
      buttons.forEach(b=>{const on=b.dataset.hushView===viewKey;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on))});
      const active=buttons.find(b=>b.dataset.hushView===viewKey);if(active&&thumb&&switcher)requestAnimationFrame(()=>{thumb.style.setProperty('--w',`${active.offsetWidth}px`);thumb.style.setProperty('--x',`${active.offsetLeft}px`);thumb.classList.add('is-placed');switcher.classList.add('has-thumb')});
    };
    buttons.forEach(b=>b.addEventListener('click',()=>render(b.dataset.hushView)));
    render('utility');
  }

  const said=$('.said',prod);if(said){const q=$('blockquote',said),cap=$('figcaption',said);if(q)q.innerHTML='“Across <b>4,000 paired tasks</b>, Hush matched the oracle on every task while exposing <b>zero exact private input attributes</b> to the agent path.”';if(cap)cap.textContent='Scientific Superiority Protocol v1 · synthetic paired evaluation'}

  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,stats=$$('.stat',proof);
  if(reduce)stats.forEach(s=>s.classList.add('is-visible'));else{const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -8% 0px'});stats.forEach(s=>io.observe(s))}
};
