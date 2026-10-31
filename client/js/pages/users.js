// User & Staff Management Page Script

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await Auth.requireAuth(['ADMIN']);
  if (!currentUser) return;

  const tableBody = document.getElementById('users-table-body');
  const searchInput = document.getElementById('search-input');
  const roleFilter = document.getElementById('role-filter');
  const statusFilter = document.getElementById('status-filter');

  // Modal elements
  const staffModal = document.getElementById('staff-modal');
  const openModalBtn = document.getElementById('open-staff-modal-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelModalBtn = document.getElementById('cancel-modal-btn');
  const staffForm = document.getElementById('create-staff-form');
  const modalAlert = document.getElementById('modal-alert');
  const saveStaffBtn = document.getElementById('save-staff-btn');

  function openModal() {
    modalAlert.className = 'auth-alert';
    modalAlert.textContent = '';
    staffForm.reset();
    staffModal.classList.add('open');
  }

  function closeModal() {
    staffModal.classList.remove('open');
  }

  openModalBtn.addEventListener('click', openModal);
  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);

  async function loadUsers() {
    const params = new URLSearchParams();
    if (searchInput.value.trim()) params.append('search', searchInput.value.trim());
    if (roleFilter.value) params.append('role', roleFilter.value);
    if (statusFilter.value) params.append('isActive', statusFilter.value);

    try {
      const res = await api.get(`/users?${params.toString()}`);
      renderTable(res.data.users);
    } catch (err) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #f87171; padding: 24px;">
            Failed to load users: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  function renderTable(users) {
    if (!users || users.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">
            No users found matching the filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = users
      .map((u) => {
        const isSelf = u.id === currentUser.id;
        const orgName = u.customer ? u.customer.companyName : '<span style="color: var(--text-faint);">Internal</span>';
        const roleBadge = `<span class="badge badge-${u.role.toLowerCase()}">${u.role}</span>`;
        const statusBadge = u.isActive
          ? `<span class="badge badge-active">Active</span>`
          : `<span class="badge badge-inactive">Deactivated</span>`;
        const lastLogin = u.lastLoginAt
          ? new Date(u.lastLoginAt).toLocaleString()
          : '<span style="color: var(--text-faint);">Never</span>';

        const toggleBtn = isSelf
          ? '<span style="font-size: 0.75rem; color: var(--text-faint);">(Current)</span>'
          : `<button class="btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-secondary'}" onclick="toggleStatus(${u.id}, ${!u.isActive})">
               ${u.isActive ? 'Deactivate' : 'Activate'}
             </button>`;

        return `
          <tr>
            <td>
              <div style="font-weight: 600;">${u.fullName}</div>
              <div style="font-size: 0.8rem; color: var(--text-faint);">${u.email}</div>
            </td>
            <td>${roleBadge}</td>
            <td>${orgName}</td>
            <td>${statusBadge}</td>
            <td>${lastLogin}</td>
            <td>${toggleBtn}</td>
          </tr>
        `;
      })
      .join('');
  }

  // Live filter handlers
  searchInput.addEventListener('input', debounce(loadUsers, 300));
  roleFilter.addEventListener('change', loadUsers);
  statusFilter.addEventListener('change', loadUsers);

  // Toggle user activation status
  window.toggleStatus = async (id, newStatus) => {
    const actionWord = newStatus ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${actionWord} this user account?`)) {
      return;
    }

    try {
      await api.patch(`/users/${id}/status`, { isActive: newStatus });
      showToast(`User account ${actionWord}d successfully`, 'success');
      loadUsers();
    } catch (err) {
      showToast(err.message || `Failed to ${actionWord} account`, 'error');
    }
  };

  // Create Staff Submission
  staffForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    modalAlert.className = 'auth-alert';

    const fullName = document.getElementById('staff-name').value.trim();
    const email = document.getElementById('staff-email').value.trim();
    const password = document.getElementById('staff-password').value;

    if (!fullName || !email || !password) {
      modalAlert.textContent = 'Please fill in all required fields';
      modalAlert.className = 'auth-alert auth-alert-error visible';
      return;
    }

    saveStaffBtn.disabled = true;
    saveStaffBtn.textContent = 'Creating...';

    try {
      await api.post('/users/staff', { fullName, email, password });
      showToast('Staff member account created successfully!', 'success');
      closeModal();
      loadUsers();
    } catch (err) {
      modalAlert.textContent = err.message || 'Failed to create staff account';
      modalAlert.className = 'auth-alert auth-alert-error visible';
    } finally {
      saveStaffBtn.disabled = false;
      saveStaffBtn.textContent = 'Create Staff';
    }
  });

  function debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Initial load
  loadUsers();
});
