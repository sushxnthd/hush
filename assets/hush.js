document.documentElement.classList.add('js');

const normalizeHomePath = path => path.replace(/index\.html$/, '').replace(/\/+$/, '/') || '/';
const currentPath = normalizeHomePath(location.pathname);
const isHushHome = currentPath === '/' || currentPath.endsWith('/hush/');

if (isHushHome) {
  buildFullHomepage();
} else {
  initStandardPage();
}

async function buildFullHomepage() {
  const root = document.documentElement;
  const main = document.querySelector('main.col');
  if (!main) return initStandardPage();

  root.classList.add('hush-assembling');
  const guard = document.createElement('style');
  guard.id = 'hush-assembly-guard';
  guard.textContent = 'html.hush-assembling main.col{opacity:0}';
  document.head.append(guard);

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'assets/hush-full.css?v=20261006c';
  const cssReady = new Promise(resolve => {
    css.onload = resolve;
    css.onerror = resolve;
  });
  document.head.append(css);

  const names = ['hero','memo','what','production','security','cta','writing','contribute','footer','cards'];
  try {
    const parts = await Promise.all(names.map(async name => {
      const response = await fetch(`fragments/${name}.html?v=20261006c`, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`${name}: ${response.status}`);
      return response.text();
    }));

    await cssReady;
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      if (/assets\/hush\.css(?:\?|$)/.test(link.getAttribute('href') || '')) link.remove();
    });

    main.innerHTML = parts.slice(0, 9).join('\n');
    document.querySelector('.card-layer')?.remove();
    document.body.insertAdjacentHTML('beforeend', parts[9]);

    const toc = document.querySelector('.nav-here');
    if (toc) {
      toc.innerHTML = [
        '<span class="nav-ruler"></span>',
        '<a href="#top" data-section="top">Overview</a>',
        '<a href="#memo" data-section="memo">Mission</a>',
        '<a href="#what" data-section="what">What Hush does</a>',
        '<a href="#production" data-section="production">Evidence</a>',
        '<a href="#security" data-section="security">Surfaces</a>',
        '<a href="#writing" data-section="writing">Writing</a>',
        '<a href="#contribute" data-section="contribute">Contribute</a>'
      ].join('');
    }

    const full = document.createElement('script');
    full.src = 'assets/hush-full.js?v=20261006c';
    full.defer = true;
    full.onload = reveal;
    full.onerror = reveal;
    document.body.append(full);
  } catch (error) {
    console.warn('Hush homepage enhancement failed; keeping the stable page.', error);
    reveal();
    initStandardPage();
  }

  function reveal() {
    root.classList.remove('hush-assembling');
    guard.remove();
  }

  setTimeout(reveal, 1800);
}

function initStandardPage() {
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const rail = q('.rail');
  const menu = q('.menu');

  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    rail?.classList.toggle('is-open', open);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      menu?.setAttribute('aria-expanded', 'false');
      rail?.classList.remove('is-open');
    }
  });

  qa('.nav-doors a').forEach(link => link.addEventListener('click', () => {
    menu?.setAttribute('aria-expanded', 'false');
    rail?.classList.remove('is-open');
  }));

  const revealNodes = qa('[data-reveal]');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    revealNodes.forEach(node => node.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }), { threshold: .08, rootMargin: '0px 0px -30px' });
    revealNodes.forEach(node => node.dataset.reveal === 'load'
      ? requestAnimationFrame(() => node.classList.add('is-visible'))
      : observer.observe(node));
  }

  const tocLinks = qa('[data-section]');
  const sections = tocLinks.map(link => document.getElementById(link.dataset.section)).filter(Boolean);
  const navHere = q('.nav-here');
  const mark = q('.nav-mark');

  function placeMark() {
    const active = q('.nav-doors a[aria-current="page"]');
    if (mark && active && innerWidth > 1000) {
      mark.style.setProperty('--y', `${active.offsetTop + active.offsetHeight / 2 - 3}px`);
    }
  }

  function sync() {
    if (!sections.length) return;
    const trigger = innerHeight * .38;
    let active = 0;
    const tops = sections.map(section => section.getBoundingClientRect().top);
    tops.forEach((top, index) => { if (top <= trigger) active = index; });
    if (scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 2) active = sections.length - 1;
    tocLinks.forEach((link, index) => index === active
      ? link.setAttribute('aria-current', 'location')
      : link.removeAttribute('aria-current'));
    const next = tops[active + 1];
    const progress = next == null ? 0 : Math.max(0, Math.min(1, (trigger - tops[active]) / Math.max(next - tops[active], 1)));
    navHere?.style.setProperty('--y', String((active + progress) * 5));
  }

  let ticking = false;
  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      sync();
      placeMark();
      ticking = false;
    });
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  document.fonts?.ready.then(schedule);
  schedule();

  const prefetched = new Set();
  document.addEventListener('pointerover', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (url.origin !== location.origin || url.pathname === location.pathname || prefetched.has(url.href)) return;
    prefetched.add(url.href);
    const hint = document.createElement('link');
    hint.rel = 'prefetch';
    hint.href = url.href;
    document.head.append(hint);
  }, { passive: true });

  const pixelCss = document.createElement('link');
  pixelCss.rel = 'stylesheet';
  pixelCss.href = '../assets/subpage-integrity.css?v=3';
  document.head.append(pixelCss);
  const pixelScript = document.createElement('script');
  pixelScript.src = '../assets/subpage-nav-pixel.js?v=1';
  pixelScript.defer = true;
  document.body.append(pixelScript);
}
