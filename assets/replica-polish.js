(()=>{
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const memo=q('#memo');
if(memo){
  const ps=[...memo.children].filter(el=>el.tagName==='P');
  const fn='<span aria-hidden="true" class="fn"></span>';
  if(ps[0]) ps[0].innerHTML=`The path to useful personal AI is a <a aria-controls="q-hassabis" class="key" data-card="hassabis" href="#production">private context layer${fn}</a> that works with <strong>any model, any harness</strong>, and across the full variety of tasks people actually delegate. As model choice grows and the world becomes even more <a aria-controls="q-openrouter" class="key" data-card="openrouter" href="#production">multi-model${fn}</a>, private context should live outside model providers and remain interoperable, user-controlled, and available in context only when a task needs it.`;
  if(ps[1]){ps[1].classList.add('beat');ps[1].innerHTML=`<a aria-controls="q-arc" class="key" data-card="arc" href="#production">AI should query you, not copy you.${fn}</a>`}
  if(ps[2]) ps[2].textContent='More capable models make the boundary more important, not less. Intelligence alone does not decide what an agent should learn about you, what it should retain, or what authority it should be allowed to exercise.';
  if(ps[3]) ps[3].innerHTML=`We build the hard infrastructure for that boundary: <a aria-controls="q-graph" class="key" data-card="graph" href="#production">encrypted, bounded, cumulatively-accounted context${fn}</a>, approval-gated shared memory, privacy-aware routing, scoped grants, credential brokerage and receipts.`;
  if(ps[4]) ps[4].innerHTML='The <strong>Hush kernel</strong> lets an AI ask for the minimum result it needs instead of receiving the underlying private record. It can compute locally over connector data, carry approved memory across models, and execute permitted actions without exposing reusable credentials to model context.';
}

// Remove source-company identity from adapted evidence popovers while preserving their geometry.
const mark='<svg aria-hidden="true" viewBox="0 0 256 256"><g fill="currentColor"><path d="M78 34H178C183.523 34 188 38.477 188 44V84H68V44C68 38.477 72.477 34 78 34Z"/><path d="M30 84H68V160H30C24.477 160 20 155.523 20 150V94C20 88.477 24.477 84 30 84Z"/><path d="M188 84H226C231.523 84 236 88.477 236 94V150C236 155.523 231.523 160 226 160H188V84Z"/><path d="M68 160H112V200H68V160Z"/><path d="M152 160H196V201L152 232V160Z"/><rect x="91" y="110" width="22" height="24"/><rect x="143" y="110" width="22" height="24"/></g></svg>';
qa('.pop-logo').forEach(el=>{el.setAttribute('aria-label','Hush');el.innerHTML=mark});
const arc=q('[data-card-for="arc"] img');
if(arc) arc.alt='Hush AgentCIBench holdout evidence: completeness versus protected-context violation.';

// The mission markup above reinstates source-style evidence keys after replica-fix initialized.
// Wire only these newly-created keys without duplicating the existing global handlers.
const newKeys=qa('#memo [data-card]');
let active=null,keyActive=null;
const close=()=>{if(active){active.classList.remove('is-on','is-above');active.setAttribute('aria-hidden','true')}if(keyActive)keyActive.setAttribute('aria-expanded','false');active=keyActive=null};
const place=(key,pop)=>{const r=key.getBoundingClientRect(),above=innerHeight-r.bottom<280&&r.top>300;pop.classList.toggle('is-above',above);pop.style.left=`${Math.max(16,Math.min(innerWidth-pop.offsetWidth-16,r.left+r.width/2-pop.offsetWidth/2))}px`;pop.style.top=above?`${Math.max(16,r.top-pop.offsetHeight-16)}px`:`${Math.min(innerHeight-pop.offsetHeight-16,r.bottom+16)}px`};
const open=key=>{const pop=q(`[data-card-for="${CSS.escape(key.dataset.card)}"]`);if(!pop)return;if(active===pop){close();return}close();active=pop;keyActive=key;pop.classList.add('is-on');pop.setAttribute('aria-hidden','false');key.setAttribute('aria-expanded','true');requestAnimationFrame(()=>place(key,pop))};
newKeys.forEach(key=>{key.setAttribute('aria-expanded','false');key.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open(key)});key.addEventListener('mouseenter',()=>open(key))});
document.addEventListener('click',e=>{if(active&&!e.target.closest('[data-card-for]')&&!e.target.closest('#memo [data-card]'))close()});
addEventListener('resize',()=>{if(active&&keyActive)place(keyActive,active)},{passive:true});
q('#hush-polish-guard')?.remove();
})();