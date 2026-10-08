// Progressive enhancement. No analytics, provider requests or private app state.
document.documentElement.classList.add('js');
const menu=document.querySelector('.menu'),navigation=document.querySelector('#site-doors'),rail=document.querySelector('.rail');
if(menu&&navigation){
  const close=()=>{menu.setAttribute('aria-expanded','false');rail.classList.remove('is-open');};
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));rail.classList.toggle('is-open',open);});
  navigation.addEventListener('click',e=>{if(e.target.closest('a'))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){close();menu.focus();}});
}
const setup=document.querySelector('[data-setup-prompt]'),options=document.querySelector('.opens-toggle'),setupMenu=document.querySelector('#setup-options');
const closeOptions=()=>{if(options){options.setAttribute('aria-expanded','false');setupMenu.hidden=true;}};
if(options){options.addEventListener('click',()=>{const open=options.getAttribute('aria-expanded')!=='true';options.setAttribute('aria-expanded',String(open));setupMenu.hidden=!open;});document.addEventListener('click',e=>{if(!e.target.closest('.opens'))closeOptions();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&options.getAttribute('aria-expanded')==='true'){closeOptions();options.focus();}});}
if(setup)setup.addEventListener('click',async()=>{const status=document.querySelector('.setup-status');try{await navigator.clipboard.writeText('Help me set up Hush in this project. Read https://sushxnthd.github.io/hush/start/ and the linked MCP documentation. Explain the current release limits and ask before configuring permissions or connecting accounts.');setup.classList.add('is-copied');status.textContent='Setup prompt copied.';setTimeout(()=>setup.classList.remove('is-copied'),1800);}catch{status.classList.remove('sr-only');status.textContent='Clipboard unavailable. Open Get started for setup instructions.';}});
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
document.querySelectorAll('.figure,.row figure.tile').forEach(field=>{
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
  else{field.closest('.row')?.addEventListener('pointerenter',()=>{if(!motion.matches){inView=visible(field);play();}});field.closest('.row')?.addEventListener('pointerleave',pause);}
  video.addEventListener('error',pause);
  if(hasObserver)new IntersectionObserver(entries=>{for(const entry of entries){inView=entry.isIntersecting;sync();}},{threshold:.15}).observe(field);
  animations.push({sync,pause,preference:()=>{explicitPlay=false;sync();}});
});
// The reference's square-elbow tracks, layered comets and pixel-grid processing
// are illustrative. They never read or modify the real workspace.
document.querySelectorAll('[data-loop]').forEach(figure=>{
  const button=figure.querySelector('.loop-motion'),steps=[...figure.querySelectorAll('[data-loop-step]')];
  const sources=[...figure.querySelectorAll('[data-source]')],agents=[...figure.querySelectorAll('[data-agent]')];
  const hub=figure.querySelector('[data-learner]'),db=figure.querySelector('[data-db]'),verbs=[...figure.querySelectorAll('[data-verb] span')];
  const edges=[...figure.querySelectorAll('.edges')],comets=[...figure.querySelectorAll('.comet')],nodes=[...figure.querySelectorAll('.node')];
  const patterns=['drive','orbit','focus','fade'];let timers=[],inView=false,manualPause=false,explicitPlay=false,running=false,source=-1;
  const later=(delay,fn)=>timers.push(setTimeout(()=>{if(running)fn();},delay));
  const cancel=()=>{timers.forEach(clearTimeout);timers=[];comets.forEach(p=>{p.getAnimations().forEach(a=>a.cancel());p.style.visibility='hidden';});nodes.forEach(n=>n.classList.remove('is-hot','is-warm','is-working'));};
  const show=step=>{figure.dataset.step=String(step);steps.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===step)));verbs.forEach((v,i)=>v.classList.toggle('is-on',i===step));hub.dataset.pattern=patterns[step];};
  const hot=(node,warm=false)=>{if(!node)return;node.classList.add(warm?'is-warm':'is-hot');later(600,()=>node.classList.remove('is-hot','is-warm'));};
  const wire=(name,delay=0,faint=false)=>{const edge=edges.find(e=>e.getClientRects().length)||edges[0],paths=comets.filter(p=>p.dataset.wire===name&&edge.contains(p));if(!paths.length)return delay;const length=paths[0].getTotalLength(),travel=(length+40)/180*1000;
    paths.forEach(p=>{const dash=Number(p.dataset.len);p.style.strokeDasharray=`${dash} ${length+100}`;p.style.visibility='visible';p.classList.toggle('is-faint',faint);p.animate([{strokeDashoffset:`${dash}px`},{strokeDashoffset:`${dash-length-40}px`}],{duration:travel,delay:delay+Number(p.dataset.n)*300,easing:'linear',fill:'both'});});return delay+length/180*1000;};
  const cycle=()=>{cancel();source=(source+1)%sources.length;hot(sources[source],true);show(0);const arrival=wire(`in${source}`);
    later(arrival,()=>{hot(hub);hub.classList.add('is-working');patterns.forEach((_,i)=>later(i*600,()=>show(i)));});
    const done=arrival+2500;later(done,()=>hub.classList.remove('is-working'));const stored=wire('work',done);later(stored,()=>hot(db));
    const output=wire('out0',stored+150),feedback=wire('ret',stored+150,true);later(output,()=>hot(agents[0]));later(feedback,()=>hot(hub,true));later(Math.max(output,feedback)+1800,cycle);};
  const pause=()=>{running=false;cancel();figure.classList.add('is-paused');figure.classList.remove('is-live');button.textContent='Play diagram';button.setAttribute('aria-pressed','false');};
  const play=()=>{if(running||!inView||document.hidden||manualPause||(motion.matches&&!explicitPlay))return;running=true;figure.classList.add('is-live','is-in');figure.classList.remove('is-paused');button.textContent='Pause diagram';button.setAttribute('aria-pressed','true');cycle();};
  const sync=()=>{if(inView&&!document.hidden&&!manualPause&&(!motion.matches||explicitPlay))play();else pause();};
  button.addEventListener('click',()=>{if(running){manualPause=true;explicitPlay=false;pause();}else{manualPause=false;explicitPlay=true;inView=visible(figure);play();}});
  steps.forEach(b=>b.addEventListener('click',()=>{manualPause=true;explicitPlay=false;pause();const step=Number(b.dataset.loopStep);show(step);const node=[sources[0],hub,db,agents[0]][step];node?.classList.add('is-warm');}));
  figure.classList.add('is-in','is-paused');if(hasObserver)new IntersectionObserver(entries=>{for(const e of entries){inView=e.isIntersecting;sync();}},{threshold:.1}).observe(figure);
  let wide=innerWidth>700;addEventListener('resize',()=>{const next=innerWidth>700;if(next!==wide){wide=next;pause();sync();}});
  animations.push({sync,pause,preference:()=>{explicitPlay=false;sync();}});
});
document.addEventListener('visibilitychange',()=>animations.forEach(a=>a.sync()));
motion.addEventListener('change',()=>animations.forEach(a=>a.preference()));
window.addEventListener('pagehide',()=>animations.forEach(a=>a.pause()));
const reveals=[...document.querySelectorAll('[data-reveal]')];
if(hasObserver){const seen=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('is-visible');seen.unobserve(e.target);}},{threshold:.05});reveals.forEach(e=>{if(e.dataset.reveal==='load'||motion.matches)e.classList.add('is-visible');else seen.observe(e);});}else reveals.forEach(e=>e.classList.add('is-visible'));
// Dense reading ticks and a continuously positioned index square, one frame per scroll.
const toc=document.querySelector('[data-toc]'),links=[...document.querySelectorAll('[data-toc] a')],mark=document.querySelector('.nav-mark');
if(toc&&links.length){
 const targets=links.map(a=>document.getElementById(a.hash.slice(1))),ruler=toc.querySelector('.nav-ruler');let pending=false;
 for(let y=32;y<32+links.length*37;y+=6){const tick=document.createElement('i');tick.style.top=`${y}px`;ruler.append(tick);}
 const update=()=>{pending=false;const focus=innerHeight*.25,tops=targets.map(s=>s?.getBoundingClientRect().top??Infinity);let index=0;for(let i=0;i<tops.length;i++)if(tops[i]<=focus)index=i;
  links.forEach((a,i)=>{if(i===index)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
  const next=Math.min(index+1,links.length-1),distance=tops[next]-tops[index],fraction=next===index?0:Math.max(0,Math.min(1,(focus-tops[index])/distance));
  const y=links[index].offsetTop+links[index].offsetHeight/2+(links[next].offsetTop-links[index].offsetTop)*fraction;
  const active=document.querySelector('.nav-doors a[aria-current]');if(active)mark.style.setProperty('--y',`${active.offsetTop+active.offsetHeight/2-3}px`);
  [...ruler.children].forEach(t=>t.style.setProperty('--l',Math.max(0,1-Math.abs(parseFloat(t.style.top)-y)/24)));
  links.forEach(a=>a.style.setProperty('--l',Math.max(0,1-Math.abs(a.offsetTop+a.offsetHeight/2-y)/24)));
 };
 const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(update);}};
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);document.fonts?.ready.then(schedule);update();
}else if(mark){const active=document.querySelector('.nav-doors a[aria-current]');if(active)mark.style.setProperty('--y',`${active.offsetTop+active.offsetHeight/2-3}px`);}
