import { hasSupabaseConfig, supabase } from './supabase-client.js';

const status = document.getElementById('admin-status');
const editor = document.getElementById('admin-editor');
let accessToken = '';

function announce(message, error = false) {
  status.textContent = message;
  status.classList.toggle('is-error', error);
}

async function authorize() {
  if (!hasSupabaseConfig || !supabase) {
    announce('Account services are not configured.', true);
    return;
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    location.replace('./sign-in.html?next=admin');
    return;
  }

  accessToken = session.access_token;
  const response = await fetch('/api/content-admin', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.authorized) {
    announce(result.error || 'This account is not authorized to publish content.', true);
    return;
  }

  editor.hidden = false;
  announce('Authorized content editor. Published entries will be committed to the repository.');
}

async function appendContent(type, item) {
  const response = await fetch('/api/content-admin', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ type, item })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Content could not be published.');
  return result;
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

document.querySelector('#devotional-form [name="date"]').value = new Date().toISOString().slice(0, 10);

function makeId(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

document.getElementById('devotional-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = formValues(form);
  const item = { id: `${values.date}-${makeId(values.title)}`, ...values };
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  announce('Publishing devotional...');
  try {
    await appendContent('devotional', item);
    form.reset();
    announce('Devotional added to assets/database.json.');
  } catch (error) {
    announce(error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('prayer-form-admin').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const item = formValues(form);
  item.category = item.category.trim().toLowerCase();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  announce('Publishing prayer prompt...');
  try {
    await appendContent('prayer', item);
    form.reset();
    announce('Prayer prompt added to assets/database.json.');
  } catch (error) {
    announce(error.message, true);
  } finally {
    button.disabled = false;
  }
});

authorize().catch((error) => {
  console.error('Admin authorization check failed:', error);
  announce('Could not check editor access. Please try again.', true);
});
