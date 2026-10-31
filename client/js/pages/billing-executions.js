// client/js/pages/billing-executions.js

async function loadExecutions() {
  const tbody = document.getElementById('executions-tbody');
  try {
    const res = await api.get('/billing/executions');
    const items = res.data?.items || [];

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--neutral-500); padding: 32px;">No billing executions logged yet. Click "Run Billing Engine Now" to trigger a run.</td></tr>';
      return;
    }

    tbody.innerHTML = items
      .map(
        (ex) => `
        <tr>
          <td>#${ex.id}</td>
          <td>
            <a href="subscription-detail.html?id=${ex.subscriptionId}" style="color: var(--primary); font-weight: 600;">
              ${ex.subscription?.subscriptionNumber || `Sub #${ex.subscriptionId}`}
            </a>
          </td>
          <td>${ex.subscription?.customer?.companyName || '—'}</td>
          <td style="font-size: 0.85rem;">${api.formatDate(ex.billingPeriodStart)} – ${api.formatDate(ex.billingPeriodEnd)}</td>
          <td>
            ${
              ex.invoice
                ? `<a href="invoice-detail.html?id=${ex.invoice.id}" style="font-weight: 600; color: var(--primary);">${ex.invoice.invoiceNumber} (${api.formatCurrency(ex.invoice.totalAmount)})</a>`
                : '<span style="color: var(--neutral-400);">None</span>'
            }
          </td>
          <td style="text-align: center;">${ex.attemptCount}</td>
          <td>
            <span class="badge ${ex.status === 'SUCCESS' ? 'badge-active' : ex.status === 'FAILED' ? 'badge-rejected' : 'badge-draft'}">
              ${ex.status}
            </span>
            ${ex.errorMessage ? `<br><small style="color:var(--danger);">${ex.errorMessage}</small>` : ''}
          </td>
          <td style="font-size: 0.85rem; color: var(--neutral-500);">${api.formatDate(ex.executedAt)}</td>
        </tr>
      `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 32px;">Failed to load billing execution history.</td></tr>';
  }
}

async function triggerManualBillingRun() {
  const btn = document.getElementById('btn-trigger-cron');
  btn.disabled = true;
  btn.textContent = '⏳ Billing Engine Running...';

  try {
    const res = await api.post('/billing/run', {});
    const r = res.data;
    showToast(
      `Billing run finished: ${r.successful} billed, ${r.skipped} skipped, ${r.failed} failed.`,
      r.failed > 0 ? 'warning' : 'success'
    );
    loadExecutions();
  } catch (err) {
    showToast('Failed to trigger billing run: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Run Billing Engine Now';
  }
}

document.addEventListener('DOMContentLoaded', loadExecutions);
window.loadPageData = loadExecutions;

