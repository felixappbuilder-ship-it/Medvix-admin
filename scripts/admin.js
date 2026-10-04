// src/scripts/admin.js
import { checkAuth } from './admin-auth.js';

export function renderSidebar() {
  const container = document.getElementById('sidebar-container');
  if (!container) return;

  const currentPage = document.body.getAttribute('data-page');
  const links = [
    { href: '/pages/dashboard.html', icon: '📊', text: 'Dashboard', page: 'dashboard' },
    { href: '/pages/users.html', icon: '👥', text: 'Users', page: 'users' },
    { href: '/pages/subscriptions.html', icon: '📅', text: 'Subscriptions', page: 'subscriptions' },
    { href: '/pages/payments.html', icon: '💳', text: 'Payments', page: 'payments' },
    { href: '/pages/agents.html', icon: '🤝', text: 'Agents', page: 'agents' },
    { href: '/pages/withdrawals.html', icon: '💸', text: 'Withdrawals', page: 'withdrawals' },
    { href: '/pages/reversals.html', icon: '↩️', text: 'Reversals', page: 'reversals' },
    { href: '/pages/notifications.html', icon: '🔔', text: 'Notifications', page: 'notifications' },
    { href: '/pages/mpesa-debug.html', icon: '📡', text: 'M‑Pesa Debug', page: 'mpesa-debug' },
    { href: '/pages/analytics.html', icon: '📈', text: 'Analytics', page: 'analytics' },
    { href: '/pages/security.html', icon: '🔒', text: 'Security', page: 'security' },
    { href: '/pages/settings.html', icon: '⚙️', text: 'Settings', page: 'settings' },
    { href: '/pages/backups.html', icon: '💾', text: 'Backups', page: 'backups' },
    { href: '/pages/logs.html', icon: '📋', text: 'Logs', page: 'logs' },
  ];

  let html = '<ul class="sidebar-nav">';
  links.forEach(link => {
    const active = currentPage === link.page ? ' class="active"' : '';
    html += `<li${active}><a href="${link.href}">${link.icon} ${link.text}</a></li>`;
  });
  html += '</ul>';
  container.innerHTML = html;
}

export function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('adminTheme', isDark ? 'dark' : 'light');
}

export function applySavedTheme() {
  const saved = localStorage.getItem('adminTheme');
  if (saved === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
}

export function initApp() {
  if (!checkAuth()) {
    window.location.href = '/pages/login.html';
    return;
  }
  applySavedTheme();
  renderSidebar();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
}

export function logout() {
  localStorage.removeItem('adminToken');
  window.location.href = '/pages/login.html';
}