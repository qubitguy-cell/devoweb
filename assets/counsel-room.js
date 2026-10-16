import { hasSupabaseConfig, supabase } from './supabase-client.js';

const status = document.getElementById('room-status');
const thread = document.getElementById('counsel-thread');
const form = document.getElementById('counsel-reply-form');
const replyInput = document.getElementById('room-reply');
const sendButton = document.getElementById('room-send');
const requestId = new URLSearchParams(location.search).get('request');
const renderedIds = new Set();
let currentUser = null;
let request = null;
let channel = null;

function announce(message, error = false) {
  status.textContent = message;
  status.classList.toggle('is-error', error);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function appendMessage(message) {
  if (!message?.id || renderedIds.has(message.id)) return;
  renderedIds.add(message.id);
  const article = document.createElement('article');
  article.className = `counsel-message${message.sender_id === currentUser.id ? ' is-mine' : ''}`;
  const role = document.createElement('span');
  role.className = 'counsel-message-role';
  role.textContent = message.sender_id === request.requester_id ? 'Person seeking guidance' : 'Guide';
  const content = document.createElement('p');
  content.textContent = message.message;
  const time = document.createElement('time');
  time.dateTime = message.created_at;
  time.textContent = formatDate(message.created_at);
  article.append(role, content, time);
  thread.append(article);
  thread.scrollTop = thread.scrollHeight;
}

async function initialize() {
  if (!hasSupabaseConfig || !supabase) {
    announce('Supabase is not configured for private counseling.', true);
    form.hidden = true;
    return;
  }
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    announce('This conversation link is not valid. Open a conversation from Counsel & advice or Notifications.', true);
    form.hidden = true;
    return;
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) {
    location.replace(`./sign-in.html?next=counsel-room&request=${encodeURIComponent(requestId)}`);
    return;
  }
  currentUser = session.user;

  const { data: requestData, error: requestError } = await supabase.from('counsel_requests')
    .select('id,requester_id,scholar_id,subject,message,created_at')
    .eq('id', requestId)
    .single();
  if (requestError || !requestData) {
    announce('This request is unavailable, or you are not one of its participants.', true);
    form.hidden = true;
    return;
  }
  request = requestData;
  const { error: readError } = await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', currentUser.id)
    .eq('request_id', request.id)
    .is('read_at', null);
  if (readError) console.warn('Could not mark this conversation notification read:', readError);
  document.getElementById('room-subject').textContent = request.subject;
  document.getElementById('room-participant').textContent = currentUser.id === request.requester_id
    ? 'You asked a community guide for support. Replies stay in this private room.'
    : 'You are the selected guide. Reply here to continue this private conversation.';
  document.getElementById('room-original-message').textContent = request.message;
  const requestDate = document.getElementById('room-request-date');
  requestDate.dateTime = request.created_at;
  requestDate.textContent = `Request sent ${formatDate(request.created_at)}`;

  const { data: messages, error: messagesError } = await supabase.from('counsel_messages')
    .select('id,request_id,sender_id,message,created_at')
    .eq('request_id', request.id)
    .order('created_at', { ascending: true });
  if (messagesError) throw messagesError;
  (messages || []).forEach(appendMessage);
  announce(messages?.length ? 'Private conversation' : 'This is the start of the conversation.');

  channel = supabase.channel(`counsel-thread:${request.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'counsel_messages',
      filter: `request_id=eq.${request.id}`
    }, (payload) => appendMessage(payload.new))
    .subscribe((state) => {
      if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
        announce('Live updates are unavailable. Refresh the room to see new replies.', true);
      }
    });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = replyInput.value.trim();
  if (!request || !currentUser || sendButton.disabled || !message) return;
  if (message.length > 4000) {
    announce('Replies must be 4000 characters or fewer.', true);
    return;
  }
  sendButton.disabled = true;
  announce('Sending private reply...');
  try {
    const { data, error } = await supabase.from('counsel_messages').insert({
      request_id: request.id,
      sender_id: currentUser.id,
      message
    }).select('id,request_id,sender_id,message,created_at').single();
    if (error) throw error;
    appendMessage(data);
    replyInput.value = '';

    const recipientId = currentUser.id === request.requester_id ? request.scholar_id : request.requester_id;
    const senderName = currentUser.user_metadata?.display_name || 'Your conversation partner';
    const { error: notificationError } = await supabase.from('notifications').insert({
      recipient_id: recipientId,
      sender_id: currentUser.id,
      request_id: request.id,
      kind: 'counsel_reply',
      message: `${senderName} replied to your counseling request: ${request.subject}`.slice(0, 240)
    });
    announce(notificationError ? 'Reply sent. The notification could not be delivered; the recipient can still find this room in Counsel & advice.' : 'Your private reply was sent.');
  } catch (error) {
    console.error('Could not send counseling reply:', error);
    announce('Could not send your reply. Confirm the latest Supabase schema has been applied and try again.', true);
  } finally {
    sendButton.disabled = false;
    replyInput.focus();
  }
});

window.addEventListener('pagehide', () => {
  if (channel) supabase.removeChannel(channel);
});

initialize().catch((error) => {
  console.error('Could not open counseling room:', error);
  announce('Could not open this conversation. Check your connection and updated Supabase schema.', true);
  form.hidden = true;
});
