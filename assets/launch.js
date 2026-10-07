// Progressive enhancement only: all pages and setup instructions work without JS.
document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    const value = document.getElementById(button.dataset.copy)?.textContent;
    const status = document.getElementById('copy-status');
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      const original = button.textContent;
      button.textContent = 'Copied';
      if (status) status.textContent = 'Commands copied. Replace the example passphrase before running them.';
      setTimeout(() => { button.textContent = original; }, 2000);
    } catch {
      if (status) status.textContent = 'Clipboard access is unavailable. Select and copy the displayed commands.';
    }
  });
});
document.querySelectorAll('[data-platform]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-platform]').forEach(item => {
      item.setAttribute('aria-pressed', String(item === button));
    });
    document.querySelectorAll('[data-code-platform]').forEach(item => {
      item.hidden = item.dataset.codePlatform !== button.dataset.platform;
    });
  });
});
