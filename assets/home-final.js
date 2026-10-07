window.initHushHomeFinal=()=>{
  if(window.__hushHomeFinal)return;window.__hushHomeFinal=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  const dek=$('.hero .dek');
  if(dek)dek.textContent='Private context, memory and scoped authority for every model.';

  const prod=$('#production');
  if(prod){
    const halves=$$('.stat-bench .bench-half',prod);
    const addViz=(half,head,rows)=>{
      if(!half||$('.bench-viz',half))return;
      const v=document.createElement('div');v.className='bench-viz';
      v.innerHTML=`<div class="bench-viz-head"><span>${head}</span><span>lower is better</span></div>${rows.map(r=>`<div class="bench-viz-row ${r.base?'base':''}"><span>${r.label}</span><span class="bench-viz-track"><i class="bench-viz-fill" style="--share:${r.share}"></i></span><b>${r.value}</b></div>`).join('')}`;
      half.append(v)
    };
    addViz(halves[0],'credential leakage',[{label:'Hush',share:0,value:'0%'},{label:'Naive',share:1,value:'100%',base:true}]);
    addViz(halves[1],'protected-context violation',[{label:'Hush',share:.796,value:'.796'},{label:'Semantic',share:.941,value:'.941',base:true}]);
  }

  // Match the source setup-menu focus/click lifecycle that the earlier replica omitted.
  const opens=$('[data-opens]');
  if(opens){
    const toggle=$('[data-opens-toggle]',opens),list=$('[data-opens-menu]',opens),glide=$('.opens-glide',list);
    if(toggle&&list){
      list.addEventListener('focusout',e=>{if(!list.contains(e.relatedTarget)&&!list.matches(':hover'))glide?.classList.remove('is-on')});
      list.addEventListener('focusin',e=>{const li=e.target.closest?.('li');if(li?.querySelector('a')&&glide){glide.style.height=`${li.offsetHeight}px`;glide.style.setProperty('--y',`${li.offsetTop}px`);glide.classList.add('is-on')}});
      list.addEventListener('click',e=>{if(e.target.closest?.('a')){list.hidden=true;toggle.setAttribute('aria-expanded','false');glide?.classList.remove('is-on')}})
    }
  }

  const memo=$('#memo');
  if(!memo||$('.card-layer'))return;
  const scope='data-astro-cid-lcdefpme';
  const scoped=el=>{el.setAttribute(scope,'');el.querySelectorAll('*').forEach(n=>n.setAttribute(scope,''));return el};
  const wrapPhrase=(phrase,id)=>{
    const walker=document.createTreeWalker(memo,NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode()){
      const i=node.nodeValue.indexOf(phrase);if(i<0)continue;
      const before=node.nodeValue.slice(0,i),after=node.nodeValue.slice(i+phrase.length);
      const frag=document.createDocumentFragment();if(before)frag.append(document.createTextNode(before));
      const a=document.createElement('a');a.href=`#${id}`;a.className='key';a.dataset.card=id;a.setAttribute('aria-expanded','false');a.setAttribute(scope,'');a.append(document.createTextNode(phrase));
      const fn=document.createElement('span');fn.className='fn';fn.setAttribute('aria-hidden','true');fn.setAttribute(scope,'');a.append(fn);frag.append(a);if(after)frag.append(document.createTextNode(after));node.replaceWith(frag);return a
    }
  };
  wrapPhrase('user-controlled boundary','q-bounded');
  wrapPhrase('minimum useful answer','q-budget');
  wrapPhrase('memory proposal','q-agentci');
  wrapPhrase('scoped action','q-agentleak');

  const layer=scoped(document.createElement('div'));layer.className='card-layer';layer.setAttribute('aria-live','polite');
  layer.innerHTML=`
    <figure class="pop quote" data-card-for="q-bounded" aria-hidden="true"><header class="pop-head"><span class="pop-tag"><i class="pop-sq"></i>Evidence 01</span><span class="pop-org">Connector-backed compute</span></header><blockquote class="pop-body"><strong>160/160 bounded decisions</strong> across Gmail, Calendar, Drive and GitHub, with zero exact benchmark-secret and connector-path exposures.</blockquote><footer class="pop-foot"><span class="pop-who pop-sub">Controlled Hush benchmark</span></footer></figure>
    <figure class="pop live" data-card-for="q-budget" aria-hidden="true"><header class="pop-head"><span class="pop-tag"><i class="pop-sq"></i>Reconstruction</span><span class="pop-org">512 generated secrets</span></header><ol class="pop-body hush-pop-bars"><li><span class="lab">Hush</span><i class="track"><b class="fill" style="--share:0"></b></i><strong>0%</strong></li><li><span class="lab">Unprotected</span><i class="track"><b class="fill" style="--share:1"></b></i><strong>100%</strong></li></ol><footer class="pop-foot"><span class="pop-who pop-sub">8 answers leave 256 candidates on the tested Hush path</span></footer></figure>
    <figure class="pop live" data-card-for="q-agentci" aria-hidden="true"><header class="pop-head"><span class="pop-tag"><i class="pop-sq"></i>AgentCIBench</span><span class="pop-org">Frozen external holdout</span></header><ol class="pop-body hush-pop-bars"><li><span class="lab">Completeness</span><i class="track"><b class="fill" style="--share:.9507"></b></i><strong>95.07%</strong></li><li><span class="lab">Hush violation</span><i class="track"><b class="fill" style="--share:.796"></b></i><strong>.796</strong></li><li><span class="lab">Semantic</span><i class="track"><b class="fill" style="--share:.941"></b></i><strong>.941</strong></li></ol><footer class="pop-foot"><span class="pop-who pop-sub">8/8 frozen scientific gates · 6–0 paired leak-free wins</span></footer></figure>
    <figure class="pop live" data-card-for="q-agentleak" aria-hidden="true"><header class="pop-head"><span class="pop-tag"><i class="pop-sq"></i>AgentLeak</span><span class="pop-org">50 paired traces</span></header><ol class="pop-body hush-pop-bars"><li><span class="lab">Hush</span><i class="track"><b class="fill" style="--share:0"></b></i><strong>0%</strong></li><li><span class="lab">Naive</span><i class="track"><b class="fill" style="--share:1"></b></i><strong>100%</strong></li></ol><footer class="pop-foot"><span class="pop-who pop-sub">credential-canary leakage · both paths 100% task success</span></footer></figure>`;
  scoped(layer);document.body.append(layer);

  const keys=$$('.memo .key[data-card]'),cards=new Map($$('[data-card-for]',layer).map(c=>[c.dataset.cardFor,c]));
  const leaveMs=reduce?120:160;let currentKey=null,currentId=null,showTimer,hideTimer,lastPointer='mouse';
  const position=()=>{
    if(!currentKey||!currentId)return;const card=cards.get(currentId);if(!card)return;
    const kr=currentKey.getBoundingClientRect(),anchor=(currentKey.querySelector('.fn')||currentKey).getBoundingClientRect(),w=card.offsetWidth,h=card.offsetHeight,x=anchor.left+(anchor.width-1)/2;
    let left=Math.min(Math.max(kr.left,16),innerWidth-16-w);if(x>left+w-16)left=Math.max(16,Math.min(x+16-w,innerWidth-16-w));
    let top=anchor.bottom+10,above=top+h>innerHeight-16&&anchor.top-10-h>16;if(above)top=anchor.top-10-h;top=Math.min(Math.max(top,16),Math.max(16,innerHeight-16-h));left=Math.round(left);const tx=Math.round(Math.min(Math.max(x-left,12),w-12));
    card.style.left=`${left}px`;card.style.top=`${Math.round(top)}px`;card.style.setProperty('--tx',`${tx}px`);card.style.transformOrigin=`${tx}px ${above?'100%':'0%'}`;card.classList.toggle('is-above',above)
  };
  const syncExpanded=()=>keys.forEach(k=>k.setAttribute('aria-expanded',String(k.dataset.card===currentId)));
  const leaveCard=card=>{if(!card)return;card.classList.add('is-leaving');card.classList.remove('is-on');card.setAttribute('aria-hidden','true');setTimeout(()=>card.classList.remove('is-leaving'),leaveMs)};
  const show=key=>{clearTimeout(hideTimer);const id=key.dataset.card;currentKey=key;if(currentId===id){position();return}if(currentId)leaveCard(cards.get(currentId));const card=cards.get(id);currentId=id;position();card.classList.remove('is-leaving');card.classList.add('is-on');card.setAttribute('aria-hidden','false');syncExpanded()};
  const hide=()=>{clearTimeout(showTimer);clearTimeout(hideTimer);if(currentId)leaveCard(cards.get(currentId));currentId=null;currentKey=null;syncExpanded()};
  const queueHide=()=>{clearTimeout(showTimer);clearTimeout(hideTimer);hideTimer=setTimeout(hide,180)};
  const isMouse=e=>e.pointerType==='mouse';
  keys.forEach(key=>{
    key.addEventListener('pointerenter',e=>{if(isMouse(e)){clearTimeout(hideTimer);clearTimeout(showTimer);showTimer=setTimeout(()=>show(key),80)}});
    key.addEventListener('pointerleave',e=>{if(isMouse(e))queueHide()});
    key.addEventListener('pointerdown',e=>{lastPointer=e.pointerType});
    key.addEventListener('focus',()=>show(key));key.addEventListener('blur',queueHide);
    key.addEventListener('click',e=>{e.preventDefault();lastPointer==='mouse'?show(key):currentId===key.dataset.card?hide():show(key)})
  });
  cards.forEach(card=>{card.addEventListener('pointerenter',()=>clearTimeout(hideTimer));card.addEventListener('pointerleave',e=>{if(isMouse(e))queueHide()})});
  addEventListener('keydown',e=>{if(e.key==='Escape')hide()});addEventListener('scroll',position,{passive:true});addEventListener('resize',position);
  document.addEventListener('pointerdown',e=>{if(currentId&&!e.target.closest('[data-card], [data-card-for]'))hide()});syncExpanded();
};