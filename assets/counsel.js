import { hasSupabaseConfig, supabase } from './supabase-client.js';
import { createShareControl } from './share.js';

const status = document.getElementById('counsel-status');
const list = document.getElementById('scholar-list');
const select = document.getElementById('counsel-scholar');
const form = document.getElementById('counsel-form');
const formStatus = document.getElementById('counsel-form-status');
const sendButton = document.getElementById('counsel-send');
let currentUser = null;

function announce(target, message, error = false) {
  target.textContent = message;
  target.classList.toggle('is-error', error);
}

async function loadScholars() {
  if (!hasSupabaseConfig) {
    announce(status, 'Set up Supabase to browse and contact community guides.', true);
    form.hidden = true;
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace('./sign-in.html?next=counsel');
    return;
  }
  currentUser = session.user;

  const { data, error } = await supabase.from('scholar_profiles').select('user_id,display_name,bio').order('display_name');
  if (error) {
    announce(status, 'Could not load guides. Apply the latest supabase-schema.sql and try again.', true);
    return;
  }

  const scholars = data.filter((scholar) => scholar.user_id !== currentUser.id);
  if (!scholars.length) {
    announce(status, 'No guides are listed yet. Check back later.');
    list.innerHTML = '<p class="notification-empty">No community guides available.</p>';
    return;
  }

  announce(status, `${scholars.length} ${scholars.length === 1 ? 'guide' : 'guides'} available.`);
  list.replaceChildren();
  for (const scholar of scholars) {
    const article = document.createElement('article');
    article.className = 'scholar-entry';
    const heading = document.createElement('h2');
    heading.textContent = scholar.display_name;
    const bio = document.createElement('p');
    bio.textContent = scholar.bio || 'Bible study and pastoral guidance';
    const button = document.createElement('button');
    button.className = 'button-secondary';
    button.type = 'button';
    button.textContent = 'Choose guide';
    button.addEventListener('click', () => {
      select.value = scholar.user_id;
      document.getElementById('counsel-subject').focus();
    });
    const share = createShareControl({
      title: `${scholar.display_name} | Daily Bread Counsel & Advice`,
      text: bio.textContent,
      url: `${location.origin}${location.pathname}#counsel-request-title`,
      label: 'Share guide'
    });
    article.append(heading, bio, button, share);
    list.append(article);

    const option = document.createElement('option');
    option.value = scholar.user_id;
    option.textContent = scholar.display_name;
    select.append(option);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser || sendButton.disabled) return;

  const scholarId = select.value;
  const subject = document.getElementById('counsel-subject').value.trim();
  const message = document.getElementById('counsel-message').value.trim();
  if (!scholarId || !subject || !message) {
    announce(formStatus, 'Choose a guide and complete both message fields.', true);
    return;
  }

  sendButton.disabled = true;
  announce(formStatus, 'Sending private request...');
  try {
    const { data: request, error: requestError } = await supabase.from('counsel_requests').insert({
      requester_id: currentUser.id,
      scholar_id: scholarId,
      subject,
      message
    }).select('id').single();
    if (requestError) throw requestError;

    const { error: notificationError } = await supabase.from('notifications').insert({
      recipient_id: scholarId,
      sender_id: currentUser.id,
      request_id: request.id,
      kind: 'counsel_request',
      message: `${currentUser.user_metadata?.display_name || currentUser.email} requested guidance: ${subject}`.slice(0, 240)
    });
    if (notificationError) throw notificationError;

    form.reset();
    announce(formStatus, 'Request sent. The guide will see it in Notifications.');
  } catch (error) {
    console.error('Could not send counseling request:', error);
    announce(formStatus, 'Could not send the request. Confirm the latest Supabase schema is installed and try again.', true);
  } finally {
    sendButton.disabled = false;
  }
});

loadScholars().catch((error) => {
  console.error('Could not load counseling directory:', error);
  announce(status, 'Could not load guides. Check your connection and try again.', true);
});
