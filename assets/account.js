import { hasSupabaseConfig, supabase } from './supabase-client.js';

const profileContent = document.getElementById('profile-content');
const loading = document.getElementById('profile-loading');
const form = document.getElementById('profile-form');
const status = document.getElementById('profile-status');
const saveButton = document.getElementById('profile-save');
const displayName = document.getElementById('profile-name');
const emailInput = document.getElementById('profile-email-edit');
const avatarFile = document.getElementById('profile-avatar-file');
const removeAvatarButton = document.getElementById('profile-avatar-remove');
const bio = document.getElementById('profile-bio');
const isScholar = document.getElementById('profile-is-scholar');
const scholarBio = document.getElementById('profile-scholar-bio');
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
  emailInput.value = user.email || '';
  document.getElementById('detail-email').textContent = user.email || 'Not available';
  document.getElementById('detail-created').textContent = formatDate(user.created_at);
  document.getElementById('detail-last-sign-in').textContent = formatDate(user.last_sign_in_at);
  displayName.value = name;
  bio.value = metadata.bio || '';
  isScholar.checked = metadata.is_scholar === true;
  scholarBio.value = metadata.scholar_bio || '';
  renderAvatar(metadata.avatar_url, name);
  removeAvatarButton.hidden = !metadata.avatar_url;
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
  const email = emailInput.value.trim();
  const about = bio.value.trim();
  const credentials = scholarBio.value.trim();
  const file = avatarFile.files[0];
  const emailChanged = email !== currentUser.email;
  if (!name || name.length > 60 || !email || about.length > 240 || credentials.length > 300) {
    announce('Enter a display name (up to 60 characters) and bio (up to 240 characters).', true);
    return;
  }
  if (file && (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 3 * 1024 * 1024)) {
    announce('Choose a JPEG, PNG, WebP, or GIF image no larger than 3 MB.', true);
    return;
  }

  saveButton.disabled = true;
  announce('Saving profile...');
  try {
    let imageUrl = currentUser.user_metadata?.avatar_url || '';
    if (file) {
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
      const path = `${currentUser.id}/avatar.${extension}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      });
      if (uploadError) throw uploadError;
      imageUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    }
    const updates = {
      data: {
        display_name: name,
        avatar_url: imageUrl,
        bio: about,
        is_scholar: isScholar.checked,
        scholar_bio: isScholar.checked ? credentials : ''
      }
    };
    if (emailChanged) updates.email = email;
    const { data, error } = await supabase.auth.updateUser(updates);
    if (error) throw error;
    currentUser = data.user;
    avatarFile.value = '';
    if (isScholar.checked) {
      const { error: scholarError } = await supabase.from('scholar_profiles').upsert({
        user_id: currentUser.id,
        display_name: name,
        bio: credentials
      });
      if (scholarError) throw scholarError;
    } else {
      const { error: scholarError } = await supabase.from('scholar_profiles').delete().eq('user_id', currentUser.id);
      if (scholarError) throw scholarError;
    }
    renderUser(currentUser);
    announce(emailChanged ? 'Profile saved. Check your inbox to confirm the new email address.' : 'Profile saved.');
  } catch (error) {
    announce(error.message || 'Could not save your profile. Please try again.', true);
  } finally {
    saveButton.disabled = false;
  }
});

removeAvatarButton.addEventListener('click', async () => {
  if (!currentUser || !currentUser.user_metadata?.avatar_url) return;
  removeAvatarButton.disabled = true;
  try {
    const { data: files, error: listError } = await supabase.storage.from('avatars').list(currentUser.id);
    if (listError) throw listError;
    const paths = (files || []).filter((file) => file.name.startsWith('avatar.'))
      .map((file) => `${currentUser.id}/${file.name}`);
    if (paths.length) {
      const { error: removeError } = await supabase.storage.from('avatars').remove(paths);
      if (removeError) throw removeError;
    }
    const { data, error } = await supabase.auth.updateUser({ data: { avatar_url: '' } });
    if (error) throw error;
    currentUser = data.user;
    renderUser(currentUser);
    announce('Profile photo removed.');
  } catch (error) {
    announce(error.message || 'Could not remove the profile photo.', true);
  } finally {
    removeAvatarButton.disabled = false;
  }
});

document.getElementById('profile-sign-out').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) announce(error.message, true);
});

document.getElementById('profile-delete-account').addEventListener('click', async (event) => {
  if (!currentUser || event.currentTarget.disabled) return;
  const confirmation = prompt('This permanently deletes your account and associated data. Type DELETE to continue.');
  if (confirmation !== 'DELETE') return;

  const button = event.currentTarget;
  button.disabled = true;
  announce('Deleting account...');
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const response = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Account deletion failed.');
    await supabase.auth.signOut();
    location.replace('./index.html?account-deleted=1');
  } catch (error) {
    announce(error.message || 'Could not delete your account. Please try again.', true);
    button.disabled = false;
  }
});
