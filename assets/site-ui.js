const themeKey = 'daily-bread.theme';
const settingsKey = 'daily-bread.user-settings';
const wallpaperOptions = [
  'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1516575150278-77136aed6920?auto=format&fit=crop&w=1600&q=80'
];

const root = document.documentElement;
const menuButton = document.getElementById('menu-toggle');
const menu = document.getElementById('site-menu');
const themeButton = document.getElementById('theme-toggle');
const accountButton = document.createElement('a');
accountButton.className = 'icon-button account-avatar-button';
accountButton.id = 'account-avatar-button';
accountButton.href = './sign-in.html';
accountButton.setAttribute('aria-label', 'Sign in');
accountButton.title = 'Sign in';
accountButton.innerHTML = '<i class="bi bi-person-circle" aria-hidden="true"></i>';

const notificationButton = document.createElement('a');
notificationButton.className = 'icon-button notification-button';
notificationButton.href = './notifications.html';
notificationButton.setAttribute('aria-label', 'Notifications');
notificationButton.title = 'Notifications';
notificationButton.innerHTML = '<i class="bi bi-bell" aria-hidden="true"></i><span class="notification-badge" aria-live="polite" hidden></span>';
const notificationBadge = notificationButton.querySelector('.notification-badge');

if (menuButton?.parentElement) {
  menuButton.parentElement.insertBefore(accountButton, menuButton.nextSibling);
  menuButton.parentElement.insertBefore(notificationButton, accountButton);
}
menu?.querySelectorAll('a[href$="sign-in.html"], a[href$="account.html"]').forEach((link) => link.remove());

if (menu) {
  const communityLink = menu.querySelector('a[href$="community.html"]');
  const menuLinks = [
    { href: './counsel.html', icon: 'bi-chat-square-heart', label: 'Counsel & advice' },
    { href: './notifications.html', icon: 'bi-bell', label: 'Notifications' }
  ];
  for (const item of menuLinks) {
    if (menu.querySelector(`a[href$="${item.href.split('/').pop()}"]`)) continue;
    const link = document.createElement('a');
    link.className = 'nav-link';
    link.href = item.href;
    link.innerHTML = `<i class="bi ${item.icon}" aria-hidden="true"></i><span>${item.label}</span>`;
    if (communityLink) communityLink.after(link);
    else menu.append(link);
  }
}

let notificationChannel = null;
let notificationUserId = null;

function showUnreadCount(count) {
  if (!notificationBadge) return;
  notificationBadge.hidden = !count;
  notificationBadge.textContent = count > 99 ? '99+' : String(count);
  notificationButton.setAttribute('aria-label', count ? `Notifications, ${count} unread` : 'Notifications');
  notificationButton.title = count ? `${count} unread notification${count === 1 ? '' : 's'}` : 'Notifications';
}

async function refreshUnreadCount(supabase, userId) {
  if (!userId || notificationUserId !== userId) return;
  const { count, error } = await supabase.from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null);
  if (!error && notificationUserId === userId) showUnreadCount(count || 0);
}

async function markNotificationsRead() {
  try {
    const { supabase, hasSupabaseConfig } = await import('./supabase-client.js');
    if (!hasSupabaseConfig || !supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    showUnreadCount(0);
    await supabase.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('recipient_id', session.user.id)
      .is('read_at', null);
  } catch {
    // The inbox still opens if notifications are temporarily unavailable.
  }
}

notificationButton.addEventListener('click', async (event) => {
  event.preventDefault();
  await markNotificationsRead();
  location.assign(notificationButton.href);
});

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

function applyWallpaper() {
  const now = new Date();
  const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const wallpaper = wallpaperOptions[dayNumber % wallpaperOptions.length];
  document.documentElement.style.setProperty('--page-wallpaper', `url("${wallpaper}")`);
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
applyWallpaper();

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

function updateSignedInLabel(user) {
  const isSignedIn = Boolean(user);
  accountButton.href = isSignedIn ? './account.html' : './sign-in.html';
  accountButton.setAttribute('aria-label', isSignedIn ? 'Account' : 'Sign in');
  accountButton.title = isSignedIn ? 'Account' : 'Sign in';
  accountButton.replaceChildren();

  if (isSignedIn && user.user_metadata?.avatar_url) {
    try {
      const avatarUrl = new URL(user.user_metadata.avatar_url);
      if (['http:', 'https:'].includes(avatarUrl.protocol)) {
        const image = document.createElement('img');
        image.src = avatarUrl.href;
        image.alt = '';
        image.addEventListener('error', () => image.replaceWith(makeAvatarFallback(user)), { once: true });
        accountButton.append(image);
        return;
      }
    } catch {
      // Invalid avatar URLs fall back to an initial.
    }
  }

  accountButton.append(isSignedIn ? makeAvatarFallback(user) : createSignInIcon());
}

function makeAvatarFallback(user) {
  const initial = (user.user_metadata?.display_name || user.email?.split('@')[0] || '?').trim().charAt(0).toUpperCase();
  const label = document.createElement('span');
  label.className = 'account-avatar-initial';
  label.textContent = initial || '?';
  return label;
}

function createSignInIcon() {
  const icon = document.createElement('i');
  icon.className = 'bi bi-person-circle';
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

async function syncAuthState() {
  try {
    const module = await import('./supabase-client.js');
    const { hasSupabaseConfig, supabase } = module;
    if (!hasSupabaseConfig || !supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    updateSignedInLabel(session?.user);
    notificationUserId = session?.user?.id || null;
    if (notificationChannel) await supabase.removeChannel(notificationChannel);
    notificationChannel = null;
    showUnreadCount(0);
    if (session?.user) {
      await refreshUnreadCount(supabase, session.user.id);
      notificationChannel = supabase.channel(`notifications:${session.user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${session.user.id}`
        }, () => refreshUnreadCount(supabase, session.user.id))
        .subscribe();
    }
    if (session?.user?.user_metadata) {
      const metaTheme = session.user.user_metadata.theme;
      if (metaTheme) setTheme(metaTheme);
      if (metaTheme) {
        persistSettings({
          theme: metaTheme
        });
      }
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        updateSignedInLabel(session?.user);
        if (event === 'SIGNED_OUT') {
          notificationUserId = null;
          showUnreadCount(0);
          if (notificationChannel) supabase.removeChannel(notificationChannel);
          notificationChannel = null;
        } else if (session?.user && notificationUserId !== session.user.id) {
          notificationUserId = session.user.id;
          refreshUnreadCount(supabase, session.user.id);
          if (notificationChannel) supabase.removeChannel(notificationChannel);
          notificationChannel = supabase.channel(`notifications:${session.user.id}`)
            .on('postgres_changes', {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `recipient_id=eq.${session.user.id}`
            }, () => refreshUnreadCount(supabase, session.user.id))
            .subscribe();
        }
        if (session?.user?.user_metadata) {
          const metaTheme = session.user.user_metadata.theme;
          if (metaTheme) setTheme(metaTheme);
        }
      }
    });
  } catch {
    updateSignedInLabel(null);
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