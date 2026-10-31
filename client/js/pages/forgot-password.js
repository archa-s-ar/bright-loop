// Forgot Password Page Script

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgot-form');
  const alertEl = document.getElementById('auth-alert');
  const submitBtn = document.getElementById('submit-btn');

  function showAlert(msg, isError = true) {
    alertEl.textContent = msg;
    alertEl.className = `auth-alert ${isError ? 'auth-alert-error' : 'auth-alert-success'} visible`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();

    if (!email) {
      showAlert('Please enter your account email.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Sending Link...</span>';

    try {
      const res = await api.post('/auth/forgot-password', { email });
      showAlert(
        res.message || 'If an account exists with this email, a password reset link has been dispatched.',
        false
      );
      showToast('Reset request received!', 'success');
      form.reset();
    } catch (err) {
      showAlert(err.message || 'Unable to process reset request. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Send Reset Link</span>';
    }
  });
});
