// client/js/pages/quotations.js

async function loadQuotations() {
  const tbody = document.getElementById('quotations-tbody');
  const search = document.getElementById('quote-search')?.value.trim();
  const status = document.getElementById('quote-status-filter')?.value;

  let query = '?';
  if (search) query += `search=${encodeURIComponent(search)}&`;
  if (status) query += `status=${encodeURIComponent(status)}&`;

  try {
    const res = await api.get(`/quotations${query}`);
    const items = res.data?.items || [];

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--neutral-500); padding: 32px;">No quotations found.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map(
        (q) => `
        <tr>
          <td><a href="quotation-detail.html?id=${q.id}" style="font-weight: 600; color: var(--primary);">${q.quotationNumber}</a></td>
          <td>${q.customer?.companyName || '—'}</td>
          <td>${api.formatDate(q.quotationDate)}</td>
          <td>${api.formatDate(q.expiryDate)}</td>
          <td style="font-weight: 600;">${api.formatCurrency(q.totalAmount)}</td>
          <td><span class="badge badge-${q.status.toLowerCase()}">${q.status}</span></td>
          <td>
            <a href="quotation-detail.html?id=${q.id}" class="btn btn-secondary btn-sm">View</a>
            <a href="/api/quotations/${q.id}/pdf" target="_blank" class="btn btn-secondary btn-sm">PDF</a>
          </td>
        </tr>
      `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 32px;">Failed to load quotations.</td></tr>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadQuotations();
  document.getElementById('quote-search')?.addEventListener('input', () => {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(loadQuotations, 300);
  });
  document.getElementById('quote-status-filter')?.addEventListener('change', loadQuotations);
});

window.loadPageData = loadQuotations;

