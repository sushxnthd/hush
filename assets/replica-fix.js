document.documentElement.classList.add('js');
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const reduced=matchMedia('(prefers-reduced-motion:reduce)');

// Keep the source geometry, remove UI that is false for Hush, and repair content inherited from source data.
qa('[data-cookie-consent],[data-cookie-dialog]').forEach(el=>el.remove());

const memo=q('#memo');
if(memo){
  const ps=[...memo.children].filter(el=>el.tagName==='P');
  const copy=[
    'The path to useful personal AI is a private context layer that works with any model, any harness, and across the full variety of tasks people actually delegate. As model choice grows and the world becomes even more multi-model, private context should live outside model providers and remain interoperable, user-controlled, and available in context only when a task needs it.',
    'Personal context should not become provider-owned state.',
    'More capable models make the boundary more important, not less. Intelligence alone does not decide what an agent should learn about you, what it should retain, or what authority it should be allowed to exercise.',
    'We build the hard infrastructure for that boundary: encrypted context, bounded computation, cumulative disclosure accounting, approval-gated shared memory, privacy-aware routing, scoped grants, credential brokerage and receipts.',
    'The Hush kernel lets an AI ask for the minimum result it needs instead of receiving the underlying private record. It can compute locally over connector data, carry approved memory across models, and execute permitted actions without exposing reusable credentials to model context.'
  ];
  ps.slice(0,5).forEach((p,i)=>p.textContent=copy[i]);
}

const prod=q('#production');
if(prod){
  qa('.stat-n',prod).forEach(n=>{
    if(n.textContent.trim().startsWith('160/160')||n.textContent.trim().startsWith('8/8')) qa('.stat-unit',n).forEach(u=>u.remove());
  });
  const verdict=q('blockquote.verdict',prod);
  if(verdict) verdict.innerHTML='“Hush <b>passed all 8 preregistered scientific gates</b>, reaching <b>95.07% completeness</b> and a <b>12.00% leak-free rate</b> on the frozen 50-case holdout.”';
  const sm=qa('.stat-n.sm',prod);
  if(sm[0]) sm[0].textContent='79.60%';
  if(sm[1]) sm[1].innerHTML='95.07<span class="stat-unit">%</span>';
  const curve=q('.cost-curve',prod);
  if(curve){
    curve.dataset.fsLabel='semantic-only baseline';
    curve.setAttribute('aria-label','Privacy and utility benchmark metric comparison');
    const kicker=q('.cost-curve-kicker',curve),title=q('.cost-curve-title',curve),cap=q('.cost-curve-caption',curve),foot=q('.cost-curve-foot',curve);
    if(kicker) kicker.textContent='Figure 2 · lineage-aware development ablation';
    if(title) title.textContent='Privacy–utility profile across measured benchmark metrics';
    const legend=qa('.cc-legend-item',curve);
    if(legend[0]) legend[0].innerHTML='<span class="cc-swatch cc-swatch--fs"></span>semantic-only baseline';
    if(legend[1]) legend[1].innerHTML='<span class="cc-swatch cc-swatch--hush"></span>Hush lineage-aware';
    qa('[data-cc-tab]',curve).slice(0,3).forEach((b,i)=>b.textContent=['All','Privacy','Utility'][i]);
    const svg=q('svg.cost-curve-svg',curve);
    if(svg){
      const y=v=>352-(v/100)*320;
      const cats=[['LEAK FREE',0,10.45],['VIOLATION ↓',92.26,77.12],['COMPLETENESS',97.54,97.01]],xs=[155,397,639];
      let h='';
      [0,25,50,75,100].forEach(p=>{const yy=y(p);h+=`<g><line class="cc-grid" x1="60" x2="734" y1="${yy}" y2="${yy}"></line><text class="cc-tick-label cc-tick-label--y" x="50" y="${yy+3.5}" text-anchor="end">${p}%</text></g>`});
      h+='<line class="cc-axis" x1="60" x2="60" y1="32" y2="352"></line><line class="cc-axis" x1="60" x2="734" y1="352" y2="352"></line>';
      cats.forEach((c,i)=>{h+=`<line class="cc-tick" x1="${xs[i]}" x2="${xs[i]}" y1="352" y2="356"></line><text class="cc-tick-label" x="${xs[i]}" y="372" text-anchor="middle">${c[0]}</text>`});
      h+=`<polyline class="cc-line cc-line--fs" points="${cats.map((c,i)=>`${xs[i]},${y(c[1])}`).join(' ')}"></polyline>`;
      h+=`<polyline class="cc-line cc-line--hush" points="${cats.map((c,i)=>`${xs[i]},${y(c[2])}`).join(' ')}"></polyline>`;
      cats.forEach((c,i)=>{h+=`<circle class="cc-marker cc-marker--fs" cx="${xs[i]}" cy="${y(c[1])}" r="4.2"></circle><rect class="cc-marker cc-marker--hush" x="${xs[i]-4}" y="${y(c[2])-4}" width="8" height="8"></rect><text class="cc-annot cc-annot--fs" x="${xs[i]}" y="${Math.max(45,y(c[1])-12)}" text-anchor="middle">${c[1].toFixed(2)}%</text><text class="cc-annot cc-annot--hush" x="${xs[i]}" y="${Math.min(344,y(c[2])+20)}" text-anchor="middle">${c[2].toFixed(2)}%</text>`});
      h+='<text class="cc-axis-title" x="397" y="418" text-anchor="middle">Measured development metric</text><text class="cc-axis-title" x="14" y="192" text-anchor="middle" transform="rotate(-90 14 192)">Rate (%)</text>';
      svg.innerHTML=h;
    }
    if(cap) cap.textContent='67 development scenarios. Lineage-aware local representation reduced protected-context violation from 92.26% to 77.12% while preserving completeness (97.01% vs 97.54%); paired leak-free outcomes were 7–0 (two-sided exact p = 0.015625). Development evidence only.';
    if(foot) foot.textContent='Fresh untouched confirmation is still required before this becomes a new confirmatory claim.';
  }
}

// Footer links should describe real Hush destinations rather than imply social accounts that do not exist.
const foot=q('.foot');
if(foot){
  const map={X:['GitHub','https://github.com/sushxnthd/hush'],LinkedIn:['Research','writing/'],Reddit:['Threat model','https://github.com/sushxnthd/hush/blob/main/THREAT_MODEL.md'],Discord:['Roadmap','https://github.com/sushxnthd/hush/blob/main/ROADMAP.md']};
  qa('a[href]',foot).forEach(a=>{const t=a.textContent.trim();if(map[t]){a.textContent=map[t][0];a.href=map[t][1]}});
}

// Source reveal behavior.
const reveals=qa('[data-reveal]');
if(reduced.matches||!('IntersectionObserver' in window)){reveals.forEach(el=>el.classList.add('is-visible'))}
else{const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -32px'});reveals.forEach(el=>el.dataset.reveal==='load'?requestAnimationFrame(()=>el.classList.add('is-visible')):io.observe(el))}

// Mobile menu.
const rail=q('.rail'),menu=q('[data-menu]'),mobile=matchMedia('(max-width:520px)');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));rail?.classList.toggle('is-open',open)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu?.setAttribute('aria-expanded','false');rail?.classList.remove('is-open');closePop()}});
document.addEventListener('click',e=>{if(mobile.matches&&rail?.classList.contains('is-open')&&!rail.contains(e.target)){menu?.setAttribute('aria-expanded','false');rail.classList.remove('is-open')}});

// Left rail ruler and smooth marker.
const toc=q('[data-toc]'),links=qa('a',toc||document.createElement('nav')).filter(a=>a.hash&&q(a.hash)),sections=links.map(a=>q(a.hash)),mark=q('.nav-mark');
links.forEach((a,i)=>{a.style.setProperty('--j',i);a.style.setProperty('--t',i*5)});
if(toc){const ruler=q('.nav-ruler',toc);if(ruler&&links.length>1){ruler.replaceChildren();for(let i=0;i<(links.length-1)*4;i++){const tick=document.createElement('i');tick.style.setProperty('--t',i+1+Math.floor(i/4));ruler.append(tick)}}}
function syncNav(){if(!sections.length)return;const trigger=innerHeight*.4;let active=0;const tops=sections.map(s=>s.getBoundingClientRect().top);tops.forEach((t,i)=>{if(t<=trigger)active=i});if(scrollY+innerHeight>=document.documentElement.scrollHeight-2)active=sections.length-1;links.forEach((a,i)=>i===active?a.setAttribute('aria-current','location'):a.removeAttribute('aria-current'));const next=tops[active+1],p=next==null?0:Math.max(0,Math.min(1,(trigger-tops[active])/Math.max(next-tops[active],1)));toc?.style.setProperty('--y',String((active+p)*5));const door=q('.nav-doors a[aria-current="page"]');if(mark&&door&&innerWidth>1000)mark.style.setProperty('--y',`${door.offsetTop+door.offsetHeight/2-3}px`)}
let ticking=false;function schedule(){if(ticking)return;ticking=true;requestAnimationFrame(()=>{syncNav();ticking=false})}addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});document.fonts?.ready.then(schedule);schedule();

// Setup prompt controls.
const prompt=q('[data-prompt]'),status=q('[data-prompt-status]'),said=q('.prompt-said');
prompt?.addEventListener('click',async()=>{const text=prompt.dataset.prompt||'';try{await navigator.clipboard.writeText(text)}catch{const ta=document.createElement('textarea');ta.value=text;document.body.append(ta);ta.select();document.execCommand('copy');ta.remove()}if(status)status.textContent='Setup prompt copied';if(said){said.textContent='Setup prompt copied';said.classList.add('is-on');setTimeout(()=>said.classList.remove('is-on'),1400)}});
const toggle=q('[data-opens-toggle]'),opens=q('[data-opens-menu]');toggle?.addEventListener('click',e=>{e.stopPropagation();const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));if(opens)opens.hidden=!open});document.addEventListener('click',e=>{if(opens&&!opens.hidden&&!e.target.closest('[data-opens]')){opens.hidden=true;toggle?.setAttribute('aria-expanded','false')}});

// Evidence popovers.
let activePop=null,activeKey=null;
function closePop(){if(activePop){activePop.classList.remove('is-on','is-above');activePop.setAttribute('aria-hidden','true')}if(activeKey)activeKey.setAttribute('aria-expanded','false');activePop=activeKey=null}
function placePop(key,pop){const r=key.getBoundingClientRect(),above=innerHeight-r.bottom<280&&r.top>300;pop.classList.toggle('is-above',above);pop.style.left=`${Math.max(16,Math.min(innerWidth-pop.offsetWidth-16,r.left+r.width/2-pop.offsetWidth/2))}px`;pop.style.top=above?`${Math.max(16,r.top-pop.offsetHeight-16)}px`:`${Math.min(innerHeight-pop.offsetHeight-16,r.bottom+16)}px`}
function openPop(key){const pop=q(`[data-card-for="${CSS.escape(key.dataset.card)}"]`);if(!pop)return;if(activePop===pop){closePop();return}closePop();activePop=pop;activeKey=key;pop.classList.add('is-on');pop.setAttribute('aria-hidden','false');key.setAttribute('aria-expanded','true');requestAnimationFrame(()=>placePop(key,pop))}
qa('[data-card]').forEach(key=>{key.setAttribute('aria-expanded','false');key.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openPop(key)});key.addEventListener('mouseenter',()=>openPop(key))});qa('[data-card-for]').forEach(pop=>pop.addEventListener('mouseleave',closePop));document.addEventListener('click',e=>{if(activePop&&!e.target.closest('[data-card-for]')&&!e.target.closest('[data-card]'))closePop()});addEventListener('resize',()=>{if(activePop&&activeKey)placePop(activeKey,activePop)},{passive:true});

// Exact source loop behavior, adapted only to Hush labels.
(()=>{const t=q('[data-loop]');if(!t)return;const n=JSON.parse(t.dataset.timing),verbs=JSON.parse(t.dataset.verbs),sources=qa('[data-source]',t),agents=qa('[data-agent]',t),learner=q('[data-learner]',t),db=q('[data-db]',t),verbEls=qa('[data-verb] span',t),ver=q('[data-ver]',t),va=ver?.querySelector('.ver-a'),vb=ver?.querySelector('.ver-b'),edges=qa('.edges',t),comets=qa('.comet',t);let timers=[],g=-1,version=12;const clear=()=>{timers.forEach(clearTimeout);timers=[]},later=(ms,fn)=>timers.push(setTimeout(fn,ms)),hot=(el,warm=false)=>{if(!el)return;el.classList.add(warm?'is-warm':'is-hot');later(n.hot,()=>el.classList.remove('is-hot','is-warm'))},setVerb=i=>{verbEls.forEach((el,j)=>el.classList.toggle('is-on',j===i));if(i>=0&&learner)learner.dataset.pattern=verbs[i].pattern},work=on=>{learner?.classList.toggle('is-working',on);if(!on&&learner)delete learner.dataset.pattern},roll=()=>{if(!ver||!va||!vb)return;vb.textContent=`v${version+1}`;ver.classList.add('is-rolling','is-fresh');later(340,()=>{version++;va.textContent=`v${version}`;vb.textContent=`v${version+1}`;ver.classList.add('no-t');ver.classList.remove('is-rolling');ver.offsetHeight;ver.classList.remove('no-t')});later(1400,()=>ver.classList.remove('is-fresh'))},activeEdges=()=>edges.find(e=>e.getClientRects().length)||edges[0],cancel=()=>{for(const a of t.getAnimations({subtree:true})){const trg=a.effect?.target;if(trg?.classList.contains('comet')){a.cancel();trg.style.visibility='hidden'}}},send=(wire,delay,faint=false)=>{const e=activeEdges(),arr=comets.filter(c=>c.dataset.wire===wire&&e.contains(c));if(!arr.length)return delay;const len=arr[0].getTotalLength(),travel=len+n.tail,dur=travel/n.speed*1000;arr.forEach(c=>{const l=Number(c.dataset.len);c.style.strokeDasharray=`${l} ${len+100}`;c.style.visibility='visible';c.classList.toggle('is-faint',faint);c.animate([{strokeDashoffset:`${l}px`},{strokeDashoffset:`${l-travel}px`}],{duration:dur,delay:delay+Number(c.dataset.n)*n.lead,easing:'linear',fill:'both'})});return delay+len/n.speed*1000},cycle=()=>{clear();cancel();g=(g+1)%3;hot(sources[g],true);let a=send(`in${g}`,0);later(a,()=>{hot(learner);work(true);verbs.forEach((_,i)=>later(i*n.verbStep,()=>setVerb(i)))});let b=a+n.work;later(b,()=>{setVerb(-1);work(false)});let c=send('work',b);later(c,()=>{hot(db);roll()});let d=send('out0',c+n.handoff),r=send('ret',c+n.handoff,true);later(d,()=>hot(agents[0]));later(r,()=>hot(learner,true));later(Math.max(d,r)+n.lead+n.rest,cycle)};if(reduced.matches)t.classList.add('is-still','is-in');else{const io=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){t.classList.add('is-live','is-in');cycle()}else{t.classList.remove('is-live');clear();cancel();setVerb(0);work(false)}},{rootMargin:'80px'});io.observe(t)}})();

qa('[data-cc-tab]').forEach(btn=>btn.addEventListener('click',()=>{qa('[data-cc-tab]').forEach(b=>b.classList.remove('is-active'));btn.classList.add('is-active')}));

// Reveal only after every synchronous QA correction is applied.
q('#hush-prepaint')?.remove();
