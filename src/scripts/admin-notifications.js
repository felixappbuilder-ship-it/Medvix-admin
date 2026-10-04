// src/scripts/admin-notifications.js
import { call, query } from './admin-api.js';
import { showToast, formatDate, showLoading } from './admin-utils.js';

let allUsers = [];
let selectedUserIds = new Set();

// ============================================================
// TEMPLATE DEFINITIONS
// ============================================================
const TEMPLATES = {
  welcome: {
    title: 'Welcome to Medical Exam Room Pro! 🎉',
    message: `
      <div class="notif-card" style="font-family: 'Segoe UI', Arial; padding: 14px; border-radius: 8px; background: #eff6ff; border-left: 4px solid #3b82f6;">
        <p><strong>Welcome, {{user.name}}!</strong></p>
        <p>We're excited to have you on board. Start your medical exam preparation today.</p>
        <button class="btn-primary" data-action="navigate" data-route="subjects">Start Studying</button>
      </div>
    `
  },
  payment_success: {
    title: '✅ Payment Successful',
    message: `
      <div class="notif-card" style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 14px; border-radius: 8px;">
        <p><strong>Payment Successful!</strong></p>
        <p>KES {{amount}} for <strong>{{plan}}</strong> (Receipt: {{receipt}})</p>
        <button class="btn-primary" data-action="navigate" data-route="subscription">View Subscription</button>
      </div>
    `
  },
  payment_failed: {
    title: '❌ Payment Failed',
    message: `
      <div class="notif-card" style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 14px; border-radius: 8px;">
        <p><strong>Payment Failed</strong></p>
        <p>KES {{amount}} for <strong>{{plan}}</strong> – {{reason}}</p>
        <button class="btn-primary" data-action="navigate" data-route="subscription">Retry</button>
      </div>
    `
  },
  exam_result: {
    title: '📊 Exam Complete!',
    message: `
      <div class="notif-card" style="background: #fefce8; border-left: 4px solid #eab308; padding: 14px; border-radius: 8px;">
        <p><strong>Exam Complete!</strong></p>
        <p>{{subject}} – Score: <strong>{{score}}%</strong></p>
        <button class="btn-primary" data-action="navigate" data-route="results" data-exam-id="{{examId}}">View Details</button>
      </div>
    `
  },
  challenge_invite: {
    title: '🤝 Challenge Invite',
    message: `
      <div class="notif-card" style="background: #f3e8ff; border-left: 4px solid #a855f7; padding: 14px; border-radius: 8px;">
        <p><strong>Challenge Invite</strong></p>
        <p><strong>{{inviter}}</strong> invited you to a challenge!</p>
        <button class="btn-primary" data-action="navigate" data-route="challenge" data-challenge-code="{{challengeCode}}">Join Challenge</button>
      </div>
    `
  },
  subscription_expiry: {
    title: '⏳ Subscription Expiring Soon',
    message: `
      <div class="notif-card" style="background: #fefce8; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 8px;">
        <p><strong>Subscription Expiring Soon</strong></p>
        <p>Your subscription expires on <strong>{{expiryDate}}</strong>.</p>
        <button class="btn-primary" data-action="navigate" data-route="subscription">Renew Now</button>
      </div>
    `
  },
  note_shared: {
    title: '📝 Note Shared',
    message: `
      <div class="notif-card" style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 14px; border-radius: 8px;">
        <p><strong>Note Shared</strong></p>
        <p><strong>{{sharer}}</strong> shared a note: <em>{{noteTitle}}</em></p>
        <button class="btn-primary" data-action="navigate" data-route="note" data-note-id="{{noteId}}">View Note</button>
      </div>
    `
  },
  custom: {
    title: '',
    message: ''
  }
};

// ============================================================
// INITIALISATION
// ============================================================
export async function initNotificationsPage() {
  document.getElementById('send-notification-btn')?.addEventListener('click', sendNotification);
  await loadAllUsers();
  await loadRecentNotifications();
  setupTargetMode();
  setupTemplateButtons();
  setupVariableInsertion();
  setupPreview();
}

// ============================================================
// LOAD USERS
// ============================================================
async function loadAllUsers() {
  try {
    const data = await query('admin/queries:adminGetAllUsers', { limit: 1000 });
    allUsers = data.users || [];
  } catch (error) {
    console.warn('Failed to load users for picker', error);
    allUsers = [];
  }
}

// ============================================================
// TARGET MODE & USER PICKER
// ============================================================
function setupTargetMode() {
  const targetSelect = document.getElementById('notification-target');
  const specificArea = document.getElementById('specific-users-area');
  if (!targetSelect || !specificArea) return;

  targetSelect.addEventListener('change', () => {
    specificArea.style.display = targetSelect.value === 'specific' ? 'block' : 'none';
  });

  const searchInput = document.getElementById('user-search-input');
  const resultsDiv = document.getElementById('user-search-results');
  searchInput?.addEventListener('input', () => {
    const term = searchInput.value.toLowerCase();
    resultsDiv.innerHTML = '';
    if (!term) return;
    const matches = allUsers
      .filter(u => (u.name || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term))
      .slice(0, 10);
    matches.forEach(user => {
      const div = document.createElement('div');
      div.className = 'search-result-item';
      div.textContent = `${user.name} (${user.email})`;
      div.addEventListener('click', () => {
        selectedUserIds.add(user._id);
        renderSelectedUsers();
        searchInput.value = '';
        resultsDiv.innerHTML = '';
      });
      resultsDiv.appendChild(div);
    });
  });

  renderSelectedUsers();
}

function renderSelectedUsers() {
  const container = document.getElementById('selected-users-list');
  if (!container) return;
  container.innerHTML = '';
  selectedUserIds.forEach(id => {
    const user = allUsers.find(u => u._id === id);
    if (!user) return;
    const chip = document.createElement('span');
    chip.className = 'user-chip';
    chip.textContent = `${user.name} ✕`;
    chip.addEventListener('click', () => {
      selectedUserIds.delete(id);
      renderSelectedUsers();
    });
    container.appendChild(chip);
  });
}

// ============================================================
// TEMPLATE BUTTONS
// ============================================================
function setupTemplateButtons() {
  const buttons = document.querySelectorAll('.template-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const templateKey = btn.dataset.template;
      const template = TEMPLATES[templateKey];
      if (!template) return;
      document.getElementById('notification-title').value = template.title;
      document.getElementById('notification-message').value = template.message;
      updatePreview(); // trigger preview update
    });
  });
}

// ============================================================
// VARIABLE INSERTION
// ============================================================
function setupVariableInsertion() {
  const codes = document.querySelectorAll('.variable-help code');
  const messageArea = document.getElementById('notification-message');
  codes.forEach(code => {
    code.addEventListener('click', () => {
      const varText = code.dataset.var;
      const start = messageArea.selectionStart;
      const end = messageArea.selectionEnd;
      const text = messageArea.value;
      messageArea.value = text.substring(0, start) + varText + text.substring(end);
      messageArea.focus();
      const newCursor = start + varText.length;
      messageArea.setSelectionRange(newCursor, newCursor);
      updatePreview(); // update preview after insertion
    });
  });
}

// ============================================================
// LIVE PREVIEW
// ============================================================
function setupPreview() {
  const titleInput = document.getElementById('notification-title');
  const messageInput = document.getElementById('notification-message');
  titleInput?.addEventListener('input', updatePreview);
  messageInput?.addEventListener('input', updatePreview);
  // Initial preview
  updatePreview();
}

function updatePreview() {
  const title = document.getElementById('notification-title').value || 'No title';
  const message = document.getElementById('notification-message').value || '';
  const previewBox = document.getElementById('preview-box');

  // Replace variables with example values (for preview)
  let previewMessage = message;
  const sampleData = {
    'user.name': 'John Doe',
    'user.email': 'john@example.com',
    'plan': 'Monthly',
    'amount': '350',
    'expiryDate': '2025-12-31',
    'examId': 'EX123',
    'score': '85',
    'subject': 'Anatomy',
    'challengeCode': 'ABCD',
    'shareToken': 'abc123',
    'receipt': 'RCP-001',
    'inviter': 'Jane Smith',
    'noteTitle': 'Study Notes',
    'noteId': 'note_456',
    'reason': 'Insufficient funds'
  };

  // Replace {{var}} with sample values
  for (const [key, value] of Object.entries(sampleData)) {
    previewMessage = previewMessage.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Remove any remaining {{...}} placeholders
  previewMessage = previewMessage.replace(/{{[^}]+}}/g, '[variable]');

  previewBox.innerHTML = `
    <div style="margin-bottom: 0.5rem; font-weight: bold;">${title}</div>
    <div class="preview-content">${previewMessage}</div>
  `;
}

// ============================================================
// SEND NOTIFICATION
// ============================================================
async function sendNotification() {
  const title = document.getElementById('notification-title').value.trim();
  const message = document.getElementById('notification-message').value.trim();
  const target = document.getElementById('notification-target').value;

  if (!title || !message) {
    showToast('Title and message are required', 'error');
    return;
  }

  let targetUserIds = undefined;
  if (target === 'specific') {
    if (selectedUserIds.size === 0) {
      showToast('Please select at least one user', 'error');
      return;
    }
    targetUserIds = Array.from(selectedUserIds);
  }

  try {
    showLoading(true);
    await call('admin/actions:adminBroadcastNotification', {
      title,
      message,
      target: target === 'specific' ? undefined : target,
      targetUserIds,
    });
    showToast('Notification sent successfully', 'success');
    // Clear form (except maybe keep template)
    document.getElementById('notification-title').value = '';
    document.getElementById('notification-message').value = '';
    selectedUserIds.clear();
    renderSelectedUsers();
    updatePreview();
    await loadRecentNotifications();
  } catch (error) {
    console.error('[Admin Notifications] Send error:', error);
    showToast(error.message || 'Failed to send notification', 'error');
  } finally {
    showLoading(false);
  }
}

// ============================================================
// LOAD RECENT NOTIFICATIONS
// ============================================================
async function loadRecentNotifications() {
  try {
    const data = await query('admin/queries:adminGetNotifications', { limit: 20 });
    renderNotifications(data.notifications || []);
  } catch (error) {
    console.error('[Admin Notifications] Load error:', error);
    showToast('Could not load recent broadcasts', 'warning');
  }
}

function renderNotifications(notifications) {
  const container = document.getElementById('notifications-list');
  if (!container) return;
  if (!notifications || !notifications.length) {
    container.innerHTML = '<p>No notifications sent yet.</p>';
    return;
  }
  container.innerHTML = notifications.map(n => `
    <div class="notification-item">
      <h4>${escapeHtml(n.title)}</h4>
      <p>${escapeHtml(n.message)}</p>
      <small>Sent: ${formatDate(n.createdAt || n.sentAt)}</small>
    </div>
  `).join('');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}