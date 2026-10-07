window.initHushNavPixel=()=>{
  if(window.__hushNavPixel)return;window.__hushNavPixel=true;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rail=document.querySelector('.rail');
  if(!rail)return;

  const brand=rail.querySelector('.hush-brand');
  if(brand)brand.innerHTML='<img class="hush-brand-logo" src="assets/hush-logo.svg" alt="" aria-hidden="true"><span class="hush-brand-word">hush</span>';

  const human=rail.querySelector('[data-format-human]'),agent=rail.querySelector('[data-format-agent]');
  if(human){human.href='./';human.setAttribute('aria-current','page')}
  if(agent){agent.href='index.md';agent.type='text/markdown';agent.title='Read this page as Markdown';agent.removeAttribute('aria-current')}

  const docs=[...rail.querySelectorAll('.nav-doors a')].find(a=>a.textContent.trim()==='Docs');
  docs?.classList.add('nav-mobile-keep');

  const oldMenu=rail.querySelector('[data-menu]');let menu=oldMenu;
  if(oldMenu){menu=oldMenu.cloneNode(true);oldMenu.replaceWith(menu)}
  const oldMark=document.querySelector('.nav-mark');let mark=oldMark;
  if(oldMark){mark=oldMark.cloneNode(true);oldMark.replaceWith(mark)}
  const oldToc=rail.querySelector('.nav-here[data-toc]');let toc=oldToc;
  if(oldToc){toc=oldToc.cloneNode(true);oldToc.replaceWith(toc)}

  const doors=[...rail.querySelectorAll('.nav-doors a')];
  doors.forEach((a,i)=>a.style.setProperty('--k',String(i)));
  const currentDoor=doors.find(a=>a.hasAttribute('aria-current'));
  const placeMark=(door,rotation)=>{
    if(!mark||!door)return;
    const rr=rail.getBoundingClientRect(),ar=door.getBoundingClientRect();
    mark.style.setProperty('--y',`${(ar.top-rr.top+ar.height/2-mark.offsetHeight/2).toFixed(1)}px`);
    mark.style.setProperty('--r',`${rotation}deg`);
  };
  const moveMark=fn=>{
    if(!mark)return;
    if(!(mark.style.getPropertyValue('--y')&&!reduce)){
      mark.style.transition=reduce?'none':'';
      fn();
      if(reduce){mark.offsetWidth;mark.style.transition=''}
      return;
    }
    mark.style.transition='transform 700ms var(--spring-36), opacity var(--dur-hover) var(--ease-hover)';
    fn();
    setTimeout(()=>{mark.style.transition=''},720);
  };
  if(mark){
    if(currentDoor){
      const rotation=doors.indexOf(currentDoor)*90;
      mark.classList.remove('is-off');
      moveMark(()=>placeMark(currentDoor,rotation));
      document.fonts?.ready.then(()=>moveMark(()=>placeMark(currentDoor,rotation)));
      addEventListener('resize',()=>placeMark(currentDoor,rotation));
    }else mark.classList.add('is-off');
  }

  if(menu){
    const desktop=matchMedia('(min-width: 521px)');
    const setOpen=on=>{rail.classList.toggle('is-open',on);menu.setAttribute('aria-expanded',String(on))};
    setOpen(false);
    menu.addEventListener('click',()=>setOpen(menu.getAttribute('aria-expanded')!=='true'));
    doors.forEach(a=>a.addEventListener('click',()=>setOpen(false)));
    addEventListener('keydown',e=>{if(e.key==='Escape'&&rail.classList.contains('is-open')){setOpen(false);menu.focus()}});
    document.addEventListener('pointerdown',e=>{if(rail.classList.contains('is-open')&&!e.target.closest('.rail'))setOpen(false)});
    desktop.addEventListener('change',e=>{if(e.matches)setOpen(false)});
  }

  if(toc){
    const links=[...toc.querySelectorAll('a[href^="#"]')];
    const sections=links.map(a=>document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))));
    const ruler=toc.querySelector('.nav-ruler');
    const centerOffset=10.5;
    let active=-2,lockUntil=0,progressLocked=true,raf=false;
    const buildRuler=()=>{
      if(!ruler||links.length<2)return;
      links.forEach((a,i)=>{a.style.setProperty('--k',String(doors.length+i));a.style.setProperty('--j',String(i));a.style.setProperty('--t',String(i*5))});
      const ticks=[];
      for(let i=0;i<links.length-1;i++){
        const y0=links[i].offsetTop+centerOffset,y1=links[i+1].offsetTop+centerOffset;
        for(let j=1;j<5;j++)ticks.push(`<i style="top:${(y0+(y1-y0)*j/5-.5).toFixed(1)}px; --t:${i*5+j}"></i>`)
      }
      ruler.innerHTML=ticks.join('');
    };
    const setActive=i=>{
      if(i===active)return;active=i;
      links.forEach((a,j)=>j===i?a.setAttribute('aria-current','location'):a.removeAttribute('aria-current'));
    };
    const sync=()=>{
      if(performance.now()<lockUntil)return;
      const line=innerHeight*.4;
      let idx=0;
      sections.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<=line)idx=i});
      const atBottom=links.length&&scrollY+innerHeight>=document.documentElement.scrollHeight-2;
      if(atBottom)idx=links.length-1;
      setActive(idx);
      if(progressLocked)return;
      const top=sections[idx]?.getBoundingClientRect().top??line;
      const next=sections[idx+1]?.getBoundingClientRect().top;
      const frac=atBottom||next===undefined?0:Math.min(1,Math.max(0,(line-top)/Math.max(next-top,1)));
      toc.style.setProperty('--y',((idx+frac)*5).toFixed(2));
    };
    addEventListener('scroll',()=>{if(!raf){raf=true;requestAnimationFrame(()=>{sync();raf=false})}},{passive:true});
    addEventListener('scrollend',()=>{lockUntil=0;sync()});
    addEventListener('resize',()=>{buildRuler();sync()});
    document.fonts?.ready.then(buildRuler);
    buildRuler();
    links.forEach((a,i)=>a.addEventListener('click',()=>{lockUntil=performance.now()+1200;setActive(i)}));
    sync();
    const unlock=()=>{
      const h=parseFloat(getComputedStyle(rail).getPropertyValue('--h'))||0;
      const delay=reduce?0:h+460+Math.max(active,0)*60;
      setTimeout(()=>{progressLocked=false;sync()},delay);
    };
    if(rail.classList.contains('is-visible'))unlock();
    else{
      const mo=new MutationObserver(()=>{if(rail.classList.contains('is-visible')){mo.disconnect();unlock()}});
      mo.observe(rail,{attributes:true,attributeFilter:['class']});
    }
  }
};