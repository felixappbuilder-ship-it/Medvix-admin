// src/scripts/admin-reports.js
import { query } from './admin-api.js';
import { showToast, showLoading } from './admin-utils.js';
import { exportCSV, exportJSON, exportPDF } from './admin-exports.js';

/**
 * Generates and downloads a user report (CSV).
 */
export async function generateUserReport() {
  try {
    showLoading(true);
    // Fetch all users (may need to handle pagination fully)
    const data = await query('admin/queries:adminGetAllUsers', { limit: 1000 });
    if (data.users.length === 0) {
      showToast('No users to export', 'info');
      return;
    }
    exportCSV(data.users, `users-report-${new Date().toISOString()}.csv`);
    showToast('User report downloaded', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Generates and downloads a payment report (CSV) for a date range.
 * @param {string} [startDate] - ISO date string
 * @param {string} [endDate] - ISO date string
 */
export async function generatePaymentReport(startDate, endDate) {
  try {
    showLoading(true);
    // Use adminExportPayments action if available, else fallback to query
    let payments;
    try {
      payments = await query('admin/queries:adminGetAllPayments', { startDate, endDate, limit: 1000 });
      payments = payments.payments;
    } catch {
      // Fallback: use server-side action (might return download URL)
      const result = await call('admin/actions:adminExportPayments', { startDate, endDate });
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
        return;
      } else {
        throw new Error('No data received');
      }
    }
    exportCSV(payments, `payments-report-${startDate || 'all'}-${endDate || 'all'}.csv`);
    showToast('Payment report downloaded', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Generates and downloads a subscription report.
 */
export async function generateSubscriptionReport() {
  try {
    showLoading(true);
    const data = await query('admin/queries:adminGetAllSubscriptions', { limit: 1000 });
    if (data.subscriptions.length === 0) {
      showToast('No subscriptions to export', 'info');
      return;
    }
    exportCSV(data.subscriptions, `subscriptions-report-${new Date().toISOString()}.csv`);
    showToast('Subscription report downloaded', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// Attach to global for button clicks
window.adminReports = {
  generateUserReport,
  generatePaymentReport,
  generateSubscriptionReport
};