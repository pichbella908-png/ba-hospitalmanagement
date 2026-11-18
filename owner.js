const API_BASE = (window.API_BASE || '').replace(/\/+$/, '');
const TOKEN_KEY = 'systemOwnerToken';
let ownerToken = sessionStorage.getItem(TOKEN_KEY) || '';
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function setMessage(element, message, kind = '') {
  element.textContent = message;
  element.className = `message${kind ? ` ${kind}` : ''}`;
}

function showConsole(visible) {
  $('#owner-login').hidden = visible;
  $('#owner-console').hidden = !visible;
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE}/api/system-owner${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(ownerToken ? { Authorization: `Bearer ${ownerToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return result;
}

function signOut() {
  ownerToken = '';
  sessionStorage.removeItem(TOKEN_KEY);
  showConsole(false);
  $('#login-form').reset();
  setMessage($('#login-message'), '');
}

async function loadClinics() {
  const list = $('#clinic-list');
  setMessage($('#clinic-message'), '');
  list.innerHTML = '<tr><td class="empty" colspan="4">Loading clinics…</td></tr>';
  try {
    const clinics = await request('/clinics');
    list.innerHTML = clinics.length ? clinics.map((clinic) => {
      const created = clinic.created_at ? new Date(clinic.created_at).toLocaleString() : '—';
      return `<tr>
        <td><b>${escapeHtml(clinic.clinic_name)}</b></td>
        <td>${escapeHtml(clinic.database_name)}</td>
        <td>${escapeHtml(created)}</td>
        <td><div class="actions">
          <button type="button" class="secondary" data-test="${Number(clinic.id)}">Test connection</button>
          <button type="button" class="danger" data-delete="${Number(clinic.id)}">Delete</button>
        </div></td>
      </tr>`;
    }).join('') : '<tr><td class="empty" colspan="4">No clinic databases registered.</td></tr>';
  } catch (error) {
    if (error.status === 401) {
      signOut();
      setMessage($('#login-message'), 'System owner session expired. Please sign in again.', 'error');
      return;
    }
    list.innerHTML = '<tr><td class="empty" colspan="4">Could not load clinic databases.</td></tr>';
    setMessage($('#clinic-message'), error.message, 'error');
  }
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage($('#login-message'), '');
  try {
    const result = await request('/login', {
      method: 'POST',
      body: { email: $('#owner-email').value, password: $('#owner-password').value },
    });
    ownerToken = result.token;
    sessionStorage.setItem(TOKEN_KEY, ownerToken);
    $('#owner-password').value = '';
    showConsole(true);
    await loadClinics();
  } catch (error) {
    setMessage($('#login-message'), error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

$('#clinic-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(form));
  button.disabled = true;
  setMessage($('#create-message'), '');
  try {
    await request('/clinics', { method: 'POST', body: values });
    form.reset();
    setMessage($('#create-message'), 'Clinic database and administrator created.', 'success');
    await loadClinics();
  } catch (error) {
    setMessage($('#create-message'), error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

$('#refresh-clinics').addEventListener('click', loadClinics);
$('#owner-logout').addEventListener('click', signOut);
$('#clinic-list').addEventListener('click', async (event) => {
  const testButton = event.target.closest('[data-test]');
  if (testButton) {
    testButton.disabled = true;
    setMessage($('#clinic-message'), '');
    try {
      const result = await request(`/clinics/${testButton.dataset.test}/test`, { method: 'POST' });
      setMessage($('#clinic-message'), `Connection successful: ${result.clinic_name}`, 'success');
    } catch (error) {
      setMessage($('#clinic-message'), error.message, 'error');
    } finally {
      testButton.disabled = false;
    }
    return;
  }
  const deleteButton = event.target.closest('[data-delete]');
  if (!deleteButton) return;
  const clinic = deleteButton.closest('tr');
  const clinicName = clinic.querySelector('td b').textContent;
  const typedName = window.prompt(`Type the exact clinic name to permanently delete its database:\n${clinicName}`);
  if (typedName === null) return;
  if (typedName !== clinicName) {
    setMessage($('#clinic-message'), 'The clinic name did not match. Nothing was deleted.', 'error');
    return;
  }
  if (!window.confirm(`Permanently delete "${clinicName}" and all data in its clinic database? This cannot be undone.`)) return;
  deleteButton.disabled = true;
  setMessage($('#clinic-message'), '');
  try {
    await request(`/clinics/${deleteButton.dataset.delete}`, {
      method: 'DELETE',
      body: { confirm_name: typedName, confirm: true },
    });
    await loadClinics();
    setMessage($('#clinic-message'), `Deleted clinic database for ${clinicName}.`, 'success');
  } catch (error) {
    setMessage($('#clinic-message'), error.message, 'error');
  } finally {
    deleteButton.disabled = false;
  }
});

if (ownerToken) {
  showConsole(true);
  loadClinics();
}
