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
  body.className = 'community-body';
  body.textContent = message.text;
  const time = document.createElement('time');
  const date = new Date(message.created_at);
  time.dateTime = date.toISOString();
  time.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  item.append(author, body, time);
  item.dataset.messageId = String(message.id);
  if (message.user_id === currentUser?.id) {
    const edit = document.createElement('button');
    edit.className = 'text-button community-edit';
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.setAttribute('aria-label', 'Edit your message');
    edit.addEventListener('click', async () => {
      const updatedText = window.prompt('Edit your community message:', body.textContent);
      if (updatedText === null) return;
      const text = updatedText.trim();
      if (!text || text.length > 1000) {
        announce('Messages must contain between 1 and 1000 characters.', true);
        return;
      }
      edit.disabled = true;
      const { error } = await supabase.from('community_messages').update({ text })
        .eq('id', message.id).eq('user_id', currentUser.id);
      if (error) {
        announce('Could not edit your message. Check your connection and try again.', true);
        edit.disabled = false;
        return;
      }
      body.textContent = text;
      announce('Message updated.');
      edit.disabled = false;
    });
    const remove = document.createElement('button');
    remove.className = 'text-button community-delete';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', 'Delete your message');
    remove.addEventListener('click', async () => {
      if (!window.confirm('Delete this community message?')) return;
      remove.disabled = true;
      const { error } = await supabase.from('community_messages')
        .delete().eq('id', message.id).eq('user_id', currentUser.id);
      if (error) {
        announce('Could not delete your message. Check your connection and try again.', true);
        remove.disabled = false;
        return;
      }
      item.remove();
      renderedIds.delete(message.id);
      announce('Message deleted.');
    });
    item.append(edit, remove);
  }
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
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'community_messages'
    }, (payload) => {
      const id = payload.old.id;
      if (id === undefined) return;
      list.querySelector(`[data-message-id="${CSS.escape(String(id))}"]`)?.remove();
      renderedIds.delete(id);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'community_messages'
    }, (payload) => {
      const item = list.querySelector(`[data-message-id="${CSS.escape(String(payload.new.id))}"]`);
      const body = item?.querySelector('.community-body');
      if (body) body.textContent = payload.new.text;
    })
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

input.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  form.requestSubmit();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!currentUser || !text || text.length > 1000 || send.disabled) return;

  send.disabled = true;
  try {
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
  } catch (error) {
    console.error('Could not send community message:', error);
    announce('Your message could not be sent. Check your connection and try again.', true);
  } finally {
    send.disabled = false;
    input.focus();
  }
});

document.getElementById('community-sign-out').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) announce(error.message, true);
});