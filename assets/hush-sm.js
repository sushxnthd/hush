document.documentElement.classList.add('js');
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const rail=q('.rail'),menu=q('.menu');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));rail?.classList.toggle('is-open',open)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu?.setAttribute('aria-expanded','false');rail?.classList.remove('is-open')}});
const reveals=qa('[data-reveal]');
if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -32px'});reveals.forEach(el=>el.dataset.reveal==='load'?requestAnimationFrame(()=>el.classList.add('is-visible')):io.observe(el))}else reveals.forEach(el=>el.classList.add('is-visible'));
const toc=qa('[data-section]'),secs=toc.map(a=>document.getElementById(a.dataset.section)).filter(Boolean),mark=q('.nav-mark');
function sync(){if(!secs.length)return;let active=0,trigger=innerHeight*.38;secs.forEach((s,i)=>{if(s.getBoundingClientRect().top<=trigger)active=i});toc.forEach((a,i)=>i===active?a.setAttribute('aria-current','location'):a.removeAttribute('aria-current'));const a=toc[active];if(mark&&a&&innerWidth>1000)mark.style.setProperty('--mark-y',`${a.offsetTop+a.offsetHeight/2-3}px`)}
addEventListener('scroll',()=>requestAnimationFrame(sync),{passive:true});addEventListener('resize',sync,{passive:true});sync();