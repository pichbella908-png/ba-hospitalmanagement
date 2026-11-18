'use strict';
const approvalToken = new URLSearchParams(location.search).get('token') || '';
const statusElement = document.querySelector('#status');
const detailsElement = document.querySelector('#details');
const actionsElement = document.querySelector('#actions');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);

async function showSignupRequest() {
  if (!approvalToken) throw new Error('The approval link is missing its token.');
  const response = await fetch(`${window.API_BASE}/api/auth/approval?token=${encodeURIComponent(approvalToken)}`, { cache: 'no-store', credentials: 'omit' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not load the signup request.');
  detailsElement.innerHTML = `<p><b>Clinic:</b> ${escapeHtml(result.clinic_name)}<br><b>Administrator:</b> ${escapeHtml(result.name)}<br><b>Email:</b> ${escapeHtml(result.email)}</p>`;
  if (result.status === 'pending') {
    statusElement.textContent = 'Review this request before approving or rejecting it.';
    actionsElement.hidden = false;
  } else {
    statusElement.textContent = `This request is already ${result.status}.`;
  }
}

async function decideSignup(decision) {
  const buttons = [...actionsElement.querySelectorAll('button')];
  buttons.forEach((button) => { button.disabled = true; });
  statusElement.textContent = decision === 'approve' ? 'Creating the clinic database…' : 'Rejecting the signup…';
  try {
    const response = await fetch(`${window.API_BASE}/api/auth/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({ token: approvalToken, decision }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not process this request.');
    actionsElement.hidden = true;
    statusElement.textContent = result.status === 'approved' ? 'Clinic approved. The administrator can now sign in.' : 'Signup request rejected.';
  } catch (error) {
    statusElement.textContent = error.message || 'Could not process this request.';
    buttons.forEach((button) => { button.disabled = false; });
  }
}

document.querySelector('#approve').addEventListener('click', () => decideSignup('approve'));
document.querySelector('#reject').addEventListener('click', () => decideSignup('reject'));
showSignupRequest().catch((error) => { statusElement.textContent = error.message; });
