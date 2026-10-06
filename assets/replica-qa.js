(()=>{
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];

  // Remove source-only controls that are false for Hush. Keep the source layout itself intact.
  qa('.cookie-bar,.cookie-panel,[data-cookie-consent],[data-cookie-dialog],.dials').forEach(el=>el.remove());
  qa('[data-cookie-settings]').forEach(el=>el.closest('li')?.remove()||el.remove());

  // Restore the original field still. The mirrored source expected a video that is intentionally
  // not carried over, so the still must be the visible layer rather than a blank blue poster.
  const field=q('.field');
  const still=q('.field .still');
  const film=q('.field .film');
  if(field) field.setAttribute('aria-label','The Hush field: private context held behind the user-owned boundary.');
  if(still){
    still.src='assets/images/context-field.webp';
    still.loading='eager';
    still.decoding='async';
    still.style.display='block';
  }
  film?.remove();

  // The mirrored document used a page URL as its skip target. Restore proper in-document behavior.
  const main=q('main.col');
  if(main&&!main.id) main.id='content';
  const skip=q('a.skip');
  if(skip) skip.href='#content';

  // Replace every source-site relative route with an actual Hush destination. No dead inherited links.
  const exact={
    'docs/concepts/content-types.html':'product/',
    'product.html':'product/',
    'research/index.html':'writing/',
    'docs/self-hosting/overview.html':'https://github.com/sushxnthd/hush/blob/main/ARCHITECTURE.md',
    'blog/open-sourcing-company-brain.html':'https://github.com/sushxnthd/hush/pull/29',
    'blog/jev-memory-context-engineering.html':'https://github.com/sushxnthd/hush/blob/main/research/AGENTCIBENCH_CONFIRMATORY_V1.md',
    'blog/reverse-engineering-instinct-memory.html':'https://github.com/sushxnthd/hush/blob/main/research/AGENTCIBENCH_CONTEXT_BOUNDARY_DEV_V1F.md',
    'blog.html':'writing/',
    'responsible-disclosure.html':'https://github.com/sushxnthd/hush/blob/main/SECURITY.md'
  };
  qa('a[href]').forEach(a=>{
    const raw=a.getAttribute('href')||'';
    if(exact[raw]) a.setAttribute('href',exact[raw]);
    if(/^docs\/integrations\//.test(raw)) a.setAttribute('href','product/');
  });

  // Normalize footer destinations and remove labels that imply unsupported social/status products.
  const foot=q('.foot');
  if(foot){
    const byText={
      'Responsible disclosure':'https://github.com/sushxnthd/hush/blob/main/SECURITY.md',
      'Research':'writing/',
      'Changelog':'changelog/',
      'Product':'product/'
    };
    qa('a',foot).forEach(a=>{
      const t=a.textContent.trim();
      if(byText[t]) a.href=byText[t];
    });
  }

  // Prevent small presentational leftovers from source components from surfacing as product claims.
  qa('[data-status]').forEach(a=>{
    a.href='https://github.com/sushxnthd/hush';
    const label=a.querySelector('.foot-status-label')||a.querySelector('span:last-child');
    if(label&&/operational|status/i.test(label.textContent)) label.textContent='Alpha';
  });

  // Repair source chart tab semantics without changing the source geometry.
  const curve=q('.cost-curve');
  if(curve){
    const buttons=qa('[data-cc-tab]',curve);
    buttons.forEach((btn,i)=>{
      btn.classList.toggle('is-active',i===0);
      btn.setAttribute('aria-selected',i===0?'true':'false');
      btn.addEventListener('click',()=>{
        buttons.forEach(b=>{
          const on=b===btn;
          b.classList.toggle('is-active',on);
          b.setAttribute('aria-selected',on?'true':'false');
        });
      });
    });
  }

  // Clean up any empty list items left by removed controls.
  qa('li').forEach(li=>{if(!li.textContent.trim()&&!li.querySelector('a,button,svg,img')) li.remove()});
})();