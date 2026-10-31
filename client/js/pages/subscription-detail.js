// client/js/pages/subscription-detail.js

const urlParams = new URLSearchParams(window.location.search);
const subId = urlParams.get('id');

async function loadSubscription() {
  if (!subId) {
    showToast('No subscription ID provided', 'error');
    return;
  }

  try {
    const res = await api.get(`/subscriptions/${subId}`);
    const s = res.data;

    document.getElementById('sub-number').textContent = s.subscriptionNumber;
    document.getElementById('sub-customer-name').textContent = s.customer?.companyName || '—';

    const statusBadge = document.getElementById('sub-status-badge');
    statusBadge.className = `badge badge-${s.status.toLowerCase()}`;
    statusBadge.textContent = s.status;

    document.getElementById('sub-cycle').textContent = s.billingCycle;
    document.getElementById('sub-start-date').textContent = api.formatDate(s.startDate);
    document.getElementById('sub-last-billed').textContent = s.lastBillingDate ? api.formatDate(s.lastBillingDate) : 'Not billed yet';
    document.getElementById('sub-next-billing').textContent = s.nextBillingDate ? api.formatDate(s.nextBillingDate) : 'Paused/Closed';
    document.getElementById('sub-terms').textContent = s.paymentTermsDays ? `Net ${s.paymentTermsDays} Days` : 'Due upon receipt';

    document.getElementById('sub-plan-desc').innerHTML = `
      <strong>Plan:</strong> ${s.plan?.name || '—'} &nbsp;|&nbsp; 
      <strong>Mode:</strong> ${s.plan?.pricingMode || 'FIXED'} &nbsp;|&nbsp; 
      <strong>Base Price:</strong> ${api.formatCurrency(s.plan?.planPrice || 0)}/${s.billingCycle.toLowerCase()}
    `;

    // Lines table
    const tbody = document.getElementById('sub-lines-tbody');
    if ((s.lines || []).length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--neutral-500); padding: 16px;">Fixed plan base bundle.</td></tr>`;
    } else {
      tbody.innerHTML = s.lines
        .map(
          (l) => `
          <tr>
            <td><strong>${l.descriptionSnapshot}</strong></td>
            <td style="text-align: center;">${l.quantity}</td>
            <td style="text-align: right;">${api.formatCurrency(l.unitPrice)}</td>
            <td style="text-align: right; font-weight: 600;">${api.formatCurrency(Number(l.unitPrice) * l.quantity)}</td>
          </tr>
        `
        )
        .join('');
    }

    // Invoices table
    const invTbody = document.getElementById('sub-invoices-tbody');
    if ((s.invoices || []).length === 0) {
      invTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--neutral-500); padding: 16px;">No invoices generated yet.</td></tr>`;
    } else {
      invTbody.innerHTML = s.invoices
        .map(
          (inv) => `
          <tr>
            <td><a href="invoice-detail.html?id=${inv.id}" style="font-weight: 600; color: var(--primary);">${inv.invoiceNumber}</a></td>
            <td>${api.formatDate(inv.invoiceDate)}</td>
            <td>${api.formatDate(inv.dueDate)}</td>
            <td style="font-weight: 600;">${api.formatCurrency(inv.totalAmount)}</td>
            <td><span class="badge badge-${inv.status.toLowerCase().replace('_', '-')}">${inv.status}</span></td>
            <td><a href="invoice-detail.html?id=${inv.id}" class="btn btn-secondary btn-sm">View</a></td>
          </tr>
        `
        )
        .join('');
    }

    // Action Controls visibility
    const btnActivate = document.getElementById('btn-activate');
    const btnPause = document.getElementById('btn-pause');
    const btnResume = document.getElementById('btn-resume');
    const btnRenew = document.getElementById('btn-renew');
    const btnClose = document.getElementById('btn-close');
    const btnGenInvoice = document.getElementById('btn-gen-invoice');

    btnActivate.style.display = s.status === 'CONFIRMED' ? 'inline-block' : 'none';
    btnPause.style.display = s.status === 'ACTIVE' ? 'inline-block' : 'none';
    btnResume.style.display = s.status === 'PAUSED' ? 'inline-block' : 'none';
    btnClose.style.display = ['ACTIVE', 'PAUSED'].includes(s.status) ? 'inline-block' : 'none';

    btnActivate.onclick = () => doAction('activate');
    btnPause.onclick = () => doAction('pause', 'Paused by user request');
    btnResume.onclick = () => doAction('resume', 'Resumed by user request');
    btnRenew.onclick = () => doAction('renew');
    btnClose.onclick = () => doAction('close', 'Subscription closed by request');
    btnGenInvoice.onclick = generateManualInvoice;

    // Load History Timeline
    loadHistory();
  } catch (err) {
    showToast('Failed to load subscription details', 'error');
  }
}

async function loadHistory() {
  try {
    const res = await api.get(`/subscriptions/${subId}/history`);
    const history = res.data || [];
    const container = document.getElementById('history-timeline');

    if (history.length === 0) {
      container.innerHTML = '<div style="color: var(--neutral-400); font-size: 0.85rem;">No history records found.</div>';
      return;
    }

    container.innerHTML = history
      .map(
        (h) => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div style="font-weight: 600; font-size: 0.9rem;">Status changed to ${h.newStatus}</div>
          <div style="color: var(--neutral-500); font-size: 0.8rem;">
            ${api.formatDate(h.changedAt)} by ${h.changedBy?.fullName || 'System'}
          </div>
          ${h.reason ? `<div style="font-size: 0.85rem; color: var(--neutral-700); margin-top: 4px;">"${h.reason}"</div>` : ''}
        </div>
      `
      )
      .join('');
  } catch (err) {
    // handled
  }
}

async function doAction(action, reason = null) {
  if (!confirm(`Are you sure you want to ${action} this subscription?`)) return;
  try {
    await api.post(`/subscriptions/${subId}/${action}`, { reason });
    showToast(`Subscription ${action}d successfully`, 'success');
    loadSubscription();
  } catch (err) {
    // handled
  }
}

async function generateManualInvoice() {
  if (!confirm('Generate a new billing invoice for this subscription now?')) return;
  try {
    const res = await api.post('/invoices', { subscriptionId: Number(subId) });
    showToast(`Invoice ${res.data.invoiceNumber} created!`, 'success');
    loadSubscription();
  } catch (err) {
    // handled
  }
}

document.addEventListener('DOMContentLoaded', loadSubscription);
window.loadPageData = loadSubscription;

