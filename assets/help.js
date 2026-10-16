const form = document.getElementById('suggestion-form');
const status = document.getElementById('suggestion-status');
const submit = document.getElementById('suggestion-submit');

function announce(message, error = false) {
  status.textContent = message;
  status.classList.toggle('is-error', error);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  const values = Object.fromEntries(new FormData(form).entries());
  submit.disabled = true;
  announce('Sending your note privately to the admins...');

  try {
    const response = await fetch('/api/suggestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Your suggestion could not be sent. Please try again.');
    form.reset();
    announce('Thanks. Your suggestion was emailed privately to the admins.');
  } catch (error) {
    announce(error.message || 'Could not send your suggestion. Please try again later.', true);
  } finally {
    submit.disabled = false;
  }
});
