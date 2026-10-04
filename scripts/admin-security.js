// src/scripts/admin-security.js
import { call, query } from './admin-api.js';
import { showToast, confirmDialog, formatDate, showLoading } from './admin-utils.js';

let securityLogs = [];
let lockedUsers = [];

/**
 * Loads security event logs.
 * @param {Object} [params] - filter, limit, cursor
 */
export async function loadSecurityLogs(params = {}) {
  try {
    showLoading(true);
    const data = await query('admin/queries:adminGetSecurityLogs', params);
    securityLogs = data.logs;
    renderLogsTable(securityLogs);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Loads all users who are currently locked.
 */
export async function loadLockedUsers() {
  try {
    showLoading(true);
    // Fetch users with isLocked filter if supported; otherwise get all and filter.
    const data = await query('admin/queries:adminGetAllUsers', { filter: { isLocked: true } });
    lockedUsers = data.users;
    renderLockedUsersTable(lockedUsers);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Unlocks a user account.
 * @param {string} userId
 */
export async function unlockUser(userId) {
  try {
    const confirmed = await confirmDialog(`Unlock user ${userId}?`);
    if (!confirmed) return;
    showLoading(true);
    await call('admin/mutations:adminUpdateUser', { userId, updates: { isLocked: false } });
    showToast('User unlocked', 'success');
    await loadLockedUsers(); // refresh the list
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Renders the security logs table.
 * @param {Array} logs
 */
export function renderLogsTable(logs) {
  const container = document.getElementById('logs-table-container');
  if (!container) return;

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Event Type</th>
          <th>User</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
  `;

  logs.forEach(log => {
    html += `
      <tr>
        <td>${formatDate(log.timestamp)}</td>
        <td>${log.eventType}</td>
        <td>${log.userId || '—'}</td>
        <td>${log.details || ''}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

/**
 * Renders the locked users table.
 * @param {Array} users
 */
export function renderLockedUsersTable(users) {
  const container = document.getElementById('locked-users-container');
  if (!container) return;

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Email</th>
          <th>Lock Reason</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
  `;

  users.forEach(user => {
    html += `
      <tr>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.lockReason || 'N/A'}</td>
        <td><button onclick="window.adminSecurity.unlockUser('${user._id}')">Unlock</button></td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// Attach to global
window.adminSecurity = {
  unlockUser,
  refresh() {
    loadSecurityLogs();
    loadLockedUsers();
  }
};