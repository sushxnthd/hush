// Progressive enhancement. No analytics, provider requests or private app state.
const menu=document.querySelector('.site-menu'),navigation=document.querySelector('#site-navigation');
if(menu&&navigation){
  const close=()=>{menu.setAttribute('aria-expanded','false');navigation.classList.remove('open');};
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));navigation.classList.toggle('open',open);});
  navigation.addEventListener('click',e=>{if(e.target.closest('a'))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){close();menu.focus();}});
}
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
  const value=document.getElementById(button.dataset.copy)?.textContent,status=document.getElementById('copy-status');if(!value)return;
  try{await navigator.clipboard.writeText(value);button.textContent='Copied';if(status)status.textContent='Commands copied.';setTimeout(()=>button.textContent='Copy commands',1800);}
  catch{if(status)status.textContent='Clipboard unavailable. Select and copy the displayed commands.';}
}));
const motion=matchMedia('(prefers-reduced-motion: reduce)'),hasObserver='IntersectionObserver'in window;
const animations=[];
const visible=element=>{const r=element.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;};
// Stop offscreen and background media. Generation guards prevent a delayed play()
// promise from reviving footage after a pause, tab switch or preference change.
document.querySelectorAll('.blue-field,.feature-rows figure').forEach(field=>{
  const video=field.querySelector('video'),button=field.querySelector('.media-toggle');if(!video)return;
  let manualPause=false,explicitPlay=false,inView=false,generation=0,stopTimer;
  const label=playing=>{if(button){button.textContent=playing?'Pause motion':'Play motion';button.setAttribute('aria-label',playing?'Pause background animation':'Play background animation');}};
  const pause=()=>{generation++;clearTimeout(stopTimer);video.pause();field.classList.remove('playing');label(false);};
  const play=async()=>{
    if(document.hidden||!inView||(motion.matches&&!explicitPlay)||manualPause)return;
    const request=++generation;
    try{await video.play();if(request!==generation){if(!inView||document.hidden||manualPause||(motion.matches&&!explicitPlay))video.pause();return;}field.classList.add('playing');label(true);if(!button)stopTimer=setTimeout(pause,4000);}catch{if(request===generation)pause();}
  };
  const sync=()=>{if(inView&&!document.hidden&&!manualPause&&(!motion.matches||explicitPlay))play();else pause();};
  if(button)button.addEventListener('click',()=>{if(video.paused){manualPause=false;explicitPlay=true;inView=visible(field);play();}else{manualPause=true;explicitPlay=false;pause();}});
  else{field.closest('article')?.addEventListener('pointerenter',()=>{if(!motion.matches){inView=visible(field);play();}});field.closest('article')?.addEventListener('pointerleave',pause);}
  video.addEventListener('error',pause);
  if(hasObserver)new IntersectionObserver(entries=>{for(const entry of entries){inView=entry.isIntersecting;sync();}},{threshold:.15}).observe(field);
  animations.push({sync,pause,preference:()=>{explicitPlay=false;sync();}});
});
const explanations=['Private notes stay in your encrypted workspace.','A proposed memory waits for your approval.','Select useful memories and review the exact prompt.','Approve a clipboard copy. Paste it into your AI when you choose.'];
const verbs=['Keep it private','Approve memory','Review context','Share your choice'];
document.querySelectorAll('.context-loop').forEach(figure=>{
  const button=figure.querySelector('.loop-motion'),steps=[...figure.querySelectorAll('[data-loop-step]')];
  let step=0,timer=null,inView=false,manualPause=false,explicitPlay=false;
  const show=value=>{step=value;figure.dataset.step=String(step);steps.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===step)));figure.querySelector('.loop-verb').textContent=verbs[step];figure.querySelector('.loop-explanation').textContent=explanations[step];};
  const pause=()=>{clearInterval(timer);timer=null;figure.classList.remove('running');button.textContent='Play diagram';button.setAttribute('aria-pressed','false');};
  const play=()=>{if(timer||!inView||document.hidden||manualPause||(motion.matches&&!explicitPlay))return;figure.classList.add('running');button.textContent='Pause diagram';button.setAttribute('aria-pressed','true');timer=setInterval(()=>show((step+1)%4),2400);};
  const sync=()=>{if(inView&&!document.hidden&&!manualPause&&(!motion.matches||explicitPlay))play();else pause();};
  button.addEventListener('click',()=>{if(timer){manualPause=true;explicitPlay=false;pause();}else{manualPause=false;explicitPlay=true;inView=visible(figure);play();}});
  steps.forEach(b=>b.addEventListener('click',()=>{manualPause=true;explicitPlay=false;pause();show(Number(b.dataset.loopStep));}));
  if(hasObserver)new IntersectionObserver(entries=>{for(const e of entries){inView=e.isIntersecting;sync();}},{threshold:.25}).observe(figure);
  animations.push({sync,pause,preference:()=>{explicitPlay=false;sync();}});
});
document.addEventListener('visibilitychange',()=>animations.forEach(a=>a.sync()));
motion.addEventListener('change',()=>animations.forEach(a=>a.preference()));
window.addEventListener('pagehide',()=>animations.forEach(a=>a.pause()));
if(hasObserver&&!motion.matches){const seen=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){e.target.classList.add('in-view');seen.unobserve(e.target);}}},{threshold:.08});document.querySelectorAll('.site-section,.product-preview,.feature-rows').forEach(e=>seen.observe(e));}
// The ruler follows reading progress between section ticks; one frame per scroll.
const toc=document.querySelector('.site-toc'),links=[...document.querySelectorAll('.site-toc a')];
if(toc&&links.length){
  const targets=links.map(a=>document.getElementById(a.hash.slice(1)));let pending=false;
  const update=()=>{pending=false;const focus=innerHeight*.25,tops=targets.map(s=>s?.getBoundingClientRect().top??Infinity);let index=0;for(let i=0;i<tops.length;i++)if(tops[i]<=focus)index=i;
    links.forEach((a,i)=>{if(i===index)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
    const next=Math.min(index+1,links.length-1),distance=tops[next]-tops[index],fraction=next===index?0:Math.max(0,Math.min(1,(focus-tops[index])/distance));
    const y=links[index].offsetTop+links[index].offsetHeight/2+(links[next].offsetTop-links[index].offsetTop)*fraction;
    toc.style.setProperty('--toc-y',`${y-64}px`);
  };
  const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(update);}};
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);document.fonts?.ready.then(schedule);update();
}
