// Authentication Session & Route Protection Helper

const Auth = {
  currentUser: null,

  async checkSession() {
    try {
      const res = await window.api.get('/auth/me');
      if (res && res.data) {
        this.currentUser = res.data;
        return res.data;
      }
      return null;
    } catch (err) {
      this.currentUser = null;
      return null;
    }
  },

  getDashboardPath(role) {
    switch (role) {
      case 'ADMIN':
        return '/admin/dashboard.html';
      case 'STAFF':
        return '/staff/dashboard.html';
      case 'CUSTOMER':
        return '/customer/dashboard.html';
      default:
        return '/login.html';
    }
  },

  async redirectIfLoggedIn() {
    const user = await this.checkSession();
    if (user) {
      window.location.href = this.getDashboardPath(user.role);
    }
  },

  async requireAuth(allowedRoles = []) {
    const user = await this.checkSession();

    if (!user) {
      const returnUrl = encodeURIComponent(window.location.pathname);
      window.location.href = `/login.html?returnUrl=${returnUrl}`;
      return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      alert(`Access Restricted: This page requires one of [${allowedRoles.join(', ')}] permissions.`);
      window.location.href = this.getDashboardPath(user.role);
      return null;
    }

    this.renderUserProfile(user);
    return user;
  },

  renderUserProfile(user) {
    const nameEl = document.getElementById('user-full-name');
    const emailEl = document.getElementById('user-email');
    const roleEl = document.getElementById('user-role-badge');
    const avatarEl = document.getElementById('user-avatar');

    if (nameEl) nameEl.textContent = user.fullName;
    if (emailEl) emailEl.textContent = user.email;
    if (avatarEl) avatarEl.textContent = user.fullName.charAt(0).toUpperCase();

    if (roleEl) {
      roleEl.textContent = user.role;
      roleEl.className = `badge badge-${user.role.toLowerCase()}`;
    }
  },

  async logout() {
    try {
      await window.api.post('/auth/logout');
    } catch (e) {
      // ignore
    } finally {
      this.currentUser = null;
      window.location.href = '/login.html';
    }
  },
};

window.Auth = Auth;
