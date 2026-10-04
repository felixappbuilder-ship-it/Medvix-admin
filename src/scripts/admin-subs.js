// src/scripts/admin-subs.js
import { call, query } from './admin-api.js';
import { showToast, confirmDialog, formatDate, showLoading } from './admin-utils.js';

let currentSubscriptions = [];
let allUsers = [];              // cache of all users for search
let selectedUserId = null;      // for grant modal
let checkboxes = [];            // currently checked subscription rows

/**
 * Loads all users (for autocomplete) and stores them.
 */
async function loadAllUsers() {
  try {
    // Fetch up to 1000 users – adjust if needed
    const data = await query('admin/queries:adminGetAllUsers', { limit: 1000 });
    allUsers = data.users;
  } catch (error) {
    console.error('Failed to load users', error);
    allUsers = [];
  }
}

/**
 * Loads subscriptions with optional filters.
 */
export async function loadSubscriptions(params = {}) {
  try {
    showLoading(true);
    const { limit = 200, cursor, filter } = params;
    const data = await query('admin/queries:adminGetAllSubscriptions', { limit, cursor, filter });
    currentSubscriptions = data.subscriptions;
    renderSubTable(currentSubscriptions);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Applies client-side filters and re-renders the table.
 */
function applyFilters() {
  const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
  const plan = document.getElementById('plan-filter')?.value || '';
  const status = document.getElementById('status-filter')?.value || '';

  let filtered = [...currentSubscriptions];
  if (searchTerm) {
    filtered = filtered.filter(sub => {
      const userName = (sub.userName || '').toLowerCase();
      const userEmail = (sub.userEmail || '').toLowerCase();
      return userName.includes(searchTerm) || userEmail.includes(searchTerm);
    });
  }
  if (plan) {
    filtered = filtered.filter(sub => sub.plan === plan);
  }
  if (status) {
    filtered = filtered.filter(sub => sub.status === status);
  }
  renderSubTable(filtered);
}

/**
 * Renders the subscription table.
 */
export function renderSubTable(subs) {
  const container = document.getElementById('sub-table-container');
  if (!container) return;

  checkboxes = [];

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th><input type="checkbox" id="select-all"></th>
          <th>User</th>
          <th>Email</th>
          <th>Plan</th>
          <th>Start</th>
          <th>Expiry</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  subs.forEach((sub, index) => {
    html += `
      <tr data-sub-id="${sub._id}" data-user-id="${sub.userId}">
        <td><input type="checkbox" class="sub-checkbox" data-index="${index}"></td>
        <td>${sub.userName || '—'}</td>
        <td>${sub.userEmail || '—'}</td>
        <td>${sub.plan}</td>
        <td>${formatDate(sub.startDate)}</td>
        <td>${formatDate(sub.expiryDate)}</td>
        <td>${sub.status}</td>
        <td>
          <button class="btn-sm btn-secondary" onclick="window.adminSubs.extendPrompt('${sub.userId}')">Extend</button>
          <button class="btn-sm btn-secondary" onclick="window.adminSubs.reducePrompt('${sub.userId}')">Reduce</button>
          <button class="btn-sm btn-secondary" onclick="window.adminSubs.changePlanPrompt('${sub.userId}')">Plan</button>
          <button class="btn-sm btn-danger" onclick="window.adminSubs.terminateSubscription('${sub.userId}')">Terminate</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  // Attach event listeners
  document.getElementById('select-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('.sub-checkbox').forEach(cb => cb.checked = checked);
    updateBulkActions();
  });

  document.querySelectorAll('.sub-checkbox').forEach(cb => {
    cb.addEventListener('change', updateBulkActions);
  });

  updateBulkActions();
}

/**
 * Updates the bulk actions bar visibility and selected count.
 */
function updateBulkActions() {
  const checked = document.querySelectorAll('.sub-checkbox:checked');
  const bar = document.getElementById('bulk-actions');
  if (bar) {
    bar.style.display = checked.length > 0 ? 'flex' : 'none';
    const counter = document.getElementById('selected-count');
    if (counter) counter.textContent = `${checked.length} selected`;
  }
  checkboxes = Array.from(checked);
}

// ---- Bulk actions ----
export function setupBulkActions() {
  document.getElementById('bulk-extend-btn')?.addEventListener('click', async () => {
    const days = prompt('Enter number of days to extend:');
    if (!days || isNaN(days)) return;
    const confirmed = await confirmDialog(`Extend all selected subscriptions by ${days} days?`);
    if (!confirmed) return;

    const userIds = checkboxes.map(cb => cb.closest('tr')?.dataset.userId).filter(Boolean);
    showLoading(true);
    try {
      // Try bulk mutation; fallback to individual calls
      try {
        await call('admin/mutations:adminBulkExtendSubscriptions', { userIds, days: parseInt(days) });
        showToast('Bulk extend completed', 'success');
      } catch {
        for (const userId of userIds) {
          await call('admin/mutations:adminUpdateSubscription', { userId, extendDays: parseInt(days) });
        }
        showToast('Extended individually (bulk endpoint not available)', 'warning');
      }
      loadSubscriptions();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      showLoading(false);
    }
  });

  document.getElementById('bulk-terminate-btn')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog('Terminate all selected subscriptions?');
    if (!confirmed) return;
    const userIds = checkboxes.map(cb => cb.closest('tr')?.dataset.userId).filter(Boolean);
    showLoading(true);
    try {
      try {
        await call('admin/mutations:adminBulkTerminateSubscriptions', { userIds });
        showToast('Bulk terminate completed', 'success');
      } catch {
        for (const userId of userIds) {
          await call('admin/mutations:adminTerminateSubscription', { userId });
        }
        showToast('Terminated individually (bulk endpoint not available)', 'warning');
      }
      loadSubscriptions();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      showLoading(false);
    }
  });

  document.getElementById('bulk-cancel-btn')?.addEventListener('click', () => {
    document.querySelectorAll('.sub-checkbox').forEach(cb => cb.checked = false);
    updateBulkActions();
  });
}

// ---- Grant Free Subscription Modal ----
export function setupGrantModal() {
  const modal = document.getElementById('grant-modal');
  const openBtn = document.getElementById('grant-free-btn');
  const closeBtn = document.getElementById('close-grant-modal');
  const cancelBtn = document.getElementById('cancel-grant');
  const submitBtn = document.getElementById('submit-grant');
  const searchInput = document.getElementById('user-search-input');
  const resultsDiv = document.getElementById('user-search-results');
  const displayDiv = document.getElementById('selected-user-display');

  let localSelectedUser = null;

  // Open modal
  openBtn?.addEventListener('click', () => {
    modal.style.display = 'flex';
    localSelectedUser = null;
    selectedUserId = null;
    displayDiv.innerHTML = '';
    searchInput.value = '';
    resultsDiv.innerHTML = '';
  });

  // Close modal
  const closeModal = () => { modal.style.display = 'none'; };
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // Live search
  searchInput?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    resultsDiv.innerHTML = '';
    if (!term) return;

    const matches = allUsers.filter(u =>
      (u.name || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)
    ).slice(0, 10);

    matches.forEach(user => {
      const div = document.createElement('div');
      div.className = 'search-result-item';
      div.textContent = `${user.name} (${user.email})`;
      div.addEventListener('click', () => {
        localSelectedUser = user;
        selectedUserId = user._id;
        displayDiv.innerHTML = `<strong>Selected:</strong> ${user.name} (${user.email})`;
        resultsDiv.innerHTML = '';
        searchInput.value = '';
      });
      resultsDiv.appendChild(div);
    });
  });

  // Submit grant
  submitBtn?.addEventListener('click', async () => {
    if (!selectedUserId) {
      showToast('Please select a user', 'error');
      return;
    }
    const plan = document.getElementById('grant-plan').value;
    const duration = parseInt(document.getElementById('grant-duration').value);
    if (!plan || duration < 1) {
      showToast('Invalid plan or duration', 'error');
      return;
    }
    try {
      showLoading(true);
      await call('admin/mutations:adminGrantFreeSubscription', {
        userId: selectedUserId,
        plan,
        durationDays: duration
      });
      showToast('Free subscription granted', 'success');
      closeModal();
      loadSubscriptions();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      showLoading(false);
    }
  });
}

// ---- Page initialisation ----
export async function initSubscriptionPage() {
  await loadAllUsers();           // cache users for search
  await loadSubscriptions();
  setupGrantModal();
  setupBulkActions();

  // Attach filter events
  document.getElementById('search-input')?.addEventListener('input', applyFilters);
  document.getElementById('plan-filter')?.addEventListener('change', applyFilters);
  document.getElementById('status-filter')?.addEventListener('change', applyFilters);
}

// ---- Individual action helpers (used by inline onclick) ----
window.adminSubs = {
  extendPrompt(userId) {
    const days = prompt('Days to extend:');
    if (days && !isNaN(days)) {
      call('admin/mutations:adminUpdateSubscription', { userId, extendDays: parseInt(days) })
        .then(() => { showToast('Extended', 'success'); loadSubscriptions(); })
        .catch(err => showToast(err.message, 'error'));
    }
  },
  reducePrompt(userId) {
    const days = prompt('Days to reduce:');
    if (days && !isNaN(days)) {
      call('admin/mutations:adminUpdateSubscription', { userId, extendDays: -parseInt(days) })
        .then(() => { showToast('Reduced', 'success'); loadSubscriptions(); })
        .catch(err => showToast(err.message, 'error'));
    }
  },
  changePlanPrompt(userId) {
    const plan = prompt('New plan (monthly/quarterly/yearly):');
    if (plan) {
      call('admin/mutations:adminUpdateSubscription', { userId, plan })
        .then(() => { showToast('Plan changed', 'success'); loadSubscriptions(); })
        .catch(err => showToast(err.message, 'error'));
    }
  },
  terminateSubscription(userId) {
    confirmDialog('Terminate this subscription?')
      .then(confirmed => {
        if (!confirmed) return;
        return call('admin/mutations:adminTerminateSubscription', { userId });
      })
      .then(() => { showToast('Terminated', 'success'); loadSubscriptions(); })
      .catch(err => showToast(err.message, 'error'));
  }
};