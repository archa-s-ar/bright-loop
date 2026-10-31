// Login Page Script

document.addEventListener('DOMContentLoaded', async () => {
  // If already logged in, redirect straight to their dashboard
  await Auth.redirectIfLoggedIn();

  const form = document.getElementById('login-form');
  const alertEl = document.getElementById('auth-alert');
  const submitBtn = document.getElementById('login-btn');

  function showAlert(msg, isError = true) {
    alertEl.textContent = msg;
    alertEl.className = `auth-alert ${isError ? 'auth-alert-error' : 'auth-alert-success'} visible`;
  }

  function hideAlert() {
    alertEl.className = 'auth-alert';
    alertEl.textContent = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showAlert('Please enter both email and password.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Signing In...</span>';

    try {
      const res = await api.post('/auth/login', { email, password });
      showToast('Signed in successfully!', 'success');

      // Check URL parameters for returnUrl
      const urlParams = new URLSearchParams(window.location.search);
      const returnUrl = urlParams.get('returnUrl');

      if (returnUrl && returnUrl.startsWith('/')) {
        window.location.href = returnUrl;
      } else {
        window.location.href = Auth.getDashboardPath(res.data.user.role);
      }
    } catch (err) {
      showAlert(err.message || 'Login failed. Please check your credentials.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Sign In</span>';
    }
  });
});
