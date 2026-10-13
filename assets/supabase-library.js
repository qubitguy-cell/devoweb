import { hasSupabaseConfig, supabase } from './supabase-client.js';

const status = document.getElementById('library-status');
const form = document.getElementById('pdf-upload-form');
const list = document.getElementById('journal-list');
const search = document.getElementById('journal-search');
let documents = [];
let currentUser = null;

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('is-error', error);
}

function renderDocuments() {
  const filter = search.value.trim().toLowerCase();
  list.replaceChildren();
  const matches = documents.filter((document) =>
    `${document.title} ${document.author_name} ${document.description}`.toLowerCase().includes(filter)
  );

  if (matches.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'library-empty';
    empty.textContent = filter ? 'No journals match that search.' : 'No journals have been shared yet.';
    list.append(empty);
    return;
  }

  matches.forEach((document) => {
    const article = document.createElement('article');
    article.className = 'journal-card';
    const details = document.createElement('div');
    details.className = 'journal-details';
    const title = document.createElement('h2');
    title.textContent = document.title;
    const description = document.createElement('p');
    description.textContent = document.description || 'Shared devotional reading.';
    const meta = document.createElement('p');
    meta.className = 'journal-meta';
    meta.textContent = `${document.author_name} · ${document.file_name}`;
    details.append(title, description, meta);

    const { data } = supabase.storage.from('journals').getPublicUrl(document.storage_path);
    const { data: downloadData } = supabase.storage.from('journals').getPublicUrl(document.storage_path, {
      download: document.file_name
    });
    const actions = document.createElement('div');
    actions.className = 'journal-actions';
    const view = document.createElement('a');
    view.className = 'button-secondary';
    view.href = data.publicUrl;
    view.target = '_blank';
    view.rel = 'noopener noreferrer';
    view.textContent = 'View PDF';
    view.setAttribute('aria-label', `View ${document.title} PDF`);
    const download = document.createElement('a');
    download.className = 'button-primary';
    download.href = downloadData.publicUrl;
    download.download = document.file_name;
    download.textContent = 'Download';
    download.setAttribute('aria-label', `Download ${document.title} PDF`);
    actions.append(view, download);
    article.append(details, actions);
    list.append(article);
  });
}

async function loadDocuments() {
  const { data, error } = await supabase
    .from('journals')
    .select('id,title,description,author_name,file_name,storage_path,file_size,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Journal list unavailable:', error);
    setStatus('Could not load the journal library. Run supabase-schema.sql and check the RLS policies.', true);
    return;
  }

  documents = data;
  renderDocuments();
  setStatus(`${documents.length} ${documents.length === 1 ? 'journal' : 'journals'} shared`);
}

if (!hasSupabaseConfig) {
  setStatus('Add your Supabase project URL and publishable key in assets/supabase-config.js to enable the library.', true);
  form.hidden = true;
} else {
  const { data, error } = await supabase.auth.getSession();
  if (error) setStatus(error.message, true);
  currentUser = data.session?.user || null;
  form.hidden = !currentUser;
  document.getElementById('upload-sign-in-note').hidden = Boolean(currentUser);
  document.getElementById('library-account-link').textContent = currentUser ? 'Signed in' : 'Sign in to upload';
  if (currentUser) document.getElementById('library-account-link').removeAttribute('href');

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    form.hidden = !currentUser;
    document.getElementById('upload-sign-in-note').hidden = Boolean(currentUser);
    document.getElementById('library-account-link').textContent = currentUser ? 'Signed in' : 'Sign in to upload';
    if (!currentUser) document.getElementById('library-account-link').href = './sign-in.html';
    else document.getElementById('library-account-link').removeAttribute('href');
  });

  await loadDocuments();
}

search.addEventListener('input', renderDocuments);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) {
    setStatus('Sign in before uploading a journal.', true);
    return;
  }

  const file = document.getElementById('pdf-file').files[0];
  const title = document.getElementById('pdf-title').value.trim();
  const description = document.getElementById('pdf-description').value.trim();
  if (!file || file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
    setStatus('Choose a PDF file to upload.', true);
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    setStatus('PDFs must be 15 MB or smaller.', true);
    return;
  }
  if (!title || title.length > 100 || description.length > 300) {
    setStatus('Enter a title (up to 100 characters) and description (up to 300 characters).', true);
    return;
  }

  const submit = document.getElementById('pdf-submit');
  submit.disabled = true;
  setStatus('Uploading PDF...');
  const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120);
  const storagePath = `${currentUser.id}/${crypto.randomUUID()}.pdf`;
  const authorName = currentUser.user_metadata?.display_name || 'Community member';

  const { error: uploadError } = await supabase.storage.from('journals').upload(storagePath, file, {
    contentType: 'application/pdf',
    cacheControl: '3600',
    upsert: false
  });

  if (uploadError) {
    console.error('Journal upload failed:', uploadError);
    setStatus('Upload failed. Check the Storage bucket and policies, then try again.', true);
    submit.disabled = false;
    return;
  }

  const { error: insertError } = await supabase.from('journals').insert({
    user_id: currentUser.id,
    title,
    description,
    author_name: authorName,
    file_name: fileName,
    storage_path: storagePath,
    file_size: file.size
  });

  if (insertError) {
    console.error('Journal metadata could not be saved:', insertError);
    setStatus('PDF uploaded but could not be added to the library. Check the journals table policy.', true);
  } else {
    form.reset();
    setStatus('Journal shared with the library.');
    await loadDocuments();
  }
  submit.disabled = false;
});