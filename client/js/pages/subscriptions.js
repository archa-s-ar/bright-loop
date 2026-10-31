// client/js/pages/subscriptions.js

async function loadSubscriptions() {
  const tbody = document.getElementById('subs-tbody');
  const search = document.getElementById('sub-search')?.value.trim();
  const status = document.getElementById('sub-status-filter')?.value;

  let query = '?';
  if (search) query += `search=${encodeURIComponent(search)}&`;
  if (status) query += `status=${encodeURIComponent(status)}&`;

  try {
    const res = await api.get(`/subscriptions${query}`);
    const items = res.data?.items || [];

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--neutral-500); padding: 32px;">No subscriptions found.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map(
        (s) => `
        <tr>
          <td><a href="subscription-detail.html?id=${s.id}" style="font-weight: 600; color: var(--primary);">${s.subscriptionNumber}</a></td>
          <td>${s.customer?.companyName || '—'}</td>
          <td>${s.plan?.name || '—'}</td>
          <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${s.billingCycle}</span></td>
          <td>${s.nextBillingDate ? api.formatDate(s.nextBillingDate) : '<span style="color:var(--neutral-400);">None</span>'}</td>
          <td><span class="badge badge-${s.status.toLowerCase()}">${s.status}</span></td>
          <td>
            <a href="subscription-detail.html?id=${s.id}" class="btn btn-secondary btn-sm">Manage</a>
          </td>
        </tr>
      `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 32px;">Failed to load subscriptions.</td></tr>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadSubscriptions();
  document.getElementById('sub-search')?.addEventListener('input', () => {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(loadSubscriptions, 300);
  });
  document.getElementById('sub-status-filter')?.addEventListener('change', loadSubscriptions);
});

window.loadPageData = loadSubscriptions;

