// src/scripts/admin-reversals.js
import { call, query } from './admin-api.js';
import { showToast, confirmDialog, formatDate, formatCurrency, showLoading } from './admin-utils.js';

let allReversals = [];

export async function initReversalsPage() {
  await loadReversals();

  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, 300);
  });

  document.getElementById('status-filter')?.addEventListener('change', applyFilters);
}

async function loadReversals() {
  try {
    showLoading(true);
    const data = await query('admin/queries:adminGetAllReversals', { limit: 500 });
    allReversals = data.reversals || [];
    applyFilters();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function applyFilters() {
  const searchTerm = document.getElementById('search-input')?.value?.toLowerCase() || '';
  const status = document.getElementById('status-filter')?.value || '';
  let filtered = [...allReversals];

  if (searchTerm) {
    filtered = filtered.filter(r =>
      (r.userName || '').toLowerCase().includes(searchTerm) ||
      (r.reference || '').toLowerCase().includes(searchTerm) ||
      (r.paymentId || '').toLowerCase().includes(searchTerm)
    );
  }
  if (status) {
    filtered = filtered.filter(r => r.status === status);
  }
  renderReversalsTable(filtered);
}

function renderReversalsTable(reversals) {
  const container = document.getElementById('reversals-table-container');
  if (!container) return;

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Amount</th>
          <th>Reference</th>
          <th>Date</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  reversals.forEach(r => {
    html += `
      <tr>
        <td>${r.userName || '—'}</td>
        <td>${formatCurrency(r.amount)}</td>
        <td>${r.reference || r.paymentId || '—'}</td>
        <td>${formatDate(r.createdAt)}</td>
        <td>${r.status}</td>
        <td>
          <button class="btn-sm btn-success" onclick="window.adminReversals.approveReversal('${r._id}')">Approve</button>
          <button class="btn-sm btn-danger" onclick="window.adminReversals.rejectReversal('${r._id}')">Reject</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

async function approveReversal(id) {
  try {
    showLoading(true);
    await call('admin/mutations:adminProcessReversal', { reversalId: id, status: 'approved' });
    showToast('Reversal approved', 'success');
    await loadReversals();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function rejectReversal(id) {
  const reason = prompt('Reason for rejection:');
  if (!reason) return;
  try {
    showLoading(true);
    await call('admin/mutations:adminProcessReversal', { reversalId: id, status: 'rejected', reason });
    showToast('Reversal rejected', 'success');
    await loadReversals();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

window.adminReversals = {
  approveReversal,
  rejectReversal
};