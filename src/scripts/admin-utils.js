// src/scripts/admin-utils.js

/**
 * Formats an ISO timestamp or Date into a readable string.
 * @param {string|Date} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a number as Kenyan Shillings.
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Shows a generic modal with a title and HTML content.
 * @param {string} title
 * @param {string} contentHTML
 */
export function showModal(title, contentHTML) {
  const existing = document.getElementById('global-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'global-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close" id="modal-close-btn">×</button>
      </div>
      <div class="modal-body">${contentHTML}</div>
      <div class="modal-footer">
        <button class="btn-secondary" id="modal-close-footer">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  modal.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('#modal-close-footer').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

/**
 * Displays a confirmation dialog and returns a Promise.
 * @param {string} message - The confirmation message
 * @param {string} [confirmText='Yes'] - Text for the confirm button
 * @param {string} [cancelText='No'] - Text for the cancel button
 * @returns {Promise<boolean>} resolves to true if confirmed, false otherwise
 */
export function confirmDialog(message, confirmText = 'Yes', cancelText = 'No') {
  return new Promise((resolve) => {
    const existing = document.getElementById('confirm-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'confirm-dialog';
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Confirm</h2>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary confirm-no">${cancelText}</button>
          <button class="btn-primary confirm-yes">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    const cleanup = (result) => {
      dialog.remove();
      resolve(result);
    };

    dialog.querySelector('.confirm-yes').addEventListener('click', () => cleanup(true));
    dialog.querySelector('.confirm-no').addEventListener('click', () => cleanup(false));
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) cleanup(false);
    });
  });
}

/**
 * Displays a form modal with configurable fields.
 * @param {string} title - Modal title
 * @param {Array<{name: string, label: string, type?: string, placeholder?: string, value?: string, required?: boolean, options?: Array<{value: string, label: string}>}>} fields - Field definitions
 * @returns {Promise<Object|null>} Resolves with field values, or null if cancelled.
 */
export function showFormModal(title, fields) {
  return new Promise((resolve) => {
    const existing = document.getElementById('form-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'form-modal';
    modal.className = 'modal-overlay';

    let html = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" id="modal-close-btn">×</button>
        </div>
        <div class="modal-body">
    `;
    fields.forEach(field => {
      const type = field.type || 'text';
      const required = field.required ? 'required' : '';
      if (type === 'select') {
        html += `
          <div class="form-group">
            <label for="field-${field.name}">${field.label}</label>
            <select id="field-${field.name}" ${required}>
              ${(field.options || []).map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
            </select>
          </div>
        `;
      } else if (type === 'textarea') {
        html += `
          <div class="form-group">
            <label for="field-${field.name}">${field.label}</label>
            <textarea id="field-${field.name}" placeholder="${field.placeholder || ''}" ${required}>${field.value || ''}</textarea>
          </div>
        `;
      } else if (type === 'checkbox') {
        html += `
          <div class="form-group">
            <label>
              <input type="checkbox" id="field-${field.name}" ${field.value ? 'checked' : ''}> ${field.label}
            </label>
          </div>
        `;
      } else {
        html += `
          <div class="form-group">
            <label for="field-${field.name}">${field.label}</label>
            <input type="${type}" id="field-${field.name}" placeholder="${field.placeholder || ''}" value="${field.value || ''}" ${required}>
          </div>
        `;
      }
    });
    html += `
        </div>
        <div class="modal-footer">
          <button id="modal-submit-btn" class="btn-primary">Submit</button>
          <button id="modal-cancel-btn" class="btn-secondary">Cancel</button>
        </div>
      </div>
    `;
    modal.innerHTML = html;
    document.body.appendChild(modal);

    const closeModal = (result) => {
      modal.remove();
      resolve(result);
    };

    modal.querySelector('#modal-close-btn').addEventListener('click', () => closeModal(null));
    modal.querySelector('#modal-cancel-btn').addEventListener('click', () => closeModal(null));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(null);
    });

    modal.querySelector('#modal-submit-btn').addEventListener('click', () => {
      const values = {};
      for (const field of fields) {
        const input = modal.querySelector(`#field-${field.name}`);
        if (field.required && !input.value.trim()) {
          showToast(`${field.label} is required`, 'error');
          return;
        }
        if (field.type === 'checkbox') {
          values[field.name] = input.checked;
        } else {
          values[field.name] = input.value;
        }
      }
      closeModal(values);
    });

    // Focus first input/select
    setTimeout(() => {
      const first = modal.querySelector('input, select, textarea');
      if (first) first.focus();
    }, 100);
  });
}

/**
 * Displays a toast notification.
 * @param {string} message
 * @param {string} type - 'success', 'error', 'info', 'warning'
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Creates (or returns existing) toast container.
 */
export function createToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '10000';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Shows or hides a global loading spinner.
 * @param {boolean} visible
 */
export function showLoading(visible) {
  let spinner = document.getElementById('global-spinner');
  if (!visible) {
    if (spinner) spinner.style.display = 'none';
    return;
  }
  if (!spinner) {
    spinner = document.createElement('div');
    spinner.id = 'global-spinner';
    spinner.className = 'spinner-overlay';
    spinner.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(spinner);
  }
  spinner.style.display = 'flex';
}

/**
 * Creates pagination controls as an HTML element.
 * @param {number} totalItems
 * @param {number} currentPage - 0-based index
 * @param {function} callback - receives new page number
 * @returns {HTMLElement} pagination div element
 */
export function buildPagination(totalItems, currentPage, callback) {
  const paginationDiv = document.createElement('div');
  paginationDiv.className = 'pagination';
  const totalPages = Math.ceil(totalItems / 20); // assuming 20 per page
  for (let i = 0; i < totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i + 1;
    if (i === currentPage) btn.classList.add('active');
    btn.addEventListener('click', () => callback(i));
    paginationDiv.appendChild(btn);
  }
  return paginationDiv;
}

/**
 * Debounce function for search inputs.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}