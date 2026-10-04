// src/scripts/admin-mpesa-debug.js
import { call, query } from './admin-api.js';
import { showToast, formatDate, formatCurrency, showLoading } from './admin-utils.js';

export async function initMpesaDebugPage() {
  document.getElementById('verify-stk-btn')?.addEventListener('click', () => triggerVerification('admin/actions:adminTriggerStkVerification', 'STK verification started'));
  document.getElementById('verify-b2c-btn')?.addEventListener('click', () => triggerVerification('admin/actions:adminTriggerB2CVerification', 'B2C verification started'));
  document.getElementById('verify-balance-btn')?.addEventListener('click', () => triggerVerification('admin/actions:adminTriggerBalanceVerification', 'Balance verification started'));
  document.getElementById('verify-status-btn')?.addEventListener('click', () => triggerVerification('admin/actions:adminTriggerStatusVerification', 'Status verification started'));
  document.getElementById('check-balance-btn')?.addEventListener('click', checkBalance);
  await loadWebhookLogs();
}

async function triggerVerification(path, successMsg) {
  try {
    showLoading(true);
    await call(path, {});
    showToast(successMsg, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function checkBalance() {
  try {
    showLoading(true);
    const data = await query('admin/queries:adminGetMpesaBalance', {});
    const display = document.getElementById('balance-display');
    if (display) {
      display.textContent = `Current M-Pesa Balance: ${formatCurrency(data.balance)}`;
    }
    showToast('Balance fetched', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function loadWebhookLogs() {
  try {
    const data = await query('admin/queries:adminGetWebhookLogs', { limit: 20 });
    renderWebhookLogs(data.logs || []);
  } catch (error) {
    showToast('Failed to load webhook logs: ' + error.message, 'error');
  }
}

function renderWebhookLogs(logs) {
  const container = document.getElementById('webhook-logs-container');
  if (!container) return;
  if (!logs.length) {
    container.innerHTML = '<p>No webhook logs found.</p>';
    return;
  }
  let html = `
    <table class="admin-table">
      <thead><tr><th>Time</th><th>Type</th><th>Status</th><th>Details</th></tr></thead>
      <tbody>
  `;
  logs.forEach(log => {
    html += `<tr><td>${formatDate(log.timestamp)}</td><td>${log.type}</td><td>${log.status}</td><td>${log.details || ''}</td></tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}