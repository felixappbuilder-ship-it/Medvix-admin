// src/scripts/admin-withdrawals.js
import { call, query } from './admin-api.js';
import { showToast, confirmDialog, showFormModal, formatDate, formatCurrency, showLoading } from './admin-utils.js';

let allWithdrawals = [];
let selectedIds = new Set();
let autoApproveEnabled = false;

/**
 * Initialises the withdrawals page.
 */
export async function initWithdrawalsPage() {
  await loadWithdrawals();
  await loadAutoApproveSetting();

  // Live search with debounce
  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, 300);
  });

  document.getElementById('status-filter')?.addEventListener('change', applyFilters);
  setupBulkActions();
  setupAutoApproveToggle();
}

/**
 * Loads all withdrawal requests from the backend.
 */
async function loadWithdrawals() {
  try {
    showLoading(true);
    const data = await query('admin/queries:adminGetAllWithdrawals', { limit: 500 });
    allWithdrawals = data.withdrawals || [];
    applyFilters();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Loads the auto-approve setting from app config.
 */
async function loadAutoApproveSetting() {
  try {
    const config = await query('admin/queries:adminGetAppConfig', {});
    autoApproveEnabled = config?.autoApproveWithdrawals || false;
    const toggle = document.getElementById('auto-approve-toggle');
    if (toggle) {
      toggle.checked = autoApproveEnabled;
      document.getElementById('auto-approve-label').textContent = autoApproveEnabled ? 'Enabled' : 'Disabled';
    }
  } catch (error) {
    console.warn('Failed to load auto-approve setting:', error);
  }
}

/**
 * Applies search and status filters.
 */
function applyFilters() {
  const searchTerm = document.getElementById('search-input')?.value?.toLowerCase() || '';
  const status = document.getElementById('status-filter')?.value || '';
  let filtered = [...allWithdrawals];

  if (searchTerm) {
    filtered = filtered.filter(w =>
      (w.userName || '').toLowerCase().includes(searchTerm) ||
      (w.userEmail || '').toLowerCase().includes(searchTerm) ||
      (w.phoneNumber || '').toLowerCase().includes(searchTerm) ||
      (w.userPhone || '').toLowerCase().includes(searchTerm)
    );
  }
  if (status) {
    filtered = filtered.filter(w => w.status === status);
  }
  renderWithdrawalsTable(filtered);
}

/**
 * Renders the withdrawals table with enhanced columns: payment method, B2C status.
 */
function renderWithdrawalsTable(withdrawals) {
  const container = document.getElementById('withdrawals-table-container');
  if (!container) return;

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th><input type="checkbox" id="select-all"></th>
          <th>User</th>
          <th>Amount</th>
          <th>Phone</th>
          <th>Date</th>
          <th>Method</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  withdrawals.forEach(w => {
    const method = w.paymentMethod || (w.b2cTransactionId ? 'B2C' : '—');
    const isPending = w.status === 'pending';
    // Use phoneNumber from withdrawal (user-provided) if available, else fallback to userPhone
    const phoneDisplay = w.phoneNumber || w.userPhone || '—';
    html += `
      <tr data-withdrawal-id="${w._id}">
        <td><input type="checkbox" class="withdrawal-checkbox" data-id="${w._id}" ${isPending ? '' : 'disabled'}></td>
        <td>${w.userName || '—'}</td>
        <td>${formatCurrency(w.amount)}</td>
        <td>${phoneDisplay}</td>
        <td>${formatDate(w.requestedAt || w.createdAt)}</td>
        <td>${method}</td>
        <td><span class="status-badge status-${w.status}">${w.status}</span></td>
        <td>
          ${isPending ? `
            <button class="btn-sm btn-success" onclick="window.adminWithdrawals.approveWithdrawal('${w._id}')">Approve</button>
            <button class="btn-sm btn-primary" onclick="window.adminWithdrawals.processB2C('${w._id}')">B2C</button>
            <button class="btn-sm btn-danger" onclick="window.adminWithdrawals.rejectWithdrawal('${w._id}')">Reject</button>
          ` : `
            <span class="text-muted">—</span>
          `}
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  // Attach listeners
  document.getElementById('select-all')?.addEventListener('change', (e) => {
    document.querySelectorAll('.withdrawal-checkbox:not([disabled])').forEach(cb => cb.checked = e.target.checked);
    updateBulkBar();
  });
  document.querySelectorAll('.withdrawal-checkbox').forEach(cb => cb.addEventListener('change', updateBulkBar));
  updateBulkBar();
}

/**
 * Updates the bulk actions bar.
 */
function updateBulkBar() {
  const checked = document.querySelectorAll('.withdrawal-checkbox:checked');
  selectedIds = new Set(Array.from(checked).map(cb => cb.dataset.id));
  const bar = document.getElementById('bulk-actions');
  if (bar) {
    bar.style.display = selectedIds.size > 0 ? 'flex' : 'none';
    document.getElementById('selected-count').textContent = `${selectedIds.size} selected`;
    // Enable/disable bulk buttons based on selection
    document.getElementById('bulk-approve-btn').disabled = selectedIds.size === 0;
    document.getElementById('bulk-b2c-btn').disabled = selectedIds.size === 0;
    document.getElementById('bulk-reject-btn').disabled = selectedIds.size === 0;
  }
}

/**
 * Approves a single withdrawal (manual).
 */
async function approveWithdrawal(id) {
  const result = await showFormModal('Approve Withdrawal', [
    { name: 'paymentMethod', label: 'Payment Method', type: 'select', required: true, options: [
      { value: 'cash', label: 'Cash' },
      { value: 'bank', label: 'Bank Transfer' },
      { value: 'mpesa_manual', label: 'M-Pesa Manual' },
    ]},
    { name: 'paymentReference', label: 'Payment Reference', placeholder: 'e.g., transaction code or receipt number' }
  ]);
  if (!result) return;

  try {
    showLoading(true);
    await call('admin/mutations:adminProcessWithdrawal', {
      withdrawalId: id,
      status: 'processed',
      paymentMethod: result.paymentMethod,
      paymentReference: result.paymentReference || 'manual',
    });
    showToast('Withdrawal approved', 'success');
    await loadWithdrawals();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Rejects a single withdrawal.
 */
async function rejectWithdrawal(id) {
  const result = await showFormModal('Reject Withdrawal', [
    { name: 'reason', label: 'Reason for rejection', required: true }
  ]);
  if (!result) return;

  try {
    showLoading(true);
    await call('admin/mutations:adminProcessWithdrawal', {
      withdrawalId: id,
      status: 'failed',
      reason: result.reason,
    });
    showToast('Withdrawal rejected', 'success');
    await loadWithdrawals();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Processes a single withdrawal via B2C (auto M-Pesa).
 */
async function processB2C(id) {
  const confirmed = await confirmDialog('This will initiate an M-Pesa B2C payment to the user. Continue?');
  if (!confirmed) return;

  try {
    showLoading(true);
    const result = await call('admin/mutations:adminProcessB2CWithdrawal', {
      withdrawalId: id,
    });
    showToast(result.message || 'B2C initiated', 'success');
    await loadWithdrawals();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Sets up bulk actions (approve, B2C, reject, clear).
 */
function setupBulkActions() {
  // Bulk Approve (Manual)
  document.getElementById('bulk-approve-btn')?.addEventListener('click', async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    const result = await showFormModal('Bulk Approve Withdrawals', [
      { name: 'paymentMethod', label: 'Payment Method', type: 'select', required: true, options: [
        { value: 'cash', label: 'Cash' },
        { value: 'bank', label: 'Bank Transfer' },
        { value: 'mpesa_manual', label: 'M-Pesa Manual' },
      ]},
      { name: 'paymentReference', label: 'Payment Reference', placeholder: `bulk_${Date.now()}` }
    ]);
    if (!result) return;

    const confirmed = await confirmDialog(`Approve ${ids.length} withdrawals manually?`);
    if (!confirmed) return;

    try {
      showLoading(true);
      await call('admin/mutations:adminBulkApproveWithdrawals', {
        mode: 'manual',
        paymentMethod: result.paymentMethod,
        paymentReference: result.paymentReference || `bulk_${Date.now()}`,
      });
      showToast('Bulk manual approval completed', 'success');
      await loadWithdrawals();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      showLoading(false);
    }
  });

  // Bulk B2C
  document.getElementById('bulk-b2c-btn')?.addEventListener('click', async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const confirmed = await confirmDialog(`Process ${ids.length} withdrawals via B2C (M-Pesa)?`);
    if (!confirmed) return;

    try {
      showLoading(true);
      await call('admin/mutations:adminBulkApproveWithdrawals', {
        mode: 'b2c',
      });
      showToast('Bulk B2C initiated', 'success');
      await loadWithdrawals();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      showLoading(false);
    }
  });

  // Bulk Reject
  document.getElementById('bulk-reject-btn')?.addEventListener('click', async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    const result = await showFormModal('Bulk Reject Withdrawals', [
      { name: 'reason', label: 'Reason for rejection (applies to all)', required: true }
    ]);
    if (!result) return;

    const confirmed = await confirmDialog(`Reject ${ids.length} withdrawals?`);
    if (!confirmed) return;

    try {
      showLoading(true);
      for (const id of ids) {
        await call('admin/mutations:adminProcessWithdrawal', {
          withdrawalId: id,
          status: 'failed',
          reason: result.reason,
        });
      }
      showToast('Bulk rejection completed', 'success');
      await loadWithdrawals();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      showLoading(false);
    }
  });

  // Clear selection
  document.getElementById('bulk-clear-btn')?.addEventListener('click', () => {
    document.querySelectorAll('.withdrawal-checkbox').forEach(cb => cb.checked = false);
    updateBulkBar();
  });
}

/**
 * Sets up the auto-approve toggle.
 */
function setupAutoApproveToggle() {
  const toggle = document.getElementById('auto-approve-toggle');
  const label = document.getElementById('auto-approve-label');
  if (!toggle) return;

  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    try {
      showLoading(true);
      await call('admin/mutations:adminSetAutoApprove', { enabled });
      autoApproveEnabled = enabled;
      label.textContent = enabled ? 'Enabled' : 'Disabled';
      showToast(`Auto-approve ${enabled ? 'enabled' : 'disabled'}`, 'success');
      await loadWithdrawals();
    } catch (error) {
      showToast(error.message, 'error');
      toggle.checked = !enabled;
    } finally {
      showLoading(false);
    }
  });
}

// Expose to global for inline onclick
window.adminWithdrawals = {
  approveWithdrawal,
  rejectWithdrawal,
  processB2C,
};