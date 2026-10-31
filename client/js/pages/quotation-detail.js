// client/js/pages/quotation-detail.js

const urlParams = new URLSearchParams(window.location.search);
const quoteId = urlParams.get('id');

async function loadQuotation() {
  if (!quoteId) {
    showToast('No quotation ID specified', 'error');
    return;
  }

  try {
    const res = await api.get(`/quotations/${quoteId}`);
    const q = res.data;

    document.getElementById('q-number').textContent = q.quotationNumber;
    document.getElementById('q-customer-name').textContent = q.customer?.companyName || '—';
    document.getElementById('btn-download-pdf').href = `/api/quotations/${q.id}/pdf`;

    const statusBadge = document.getElementById('q-status-badge');
    statusBadge.className = `badge badge-${q.status.toLowerCase()}`;
    statusBadge.textContent = q.status;

    document.getElementById('q-date').textContent = api.formatDate(q.quotationDate);
    document.getElementById('q-expiry').textContent = api.formatDate(q.expiryDate);

    if (q.subscription) {
      document.getElementById('q-linked-sub').innerHTML = `
        <a href="subscription-detail.html?id=${q.subscription.id}" style="color: var(--primary); font-weight: 600;">
          ${q.subscription.subscriptionNumber} (${q.subscription.status})
        </a>
      `;
    } else {
      document.getElementById('q-linked-sub').textContent = 'None';
    }

    // Totals
    document.getElementById('q-subtotal').textContent = api.formatCurrency(q.subtotal);
    document.getElementById('q-discount').textContent = q.discountTotal > 0 ? `-${api.formatCurrency(q.discountTotal)}` : '₹0.00';
    document.getElementById('q-tax').textContent = api.formatCurrency(q.taxTotal);
    document.getElementById('q-total').textContent = api.formatCurrency(q.totalAmount);

    // Lines Table
    const tbody = document.getElementById('quote-lines-tbody');
    tbody.innerHTML = (q.lines || [])
      .map(
        (l) => `
        <tr>
          <td>
            <strong>${l.descriptionSnapshot}</strong>
            ${l.product ? `<br><small style="color: var(--neutral-500);">${l.product.name}</small>` : ''}
          </td>
          <td style="text-align: center;">${l.quantity}</td>
          <td style="text-align: right;">${api.formatCurrency(l.unitPrice)}</td>
          <td style="text-align: right;">${api.formatCurrency(l.taxAmount)}</td>
          <td style="text-align: right; font-weight: 600;">${api.formatCurrency(l.lineTotal)}</td>
        </tr>
      `
      )
      .join('');

    // Lifecycle Action Buttons
    const btnSend = document.getElementById('btn-send');
    const btnAccept = document.getElementById('btn-accept');
    const btnReject = document.getElementById('btn-reject');
    const btnConvert = document.getElementById('btn-convert');

    btnSend.style.display = q.status === 'DRAFT' ? 'inline-block' : 'none';
    btnAccept.style.display = q.status === 'SENT' ? 'inline-block' : 'none';
    btnReject.style.display = q.status === 'SENT' ? 'inline-block' : 'none';
    btnConvert.style.display = q.status === 'ACCEPTED' ? 'inline-block' : 'none';

    btnSend.onclick = () => doTransition('send');
    btnAccept.onclick = () => doTransition('accept');
    btnReject.onclick = () => doTransition('reject');
    btnConvert.onclick = doConvert;
  } catch (err) {
    showToast('Failed to load quotation details', 'error');
  }
}

async function doTransition(action) {
  try {
    await api.post(`/quotations/${quoteId}/${action}`);
    showToast(`Quotation status updated (${action})`, 'success');
    loadQuotation();
  } catch (err) {
    // handled by api wrapper
  }
}

async function doConvert() {
  if (!confirm('Convert this accepted proposal into an active Subscription?')) return;
  try {
    const res = await api.post(`/quotations/${quoteId}/convert`, {});
    showToast('Converted to live Subscription successfully!', 'success');
    setTimeout(() => {
      window.location.href = `subscription-detail.html?id=${res.data.id}`;
    }, 800);
  } catch (err) {
    // handled by api wrapper
  }
}

document.addEventListener('DOMContentLoaded', loadQuotation);
window.loadPageData = loadQuotation;

