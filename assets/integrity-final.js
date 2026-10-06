window.finalizeHushIntegrity=()=>{
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const note=$('.hero .note');
  if(note){const text=$('.note-text',note)||$$('span',note)[1],cta=$('.note-cta',note);if(text)text.textContent='8/8 frozen gates passed';if(cta)cta.innerHTML='Research <span aria-hidden="true" class="arrow">↗</span>';}
  const groups=$$('.foot-group');
  if(groups[0])groups[0].innerHTML='<span class="foot-head">Product</span><ul class="foot-links"><li><a href="product/">Product</a></li><li><a href="#production">Evidence</a></li><li><a href="changelog/">Changelog</a></li><li><a href="https://github.com/sushxnthd/hush">Docs</a></li><li><a href="https://github.com/sushxnthd/hush">GitHub</a></li></ul>';
  if(groups[1])groups[1].innerHTML='<span class="foot-head">Research</span><ul class="foot-links"><li><a href="writing/">Research</a></li><li><a href="THREAT_MODEL.md">Threat model</a></li><li><a href="V1_2_ACCEPTANCE.md">v1.2</a></li><li><a href="ROADMAP.md">Roadmap</a></li></ul>';
  const footLine=$('.foot-line');if(footLine)footLine.textContent='Private mode for every AI.';
  const status=$('.foot-status');if(status)status.innerHTML='<i class="dot"></i> v1.2 in progress';
};