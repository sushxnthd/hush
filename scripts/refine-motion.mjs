import fs from 'node:fs';
const path='index.html';
let s=fs.readFileSync(path,'utf8');
const replaceOne=(a,b)=>{const n=s.split(a).length-1;if(n!==1)throw new Error(`Expected one match, found ${n}: ${a.slice(0,90)}`);s=s.replace(a,b)};

replaceOne('<nav class="nav nav-here" aria-label="Sections"><span class="nav-ruler" aria-hidden="true"><i style="top:47px"></i><i style="top:55px"></i><i style="top:62px"></i><i style="top:70px"></i><i style="top:84px"></i><i style="top:92px"></i><i style="top:99px"></i><i style="top:107px"></i></span><a href="#memo" data-section="memo">Mission</a><a href="#what" data-section="what">What we do</a><a href="#production" data-section="production">In production</a><a href="#writing" data-section="writing">Writing</a><a href="#careers" data-section="careers">Careers</a><span class="nav-mark" aria-hidden="true"></span></nav>','<nav class="nav nav-here" aria-label="Sections" data-toc><span class="nav-ruler" aria-hidden="true"></span><a href="#memo" data-section="memo">Mission</a><a href="#what" data-section="what">What we do</a><a href="#production" data-section="production">In production</a><a href="#writing" data-section="writing">Writing</a><a href="#careers" data-section="careers">Careers</a></nav><span class="nav-mark" aria-hidden="true"></span>');

const needle='@media(prefers-reduced-motion:reduce)';
if(!s.includes(needle))throw new Error('reduced-motion block missing');
const exact=`/* Reference-accurate rail/reveal behavior. */
html.js [data-reveal="load"]:not(.rail){opacity:1;translate:0}
html.js .figure[data-reveal]{transition-duration:1.2s;translate:0;scale:1.01}
html.js .figure[data-reveal].is-visible{scale:1}
.rail{--h:.52s}
.nav-doors a:nth-child(1){--k:0}.nav-doors a:nth-child(2){--k:1}.nav-doors a:nth-child(3){--k:2}.nav-doors a:nth-child(4){--k:3}.nav-doors a:nth-child(5){--k:4}.nav-doors a:nth-child(6){--k:5}.nav-doors a:nth-child(7){--k:6}.nav-doors a:nth-child(8){--k:7}
.nav-here{--y:-99;gap:16px}
.nav-here:before{content:"On this page";font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink60);font-size:11px;font-weight:500;line-height:14px}
.nav-here a{color:var(--ink60);align-items:flex-start;gap:10px;display:flex}
.nav-here a:before,.nav-ruler i{--l:max(0,calc(1 - abs(var(--t,0) - var(--y))/4));content:"";transform-origin:0;width:24px;transition:scale .3s var(--easeout),background-color var(--dur-hover) var(--ease-hover);border-radius:1px;display:block}
.nav-here a:before{height:2px;scale:calc(.5 + .5*var(--l)) 1;background:#0b101538;flex:none;margin-top:9.5px}
.nav-here a:has(~a[aria-current]):before,.nav-here a[aria-current]:before{background:var(--blue)}
.nav-here a[aria-current]{color:var(--ink);font-weight:500}
.nav-ruler{pointer-events:none;display:block;position:absolute;inset:0;left:0;top:0;width:auto}
.nav-ruler:before{display:none}
.nav-ruler i{height:1px;scale:calc(.25 + .5*var(--l)) 1;background:#0b101524;position:absolute;left:0}
.nav-mark{transform:translateY(var(--y,8px)) rotate(var(--r,0deg))}
.rail-rule{background:repeating-linear-gradient(90deg,var(--rule) 0 4px,transparent 4px 8px);border:0;height:1px;margin:24px 0}
html.js .rail[data-reveal]:not(.is-visible) .rail-rule,html.js .rail[data-reveal]:not(.is-visible) .nav-here:before,html.js .rail[data-reveal]:not(.is-visible) .nav-ruler{opacity:0}
html.js .rail[data-reveal].is-visible .rail-rule{animation:draw-across .5s var(--easeout) var(--h) backwards}
html.js .rail[data-reveal].is-visible .nav-here:before{animation:rise-in .4s var(--ease-standard) calc(var(--h) + 80ms) backwards}
html.js .rail[data-reveal].is-visible .nav-here a{animation:rise-in .4s var(--ease-standard) calc(var(--h) + .16s + var(--j,0)*60ms) backwards}
html.js .rail[data-reveal].is-visible .nav-ruler{animation:fade-in .5s var(--ease-standard) calc(var(--h) + .26s) backwards}
@keyframes fade-in{0%{opacity:0}}@keyframes draw-across{0%{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0)}}@keyframes rise-in{0%{opacity:0;translate:0 8px}}
`;
s=s.replace(needle,exact+needle);

const start=s.indexOf('<script>\nconst reduceMotion=');
const end=s.indexOf('</script>',start)+9;
if(start<0||end<9)throw new Error('motion script missing');
const script=`<script>
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealNodes=[...document.querySelectorAll('[data-reveal]')];
const rail=document.querySelector('.rail[data-reveal="load"]');
const heroFigure=document.querySelector('.figure[data-reveal="load"]');
requestAnimationFrame(()=>{rail?.classList.add('is-visible');heroFigure?.classList.add('is-visible')});
if(reduceMotion){revealNodes.forEach(el=>el.classList.add('is-visible'))}else{
  const io=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target)}}},{threshold:.12,rootMargin:'0px 0px -8% 0px'});
  revealNodes.filter(el=>el.getAttribute('data-reveal')!=='load').forEach(el=>io.observe(el));
}
const sectionNav=document.querySelector('.nav-here[data-toc]');
const links=[...document.querySelectorAll('[data-section]')];
const sections=links.map(a=>document.getElementById(a.dataset.section)).filter(Boolean);
const ruler=sectionNav?.querySelector('.nav-ruler');
links.forEach((a,i)=>{a.style.setProperty('--t',String(i*5));a.style.setProperty('--j',String(i))});
document.querySelectorAll('.nav-doors a').forEach((a,i)=>a.style.setProperty('--k',String(i)));
function layoutRuler(){
  if(!ruler||links.length<2)return;
  const ticks=[];const offset=10.5;
  for(let i=0;i<links.length-1;i++){
    const from=links[i].offsetTop+offset,to=links[i+1].offsetTop+offset;
    for(let j=1;j<5;j++)ticks.push('<i style="top:'+(from+(to-from)*j/5-.5).toFixed(1)+'px;--t:'+(i*5+j)+'"></i>');
  }
  ruler.innerHTML=ticks.join('');
}
let ticking=false;
function sync(){
  const trigger=innerHeight*.4;let active=0;
  sections.forEach((section,i)=>{if(section.getBoundingClientRect().top<=trigger)active=i});
  const atEnd=scrollY+innerHeight>=document.documentElement.scrollHeight-2;
  if(atEnd)active=sections.length-1;
  links.forEach((a,i)=>a.toggleAttribute('aria-current',i===active));
  const current=sections[active]?.getBoundingClientRect().top??trigger;
  const next=sections[active+1]?.getBoundingClientRect().top;
  const progress=atEnd||next==null?0:Math.min(1,Math.max(0,(trigger-current)/Math.max(next-current,1)));
  sectionNav?.style.setProperty('--y',((active+progress)*5).toFixed(2));
  ticking=false;
}
const siteLinks=[...document.querySelectorAll('.nav-doors a')];
const mark=document.querySelector('.nav-mark');
function placeSiteMark(){
  const current=siteLinks.find(a=>a.hasAttribute('aria-current'))||siteLinks[0];
  if(!mark||!current)return;
  const y=current.offsetTop+current.offsetHeight/2-3;
  mark.style.setProperty('--y',y+'px');
  mark.style.setProperty('--r',(Math.max(0,siteLinks.indexOf(current))*90)+'deg');
}
addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(sync)}},{passive:true});
addEventListener('scrollend',sync,{passive:true});
addEventListener('resize',()=>{layoutRuler();placeSiteMark();sync()},{passive:true});
document.fonts?.ready.then(()=>{layoutRuler();placeSiteMark();sync()});
layoutRuler();placeSiteMark();sync();
</script>`;
s=s.slice(0,start)+script+s.slice(end);
fs.writeFileSync(path,s);
console.log('Reference motion refinement applied');
