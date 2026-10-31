// client/js/pages/payments.js

let availableInvoices = [];

async function loadPayments() {
  const tbody = document.getElementById('payments-tbody');
  const method = document.getElementById('pay-method-filter')?.value;
  const status = document.getElementById('pay-status-filter')?.value;

  let query = '?';
  if (method) query += `paymentMethod=${encodeURIComponent(method)}&`;
  if (status) query += `status=${encodeURIComponent(status)}&`;

  try {
    const res = await api.get(`/payments${query}`);
    const items = res.data?.items || [];

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--neutral-500); padding: 32px;">No payment records found.</td></tr>';
      return;
    }

    tbody.innerHTML = items
      .map(
        (p) => `
        <tr>
          <td><strong style="color: var(--primary);">${p.paymentReference}</strong></td>
          <td>${p.customer?.companyName || '—'}</td>
          <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${p.paymentMethod}</span></td>
          <td>${api.formatDate(p.paymentDate || p.createdAt)}</td>
          <td><code>${p.transactionReference || p.providerPaymentId || '—'}</code></td>
          <td style="text-align: right; font-weight: 700; color: var(--success);">${api.formatCurrency(p.amount)}</td>
          <td>
            ${
              (p.allocations || []).length > 0
                ? p.allocations.map((a) => `<a href="invoice-detail.html?id=${a.invoiceId}" style="color:var(--primary); font-weight:600;">${a.invoice?.invoiceNumber || 'INV'} (₹${a.allocatedAmount})</a>`).join(', ')
                : '<span style="color:var(--neutral-400);">Unallocated Credit</span>'
            }
          </td>
          <td><span class="badge badge-${p.status.toLowerCase()}">${p.status}</span></td>
        </tr>
      `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 32px;">Failed to load payments.</td></tr>';
  }
}

async function openRecordPaymentModal() {
  // Populate customers
  try {
    const custRes = await api.get('/customers');
    const custSelect = document.getElementById('rec-customer-id');
    custSelect.innerHTML = '<option value="">Select customer...</option>';
    (custRes.data?.items || custRes.data || []).forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.companyName} (${c.email})`;
      custSelect.appendChild(opt);
    });

    document.getElementById('rec-date').value = new Date().toISOString().split('T')[0];
    openModal('record-payment-modal');
  } catch (err) {
    showToast('Failed to load customers for payment modal', 'error');
  }
}

// When customer changes in modal, load unpaid invoices for that customer
async function onCustomerChange(e) {
  const customerId = e.target.value;
  const invSelect = document.getElementById('rec-invoice-id');
  invSelect.innerHTML = '<option value="">Do not allocate immediately (Leave as unallocated credit)</option>';

  if (!customerId) return;

  try {
    const res = await api.get(`/invoices?customerId=${customerId}`);
    const invoices = (res.data?.items || []).filter((i) => ['CONFIRMED', 'PARTIALLY_PAID'].includes(i.status) && Number(i.outstandingAmount) > 0);

    invoices.forEach((inv) => {
      const opt = document.createElement('option');
      opt.value = inv.id;
      opt.dataset.balance = inv.outstandingAmount;
      opt.textContent = `${inv.invoiceNumber} — Balance Due: ₹${inv.outstandingAmount} (Due: ${api.formatDate(inv.dueDate)})`;
      invSelect.appendChild(opt);
    });
  } catch (err) {
    // handled
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadPayments();
  document.getElementById('pay-method-filter')?.addEventListener('change', loadPayments);
  document.getElementById('pay-status-filter')?.addEventListener('change', loadPayments);
  document.getElementById('rec-customer-id')?.addEventListener('change', onCustomerChange);

  document.getElementById('rec-invoice-id')?.addEventListener('change', (e) => {
    const selected = e.target.selectedOptions[0];
    if (selected && selected.dataset.balance) {
      document.getElementById('rec-amount').value = selected.dataset.balance;
    }
  });

  document.getElementById('record-payment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const customerId = document.getElementById('rec-customer-id').value;
    const amount = document.getElementById('rec-amount').value;
    const paymentMethod = document.getElementById('rec-method').value;
    const transactionReference = document.getElementById('rec-txn-ref').value.trim();
    const paymentDate = document.getElementById('rec-date').value;
    const note = document.getElementById('rec-note').value.trim();
    const invoiceId = document.getElementById('rec-invoice-id').value;

    const allocations = [];
    if (invoiceId) {
      allocations.push({
        invoiceId: Number(invoiceId),
        allocatedAmount: Number(amount),
      });
    }

    try {
      await api.post('/payments', {
        customerId: Number(customerId),
        amount: Number(amount),
        paymentMethod,
        transactionReference: transactionReference || null,
        paymentDate: paymentDate || null,
        note: note || null,
        allocations,
      });

      showToast('Payment recorded and allocated successfully!', 'success');
      closeModal('record-payment-modal');
      document.getElementById('record-payment-form').reset();
      loadPayments();
    } catch (err) {
      // handled
    }
  });
});

window.loadPageData = loadPayments;

