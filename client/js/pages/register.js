// Registration Page Script

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.redirectIfLoggedIn();

  const form = document.getElementById('register-form');
  const alertEl = document.getElementById('auth-alert');
  const submitBtn = document.getElementById('register-btn');
  const passwordInput = document.getElementById('password');
  const meterBar = document.getElementById('password-meter-bar');
  const feedbackText = document.getElementById('password-feedback');
  const scoreText = document.getElementById('password-score');

  function showAlert(msg, isError = true) {
    alertEl.textContent = msg;
    alertEl.className = `auth-alert ${isError ? 'auth-alert-error' : 'auth-alert-success'} visible`;
  }

  function hideAlert() {
    alertEl.className = 'auth-alert';
    alertEl.textContent = '';
  }

  // Live Password Strength Meter
  passwordInput.addEventListener('input', () => {
    const val = passwordInput.value;
    let score = 0;

    const hasMinLen = val.length >= 9;
    const hasLower = /[a-z]/.test(val);
    const hasUpper = /[A-Z]/.test(val);
    const hasSpecial = /[^a-zA-Z0-9]/.test(val);

    if (hasMinLen) score += 25;
    if (hasLower) score += 25;
    if (hasUpper) score += 25;
    if (hasSpecial) score += 25;

    meterBar.style.width = `${score}%`;

    if (score < 50) {
      meterBar.style.backgroundColor = '#ef4444';
      feedbackText.textContent = 'Weak: Must be >8 chars with upper, lower, & special symbol';
      scoreText.textContent = 'Weak';
      scoreText.style.color = '#ef4444';
    } else if (score < 100) {
      meterBar.style.backgroundColor = '#f59e0b';
      feedbackText.textContent = 'Moderate: Include all character requirements';
      scoreText.textContent = 'Moderate';
      scoreText.style.color = '#f59e0b';
    } else {
      meterBar.style.backgroundColor = '#10b981';
      feedbackText.textContent = 'Strong password meets all security rules';
      scoreText.textContent = 'Strong';
      scoreText.style.color = '#10b981';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const companyName = document.getElementById('companyName').value.trim();
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const phone = document.getElementById('phone').value.trim();
    const taxRegistrationNumber = document.getElementById('taxRegistrationNumber').value.trim();
    const billingAddress = document.getElementById('billingAddress').value.trim();

    if (!companyName || !fullName || !email || !password) {
      showAlert('Please fill in all required fields marked with *');
      return;
    }

    if (password.length < 9 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
      showAlert('Password must be longer than 8 characters and include uppercase, lowercase, and special characters.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Creating Account...</span>';

    try {
      const payload = {
        companyName,
        fullName,
        email,
        password,
        phone: phone || null,
        taxRegistrationNumber: taxRegistrationNumber || null,
        billingAddress: billingAddress || null,
      };

      const res = await api.post('/auth/register', payload);
      showToast('Registration successful! Redirecting...', 'success');

      setTimeout(() => {
        window.location.href = Auth.getDashboardPath(res.data.user.role);
      }, 1000);
    } catch (err) {
      showAlert(err.message || 'Registration failed. Please check your inputs.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Create Customer Account</span>';
    }
  });
});
