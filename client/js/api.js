// client/js/api.js - Brightloop API Client & Utilities

const API_BASE = '/api';

const state = {
  role: localStorage.getItem('brightloop_role') || 'ADMIN',
  token: localStorage.getItem('brightloop_token') || null
};

/**
 * Switch role dynamically and request a valid JWT dev token.
 */
async function setRole(newRole) {
  try {
    const res = await fetch(`${API_BASE}/auth/dev-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole })
    });
    const data = await res.json();
    if (data.success) {
      state.role = newRole;
      state.token = data.token;
      localStorage.setItem('brightloop_role', newRole);
      localStorage.setItem('brightloop_token', data.token);
      showToast(`Switched active role to ${newRole}`, 'info');
      // Reload current page data if page defines loadData()
      if (typeof window.loadPageData === 'function') {
        window.loadPageData();
      }
    }
  } catch (err) {
    console.error('Failed to switch role:', err);
    showToast('Failed to generate role token', 'error');
  }
}

// Initialize token on first launch if empty
(async function initAuth() {
  if (!state.token) {
    await setRole(state.role);
  }
  // Setup role switcher in header if present
  const select = document.getElementById('global-role-select');
  if (select) {
    select.value = state.role;
    select.addEventListener('change', (e) => setRole(e.target.value));
  }
})();

/**
 * Reusable fetch wrapper with automatic JWT authorization headers and error handling.
 */
async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.errors
        ? data.errors.map(e => `${e.path}: ${e.message}`).join(', ')
        : (data.message || 'Request failed');
      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  }
}

/**
 * Currency Formatter (INR)
 */
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Date Formatter
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Toast Notification Dispatcher
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span><button style="border:none;background:none;cursor:pointer;font-weight:bold;margin-left:8px;" onclick="this.parentElement.remove()">&times;</button>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Modal helper
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

window.api = {
  request,
  setRole,
  formatCurrency,
  formatDate,
  showToast,
  openModal,
  closeModal,
  getRole: () => state.role
};

