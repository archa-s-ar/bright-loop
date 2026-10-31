
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

// API Client & Notification Helpers

const API_BASE = '/api';


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


  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config = {
    ...options,
    method: options.method || 'GET',
    headers: { ...defaultHeaders, ...options.headers },
    credentials: options.credentials || 'include', // Guarantees HTTP-only cookie exchange
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage =
        data?.message ||
        (data?.errors && data.errors.map((e) => e.message).join(', ')) ||
        `Request failed with status ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    throw err;
  }
}

const api = {
  get: (endpoint, headers) => apiRequest(endpoint, { method: 'GET', headers }),
  post: (endpoint, body, headers) => apiRequest(endpoint, { method: 'POST', body, headers }),
  patch: (endpoint, body, headers) => apiRequest(endpoint, { method: 'PATCH', body, headers }),
  delete: (endpoint, headers) => apiRequest(endpoint, { method: 'DELETE', headers }),
};

window.api = api;
window.showToast = showToast;

