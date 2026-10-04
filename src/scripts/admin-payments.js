// src/scripts/admin-payments.js
import { call, query } from './admin-api.js';
import { showToast, confirmDialog, formatDate, formatCurrency, showLoading } from './admin-utils.js';
import { exportCSV } from './admin-exports.js';

let currentPayments = [];
let currentCursor = null;
let hasMore = false;

/**
 * Loads payments from the backend.
 * @param {Object} [params] - { limit, cursor, filter }
 */
export async function loadPayments(params = {}) {
  try {
    showLoading(true);
    const { limit = 20, cursor, filter } = params;
    const data = await query('admin/queries:adminGetAllPayments', { limit, cursor, filter });
    currentPayments = data.payments;
    currentCursor = data.nextCursor;
    hasMore = data.hasMore;
    renderPaymentsTable(currentPayments, currentCursor, hasMore);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Records a manual payment (e.g. cash, bank transfer).
 * @param {string} userId
 * @param {number} amount
 * @param {string} reference - receipt or transaction reference
 * @param {string} planName - plan to activate
 */
export async function recordManualPayment(userId, amount, reference, planName) {
  try {
    showLoading(true);
    await call('admin/mutations:adminRecordManualPayment', { userId, amount, reference, planName });
    showToast('Manual payment recorded', 'success');
    await loadPayments({ cursor: null });
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Processes a refund for a payment.
 * @param {string} paymentId
 */
export async function processRefund(paymentId) {
  try {
    const confirmed = await confirmDialog(`Process refund for payment ${paymentId}?`);
    if (!confirmed) return;
    showLoading(true);
    await call('admin/mutations:adminProcessRefund', { paymentId });
    showToast('Refund processed', 'success');
    await loadPayments({ cursor: null });
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Exports payments to CSV.
 * Uses the server-side export action if available, otherwise downloads from current data.
 * @param {string} [format='csv']
 */
export async function exportPayments(format = 'csv') {
  try {
    showLoading(true);
    if (format === 'csv') {
      // Try server-side export action (admin/actions:adminExportPayments)
      const result = await call('admin/actions:adminExportPayments', {});
      // result.downloadUrl should be a pre-signed URL; trigger download
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      } else {
        // Fallback: export current data
        exportCSV(currentPayments, 'payments.csv');
      }
    } else {
      // For other formats, use admin-exports.js
      exportCSV(currentPayments, `payments.${format}`);
    }
    showToast('Export started', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Renders the payments table.
 * @param {Array} payments
 * @param {string|null} cursor
 * @param {boolean} hasMoreData
 */
export function renderPaymentsTable(payments, cursor, hasMoreData) {
  const container = document.getElementById('payments-table-container');
  if (!container) return;

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Amount</th>
          <th>Date</th>
          <th>Status</th>
          <th>Reference</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  payments.forEach(p => {
    html += `
      <tr>
        <td>${p.userName || p.userId}</td>
        <td>${formatCurrency(p.amount)}</td>
        <td>${formatDate(p.timestamp || p.createdAt)}</td>
        <td>${p.status}</td>
        <td>${p.reference || '—'}</td>
        <td>
          <button onclick="window.adminPayments.processRefund('${p._id}')">Refund</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  if (hasMoreData || cursor) {
    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination';
    paginationDiv.innerHTML = '<button>Load More</button>';
    container.appendChild(paginationDiv);
  }
}

// Prompt helper for manual payment entry
window.adminPayments = {
  async showManualPaymentForm() {
    const userId = prompt('User ID:');
    const amount = parseFloat(prompt('Amount (KES):'));
    const reference = prompt('Reference (e.g. receipt number):');
    const planName = prompt('Plan name (monthly/quarterly/yearly):');
    if (userId && amount > 0 && reference && planName) {
      await recordManualPayment(userId, amount, reference, planName);
    } else {
      showToast('All fields required', 'error');
    }
  },
  processRefund,
  exportPayments
};