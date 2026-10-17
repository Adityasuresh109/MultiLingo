'use strict';
const form = document.getElementById('invite-form');
const result = document.getElementById('invite-result');
const button = document.getElementById('invite-button');
form.addEventListener('submit', async event => {
  event.preventDefault();
  result.replaceChildren();
  button.disabled = true;
  try {
    const password = document.getElementById('admin-key').value;
    const response = await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { authorization: `Bearer ${password}`, 'content-type': 'application/json' },
      body: '{}', credentials: 'same-origin', cache: 'no-store'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Invitation could not be created');
    const instruction = document.createElement('p');
    instruction.textContent = 'Your new private learning code (copy it now):';
    const value = document.createElement('textarea');
    value.className = 'input'; value.readOnly = true; value.rows = 3; value.value = data.invite;
    const copy = document.createElement('button');
    copy.type = 'button'; copy.className = 'secondary'; copy.textContent = 'Copy learning code';
    copy.addEventListener('click', async () => { await navigator.clipboard.writeText(value.value); copy.textContent = 'Copied'; });
    result.append(instruction, value, copy);
  } catch (error) {
    const message = document.createElement('p');
    message.className = 'error'; message.textContent = error.message;
    result.append(message);
  } finally { button.disabled = false; }
});
