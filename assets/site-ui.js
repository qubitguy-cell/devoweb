const themeKey = 'daily-bread.theme';
const root = document.documentElement;
const menuButton = document.getElementById('menu-toggle');
const menu = document.getElementById('site-menu');
const themeButton = document.getElementById('theme-toggle');

function setTheme(theme) {
  const light = theme === 'light';
  if (!root) return;
  root.dataset.theme = light ? 'light' : 'dark';
  if (!themeButton) return;
  themeButton.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
  themeButton.title = light ? 'Switch to dark theme' : 'Switch to light theme';
  themeButton.innerHTML = light
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
}

let savedTheme = 'dark';
try {
  savedTheme = localStorage.getItem(themeKey) || 'dark';
} catch {
  savedTheme = 'dark';
}
setTheme(savedTheme);

if (themeButton) {
  themeButton.addEventListener('click', () => {
    const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    setTheme(theme);
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      // The selected theme still applies for this page when storage is unavailable.
    }
  });
}

function setMenuOpen(open) {
  if (!menuButton || !menu) return;
  menu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  menuButton.title = open ? 'Close navigation' : 'Open navigation';
  menuButton.innerHTML = open
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
}

function updateSignedInLabel(isSignedIn) {
  const signInLinks = Array.from(document.querySelectorAll('a.nav-link[href="./sign-in.html"], a.nav-link[href$="sign-in.html"]'));
  signInLinks.forEach((link) => {
    if (!link) return;
    if (isSignedIn) {
      link.href = './community.html';
      link.setAttribute('aria-label', 'Account');
      link.innerHTML = '<i class="bi bi-person-check"></i><span>Account</span>';
    } else {
      link.href = './sign-in.html';
      link.setAttribute('aria-label', 'Sign in');
      link.innerHTML = '<i class="bi bi-person-circle"></i><span>Sign in</span>';
    }
  });
}

async function syncAuthState() {
  try {
    const module = await import('./supabase-client.js');
    const { hasSupabaseConfig, supabase } = module;
    if (!hasSupabaseConfig || !supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    updateSignedInLabel(Boolean(session));

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        updateSignedInLabel(Boolean(session));
      }
    });
  } catch {
    updateSignedInLabel(false);
  }
}

if (menuButton && menu) {
  menuButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(menu.hidden);
  });

  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenuOpen(false);
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu && !menu.hidden) {
    setMenuOpen(false);
    if (menuButton) menuButton.focus();
  }
});

document.addEventListener('pointerdown', (event) => {
  if (!menu || menu.hidden) return;
  if (!menu.contains(event.target) && !menuButton.contains(event.target)) {
    setMenuOpen(false);
  }
});

syncAuthState();