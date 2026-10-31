// Reset Password Page Script

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reset-form');
  const alertEl = document.getElementById('auth-alert');
  const submitBtn = document.getElementById('submit-btn');
  const tokenInput = document.getElementById('token');
  const passwordInput = document.getElementById('newPassword');
  const confirmInput = document.getElementById('confirmPassword');
  const meterBar = document.getElementById('password-meter-bar');
  const feedbackText = document.getElementById('password-feedback');

  // Extract reset token from URL query string
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');

  function showAlert(msg, isError = true) {
    alertEl.textContent = msg;
    alertEl.className = `auth-alert ${isError ? 'auth-alert-error' : 'auth-alert-success'} visible`;
  }

  function hideAlert() {
    alertEl.className = 'auth-alert';
    alertEl.textContent = '';
  }

  if (!tokenFromUrl) {
    showAlert('Missing reset token. Please use the link provided in your email.');
    submitBtn.disabled = true;
    return;
  }

  tokenInput.value = tokenFromUrl;

  passwordInput.addEventListener('input', () => {
    const val = passwordInput.value;
    let score = 0;
    if (val.length >= 9) score += 25;
    if (/[a-z]/.test(val)) score += 25;
    if (/[A-Z]/.test(val)) score += 25;
    if (/[^a-zA-Z0-9]/.test(val)) score += 25;

    meterBar.style.width = `${score}%`;
    if (score < 50) {
      meterBar.style.backgroundColor = '#ef4444';
      feedbackText.textContent = 'Weak: Must be >8 chars with upper, lower, & special symbol';
    } else if (score < 100) {
      meterBar.style.backgroundColor = '#f59e0b';
      feedbackText.textContent = 'Moderate: Include all character requirements';
    } else {
      meterBar.style.backgroundColor = '#10b981';
      feedbackText.textContent = 'Strong password meets security policy';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const newPassword = passwordInput.value;
    const confirmPassword = confirmInput.value;

    if (newPassword !== confirmPassword) {
      showAlert('Passwords do not match. Please re-enter.');
      return;
    }

    if (newPassword.length < 9 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[^a-zA-Z0-9]/.test(newPassword)) {
      showAlert('Password must be longer than 8 characters and include uppercase, lowercase, and special character.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Updating...</span>';

    try {
      const res = await api.post('/auth/reset-password', {
        token: tokenInput.value,
        newPassword,
      });

      showAlert(res.message || 'Password reset successful! Redirecting to login...', false);
      showToast('Password updated successfully!', 'success');
      form.reset();

      setTimeout(() => {
        window.location.href = '/login.html';
      }, 2000);
    } catch (err) {
      showAlert(err.message || 'Failed to reset password. The link may have expired.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Update Password</span>';
    }
  });
});
