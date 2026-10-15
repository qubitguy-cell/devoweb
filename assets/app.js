const DATA_URL = './assets/database.json';
const VISITS_KEY = 'daily-bread.visits';
const PRAYERS_KEY = 'daily-bread.prayers';
const READ_KEY = 'daily-bread.read';

const AI_API_CONFIG = {
  endpoint: '/api/gemini'
};

let companionHistory = [];

const byId = (id) => document.getElementById(id);

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function trackVisit() {
  const today = localDateKey();
  const visits = [...new Set([...readStoredArray(VISITS_KEY), today])].sort();
  localStorage.setItem(VISITS_KEY, JSON.stringify(visits));

  const visitSet = new Set(visits);
  let streak = 0;
  const cursor = new Date();
  while (visitSet.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const number = byId('streak-count');
  if (number) number.textContent = String(streak);
}

function getTodaysDevotional(devotionals) {
  const today = new Date();
  const todayKey = localDateKey(today);
  const exact = devotionals.find((item) => item.date === todayKey);
  if (exact) return exact;

  const dayOfYear = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(today.getFullYear(), 0, 0)) / 86400000);
  return devotionals[dayOfYear % devotionals.length];
}

function renderDate() {
  const target = byId('today-date');
  if (target) {
    target.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    }).format(new Date());
  }
}

function renderHome(devotional) {
  const bindings = {
    'hero-verse': devotional.verse,
    'hero-reference': devotional.reference,
    'devotional-tag': devotional.tag,
    'devotional-title': devotional.title,
    'scripture-text': devotional.verse,
    'scripture-reference': devotional.reference,
    'scripture-reading': devotional.scripture,
    'reflection-text': devotional.body,
    'thought-text': devotional.thought
  };

  Object.entries(bindings).forEach(([id, value]) => {
    const target = byId(id);
    if (target) target.textContent = value;
  });

  const readButton = byId('mark-read');
  if (!readButton) return;

  const readDates = readStoredArray(READ_KEY);
  const today = localDateKey();
  if (readDates.includes(today)) setReadState(readButton, true);

  readButton.addEventListener('click', () => {
    const current = readStoredArray(READ_KEY);
    if (!current.includes(today)) current.push(today);
    localStorage.setItem(READ_KEY, JSON.stringify(current));
    setReadState(readButton, true);
  });
}

function setReadState(button, isRead) {
  button.classList.toggle('is-done', isRead);
  button.innerHTML = isRead
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>Read for today</span>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>Mark as read</span>';
  button.setAttribute('aria-pressed', String(isRead));
  const note = byId('read-note');
  if (note) note.textContent = isRead ? 'A quiet moment, kept.' : '';
}

function renderPrayerWall(prayers) {
  const wall = byId('prayer-wall');
  if (!wall) return;

  wall.replaceChildren();
  prayers.forEach((prayer) => {
    const article = document.createElement('article');
    article.className = 'prayer-item';
    const heading = document.createElement('h2');
    heading.textContent = prayer.title;
    const category = document.createElement('span');
    category.className = 'prayer-category';
    category.textContent = prayer.category;
    heading.append(category);
    const content = document.createElement('p');
    content.textContent = prayer.content;
    article.append(heading, content);
    wall.append(article);
  });
}

function renderArchive() {
  const list = byId('archive-list');
  if (!list) return;

  const entries = readStoredArray(PRAYERS_KEY);
  const count = byId('archive-count');
  if (count) count.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
  list.replaceChildren();

  if (entries.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'archive-empty';
    empty.textContent = 'Released prayers will be kept here on this device.';
    list.append(empty);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'archive-entry';
    const prayer = document.createElement('p');
    prayer.textContent = entry.text;
    const date = document.createElement('time');
    date.dateTime = entry.createdAt;
    date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(entry.createdAt));
    item.append(prayer, date);
    list.append(item);
  });
}

function setupPrayerRoom() {
  const breathing = byId('breathing-guide');
  if (breathing) {
    breathing.addEventListener('click', () => {
      const active = breathing.classList.toggle('is-breathing');
      breathing.setAttribute('aria-pressed', String(active));
      const label = byId('breathing-label');
      if (label) label.textContent = active ? 'Breathe in · Breathe out' : 'Begin a breathing rhythm';
    });
  }

  const form = byId('prayer-form');
  if (!form) return;

  const textarea = byId('journal-input');
  const sendButton = byId('release-prayer');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = textarea.value.trim();
    if (!text) {
      byId('journal-message').textContent = 'Write a few words first, if you’re ready.';
      textarea.focus();
      return;
    }

    const archive = readStoredArray(PRAYERS_KEY);
    archive.unshift({ text, createdAt: new Date().toISOString() });
    localStorage.setItem(PRAYERS_KEY, JSON.stringify(archive));
    sendButton.disabled = true;
    textarea.classList.add('is-releasing');

    window.setTimeout(() => {
      textarea.value = '';
      textarea.classList.remove('is-releasing');
      sendButton.disabled = false;
      byId('journal-message').textContent = 'Amen. Your prayer is held in your local archive.';
      renderArchive();
    }, 560);
  });
}

function appendMessage(role, text, suggestedVerse = '') {
  const messages = byId('chat-messages');
  if (!messages) return;

  const bubble = document.createElement('article');
  bubble.className = `message ${role}`;
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  bubble.append(paragraph);
  if (suggestedVerse) {
    const verse = document.createElement('p');
    verse.className = 'suggested-verse';
    verse.textContent = suggestedVerse;
    bubble.append(verse);
  }
  messages.append(bubble);
  messages.scrollTop = messages.scrollHeight;
}

async function getCompanionReply(message) {
  let result;
  try {
    result = await fetch(AI_API_CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: companionHistory })
    });
  } catch {
    throw new Error('Could not reach the AI endpoint. Run this site with `vercel dev` or deploy it to Vercel.');
  }
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    throw new Error(data.error || `AI request failed (${result.status}). Check the API route and GEMINI_API_KEY configuration.`);
  }
  if (typeof data.response_text !== 'string' || !data.response_text.trim()) {
    throw new Error('Gemini returned an empty reply. Please try again.');
  }

  const reply = { response_text: data.response_text, suggested_verses: data.suggested_verses || [] };
  companionHistory = [
    ...companionHistory,
    { role: 'user', text: message },
    { role: 'model', text: reply.response_text }
  ].slice(-8);
  return reply;
}

function setupChat() {
  const form = byId('chat-form');
  if (!form) return;
  const input = byId('chat-input');
  const send = byId('send-message');

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || send.disabled) return;

    appendMessage('user', message);
    input.value = '';
    send.disabled = true;
    try {
      const reply = await getCompanionReply(message);
      appendMessage('assistant', reply.response_text, (reply.suggested_verses || []).join('  ·  '));
    } catch (error) {
      appendMessage('assistant', error instanceof Error ? error.message : 'The AI companion could not respond. Check the API configuration and try again.');
    } finally {
      send.disabled = false;
      input.focus();
    }
  });
}

function showLoadError() {
  const target = byId('data-error');
  if (target) target.hidden = false;
}

async function init() {
  trackVisit();
  renderDate();
  renderArchive();
  setupPrayerRoom();

  const page = document.body.dataset.page;
  if (page === 'chat') setupChat();

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error('Content unavailable');
    const data = await response.json();

    if (page === 'home' && data.devotionals.length) renderHome(getTodaysDevotional(data.devotionals));
    if (page === 'prayer') renderPrayerWall(data.prayers);
  } catch {
    showLoadError();
    if (document.body.dataset.page === 'chat') {
      appendMessage('assistant', 'I could not load the companion just now. Please refresh this page to try again.');
    }
  }
}

init();