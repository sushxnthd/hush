const root = document.documentElement;
const rail = document.querySelector('.rail');
const menu = document.querySelector('.mobile-menu');
const mobile = matchMedia('(max-width: 1000px)');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const revealNodes = [...document.querySelectorAll('[data-reveal]')];

root.classList.add('enhanced');

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
if (!motion.matches && 'IntersectionObserver' in window) {
  root.classList.add('motion-ready');
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: .08, rootMargin: '0px 0px -32px 0px' });
  revealNodes.filter(node => node.dataset.reveal !== 'load').forEach(node => observer.observe(node));
  requestAnimationFrame(() => {
    revealNodes.filter(node => node.dataset.reveal === 'load').forEach(node => node.classList.add('is-visible'));
  });
} else {
  revealNodes.forEach(node => node.classList.add('is-visible'));
}
motion.addEventListener('change', () => {
  if (!motion.matches) return;
  observer?.disconnect();
  root.classList.remove('motion-ready');
  revealNodes.forEach(node => node.classList.add('is-visible'));
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
  if (!sections.length) { ticking = false; return; }
  const trigger = innerHeight * .4;
  let active = 0;
  const positions = sections.map(section => section.getBoundingClientRect().top);
  positions.forEach((top, index) => { if (top <= trigger) active = index; });
  const atEnd = scrollY > 0 && scrollY + innerHeight >= root.scrollHeight - 2;
  if (atEnd) active = sections.length - 1;
  links.forEach((link, index) => {
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
