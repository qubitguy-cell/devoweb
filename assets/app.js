import { createShareControl } from './share.js';

const DATA_URL = './assets/database.json';
const VISITS_KEY = 'daily-bread.visits';
const PRAYERS_KEY = 'daily-bread.prayers';
const READ_KEY = 'daily-bread.read';

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

  const scripture = byId('scripture-text')?.closest('.scripture-line');
  const reference = byId('scripture-reference')?.textContent || '';
  if (scripture && !scripture.querySelector('.share-control')) {
    scripture.append(createShareControl({
      title: `${devotional.reference} | Daily Bread`,
      text: `${devotional.verse} ${devotional.reference}`,
      label: 'Share scripture'
    }));
  }

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
    article.append(heading, content, createShareControl({
      title: `${prayer.title} | Daily Bread`,
      text: prayer.content,
      label: 'Share prayer'
    }));
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
    const edit = document.createElement('button');
    edit.className = 'button-secondary archive-edit';
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.setAttribute('aria-label', 'Edit this prayer');
    edit.addEventListener('click', () => {
      const updatedText = window.prompt('Edit your private prayer:', entry.text);
      if (updatedText === null) return;
      const text = updatedText.trim();
      if (!text || text.length > 4000) return;
      const current = readStoredArray(PRAYERS_KEY);
      current[entries.indexOf(entry)] = { ...entry, text };
      localStorage.setItem(PRAYERS_KEY, JSON.stringify(current));
      renderArchive();
    });
    const remove = document.createElement('button');
    remove.className = 'button-secondary archive-delete';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', 'Delete this prayer');
    remove.addEventListener('click', () => {
      if (!window.confirm('Delete this prayer from this device?')) return;
      const current = readStoredArray(PRAYERS_KEY);
      current.splice(entries.indexOf(entry), 1);
      localStorage.setItem(PRAYERS_KEY, JSON.stringify(current));
      renderArchive();
    });
    item.append(prayer, date, createShareControl({
      title: 'A prayer from my Daily Bread journal',
      text: entry.text,
      label: 'Share this prayer'
    }), edit, remove);
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

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error('Content unavailable');
    const data = await response.json();

    if (page === 'home' && data.devotionals.length) renderHome(getTodaysDevotional(data.devotionals));
    if (page === 'prayer') renderPrayerWall(data.prayers);
  } catch {
    showLoadError();
  }
}

init();