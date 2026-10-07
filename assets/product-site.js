// Progressive enhancement. Content, links and controls remain visible without JS.
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
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('.blue-field').forEach(field=>{const video=field.querySelector('video'),button=field.querySelector('.media-toggle');if(!video||!button)return;let manualPause=false;
  const pause=()=>{video.pause();field.classList.remove('playing');button.textContent='Play motion';button.setAttribute('aria-label','Play background animation');};
  const play=async()=>{try{await video.play();field.classList.add('playing');button.textContent='Pause motion';button.setAttribute('aria-label','Pause background animation');}catch{pause();}};
  button.addEventListener('click',()=>{if(video.paused){manualPause=false;play();}else{manualPause=true;pause();}});
  video.addEventListener('error',pause);
  if(!reduced)new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting&&!manualPause)play();else pause();}},{threshold:.15}).observe(field);
});
if(!reduced&&'IntersectionObserver'in window){const seen=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){e.target.classList.add('in-view');seen.unobserve(e.target);}}},{threshold:.08});document.querySelectorAll('.site-section,.product-preview').forEach(e=>seen.observe(e));}
const toc=[...document.querySelectorAll('.site-toc a')];
if(toc.length&&'IntersectionObserver'in window){const active=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)toc.forEach(a=>{if(a.hash==='#'+e.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});},{rootMargin:'-12% 0px -58% 0px'});toc.forEach(a=>{const s=document.getElementById(a.hash.slice(1));if(s)active.observe(s);});}
