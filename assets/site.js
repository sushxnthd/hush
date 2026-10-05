const root = document.documentElement;
const rail = document.querySelector('.rail');
const mobile = matchMedia('(max-width: 1000px)');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const scriptUrl = new URL(document.currentScript?.src || location.href, location.href);
const siteRoot = new URL('../', scriptUrl).pathname;

root.classList.add('enhanced');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

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

function applyHushLogo(scope = document) {
  scope.querySelectorAll('.brandmark svg, .btn-tile svg, .lnode.kernel svg').forEach(svg => {
    if (svg.dataset.hushLogo === 'true') return;
    const wrapper = document.createElement('span');
    wrapper.innerHTML = hushLogoMarkup.trim();
    const replacement = wrapper.firstElementChild;
    replacement.dataset.hushLogo = 'true';
    svg.replaceWith(replacement);
  });
}

function absoluteInternalLinks(scope = document) {
  scope.querySelectorAll('a[href]').forEach(link => {
    const raw = link.getAttribute('href');
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
    let url;
    try { url = new URL(raw, location.href); } catch { return; }
    if (url.origin !== location.origin || !url.pathname.startsWith(siteRoot)) return;
    link.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
  });
}

function menuButton() { return document.querySelector('.mobile-menu'); }

function closeMenu({ restoreFocus = false } = {}) {
  const button = menuButton();
  rail?.classList.remove('menu-open');
  button?.setAttribute('aria-expanded', 'false');
  button?.setAttribute('aria-label', 'Open navigation');
  if (restoreFocus) button?.focus();
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton()?.getAttribute('aria-expanded') === 'true') {
    closeMenu({ restoreFocus: true });
  }
});

let revealObserver = null;
let sectionNav = null;
let sectionLinks = [];
let sections = [];
let ruler = null;
let ticking = false;

function initReveals() {
  revealObserver?.disconnect();
  revealObserver = null;
  const revealNodes = [...document.querySelectorAll('.col [data-reveal]')];
  if (!motion.matches && 'IntersectionObserver' in window) {
    root.classList.add('motion-ready');
    revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: .08, rootMargin: '0px 0px -32px 0px' });
    revealNodes.filter(node => node.dataset.reveal !== 'load').forEach(node => revealObserver.observe(node));
    requestAnimationFrame(() => {
      revealNodes.filter(node => node.dataset.reveal === 'load').forEach(node => node.classList.add('is-visible'));
    });
  } else {
    root.classList.remove('motion-ready');
    revealNodes.forEach(node => node.classList.add('is-visible'));
  }
}

function initSections() {
  sectionNav = document.querySelector('[data-toc]');
  sectionLinks = [...document.querySelectorAll('[data-section]')]
    .filter(link => document.getElementById(link.dataset.section));
  sections = sectionLinks.map(link => document.getElementById(link.dataset.section));
  ruler = sectionNav?.querySelector('.nav-ruler') || null;
  sectionLinks.forEach((link, index) => link.style.setProperty('--t', String(index * 5)));
  ticking = false;
  layoutRuler();
  placeSiteMark();
  syncSections();
}

function layoutRuler() {
  if (!ruler || sectionLinks.length < 2 || mobile.matches) return;
  const ticks = [];
  for (let index = 0; index < sectionLinks.length - 1; index++) {
    const from = sectionLinks[index].offsetTop + 10.5;
    const to = sectionLinks[index + 1].offsetTop + 10.5;
    for (let step = 1; step < 5; step++) {
      const tick = document.createElement('i');
      tick.style.top = `${from + (to - from) * step / 5 - .5}px`;
      tick.style.setProperty('--t', String(index * 5 + step));
      ticks.push(tick);
    }
  }
  ruler.replaceChildren(...ticks);
}

function placeSiteMark() {
  const mark = document.querySelector('.nav-mark');
  const active = document.querySelector('.nav-doors a[aria-current="page"]');
  if (!mark || !active || mobile.matches) return;
  mark.style.setProperty('--mark-y', `${active.offsetTop + active.offsetHeight / 2 - 3}px`);
}

function syncSections() {
  if (!sections.length) { ticking = false; return; }
  const trigger = innerHeight * .4;
  let active = 0;
  const positions = sections.map(section => section.getBoundingClientRect().top);
  positions.forEach((top, index) => { if (top <= trigger) active = index; });
  const atEnd = scrollY > 0 && scrollY + innerHeight >= root.scrollHeight - 2;
  if (atEnd) active = sections.length - 1;
  sectionLinks.forEach((link, index) => {
    if (index === active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  const next = positions[active + 1];
  const progress = atEnd || next == null ? 0
    : Math.min(1, Math.max(0, (trigger - positions[active]) / Math.max(next - positions[active], 1)));
  sectionNav?.style.setProperty('--y', String((active + progress) * 5));
  ticking = false;
}

function scheduleSync() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(syncSections);
}

function pathKey(value) {
  const url = value instanceof URL ? value : new URL(value, location.href);
  let path = url.pathname.replace(/index\.html$/, '');
  if (!path.endsWith('/')) path += '/';
  return path;
}

function updatePrimaryNav(targetUrl) {
  const target = pathKey(targetUrl);
  document.querySelectorAll('.nav-doors a[href]').forEach(link => {
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (url.origin === location.origin && pathKey(url) === target) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function updateHead(doc) {
  if (doc.title) document.title = doc.title;
  const incoming = doc.querySelector('meta[name="description"]')?.getAttribute('content');
  const current = document.querySelector('meta[name="description"]');
  if (incoming && current) current.setAttribute('content', incoming);
}

function replaceToc(doc) {
  const incoming = doc.querySelector('.nav-here');
  const current = document.querySelector('.nav-here');
  if (incoming && current) current.innerHTML = incoming.innerHTML;
}

function scrollToDestination(url, fallbackY = 0) {
  if (url.hash) {
    const id = decodeURIComponent(url.hash.slice(1));
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      return;
    }
  }
  scrollTo({ top: fallbackY, left: 0, behavior: 'auto' });
}

const pageCache = new Map();
let navigationController = null;
let navigationSerial = 0;

function cacheKey(url) {
  const clean = new URL(url, location.href);
  clean.hash = '';
  return clean.href;
}

async function fetchPage(url, { signal } = {}) {
  const key = cacheKey(url);
  if (pageCache.has(key)) return pageCache.get(key);
  const promise = fetch(key, {
    signal,
    credentials: 'same-origin',
    headers: { 'X-Hush-Navigation': '1' }
  }).then(async response => {
    if (!response.ok) throw new Error(`Navigation failed (${response.status})`);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc.querySelector('.col')) throw new Error('Target page is missing the Hush content shell');
    return doc;
  }).catch(error => {
    pageCache.delete(key);
    throw error;
  });
  pageCache.set(key, promise);
  return promise;
}

function canNavigate(anchor, event = null) {
  if (!anchor?.href || anchor.hasAttribute('download')) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (event && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return false;
  let url;
  try { url = new URL(anchor.href, location.href); } catch { return false; }
  if (url.origin !== location.origin || !url.pathname.startsWith(siteRoot)) return false;
  if (/\.[a-z0-9]{2,8}$/i.test(url.pathname) && !url.pathname.endsWith('.html')) return false;
  return true;
}

async function animateOut(node) {
  if (motion.matches || !node?.animate) return;
  const animation = node.animate([
    { opacity: 1, transform: 'translateY(0)' },
    { opacity: 0, transform: 'translateY(7px)' }
  ], { duration: 130, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  await animation.finished.catch(() => {});
  animation.cancel();
}

async function animateIn(node) {
  if (motion.matches || !node?.animate) return;
  const animation = node.animate([
    { opacity: 0, transform: 'translateY(-7px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
  await animation.finished.catch(() => {});
  animation.cancel();
}

async function navigate(destination, { push = true, restoreY = 0 } = {}) {
  const url = new URL(destination, location.href);
  const current = new URL(location.href);

  if (pathKey(url) === pathKey(current) && url.search === current.search) {
    if (push && url.href !== current.href) history.pushState({ scrollY }, '', url.href);
    scrollToDestination(url, restoreY);
    return;
  }

  navigationController?.abort();
  navigationController = new AbortController();
  const serial = ++navigationSerial;
  const col = document.querySelector('.col');
  if (!col) { location.href = url.href; return; }

  root.classList.add('is-navigating');
  try {
    const doc = await fetchPage(url, { signal: navigationController.signal });
    if (serial !== navigationSerial) return;

    await animateOut(col);
    if (serial !== navigationSerial) return;

    if (push) {
      history.replaceState({ ...(history.state || {}), scrollY }, '', location.href);
      history.pushState({ scrollY: 0 }, '', url.href);
    }

    const incomingCol = doc.querySelector('.col');
    col.innerHTML = incomingCol.innerHTML;
    updateHead(doc);
    replaceToc(doc);
    updatePrimaryNav(url);
    applyHushLogo(document);
    absoluteInternalLinks(document);
    initReveals();
    initSections();
    scrollToDestination(url, restoreY);
    closeMenu();
    await animateIn(col);
  } catch (error) {
    if (error?.name === 'AbortError') return;
    console.warn('[Hush navigation] Falling back to a full navigation.', error);
    location.href = url.href;
  } finally {
    if (serial === navigationSerial) root.classList.remove('is-navigating');
  }
}

async function copyPrompt(button) {
  const prompt = document.querySelector('#setup-prompt');
  const status = document.querySelector('.copy-status');
  if (!prompt || !status) return;
  button.disabled = true;
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
    button.disabled = false;
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest('.mobile-menu');
  if (button) {
    const open = button.getAttribute('aria-expanded') !== 'true';
    rail?.classList.toggle('menu-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    return;
  }

  const copy = event.target.closest('.copy-prompt');
  if (copy) {
    copyPrompt(copy);
    return;
  }

  const anchor = event.target.closest('a[href]');
  if (!canNavigate(anchor, event)) {
    if (mobile.matches && !rail?.contains(event.target)) closeMenu();
    return;
  }

  const url = new URL(anchor.href, location.href);
  if (pathKey(url) === pathKey(location.href) && url.hash) {
    event.preventDefault();
    history.pushState({ scrollY }, '', url.href);
    scrollToDestination(url, scrollY);
    closeMenu();
    return;
  }

  event.preventDefault();
  navigate(url, { push: true });
});

document.addEventListener('pointerover', event => {
  const anchor = event.target.closest('a[href]');
  if (!canNavigate(anchor)) return;
  const url = new URL(anchor.href, location.href);
  if (pathKey(url) !== pathKey(location.href)) fetchPage(url).catch(() => {});
}, { passive: true });

document.addEventListener('focusin', event => {
  const anchor = event.target.closest?.('a[href]');
  if (!canNavigate(anchor)) return;
  const url = new URL(anchor.href, location.href);
  if (pathKey(url) !== pathKey(location.href)) fetchPage(url).catch(() => {});
});

addEventListener('popstate', event => {
  navigate(location.href, { push: false, restoreY: event.state?.scrollY || 0 });
});

addEventListener('scroll', scheduleSync, { passive: true });
addEventListener('resize', () => {
  layoutRuler();
  placeSiteMark();
  scheduleSync();
}, { passive: true });

mobile.addEventListener('change', () => {
  closeMenu();
  layoutRuler();
  placeSiteMark();
  scheduleSync();
});

motion.addEventListener('change', () => {
  initReveals();
});

document.fonts?.ready.then(() => {
  layoutRuler();
  placeSiteMark();
  scheduleSync();
});

applyHushLogo(document);
absoluteInternalLinks(document);
updatePrimaryNav(location.href);
initReveals();
initSections();
history.replaceState({ ...(history.state || {}), scrollY }, '', location.href);
