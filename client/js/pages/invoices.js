// client/js/pages/invoices.js

async function loadInvoices() {
  const tbody = document.getElementById('invoices-tbody');
  const search = document.getElementById('inv-search')?.value.trim();
  const status = document.getElementById('inv-status-filter')?.value;
  const isOverdue = document.getElementById('inv-overdue-filter')?.checked;

  let query = '?';
  if (search) query += `search=${encodeURIComponent(search)}&`;
  if (status) query += `status=${encodeURIComponent(status)}&`;
  if (isOverdue) query += `isOverdue=true&`;

  try {
    const res = await api.get(`/invoices${query}`);
    const items = res.data?.items || [];

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--neutral-500); padding: 32px;">No invoices found.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map(
        (inv) => `
        <tr>
          <td><a href="invoice-detail.html?id=${inv.id}" style="font-weight: 600; color: var(--primary);">${inv.invoiceNumber}</a></td>
          <td>${inv.customerName || '—'}</td>
          <td style="font-size: 0.85rem; color: var(--neutral-600);">${api.formatDate(inv.billingPeriodStart)} – ${api.formatDate(inv.billingPeriodEnd)}</td>
          <td>${api.formatDate(inv.dueDate)}</td>
          <td style="text-align: right; font-weight: 600;">${api.formatCurrency(inv.totalAmount)}</td>
          <td style="text-align: right; color: var(--success); font-weight: 600;">${api.formatCurrency(inv.paidAmount)}</td>
          <td style="text-align: right; color: ${inv.outstandingAmount > 0 ? 'var(--danger)' : 'var(--neutral-500)'}; font-weight: 700;">
            ${api.formatCurrency(inv.outstandingAmount)}
          </td>
          <td>
            <span class="badge badge-${inv.status.toLowerCase().replace('_', '-')}">${inv.status}</span>
            ${inv.isOverdue ? '<span class="badge badge-overdue">⚠️ OVERDUE</span>' : ''}
          </td>
          <td>
            <a href="invoice-detail.html?id=${inv.id}" class="btn btn-secondary btn-sm">View</a>
            <a href="/api/invoices/${inv.id}/pdf" target="_blank" class="btn btn-secondary btn-sm">PDF</a>
          </td>
        </tr>
      `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--danger); padding: 32px;">Failed to load invoices.</td></tr>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadInvoices();
  document.getElementById('inv-search')?.addEventListener('input', () => {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(loadInvoices, 300);
  });
  document.getElementById('inv-status-filter')?.addEventListener('change', loadInvoices);
  document.getElementById('inv-overdue-filter')?.addEventListener('change', loadInvoices);
});

window.loadPageData = loadInvoices;

