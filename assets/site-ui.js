const themeKey = 'daily-bread.theme';
const settingsKey = 'daily-bread.user-settings';
const defaultWallpaper = 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1600&q=80';
const wallpaperOptions = {
  journaling: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1600&q=80',
  sunrise: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
  olive: 'https://images.unsplash.com/photo-1516575150278-77136aed6920?auto=format&fit=crop&w=1600&q=80'
};

const root = document.documentElement;
const menuButton = document.getElementById('menu-toggle');
const menu = document.getElementById('site-menu');
const themeButton = document.getElementById('theme-toggle');

function getStoredSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function persistSettings(partial) {
  try {
    const current = getStoredSettings();
    const next = { ...current, ...partial };
    localStorage.setItem(settingsKey, JSON.stringify(next));
  } catch {
    // storage may be unavailable in restricted contexts
  }
}

function applyWallpaper(value = 'journaling') {
  const wallpaper = wallpaperOptions[value] || wallpaperOptions.journaling || defaultWallpaper;
  document.documentElement.style.setProperty('--page-wallpaper', `url("${wallpaper}")`);
  persistSettings({ wallpaper: value });
}

async function syncUserPreference(key, value) {
  try {
    const module = await import('./supabase-client.js');
    const { hasSupabaseConfig, supabase } = module;
    if (!hasSupabaseConfig || !supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.auth.updateUser({ data: { [key]: value } });
  } catch {
    // ignore when the user is not signed in or the client is unavailable
  }
}

const appearanceModes = ['wallpaper', 'dark', 'light'];

function setTheme(theme) {
  const mode = appearanceModes.includes(theme) ? theme : 'dark';
  const light = mode === 'light';
  if (!root) return;
  root.dataset.appearance = mode;
  root.dataset.theme = light ? 'light' : 'dark';
  persistSettings({ theme: mode });
  if (!themeButton) return;
  const nextMode = appearanceModes[(appearanceModes.indexOf(mode) + 1) % appearanceModes.length];
  const modeLabels = { wallpaper: 'wallpaper', dark: 'dark', light: 'white' };
  themeButton.setAttribute('aria-label', `Switch to ${modeLabels[nextMode]} mode`);
  themeButton.title = `Appearance: ${modeLabels[mode]}. Switch to ${modeLabels[nextMode]} mode`;
  themeButton.dataset.mode = mode;
  themeButton.innerHTML = mode === 'light'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z"/></svg>'
    : mode === 'wallpaper'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
}

const savedSettings = getStoredSettings();
let savedTheme = savedSettings.theme || 'dark';
try {
  const localTheme = localStorage.getItem(themeKey);
  if (localTheme) savedTheme = localTheme;
} catch {
  savedTheme = savedSettings.theme || 'dark';
}
setTheme(savedTheme);
applyWallpaper(savedSettings.wallpaper || 'journaling');

if (themeButton) {
  themeButton.addEventListener('click', async () => {
    const currentMode = root.dataset.appearance || 'dark';
    const nextMode = appearanceModes[(appearanceModes.indexOf(currentMode) + 1) % appearanceModes.length];
    setTheme(nextMode);
    await syncUserPreference('theme', nextMode);
    try {
      localStorage.setItem(themeKey, nextMode);
    } catch {
      // storage may be unavailable in restricted contexts
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
    if (session?.user?.user_metadata) {
      const metaTheme = session.user.user_metadata.theme;
      const metaWallpaper = session.user.user_metadata.wallpaper;
      if (metaTheme) setTheme(metaTheme);
      if (metaWallpaper) applyWallpaper(metaWallpaper);
      if (metaTheme || metaWallpaper) {
        persistSettings({
          theme: metaTheme || root.dataset.appearance || 'dark',
          wallpaper: metaWallpaper || 'journaling'
        });
      }
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        updateSignedInLabel(Boolean(session));
        if (session?.user?.user_metadata) {
          const metaTheme = session.user.user_metadata.theme;
          const metaWallpaper = session.user.user_metadata.wallpaper;
          if (metaTheme) setTheme(metaTheme);
          if (metaWallpaper) applyWallpaper(metaWallpaper);
        }
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
  if (!menu.contains(event.target) && menuButton && !menuButton.contains(event.target)) {
    setMenuOpen(false);
  }
});

syncAuthState();