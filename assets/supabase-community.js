import { hasSupabaseConfig, supabase } from './supabase-client.js';

const status = document.getElementById('community-status');
const form = document.getElementById('community-form');
const input = document.getElementById('community-input');
const send = document.getElementById('community-send');
const list = document.getElementById('community-messages');
const renderedIds = new Set();
let currentUser = null;
let messageChannel = null;

function announce(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function appendMessage(message) {
  if (renderedIds.has(message.id)) return;
  renderedIds.add(message.id);

  const item = document.createElement('article');
  item.className = `community-message${message.user_id === currentUser?.id ? ' is-mine' : ''}`;
  const author = document.createElement('strong');
  author.className = 'community-author';
  author.textContent = message.display_name || 'Community member';
  const body = document.createElement('p');
  body.textContent = message.text;
  const time = document.createElement('time');
  const date = new Date(message.created_at);
  time.dateTime = date.toISOString();
  time.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  item.append(author, body, time);
  list.append(item);
  list.scrollTop = list.scrollHeight;
}

async function connectToRoom(user) {
  currentUser = user;
  document.getElementById('community-user').textContent = user.user_metadata?.display_name || 'Friend';
  renderedIds.clear();
  list.replaceChildren();

  messageChannel = supabase.channel('community-messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'community_messages'
    }, (payload) => appendMessage(payload.new))
    .subscribe((channelStatus) => {
      if (channelStatus === 'SUBSCRIBED') announce('You are in the room.');
      if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
        announce('Live updates are unavailable. Check that community_messages is enabled in Supabase Realtime.', true);
      }
    });

  const { data, error } = await supabase
    .from('community_messages')
    .select('id,user_id,display_name,text,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Community messages unavailable:', error);
    announce('Could not load messages. Run supabase-schema.sql and check your RLS policies.', true);
    return;
  }

  data.reverse().forEach(appendMessage);
  if (data.length === 0) announce('Start a kind conversation.');
}

if (!hasSupabaseConfig) {
  announce('Add your Supabase project URL and publishable key in assets/supabase-config.js to enable community chat.', true);
  form.hidden = true;
  document.getElementById('community-sign-out').hidden = true;
} else {
  const { data, error } = await supabase.auth.getSession();
  if (error) announce(error.message, true);
  if (!data.session) {
    location.replace('./sign-in.html?next=community');
  } else {
    await connectToRoom(data.session.user);
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      if (messageChannel) supabase.removeChannel(messageChannel);
      location.replace('./sign-in.html?next=community');
    }
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!currentUser || !text || text.length > 1000 || send.disabled) return;

  send.disabled = true;
  const { error } = await supabase.from('community_messages').insert({
    user_id: currentUser.id,
    display_name: currentUser.user_metadata?.display_name || 'Community member',
    text
  });

  if (error) {
    console.error('Could not send community message:', error);
    announce('Your message could not be sent. Check your connection and Supabase policies.', true);
  } else {
    input.value = '';
    announce('Message sent.');
  }
  send.disabled = false;
  input.focus();
});

document.getElementById('community-sign-out').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) announce(error.message, true);
});