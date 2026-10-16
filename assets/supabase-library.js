import { createShareControl } from './share.js';

const status = document.getElementById('library-status');
const form = document.getElementById('pdf-upload-form');
const list = document.getElementById('journal-list');
const search = document.getElementById('journal-search');
let documents = [];
let currentUser = null;
let supabase = null;

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('is-error', error);
}

function showListMessage(message) {
  const empty = document.createElement('p');
  empty.className = 'library-empty';
  empty.textContent = message;
  list.replaceChildren(empty);
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
    const share = createShareControl({
      title: `${document.title} | Daily Bread Journal Library`,
      text: document.description || `A journal shared by ${document.author_name}.`,
      url: data.publicUrl,
      label: 'Share journal'
    });
    actions.append(view, download, share);
    if (currentUser?.id === document.user_id) {
      const edit = document.createElement('button');
      edit.className = 'button-secondary';
      edit.type = 'button';
      edit.textContent = 'Edit details';
      edit.setAttribute('aria-label', `Edit ${document.title} details`);
      edit.addEventListener('click', async () => {
        const title = window.prompt('Journal title:', document.title);
        if (title === null) return;
        const description = window.prompt('Journal description:', document.description || '');
        if (description === null) return;
        const cleanTitle = title.trim();
        const cleanDescription = description.trim();
        if (!cleanTitle || cleanTitle.length > 100 || cleanDescription.length > 300) {
          setStatus('Use a title of 1 to 100 characters and a description up to 300 characters.', true);
          return;
        }
        edit.disabled = true;
        try {
          const { error } = await supabase.from('journals').update({
            title: cleanTitle,
            description: cleanDescription,
            author_name: currentUser.user_metadata?.display_name || 'Community member'
          }).eq('id', document.id).eq('user_id', currentUser.id);
          if (error) throw error;
          await loadDocuments();
          setStatus('Journal details updated.');
        } catch (error) {
          console.error('Could not update journal details:', error);
          setStatus(error.message || 'Could not update this journal.', true);
          edit.disabled = false;
        }
      });
      const remove = document.createElement('button');
      remove.className = 'button-secondary';
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete ${document.title}`);
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Delete "${document.title}" from the journal library?`)) return;
        remove.disabled = true;
        try {
          const { error: rowError } = await supabase.from('journals').delete()
            .eq('id', document.id).eq('user_id', currentUser.id);
          if (rowError) throw rowError;
          const { error: fileError } = await supabase.storage.from('journals').remove([document.storage_path]);
          if (fileError) console.error('Journal record deleted but its PDF could not be removed:', fileError);
          await loadDocuments();
          setStatus(fileError ? 'Journal removed; its PDF could not be removed from storage.' : 'Journal deleted.');
        } catch (error) {
          console.error('Could not delete journal:', error);
          setStatus(error.message || 'Could not delete this journal.', true);
          remove.disabled = false;
        }
      });
      actions.append(edit, remove);
    }
    article.append(details, actions);
    list.append(article);
  });
}

async function loadDocuments() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const { data, error } = await supabase
      .from('journals')
      .select('id,user_id,title,description,author_name,file_name,storage_path,file_size,created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .abortSignal(controller.signal);

    if (error) throw error;

    documents = data || [];
    renderDocuments();
    setStatus(`${documents.length} ${documents.length === 1 ? 'journal' : 'journals'} shared`);
  } catch (error) {
    console.error('Journal list unavailable:', error);
    const detail = error.name === 'AbortError'
      ? 'The request timed out. Check your connection and Supabase project status.'
      : error.message || 'Check that supabase-schema.sql has been run and the journals table is available.';
    setStatus(`Could not load the journal library. ${detail}`, true);
    showListMessage('Journal entries could not be loaded.');
  } finally {
    clearTimeout(timeout);
  }
}

async function initializeLibrary() {
  try {
    const clientModule = await import('./supabase-client.js');
    if (!clientModule.hasSupabaseConfig) {
      setStatus('Add your Supabase project URL and publishable key in assets/supabase-config.js to enable the library.', true);
      showListMessage('The journal library is not configured yet.');
      form.hidden = true;
      return;
    }

    supabase = clientModule.supabase;
  function updateUserControls(user) {
    currentUser = user || null;
    form.hidden = !currentUser;
    document.getElementById('upload-sign-in-note').hidden = Boolean(currentUser);
    document.getElementById('library-account-link').textContent = currentUser ? 'Your account' : 'Sign in to upload';
    document.getElementById('library-account-link').href = currentUser ? './account.html' : './sign-in.html';
  }

  updateUserControls(null);
  void loadDocuments();

  supabase.auth.onAuthStateChange((_event, session) => {
    updateUserControls(session?.user);
  });

  supabase.auth.getSession()
    .then(({ data }) => updateUserControls(data.session?.user))
    .catch((error) => console.error('Could not read the current sign-in state:', error));
  } catch (error) {
    console.error('Journal library initialization failed:', error);
    setStatus('Could not initialize the journal library. Check your connection and Supabase configuration.', true);
    showListMessage('The journal library could not be initialized.');
    form.hidden = true;
  }
}

void initializeLibrary();

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
  if (!file || (file.type && file.type !== 'application/pdf') || !file.name.toLowerCase().endsWith('.pdf')) {
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

  let uploaded = false;
  try {
    const { error: uploadError } = await supabase.storage.from('journals').upload(storagePath, file, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: false
    });

    if (uploadError) throw uploadError;
    uploaded = true;

    const { error: insertError } = await supabase.from('journals').insert({
      user_id: currentUser.id,
      title,
      description,
      author_name: authorName,
      file_name: fileName,
      storage_path: storagePath,
      file_size: file.size
    });

    if (insertError) throw insertError;
    uploaded = false;
    form.reset();
    setStatus('Journal shared with the library.');
    await loadDocuments();
  } catch (error) {
    console.error('Journal upload failed:', error);
    if (uploaded) {
      try {
        await supabase.storage.from('journals').remove([storagePath]);
      } catch (cleanupError) {
        console.error('Could not remove incomplete journal upload:', cleanupError);
      }
    }
    setStatus(error.message || 'Upload failed. Check your Supabase Storage bucket and policies.', true);
  } finally {
    submit.disabled = false;
  }
});