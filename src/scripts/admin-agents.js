// src/scripts/admin-agents.js
import { call, query } from './admin-api.js';
import { showToast, confirmDialog, showLoading } from './admin-utils.js';

let allUsers = [];
let selectedUserIds = new Set();

export async function initAgentsPage() {
  await loadAllUsers();

  const searchInput = document.getElementById('agent-search');
  let debounceTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, 300);
  });

  document.getElementById('agent-filter')?.addEventListener('change', applyFilters);
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
  const searchTerm = document.getElementById('agent-search')?.value?.toLowerCase() || '';
  const filter = document.getElementById('agent-filter')?.value || '';

  let filtered = [...allUsers];

  if (searchTerm) {
    filtered = filtered.filter(u =>
      (u.name || '').toLowerCase().includes(searchTerm) ||
      (u.email || '').toLowerCase().includes(searchTerm) ||
      (u.phone || '').toLowerCase().includes(searchTerm)
    );
  }

  if (filter === 'agent') {
    filtered = filtered.filter(u => u.isAgent);
  } else if (filter === 'pending') {
    filtered = filtered.filter(u => u.isAgent && !u.agentVerified);
  } else if (filter === 'verified') {
    filtered = filtered.filter(u => u.isAgent && u.agentVerified);
  } else if (filter === 'not-agent') {
    filtered = filtered.filter(u => !u.isAgent);
  }

  renderAgentsTable(filtered);
}

function renderAgentsTable(users) {
  const container = document.getElementById('agents-table-container');
  if (!container) return;

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th><input type="checkbox" id="select-all"></th>
          <th>Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Agent Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  users.forEach(user => {
    let statusBadge = '';
    if (user.isAgent) {
      if (user.agentVerified) {
        statusBadge = '<span class="agent-badge agent-verified">✅ Verified</span>';
      } else {
        statusBadge = '<span class="agent-badge agent-pending">⚠️ Pending Verification</span>';
      }
    } else {
      statusBadge = '<span class="agent-badge agent-not">Not Agent</span>';
    }

    html += `
      <tr data-user-id="${user._id}">
        <td><input type="checkbox" class="agent-checkbox" data-user-id="${user._id}"></td>
        <td>${user.name} ${statusBadge}</td>
        <td>${user.email}</td>
        <td>${user.phone || '—'}</td>
        <td>${user.isAgent ? 'Agent' : 'User'}</td>
        <td>
          <div class="actions-group">
            ${!user.isAgent ? `
              <button class="btn-sm btn-primary upgrade-agent-btn" data-user-id="${user._id}">Upgrade</button>
            ` : ''}
            ${user.isAgent && !user.agentVerified ? `
              <button class="btn-sm btn-success verify-agent-btn" data-user-id="${user._id}">Verify</button>
            ` : ''}
            ${user.isAgent ? `
              <button class="btn-sm btn-danger revoke-agent-btn" data-user-id="${user._id}">Revoke</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  // Attach events
  document.getElementById('select-all')?.addEventListener('change', (e) => {
    document.querySelectorAll('.agent-checkbox').forEach(cb => cb.checked = e.target.checked);
    updateBulkBar();
  });
  document.querySelectorAll('.agent-checkbox').forEach(cb => cb.addEventListener('change', updateBulkBar));
  document.querySelectorAll('.upgrade-agent-btn').forEach(btn => btn.addEventListener('click', () => upgradeToAgent(btn.dataset.userId)));
  document.querySelectorAll('.verify-agent-btn').forEach(btn => btn.addEventListener('click', () => verifyAgent(btn.dataset.userId)));
  document.querySelectorAll('.revoke-agent-btn').forEach(btn => btn.addEventListener('click', () => revokeAgent(btn.dataset.userId)));

  updateBulkBar();
}

function updateBulkBar() {
  const checked = document.querySelectorAll('.agent-checkbox:checked');
  selectedUserIds = new Set(Array.from(checked).map(cb => cb.dataset.userId));
  const bar = document.getElementById('bulk-actions');
  if (bar) {
    bar.style.display = selectedUserIds.size > 0 ? 'flex' : 'none';
    document.getElementById('selected-count').textContent = `${selectedUserIds.size} selected`;
  }
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

async function revokeAgent(userId) {
  const confirmed = await confirmDialog('Revoke agent privileges?');
  if (!confirmed) return;
  try {
    showLoading(true);
    await call('admin/mutations:adminUpdateUser', { userId, updates: { isAgent: false, agentVerified: false } });
    showToast('Agent revoked', 'success');
    await loadAllUsers();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function setupBulkActions() {
  document.getElementById('bulk-upgrade-btn')?.addEventListener('click', async () => {
    const ids = Array.from(selectedUserIds);
    if (!ids.length) return;
    const confirmed = await confirmDialog(`Upgrade ${ids.length} users to agents?`);
    if (!confirmed) return;
    showLoading(true);
    try {
      for (const id of ids) {
        await call('admin/mutations:adminUpdateUser', { userId: id, updates: { isAgent: true } });
      }
      showToast('Bulk upgrade completed', 'success');
      await loadAllUsers();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      showLoading(false);
    }
  });

  document.getElementById('bulk-verify-btn')?.addEventListener('click', async () => {
    const ids = Array.from(selectedUserIds);
    if (!ids.length) return;
    const confirmed = await confirmDialog(`Verify ${ids.length} agents?`);
    if (!confirmed) return;
    showLoading(true);
    try {
      for (const id of ids) {
        await call('admin/mutations:adminUpdateUser', { userId: id, updates: { agentVerified: true } });
      }
      showToast('Bulk verification completed', 'success');
      await loadAllUsers();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      showLoading(false);
    }
  });

  document.getElementById('bulk-revoke-btn')?.addEventListener('click', async () => {
    const ids = Array.from(selectedUserIds);
    if (!ids.length) return;
    const confirmed = await confirmDialog(`Revoke agent privileges for ${ids.length} users?`);
    if (!confirmed) return;
    showLoading(true);
    try {
      for (const id of ids) {
        await call('admin/mutations:adminUpdateUser', { userId: id, updates: { isAgent: false, agentVerified: false } });
      }
      showToast('Bulk revoke completed', 'success');
      await loadAllUsers();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      showLoading(false);
    }
  });

  document.getElementById('bulk-clear-btn')?.addEventListener('click', () => {
    document.querySelectorAll('.agent-checkbox').forEach(cb => cb.checked = false);
    updateBulkBar();
  });
}

// Expose functions if needed globally
window.adminAgents = {
  upgradeToAgent,
  verifyAgent,
  revokeAgent
};