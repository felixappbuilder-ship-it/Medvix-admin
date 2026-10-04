// src/scripts/admin-users.js
import { call, query } from './admin-api.js';
import { showToast, confirmDialog, showModal, formatDate, showLoading } from './admin-utils.js';

let allUsers = [];
let currentFilteredUsers = [];
let selectedUserIds = new Set();

export async function initUsersPage() {
  await loadAllUsers();

  const searchInput = document.getElementById('user-search');
  const clearBtn = document.getElementById('clear-search');
  let debounceTimer;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    clearBtn.style.display = e.target.value ? 'inline-block' : 'none';
    debounceTimer = setTimeout(applyFilters, 300);
  });
  clearBtn?.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    applyFilters();
  });

  document.getElementById('status-filter')?.addEventListener('change', applyFilters);
  document.getElementById('plan-filter')?.addEventListener('change', applyFilters);
  document.getElementById('locked-filter')?.addEventListener('change', applyFilters);

  setupBulkActions();
}

async function loadAllUsers() {
  try {
    showLoading(true);
    const data = await query('admin/queries:adminGetAllUsers', { limit: 1000 });
    allUsers = data.users;
    applyFilters();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function applyFilters() {
  const searchTerm = document.getElementById('user-search')?.value?.toLowerCase() || '';
  const status = document.getElementById('status-filter')?.value || '';
  const plan = document.getElementById('plan-filter')?.value || '';
  const locked = document.getElementById('locked-filter')?.value || '';

  let filtered = [...allUsers];

  if (searchTerm) {
    filtered = filtered.filter(u =>
      (u.name || '').toLowerCase().includes(searchTerm) ||
      (u.email || '').toLowerCase().includes(searchTerm) ||
      (u.phone || '').toLowerCase().includes(searchTerm)
    );
  }

  if (status) {
    if (status === 'active') filtered = filtered.filter(u => (u.subscriptionStatus || 'active') === 'active');
    else if (status === 'expired') filtered = filtered.filter(u => u.subscriptionStatus === 'expired');
    else if (status === 'locked') filtered = filtered.filter(u => u.isLocked);
  }

  if (plan) {
    filtered = filtered.filter(u => u.subscriptionPlan === plan);
  }

  if (locked === 'true') {
    filtered = filtered.filter(u => u.isLocked);
  } else if (locked === 'false') {
    filtered = filtered.filter(u => !u.isLocked);
  }

  currentFilteredUsers = filtered;
  renderUserTable(filtered);
}

function renderUserTable(users) {
  const container = document.getElementById('user-table-container');
  if (!container) return;

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th><input type="checkbox" id="select-all"></th>
          <th>Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Plan</th>
          <th>Expiry</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  users.forEach(user => {
    const status = user.isLocked ? '🔒 Locked' : (user.subscriptionStatus || 'Active');
    const agentBadge = user.isAgent ? (user.agentVerified ? ' ✅ Agent' : ' ⚠️ Agent (Unverified)') : '';
    html += `
      <tr data-user-id="${user._id}">
        <td><input type="checkbox" class="user-checkbox" data-user-id="${user._id}"></td>
        <td>${user.name}${agentBadge}</td>
        <td>${user.email}</td>
        <td>${user.phone || '—'}</td>
        <td>${user.subscriptionPlan || '—'}</td>
        <td>${user.subscriptionExpiry ? formatDate(user.subscriptionExpiry) : '—'}</td>
        <td>${status}</td>
        <td class="actions-cell">
          <div class="actions-group">
            <button class="btn-sm btn-secondary edit-user-btn" data-user-id="${user._id}">✎</button>
            <button class="btn-sm ${user.isLocked ? 'btn-success' : 'btn-warning'} lock-user-btn" data-user-id="${user._id}">
              ${user.isLocked ? '🔓' : '🔒'}
            </button>
            <div class="action-dropdown">
              <button class="btn-sm btn-secondary more-btn">⋯</button>
              <div class="dropdown-menu">
                <button class="view-detail-btn" data-user-id="${user._id}">View Details</button>
                <button class="reset-password-btn" data-user-id="${user._id}">Reset Password</button>
                <button class="force-logout-btn" data-user-id="${user._id}">Force Logout</button>
                <button class="delete-user-btn" data-user-id="${user._id}">Delete</button>
                ${!user.isAgent ? `<button class="upgrade-agent-btn" data-user-id="${user._id}">Upgrade to Agent</button>` : ''}
                ${user.isAgent && !user.agentVerified ? `<button class="verify-agent-btn" data-user-id="${user._id}">Verify Agent</button>` : ''}
                <button class="export-data-btn" data-user-id="${user._id}">Export Data (JSON)</button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  attachTableEvents();
  updateBulkActions();
}

function attachTableEvents() {
  document.getElementById('select-all')?.addEventListener('change', (e) => {
    document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = e.target.checked);
    updateBulkActions();
  });

  document.querySelectorAll('.user-checkbox').forEach(cb => {
    cb.addEventListener('change', updateBulkActions);
  });

  document.querySelectorAll('.more-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = btn.nextElementSibling;
      document.querySelectorAll('.dropdown-menu.show').forEach(d => d !== dropdown && d.classList.remove('show'));
      dropdown.classList.toggle('show');
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu.show').forEach(d => d.classList.remove('show'));
  });

  document.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', () => openEditUser(btn.dataset.userId)));
  document.querySelectorAll('.lock-user-btn').forEach(btn => btn.addEventListener('click', () => toggleLockUser(btn.dataset.userId)));
  document.querySelectorAll('.view-detail-btn').forEach(btn => btn.addEventListener('click', () => viewUserDetails(btn.dataset.userId)));
  document.querySelectorAll('.reset-password-btn').forEach(btn => btn.addEventListener('click', () => resetUserPassword(btn.dataset.userId)));
  document.querySelectorAll('.force-logout-btn').forEach(btn => btn.addEventListener('click', () => forceUserLogout(btn.dataset.userId)));
  document.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', () => deleteUser(btn.dataset.userId)));
  document.querySelectorAll('.upgrade-agent-btn').forEach(btn => btn.addEventListener('click', () => upgradeToAgent(btn.dataset.userId)));
  document.querySelectorAll('.verify-agent-btn').forEach(btn => btn.addEventListener('click', () => verifyAgent(btn.dataset.userId)));
  document.querySelectorAll('.export-data-btn').forEach(btn => btn.addEventListener('click', () => exportUserData(btn.dataset.userId)));
}

function updateBulkActions() {
  const checked = document.querySelectorAll('.user-checkbox:checked');
  selectedUserIds = new Set(Array.from(checked).map(cb => cb.dataset.userId));
  const bar = document.getElementById('bulk-actions');
  if (bar) {
    bar.style.display = selectedUserIds.size > 0 ? 'flex' : 'none';
    document.getElementById('selected-count').textContent = `${selectedUserIds.size} selected`;
  }
}

function findUserById(id) {
  return allUsers.find(u => u._id === id) || currentFilteredUsers.find(u => u._id === id);
}

async function toggleLockUser(userId) {
  const user = findUserById(userId);
  if (!user) return;
  const action = user.isLocked ? 'unlock' : 'lock';
  if (action === 'lock') {
    const reason = prompt('Reason for locking:');
    if (!reason) return;
    try {
      showLoading(true);
      await call('admin/mutations:adminLockUser', { userId, reason });
      showToast('User locked', 'success');
      await loadAllUsers();
    } catch (err) { showToast(err.message, 'error'); }
    finally { showLoading(false); }
  } else {
    try {
      showLoading(true);
      await call('admin/mutations:adminUpdateUser', { userId, updates: { isLocked: false } });
      showToast('User unlocked', 'success');
      await loadAllUsers();
    } catch (err) { showToast(err.message, 'error'); }
    finally { showLoading(false); }
  }
}

async function resetUserPassword(userId) {
  const newPass = prompt('Enter new password (min 6 characters):');
  if (!newPass || newPass.length < 6) return showToast('Password too short', 'error');
  try {
    showLoading(true);
    await call('admin/mutations:adminResetPassword', { userId, newPassword: newPass });
    showToast('Password reset', 'success');
  } catch (err) { showToast(err.message, 'error'); }
  finally { showLoading(false); }
}

async function forceUserLogout(userId) {
  const confirmed = await confirmDialog('Force logout this user?');
  if (!confirmed) return;
  try {
    showLoading(true);
    await call('admin/mutations:adminForceLogout', { userId });
    showToast('User logged out', 'success');
  } catch (err) { showToast(err.message, 'error'); }
  finally { showLoading(false); }
}

async function deleteUser(userId) {
  const confirmed = await confirmDialog('Permanently delete this user?');
  if (!confirmed) return;
  try {
    showLoading(true);
    await call('admin/mutations:adminDeleteUser', { userId });
    showToast('User deleted', 'success');
    await loadAllUsers();
  } catch (err) { showToast(err.message, 'error'); }
  finally { showLoading(false); }
}

async function upgradeToAgent(userId) {
  const confirmed = await confirmDialog('Upgrade this user to agent?');
  if (!confirmed) return;
  try {
    showLoading(true);
    await call('admin/mutations:adminUpdateUser', { userId, updates: { isAgent: true } });
    showToast('User upgraded to agent', 'success');
    await loadAllUsers();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function verifyAgent(userId) {
  const confirmed = await confirmDialog('Verify this agent?');
  if (!confirmed) return;
  try {
    showLoading(true);
    await call('admin/mutations:adminUpdateUser', { userId, updates: { agentVerified: true } });
    showToast('Agent verified', 'success');
    await loadAllUsers();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function exportUserData(userId) {
  try {
    showLoading(true);
    const data = await call('admin/actions:adminExportUserData', { userId });
    if (data.downloadUrl) {
      window.open(data.downloadUrl, '_blank');
    } else if (data.json) {
      const blob = new Blob([JSON.stringify(data.json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-${userId}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      showToast('Export data not available', 'warning');
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function openEditUser(userId) {
  const user = findUserById(userId);
  if (!user) return showToast('User not found', 'error');

  const content = `
    <div class="user-detail-grid">
      <div class="form-group"><label>Name</label><input id="edit-name" value="${user.name}"></div>
      <div class="form-group"><label>Email</label><input id="edit-email" value="${user.email}"></div>
      <div class="form-group"><label>Phone</label><input id="edit-phone" value="${user.phone || ''}"></div>
      <div class="form-group">
        <label>Locked</label>
        <input type="checkbox" id="edit-locked" ${user.isLocked ? 'checked' : ''}>
      </div>
      <div class="form-group">
        <label>Agent</label>
        <input type="checkbox" id="edit-agent" ${user.isAgent ? 'checked' : ''}>
      </div>
      <div class="form-group">
        <label>Agent Verified</label>
        <input type="checkbox" id="edit-agent-verified" ${user.agentVerified ? 'checked' : ''}>
      </div>
    </div>
    <div class="modal-footer" style="margin-top:1rem;">
      <button id="save-user-btn" class="btn-primary">Save Changes</button>
      <button class="btn-secondary" onclick="document.getElementById('global-modal').remove()">Cancel</button>
    </div>
  `;
  showModal('Edit User', content);

  document.getElementById('save-user-btn').addEventListener('click', async () => {
    const updates = {
      name: document.getElementById('edit-name').value,
      email: document.getElementById('edit-email').value,
      phone: document.getElementById('edit-phone').value,
      isLocked: document.getElementById('edit-locked').checked,
      isAgent: document.getElementById('edit-agent').checked,
      agentVerified: document.getElementById('edit-agent-verified').checked,
    };
    try {
      showLoading(true);
      await call('admin/mutations:adminUpdateUser', { userId, updates });
      showToast('User updated', 'success');
      document.getElementById('global-modal')?.remove();
      await loadAllUsers();
    } catch (err) { showToast(err.message, 'error'); }
    finally { showLoading(false); }
  });
}

function viewUserDetails(userId) {
  const user = findUserById(userId);
  if (!user) return showToast('User not found', 'error');
  const html = `
    <div class="user-detail-grid">
      <div><strong>Name:</strong> ${user.name}</div>
      <div><strong>Email:</strong> ${user.email}</div>
      <div><strong>Phone:</strong> ${user.phone || '—'}</div>
      <div><strong>Plan:</strong> ${user.subscriptionPlan || 'None'}</div>
      <div><strong>Expiry:</strong> ${user.subscriptionExpiry ? formatDate(user.subscriptionExpiry) : '—'}</div>
      <div><strong>Locked:</strong> ${user.isLocked ? 'Yes' : 'No'}</div>
      <div><strong>Trial Used:</strong> ${user.trialUsed ? 'Yes' : 'No'}</div>
      <div><strong>Agent:</strong> ${user.isAgent ? 'Yes' : 'No'}</div>
      <div><strong>Agent Verified:</strong> ${user.agentVerified ? 'Yes' : 'No'}</div>
    </div>
  `;
  showModal('User Details', html);
}

function setupBulkActions() {
  document.getElementById('bulk-lock-btn')?.addEventListener('click', async () => {
    const reason = prompt('Reason for locking all selected:');
    if (!reason) return;
    const ids = Array.from(selectedUserIds);
    try {
      showLoading(true);
      for (const id of ids) {
        await call('admin/mutations:adminLockUser', { userId: id, reason });
      }
      showToast('Users locked', 'success');
      await loadAllUsers();
    } catch (err) { showToast(err.message, 'error'); }
    finally { showLoading(false); }
  });

  document.getElementById('bulk-unlock-btn')?.addEventListener('click', async () => {
    const ids = Array.from(selectedUserIds);
    try {
      showLoading(true);
      for (const id of ids) {
        await call('admin/mutations:adminUpdateUser', { userId: id, updates: { isLocked: false } });
      }
      showToast('Users unlocked', 'success');
      await loadAllUsers();
    } catch (err) { showToast(err.message, 'error'); }
    finally { showLoading(false); }
  });

  document.getElementById('bulk-logout-btn')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog('Force logout all selected users?');
    if (!confirmed) return;
    try {
      showLoading(true);
      for (const id of Array.from(selectedUserIds)) {
        await call('admin/mutations:adminForceLogout', { userId: id });
      }
      showToast('Users logged out', 'success');
    } catch (err) { showToast(err.message, 'error'); }
    finally { showLoading(false); }
  });

  document.getElementById('bulk-delete-btn')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog('Delete all selected users permanently?');
    if (!confirmed) return;
    try {
      showLoading(true);
      for (const id of Array.from(selectedUserIds)) {
        await call('admin/mutations:adminDeleteUser', { userId: id });
      }
      showToast('Users deleted', 'success');
      await loadAllUsers();
    } catch (err) { showToast(err.message, 'error'); }
    finally { showLoading(false); }
  });

  document.getElementById('bulk-clear-btn')?.addEventListener('click', () => {
    document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = false);
    updateBulkActions();
  });
}

export { loadAllUsers as loadUsers, applyFilters, renderUserTable };