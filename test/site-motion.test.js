import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script=readFileSync(new URL('../assets/product-site.js',import.meta.url),'utf8');
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
function target(){
  const handlers=new Map(),classes=new Set(),properties=new Map();
  return {
    hidden:false,dataset:{},attributes:new Map(),textContent:'',
    addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);},
    emit(name){for(const fn of handlers.get(name)||[])fn({type:name});},
    classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},contains:n=>classes.has(n),toggle(n,on){if(on)classes.add(n);else classes.delete(n);}},
    style:{setProperty:(name,value)=>properties.set(name,value),getPropertyValue:name=>properties.get(name)},
    setAttribute(name,value){this.attributes.set(name,value);},
    getBoundingClientRect(){return {top:10,bottom:200};}
  };
}
function harness({observer=true,reduced=false,active=false,pixel=false}={}){
  const window=target(),document=target(),motion=target(),video=target(),button=target(),field=target(),mark=target(),reveal=target();
  const intersections=[],timers=new Map();let timerId=0;
  const stream=target(),section=target(),pixelButton=target();
  stream.dataset.heights='1';stream.closest=()=>section;
  stream.querySelectorAll=()=>Array.from({length:8},target);
  section.querySelector=()=>pixelButton;
  motion.matches=reduced;
  video.paused=true;video.plays=0;
  video.play=async()=>{video.paused=false;video.plays++;};
  video.pause=()=>{video.paused=true;};
  field.querySelector=selector=>selector==='video'?video:selector==='.media-toggle'?button:null;
  const activeLink={offsetTop:200,offsetHeight:24};
  document.hidden=false;
  document.documentElement=target();
  document.fonts={ready:Promise.resolve()};
  document.querySelector=selector=>selector==='.nav-mark'?mark:selector==='.nav-doors a[aria-current]'&&active?activeLink:null;
  document.querySelectorAll=selector=>selector==='.figure,.row figure.tile'?[field]:selector==='[data-reveal]'?[reveal]:selector==='[data-stream]'&&pixel?[stream]:[];
  const context={window,document,matchMedia:()=>motion,innerHeight:900,innerWidth:1363,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn(),addEventListener:window.addEventListener.bind(window)};
  if(observer){
    context.IntersectionObserver=class {
      constructor(fn){this.fn=fn;}
      observe(element){intersections.push({element,fn:this.fn});}
      unobserve(){}
    };
    window.IntersectionObserver=context.IntersectionObserver;
  }
  vm.runInNewContext(script,context);
  return {window,document,motion,video,button,field,mark,reveal,stream,pixelButton,timers,
    intersect(element,visible){for(const item of intersections.filter(i=>i.element===element))item.fn([{target:element,isIntersecting:visible}]);}
  };
}

test('marketing video resumes after a back/forward-cache restore',async()=>{
  const h=harness();h.intersect(h.field,true);await flush();
  assert.equal(h.video.paused,false);
  h.window.emit('pagehide');assert.equal(h.video.paused,true);
  h.window.emit('pageshow');await flush();
  assert.equal(h.video.paused,false);assert.equal(h.video.plays,2);
});

test('a manual pause survives visibility changes and page restoration',async()=>{
  const h=harness();h.intersect(h.field,true);await flush();h.button.emit('click');
  h.window.emit('pagehide');h.window.emit('pageshow');h.document.emit('visibilitychange');await flush();
  assert.equal(h.video.paused,true);assert.equal(h.video.plays,1);
});

test('reduced motion stops footage immediately and reveals static content',async()=>{
  const h=harness();h.intersect(h.field,true);await flush();
  h.motion.matches=true;h.motion.emit('change');await flush();
  assert.equal(h.video.paused,true);assert.equal(h.reveal.classList.contains('is-visible'),true);
  h.motion.matches=false;h.motion.emit('change');await flush();assert.equal(h.video.paused,false);
});

test('background tabs pause media without reviving a delayed play promise',async()=>{
  const h=harness();h.intersect(h.field,true);
  h.document.hidden=true;h.document.emit('visibilitychange');await flush();
  assert.equal(h.video.paused,true);assert.equal(h.field.classList.contains('playing'),false);
  h.document.hidden=false;h.document.emit('visibilitychange');await flush();assert.equal(h.video.paused,false);
});

test('the no-observer fallback plays visible media and stops it offscreen',async()=>{
  const h=harness({observer:false});await flush();assert.equal(h.video.paused,false);
  h.field.getBoundingClientRect=()=>({top:1200,bottom:1400});h.window.emit('scroll');await flush();assert.equal(h.video.paused,true);
});

test('secondary pages do not show a stray navigation square',async()=>{
  const h=harness();await flush();assert.equal(h.mark.hidden,true);
  const current=harness({active:true});await flush();assert.equal(current.mark.hidden,false);assert.equal(current.mark.style.getPropertyValue('--y'),'209px');
});

test('static motion preference never autoplays media',async()=>{
  const h=harness({reduced:true});h.intersect(h.field,true);await flush();assert.equal(h.video.plays,0);
  h.button.emit('click');await flush();assert.equal(h.video.plays,1);
});

test('pixel playback controls express user intent without animating an offscreen stream',()=>{
  const h=harness({pixel:true});h.stream.getBoundingClientRect=()=>({top:1200,bottom:1256});
  h.intersect(h.stream,false);assert.equal(h.pixelButton.textContent,'Pause pixel animation');assert.equal(h.timers.size,0);
  h.pixelButton.emit('click');assert.equal(h.pixelButton.textContent,'Play pixel animation');
  h.pixelButton.emit('click');assert.equal(h.pixelButton.textContent,'Pause pixel animation');assert.equal(h.timers.size,0);
  h.intersect(h.stream,true);assert.equal(h.timers.size,1);
  h.pixelButton.emit('click');assert.equal(h.timers.size,0);assert.equal(h.pixelButton.attributes.get('aria-pressed'),'false');
});

test('pixel playback clears pending work in background tabs and restores the chosen state',()=>{
  const h=harness({pixel:true});h.intersect(h.stream,true);assert.equal(h.timers.size,1);
  h.document.hidden=true;h.document.emit('visibilitychange');assert.equal(h.timers.size,0);
  h.document.hidden=false;h.window.emit('pageshow');assert.equal(h.timers.size,1);
  h.motion.matches=true;h.motion.emit('change');assert.equal(h.timers.size,0);assert.equal(h.pixelButton.textContent,'Play pixel animation');
});
