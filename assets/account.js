import { hasSupabaseConfig, supabase } from './supabase-client.js';

const profileContent = document.getElementById('profile-content');
const loading = document.getElementById('profile-loading');
const form = document.getElementById('profile-form');
const status = document.getElementById('profile-status');
const saveButton = document.getElementById('profile-save');
const displayName = document.getElementById('profile-name');
const avatarUrl = document.getElementById('profile-avatar-url');
const bio = document.getElementById('profile-bio');
const avatar = document.getElementById('profile-avatar');
let currentUser = null;

function announce(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(date);
}

function renderAvatar(url, name) {
  avatar.replaceChildren();
  avatar.textContent = (name || '?').trim().charAt(0).toUpperCase() || '?';
  if (!url) return;

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return;
    const image = document.createElement('img');
    image.src = parsed.href;
    image.alt = '';
    image.addEventListener('error', () => image.remove(), { once: true });
    avatar.replaceChildren(image);
  } catch {
    // Keep the initial fallback for invalid URLs.
  }
}

function renderUser(user) {
  const metadata = user.user_metadata || {};
  const name = metadata.display_name || user.email?.split('@')[0] || 'Community member';
  document.getElementById('profile-display-name').textContent = name;
  document.getElementById('profile-email').textContent = user.email || '';
  document.getElementById('detail-email').textContent = user.email || 'Not available';
  document.getElementById('detail-created').textContent = formatDate(user.created_at);
  document.getElementById('detail-last-sign-in').textContent = formatDate(user.last_sign_in_at);
  displayName.value = name;
  avatarUrl.value = metadata.avatar_url || '';
  bio.value = metadata.bio || '';
  renderAvatar(metadata.avatar_url, name);
  loading.hidden = true;
  profileContent.hidden = false;
}

if (!hasSupabaseConfig) {
  loading.textContent = 'Add your Supabase project URL and publishable key to enable account profiles.';
} else {
  const { data, error } = await supabase.auth.getSession();
  if (error) loading.textContent = error.message;
  if (!data.session?.user) {
    location.replace('./sign-in.html?next=account');
  } else {
    currentUser = data.session.user;
    renderUser(currentUser);
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      location.replace('./sign-in.html');
    } else if (event === 'USER_UPDATED') {
      currentUser = session.user;
      renderUser(currentUser);
    }
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser || saveButton.disabled) return;

  const name = displayName.value.trim();
  const imageUrl = avatarUrl.value.trim();
  const about = bio.value.trim();
  if (!name || name.length > 60 || about.length > 240) {
    announce('Enter a display name (up to 60 characters) and bio (up to 240 characters).', true);
    return;
  }

  saveButton.disabled = true;
  announce('Saving profile...');
  try {
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: name, avatar_url: imageUrl, bio: about }
    });
    if (error) throw error;
    currentUser = data.user;
    renderUser(currentUser);
    announce('Profile saved.');
  } catch (error) {
    announce(error.message || 'Could not save your profile. Please try again.', true);
  } finally {
    saveButton.disabled = false;
  }
});

document.getElementById('profile-sign-out').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) announce(error.message, true);
});
