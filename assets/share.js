const encode = (value) => encodeURIComponent(value);

export function createShareControl({ title, text, url = location.href, label = 'Share' }) {
  const container = document.createElement('details');
  container.className = 'share-control';

  const trigger = document.createElement('summary');
  trigger.className = 'button-secondary share-trigger';
  trigger.innerHTML = '<i class="bi bi-share" aria-hidden="true"></i><span></span>';
  trigger.querySelector('span').textContent = label;
  container.append(trigger);

  const menu = document.createElement('div');
  menu.className = 'share-menu';
  menu.setAttribute('aria-label', 'Share options');

  const addLink = (name, href, icon) => {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i><span></span>`;
    link.querySelector('span').textContent = name;
    link.addEventListener('click', () => { container.open = false; });
    menu.append(link);
  };

  const shareText = `${title}\n${text}`;
  addLink('WhatsApp', `https://wa.me/?text=${encode(`${shareText}\n${url}`)}`, 'bi-whatsapp');
  addLink('X', `https://twitter.com/intent/tweet?text=${encode(shareText)}&url=${encode(url)}`, 'bi-twitter-x');
  addLink('Facebook', `https://www.facebook.com/sharer/sharer.php?u=${encode(url)}`, 'bi-facebook');
  addLink('Quora', `https://www.quora.com/share?url=${encode(url)}&title=${encode(title)}`, 'bi-quora');

  if (typeof navigator.share === 'function') {
    const native = document.createElement('button');
    native.type = 'button';
    native.innerHTML = '<i class="bi bi-box-arrow-up" aria-hidden="true"></i><span>More options</span>';
    native.addEventListener('click', async () => {
      try {
        await navigator.share({ title, text, url });
      } catch (error) {
        if (error.name !== 'AbortError') console.error('Could not open share sheet:', error);
      } finally {
        container.open = false;
      }
    });
    menu.append(native);
  }

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.innerHTML = '<i class="bi bi-copy" aria-hidden="true"></i><span>Copy text</span>';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      copy.querySelector('span').textContent = 'Copied';
      window.setTimeout(() => { copy.querySelector('span').textContent = 'Copy text'; }, 1600);
    } catch {
      copy.querySelector('span').textContent = 'Copy unavailable';
    }
  });
  menu.append(copy);
  container.append(menu);

  document.addEventListener('pointerdown', (event) => {
    if (!container.contains(event.target)) container.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') container.open = false;
  });

  return container;
}