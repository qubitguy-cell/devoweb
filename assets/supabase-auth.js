import { hasSupabaseConfig, supabase } from './supabase-client.js';

const form = document.getElementById('auth-form');
const status = document.getElementById('auth-status');
const submit = document.getElementById('auth-submit');
const nameField = document.getElementById('display-name-field');
const nameInput = document.getElementById('display-name');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const passwordToggle = document.getElementById('password-toggle');
const modeInputs = [...document.querySelectorAll('input[name="auth-mode"]')];
let mode = 'signin';

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function updateMode() {
  mode = modeInputs.find((input) => input.checked)?.value || 'signin';
  const signup = mode === 'signup';
  nameField.hidden = !signup;
  nameInput.required = signup;
  passwordInput.autocomplete = signup ? 'new-password' : 'current-password';
  submit.textContent = signup ? 'Create account' : 'Sign in';
  document.getElementById('auth-title').textContent = signup ? 'Make a little space.' : 'Welcome back.';
  setStatus('');
}

function displaySignedIn(user) {
  document.getElementById('auth-panel').hidden = true;
  document.getElementById('signed-in-state').hidden = false;
  document.getElementById('signed-in-email').textContent = user.email || '';
}

function readableError(error) {
  const messages = {
    'Invalid login credentials': 'That email and password combination was not recognized.',
    'User already registered': 'An account already uses that email address.',
    'Password should be at least 6 characters': 'Choose a password with at least 6 characters.',
    'Email not confirmed': 'Confirm your email address using the link we sent, then sign in.'
  };
  return messages[error.message] || error.message || 'The request failed. Check your Supabase settings and try again.';
}

function nextDestination() {
  const params = new URLSearchParams(location.search);
  const next = params.get('next');
  if (next === 'community') return './community.html';
  if (next === 'account') return './account.html';
  if (next === 'counsel') return './counsel.html';
  if (next === 'admin') return './admin.html';
  if (next === 'counsel-room') {
    const requestId = params.get('request');
    if (requestId && /^[0-9a-f-]{36}$/i.test(requestId)) {
      return `./counsel-room.html?request=${encodeURIComponent(requestId)}`;
    }
  }
  return null;
}

if (!form) throw new Error('Authentication form is missing.');

if (!hasSupabaseConfig) {
  setStatus('Add your Supabase project URL and publishable key in assets/supabase-config.js to enable accounts.', true);
  submit.disabled = true;
  document.getElementById('forgot-password').disabled = true;
} else {
  const { data, error } = await supabase.auth.getSession();
  if (error) setStatus(error.message, true);
  if (data.session?.user) {
    const destination = nextDestination();
    if (destination) location.replace(destination);
    else displaySignedIn(data.session.user);
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      document.getElementById('signed-in-state').hidden = true;
      document.getElementById('auth-panel').hidden = false;
    }
    if (session?.user && event === 'SIGNED_IN') {
      const destination = nextDestination();
      if (destination) location.replace(destination);
      else displaySignedIn(session.user);
    }
  });
}

modeInputs.forEach((input) => input.addEventListener('change', updateMode));
updateMode();

passwordToggle.addEventListener('click', () => {
  const isVisible = passwordInput.type === 'text';
  passwordInput.type = isVisible ? 'password' : 'text';
  passwordToggle.setAttribute('aria-pressed', String(!isVisible));
  passwordToggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
  passwordToggle.title = isVisible ? 'Show password' : 'Hide password';
  passwordToggle.innerHTML = `<i class="bi ${isVisible ? 'bi-eye' : 'bi-eye-slash'}" aria-hidden="true"></i>`;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!hasSupabaseConfig) return;
  submit.disabled = true;
  setStatus(mode === 'signup' ? 'Creating your account...' : 'Signing in...');

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const result = mode === 'signup'
    ? await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: nameInput.value.trim() } }
      })
    : await supabase.auth.signInWithPassword({ email, password });

  if (result.error) {
    setStatus(readableError(result.error), true);
    submit.disabled = false;
    return;
  }

  if (mode === 'signup' && !result.data.session) {
    setStatus('Check your email for a confirmation link, then return here to sign in.');
    submit.disabled = false;
    return;
  }

  if (mode === 'signin') {
    location.replace(nextDestination() || './index.html');
    return;
  }

  displaySignedIn(result.data.user);
  setStatus('Your account is ready.');
  submit.disabled = false;
});

document.getElementById('forgot-password').addEventListener('click', async () => {
  if (!hasSupabaseConfig) return;
  const email = emailInput.value.trim();
  if (!email) {
    setStatus('Enter your email address first, then request a reset link.', true);
    emailInput.focus();
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/sign-in.html`
  });
  setStatus(error ? readableError(error) : 'Password reset instructions have been sent.', Boolean(error));
});

document.getElementById('sign-out').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) setStatus(readableError(error), true);
});