const root = document.documentElement;
const rail = document.querySelector('.rail');
const menu = document.querySelector('.mobile-menu');
const mobile = matchMedia('(max-width: 1000px)');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const revealNodes = [...document.querySelectorAll('[data-reveal]')];

const INTERNAL_NAV_KEY = 'hush:internal-navigation-target';
const normalizePath = value => {
  const url = value instanceof URL ? value : new URL(value, location.href);
  let path = url.pathname.replace(/index\.html$/, '');
  if (!path.endsWith('/')) path += '/';
  return `${path}${url.search}`;
};

let internalArrival = false;
try {
  const target = sessionStorage.getItem(INTERNAL_NAV_KEY);
  internalArrival = target === normalizePath(location.href);
  if (target) sessionStorage.removeItem(INTERNAL_NAV_KEY);
} catch {}

root.classList.add('enhanced');
if (internalArrival) root.classList.add('internal-arrival');

const motionStyle = document.createElement('style');
motionStyle.id = 'hush-motion-system';
motionStyle.textContent = `
  @view-transition { navigation: auto; }

  .rail { view-transition-name: hush-rail; }
  .col { view-transition-name: hush-content; }

  ::view-transition-old(root),
  ::view-transition-new(root),
  ::view-transition-old(hush-rail),
  ::view-transition-new(hush-rail) {
    animation: none;
  }

  ::view-transition-old(hush-content) {
    animation: hush-content-out 140ms cubic-bezier(.4, 0, 1, 1) both;
  }

  ::view-transition-new(hush-content) {
    animation: hush-content-in 220ms cubic-bezier(.22, 1, .36, 1) both;
  }

  @keyframes hush-content-out {
    to { opacity: 0; }
  }

  @keyframes hush-content-in {
    from { opacity: 0; }
  }

  /* The sidebar is persistent chrome; it should never run the page-load reveal. */
  html.motion-ready .rail[data-reveal] {
    opacity: 1;
    translate: 0;
    transition: none;
  }

  /* Keep all page-level reveal movement consistent. */
  html.motion-ready .figure[data-reveal] {
    translate: 0 10px;
  }

  /* The scroll ruler should track scrolling directly instead of lagging behind it. */
  .nav-here a::before {
    transition: background-color var(--dur-hover) var(--ease-hover);
  }

  @media (prefers-reduced-motion: reduce) {
    ::view-transition-old(root),
    ::view-transition-new(root),
    ::view-transition-old(hush-rail),
    ::view-transition-new(hush-rail),
    ::view-transition-old(hush-content),
    ::view-transition-new(hush-content) {
      animation: none !important;
    }
  }
`;
document.head.append(motionStyle);

const hushLogoMarkup = `
  <svg viewBox="0 0 256 256" aria-hidden="true">
    <g fill="currentColor">
      <path d="M78 34H178C183.523 34 188 38.477 188 44V84H68V44C68 38.477 72.477 34 78 34Z"/>
      <path d="M30 84H68V160H30C24.477 160 20 155.523 20 150V94C20 88.477 24.477 84 30 84Z"/>
      <path d="M188 84H226C231.523 84 236 88.477 236 94V150C236 155.523 231.523 160 226 160H188V84Z"/>
      <path d="M68 160H112V200H68V160Z"/>
      <path d="M152 160H196V201L152 232V160Z"/>
      <rect x="91" y="110" width="22" height="24"/>
      <rect x="143" y="110" width="22" height="24"/>
    </g>
  </svg>`;

document.querySelectorAll('.brandmark svg, .btn-tile svg, .lnode.kernel svg').forEach(svg => {
  const wrapper = document.createElement('span');
  wrapper.innerHTML = hushLogoMarkup.trim();
  svg.replaceWith(wrapper.firstElementChild);
});

function closeMenu({ restoreFocus = false } = {}) {
  rail?.classList.remove('menu-open');
  menu?.setAttribute('aria-expanded', 'false');
  menu?.setAttribute('aria-label', 'Open navigation');
  if (restoreFocus) menu?.focus();
}

menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  rail?.classList.toggle('menu-open', open);
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
    closeMenu({ restoreFocus: true });
  }
});

document.addEventListener('click', event => {
  if (mobile.matches && !rail?.contains(event.target)) closeMenu();
});

rail?.querySelectorAll('.nav-doors a').forEach(link => {
  link.addEventListener('click', () => closeMenu());
});

mobile.addEventListener('change', () => {
  closeMenu();
  layoutRuler();
  placeSiteMark();
  scheduleSync();
});

let observer;
const loadRevealNodes = revealNodes.filter(node => node.dataset.reveal === 'load');
const scrollRevealNodes = revealNodes.filter(node => node.dataset.reveal !== 'load');

function revealImmediately(nodes) {
  nodes.forEach(node => node.classList.add('is-visible'));
}

function setupReveals() {
  observer?.disconnect();

  if (motion.matches || !('IntersectionObserver' in window)) {
    root.classList.remove('motion-ready');
    revealImmediately(revealNodes);
    return;
  }

  root.classList.add('motion-ready');

  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: .08, rootMargin: '0px 0px -32px 0px' });

  scrollRevealNodes.forEach(node => observer.observe(node));

  /* A cross-page View Transition already supplies the entrance motion. Running
     the hero's stagger again creates a second, inconsistent animation. */
  if (internalArrival) {
    revealImmediately(loadRevealNodes);
  } else {
    requestAnimationFrame(() => revealImmediately(loadRevealNodes));
  }
}

setupReveals();

motion.addEventListener('change', () => {
  if (motion.matches) {
    observer?.disconnect();
    root.classList.remove('motion-ready');
    revealImmediately(revealNodes);
  } else {
    setupReveals();
  }
});

const sectionNav = document.querySelector('[data-toc]');
const links = [...document.querySelectorAll('[data-section]')]
  .filter(link => document.getElementById(link.dataset.section));
const sections = links.map(link => document.getElementById(link.dataset.section));
const ruler = sectionNav?.querySelector('.nav-ruler');
links.forEach((link, index) => link.style.setProperty('--t', String(index * 5)));

function layoutRuler() {
  if (!ruler || links.length < 2 || mobile.matches) return;
  const ticks = [];
  for (let index = 0; index < links.length - 1; index++) {
    const from = links[index].offsetTop + 10.5;
    const to = links[index + 1].offsetTop + 10.5;
    for (let step = 1; step < 5; step++) {
      const tick = document.createElement('i');
      tick.style.top = `${from + (to - from) * step / 5 - .5}px`;
      tick.style.setProperty('--t', String(index * 5 + step));
      ticks.push(tick);
    }
  }
  ruler.replaceChildren(...ticks);
}

const mark = document.querySelector('.nav-mark');
function placeSiteMark() {
  const active = document.querySelector('.nav-doors a[aria-current]');
  if (!mark || !active || mobile.matches) return;
  mark.style.setProperty('--mark-y', `${active.offsetTop + active.offsetHeight / 2 - 3}px`);
}

let ticking = false;
function syncSections() {
  if (!sections.length) {
    ticking = false;
    return;
  }

  const trigger = innerHeight * .4;
  let active = 0;
  const positions = sections.map(section => section.getBoundingClientRect().top);
  positions.forEach((top, index) => {
    if (top <= trigger) active = index;
  });

  const atEnd = scrollY > 0 && scrollY + innerHeight >= root.scrollHeight - 2;
  if (atEnd) active = sections.length - 1;

  links.forEach((link, index) => {
    if (index === active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });

  const next = positions[active + 1];
  const progress = atEnd || next == null
    ? 0
    : Math.min(1, Math.max(0, (trigger - positions[active]) / Math.max(next - positions[active], 1)));

  sectionNav?.style.setProperty('--y', String((active + progress) * 5));
  ticking = false;
}

function scheduleSync() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(syncSections);
}

addEventListener('scroll', scheduleSync, { passive: true });
addEventListener('resize', () => {
  layoutRuler();
  placeSiteMark();
  scheduleSync();
}, { passive: true });

document.fonts?.ready.then(() => {
  layoutRuler();
  placeSiteMark();
  scheduleSync();
});

layoutRuler();
placeSiteMark();
syncSections();

const copyButton = document.querySelector('.copy-prompt');
copyButton?.addEventListener('click', async () => {
  const prompt = document.querySelector('#setup-prompt');
  const status = document.querySelector('.copy-status');
  if (!prompt || !status) return;

  copyButton.disabled = true;
  try {
    await navigator.clipboard.writeText(prompt.textContent.trim());
    status.textContent = 'Prompt copied. Paste it into your connected AI client.';
  } catch {
    const range = document.createRange();
    range.selectNodeContents(prompt);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    status.textContent = 'Select and copy the highlighted prompt to your AI client.';
  } finally {
    copyButton.disabled = false;
  }
});

function internalPageUrl(link) {
  if (!link?.href || link.hasAttribute('download')) return null;
  if (link.target && link.target !== '_self') return null;

  let url;
  try {
    url = new URL(link.href, location.href);
  } catch {
    return null;
  }

  if (url.origin !== location.origin) return null;

  const currentRoot = location.pathname.includes('/hush/') ? '/hush/' : '/';
  if (!url.pathname.startsWith(currentRoot)) return null;
  if (/\.[a-z0-9]{2,8}$/i.test(url.pathname) && !url.pathname.endsWith('.html')) return null;

  return url;
}

/* Mark only genuine cross-page Hush navigation. This lets the next document
   avoid replaying its page-load stagger on top of the View Transition. */
document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href]');
  const url = internalPageUrl(link);
  if (!url || normalizePath(url) === normalizePath(location.href)) return;

  try {
    sessionStorage.setItem(INTERNAL_NAV_KEY, normalizePath(url));
  } catch {}
}, { capture: true });

/* Prefetch any internal Hush page, not just the main nav, so CTA/footer routes
   get the same transition quality. */
const prefetched = new Set();
function prefetchInternal(link) {
  const url = internalPageUrl(link);
  if (!url || normalizePath(url) === normalizePath(location.href)) return;

  url.hash = '';
  const href = url.href;
  if (prefetched.has(href)) return;
  prefetched.add(href);

  const hint = document.createElement('link');
  hint.rel = 'prefetch';
  hint.href = href;
  document.head.append(hint);
}

document.addEventListener('pointerover', event => {
  prefetchInternal(event.target.closest('a[href]'));
}, { passive: true });

document.addEventListener('focusin', event => {
  prefetchInternal(event.target.closest?.('a[href]'));
});
