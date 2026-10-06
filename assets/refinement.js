window.initHushRefinement=()=>{
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveals=[...document.querySelectorAll("[data-reveal]")];
  reveals.filter(e=>e.dataset.reveal==="load").forEach(e=>requestAnimationFrame(()=>e.classList.add("is-visible")));
  const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add("is-visible");if(x.target.id==="production")setTimeout(()=>x.target.classList.add("is-settled"),1400);io.unobserve(x.target)}}),{rootMargin:"0px 0px -9% 0px",threshold:.1});
  reveals.filter(e=>e.dataset.reveal!=="load").forEach(e=>io.observe(e));
  document.querySelectorAll("#what .row").forEach((row,i)=>{row.dataset.reveal="";row.style.setProperty("--d",`${i*60}ms`);io.observe(row)});
  const menu=document.querySelector(".menu"),rail=document.querySelector(".rail");
  if(menu&&rail)menu.addEventListener("click",()=>{const on=menu.getAttribute("aria-expanded")!=="true";menu.setAttribute("aria-expanded",String(on));rail.classList.toggle("is-open",on)});
  document.querySelectorAll("a[href='#top']").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();scrollTo({top:0,behavior:reduce?"auto":"smooth"})}));
  document.querySelectorAll('a[href^="#"]').forEach(a=>{if(a.getAttribute("href")==="#top")return;a.addEventListener("click",()=>{if(menu&&rail){menu.setAttribute("aria-expanded","false");rail.classList.remove("is-open")}})});
  const toc=[...document.querySelectorAll(".nav-here a[href^='#']")];
  const mark=document.querySelector(".nav-mark");
  const targets=toc.map(a=>document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const syncToc=()=>{
    let active=targets[0]; const y=scrollY+innerHeight*.28;
    for(const s of targets){if(s.offsetTop<=y)active=s}
    toc.forEach(a=>a.removeAttribute("aria-current"));
    const a=toc.find(x=>x.getAttribute("href")==="#"+active?.id);
    if(a){a.setAttribute("aria-current","location");if(mark){const rr=rail.getBoundingClientRect(),ar=a.getBoundingClientRect();mark.style.setProperty("--y",`${Math.round(ar.top-rr.top+ar.height/2)}px`)}}
  };
  let raf=0; addEventListener("scroll",()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;syncToc()})},{passive:true});addEventListener("resize",syncToc);syncToc();
};
