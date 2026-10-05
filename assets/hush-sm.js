document.documentElement.classList.add('js');
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];

/* Small compatibility layer for the reference-site markup. The existing Hush
   base stylesheet used different class names for these controls. */
const compat=document.createElement('style');
compat.textContent=`
.skip{z-index:40;border:1px solid var(--ink);color:var(--ink);opacity:0;pointer-events:none;background:#fff;padding:8px 12px;font-size:13px;font-weight:500;line-height:1.4;text-decoration:none;position:fixed;top:16px;left:24px;translate:0 -8px}.skip:focus-visible{opacity:1;pointer-events:auto;translate:0}.menu{height:32px;font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink60);cursor:pointer;background:transparent;border:0;align-items:center;gap:8px;padding:0;font-size:11px;font-weight:500;display:none}.menu-word{display:grid}.menu-word>span{grid-area:1/1;transition:opacity .18s ease}.menu-shut{opacity:0}.menu-glyph{width:13px;height:12px;position:relative}.menu-glyph i{height:1.5px;background:currentColor;position:absolute;top:3.5px;left:0;right:0;transition:translate .2s ease,rotate .2s ease}.menu-glyph i+i{top:7.5px}.menu[aria-expanded=true] .menu-word>span:first-child{opacity:0}.menu[aria-expanded=true] .menu-shut{opacity:1}.menu[aria-expanded=true] .menu-glyph i{translate:0 2px;rotate:45deg}.menu[aria-expanded=true] .menu-glyph i+i{translate:0 -2px;rotate:-45deg}
@media(max-width:1000px){.menu{display:inline-flex}.rail{grid-template-columns:1fr auto!important}.rail .format-wrap{display:none}.nav-doors{grid-column:1/-1!important}.js .rail .nav-doors{display:none!important}.js .rail.is-open .nav-doors{display:grid!important}}
@media(max-width:600px){.skip{left:16px}.menu{width:auto!important;justify-content:flex-end!important}.rail .nav-doors{grid-template-columns:1fr!important;gap:0!important}}
`;
document.head.append(compat);

const rail=q('.rail'),menu=q('.menu');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));rail?.classList.toggle('is-open',open)});
qa('.nav-doors a').forEach(a=>a.addEventListener('click',()=>{if(innerWidth<=1000){menu?.setAttribute('aria-expanded','false');rail?.classList.remove('is-open')}}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu?.setAttribute('aria-expanded','false');rail?.classList.remove('is-open')}});
const reveals=qa('[data-reveal]');
if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -32px'});reveals.forEach(el=>el.dataset.reveal==='load'?requestAnimationFrame(()=>el.classList.add('is-visible')):io.observe(el))}else reveals.forEach(el=>el.classList.add('is-visible'));
const toc=qa('[data-section]'),secs=toc.map(a=>document.getElementById(a.dataset.section)).filter(Boolean),mark=q('.nav-mark');
function sync(){if(!secs.length)return;let active=0,trigger=innerHeight*.38;secs.forEach((s,i)=>{if(s.getBoundingClientRect().top<=trigger)active=i});toc.forEach((a,i)=>i===active?a.setAttribute('aria-current','location'):a.removeAttribute('aria-current'));const a=toc[active];if(mark&&a&&innerWidth>1000)mark.style.setProperty('--mark-y',`${a.offsetTop+a.offsetHeight/2-3}px`)}
addEventListener('scroll',()=>requestAnimationFrame(sync),{passive:true});addEventListener('resize',sync,{passive:true});sync();