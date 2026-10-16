import { hasSupabaseConfig, supabase } from './supabase-client.js';

const status = document.getElementById('notification-status');
const list = document.getElementById('notification-list');

function announce(message, error = false) {
  status.textContent = message;
  status.classList.toggle('is-error', error);
}

function renderNotification(notification, request = null) {
  const article = document.createElement('article');
  article.className = 'notification-entry';
  const title = document.createElement('h2');
  title.textContent = notification.kind === 'counsel_request' ? 'Counseling request' : 'Notification';
  const message = document.createElement('p');
  message.textContent = notification.message;
  const date = document.createElement('time');
  date.dateTime = notification.created_at;
  date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(notification.created_at));
  article.append(title, message, date);

  if (request) {
    const subject = document.createElement('h3');
    subject.textContent = request.subject;
    const requestMessage = document.createElement('p');
    requestMessage.textContent = request.message;
    requestMessage.className = 'notification-request-message';
    article.append(subject, requestMessage);

    const deleteRequest = document.createElement('button');
    deleteRequest.className = 'button-secondary notification-delete-request';
    deleteRequest.type = 'button';
    deleteRequest.textContent = 'Delete counseling request';
    deleteRequest.addEventListener('click', async () => {
      if (!window.confirm('Permanently delete this private counseling request?')) return;
      deleteRequest.disabled = true;
      const { error } = await supabase.from('counsel_requests').delete().eq('id', request.id);
      if (error) {
        announce('Could not delete the counseling request. Try again.', true);
        deleteRequest.disabled = false;
        return;
      }
      article.remove();
      announce('Counseling request deleted.');
    });
    article.append(deleteRequest);
  }
  const remove = document.createElement('button');
  remove.className = 'button-secondary notification-delete';
  remove.type = 'button';
  remove.textContent = 'Delete';
  remove.setAttribute('aria-label', 'Delete this notification');
  remove.addEventListener('click', async () => {
    if (!window.confirm('Delete this notification?')) return;
    remove.disabled = true;
    const { error } = await supabase.from('notifications').delete().eq('id', notification.id);
    if (error) {
      announce('Could not delete the notification. Try again.', true);
      remove.disabled = false;
      return;
    }
    article.remove();
    announce('Notification deleted.');
  });
  article.append(remove);
  return article;
}

async function loadNotifications() {
  if (!hasSupabaseConfig || !supabase) {
    announce('Set up Supabase to use notifications.', true);
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace('./sign-in.html?next=notifications');
    return;
  }

  const { data, error } = await supabase.from('notifications')
    .select('id,kind,message,request_id,created_at,read_at')
    .eq('recipient_id', session.user.id)
    .order('created_at', { ascending: false });
  if (error) {
    announce('Could not load notifications. Apply the latest supabase-schema.sql and try again.', true);
    return;
  }

  const unreadIds = data.filter((notification) => !notification.read_at).map((notification) => notification.id);
  if (unreadIds.length) {
    const { error: updateError } = await supabase.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
      .eq('recipient_id', session.user.id);
    if (updateError) console.warn('Could not mark notifications read:', updateError);
  }

  const requestsById = new Map();
  const requestIds = [...new Set(data.map((notification) => notification.request_id).filter(Boolean))];
  if (requestIds.length) {
    const { data: requests, error: requestError } = await supabase.from('counsel_requests')
      .select('id,subject,message').in('id', requestIds);
    if (requestError) console.warn('Could not load linked private requests:', requestError);
    (requests || []).forEach((request) => requestsById.set(request.id, request));
  }

  list.replaceChildren(...data.map((notification) => renderNotification(
    notification,
    requestsById.get(notification.request_id)
  )));
  announce(data.length ? `${data.length} ${data.length === 1 ? 'notification' : 'notifications'}.` : 'You have no notifications.');
}

loadNotifications().catch((error) => {
  console.error('Could not load notifications:', error);
  announce('Could not load notifications. Check your connection and try again.', true);
});