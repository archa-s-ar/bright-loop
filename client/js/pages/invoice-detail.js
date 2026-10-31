// client/js/pages/invoice-detail.js

const urlParams = new URLSearchParams(window.location.search);
const invoiceId = urlParams.get('id');
let currentInvoice = null;

async function loadInvoice() {
  if (!invoiceId) {
    showToast('No invoice ID provided', 'error');
    return;
  }

  try {
    const res = await api.get(`/invoices/${invoiceId}`);
    const inv = res.data;
    currentInvoice = inv;

    document.getElementById('inv-number').textContent = inv.invoiceNumber;
    document.getElementById('inv-customer-name').textContent = inv.customer?.companyName || '—';
    document.getElementById('btn-download-pdf').href = `/api/invoices/${inv.id}/pdf`;

    const statusBadge = document.getElementById('inv-status-badge');
    statusBadge.className = `badge badge-${inv.status.toLowerCase().replace('_', '-')}`;
    statusBadge.textContent = inv.status;

    const overdueTag = document.getElementById('inv-overdue-tag');
    if (inv.isOverdue) {
      overdueTag.innerHTML = '<span class="badge badge-overdue">⚠️ OVERDUE</span>';
    } else {
      overdueTag.innerHTML = '';
    }

    document.getElementById('inv-date').textContent = api.formatDate(inv.invoiceDate);
    document.getElementById('inv-due').textContent = api.formatDate(inv.dueDate);
    document.getElementById('inv-window').textContent = `${api.formatDate(inv.billingPeriodStart)} – ${api.formatDate(inv.billingPeriodEnd)}`;

    if (inv.subscription) {
      document.getElementById('inv-sub-link').innerHTML = `
        <a href="subscription-detail.html?id=${inv.subscription.id}" style="color: var(--primary); font-weight: 600;">
          ${inv.subscription.subscriptionNumber} (${inv.subscription.plan?.name || 'Plan'})
        </a>
      `;
    }

    // Balance & Totals
    document.getElementById('inv-subtotal').textContent = api.formatCurrency(inv.subtotal);
    document.getElementById('inv-discount').textContent = inv.discountTotal > 0 ? `-${api.formatCurrency(inv.discountTotal)}` : '₹0.00';
    document.getElementById('inv-tax').textContent = api.formatCurrency(inv.taxTotal);
    document.getElementById('inv-total').textContent = api.formatCurrency(inv.totalAmount);
    document.getElementById('inv-paid').textContent = api.formatCurrency(inv.paidAmount);
    document.getElementById('inv-balance').textContent = api.formatCurrency(inv.outstandingAmount);

    // Line items
    const linesTbody = document.getElementById('inv-lines-tbody');
    linesTbody.innerHTML = (inv.lines || [])
      .map(
        (l) => `
        <tr>
          <td>
            <strong>${l.descriptionSnapshot}</strong>
            ${(l.taxes || []).map((t) => `<br><small style="color:var(--neutral-500);">${t.taxNameSnapshot} (${(Number(t.taxRateSnapshot) * 100).toFixed(1)}%): ${api.formatCurrency(t.taxAmount)}</small>`).join('')}
          </td>
          <td style="text-align: center;">${l.quantity}</td>
          <td style="text-align: right;">${api.formatCurrency(l.unitPrice)}</td>
          <td style="text-align: right;">${api.formatCurrency(l.taxAmount)}</td>
          <td style="text-align: right; font-weight: 600;">${api.formatCurrency(l.lineTotal)}</td>
        </tr>
      `
      )
      .join('');

    // Payment Allocations
    const paymentsTbody = document.getElementById('inv-payments-tbody');
    const allocations = inv.paymentAllocations || [];
    if (allocations.length === 0) {
      paymentsTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--neutral-500); padding: 16px;">No payments allocated to this invoice yet.</td></tr>';
    } else {
      paymentsTbody.innerHTML = allocations
        .map(
          (pa) => `
          <tr>
            <td><strong>${pa.payment?.paymentReference || 'Payment'}</strong></td>
            <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${pa.payment?.paymentMethod || 'GATEWAY'}</span></td>
            <td>${api.formatDate(pa.payment?.paymentDate || pa.allocatedAt)}</td>
            <td style="text-align: right; font-weight: 600; color: var(--success);">${api.formatCurrency(pa.allocatedAmount)}</td>
            <td><span class="badge badge-${(pa.payment?.status || 'SUCCEEDED').toLowerCase()}">${pa.payment?.status || 'SUCCEEDED'}</span></td>
          </tr>
        `
        )
        .join('');
    }

    // Action Controls
    const btnPay = document.getElementById('btn-pay-now');
    const btnConfirm = document.getElementById('btn-confirm-invoice');
    const btnCancel = document.getElementById('btn-cancel-invoice');

    const hasBalance = Number(inv.outstandingAmount) > 0;
    btnPay.style.display = ['CONFIRMED', 'PARTIALLY_PAID'].includes(inv.status) && hasBalance ? 'inline-block' : 'none';
    btnConfirm.style.display = inv.status === 'DRAFT' ? 'inline-block' : 'none';
    btnCancel.style.display = ['DRAFT', 'CONFIRMED'].includes(inv.status) && Number(inv.paidAmount) === 0 ? 'inline-block' : 'none';

    btnPay.onclick = initiateRazorpayCheckout;
    btnConfirm.onclick = confirmInvoice;
    btnCancel.onclick = cancelInvoice;
  } catch (err) {
    showToast('Failed to load invoice details', 'error');
  }
}

async function confirmInvoice() {
  try {
    await api.post(`/invoices/${invoiceId}/confirm`);
    showToast('Invoice confirmed!', 'success');
    loadInvoice();
  } catch (err) {
    // handled
  }
}

async function cancelInvoice() {
  if (!confirm('Cancel this invoice? This action cannot be undone.')) return;
  try {
    await api.post(`/invoices/${invoiceId}/cancel`);
    showToast('Invoice cancelled', 'info');
    loadInvoice();
  } catch (err) {
    // handled
  }
}

/**
 * Razorpay Online Checkout Integration Bridge
 */
async function initiateRazorpayCheckout() {
  if (!currentInvoice) return;

  try {
    showToast('Initializing payment gateway...', 'info');

    // 1. Create order on backend
    const res = await api.post('/payments/create-order', {
      invoiceId: Number(invoiceId),
    });

    const orderData = res.data;

    // 2. Setup Razorpay Checkout options
    const options = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'Brightloop Software',
      description: `Payment for ${orderData.invoiceNumber}`,
      order_id: orderData.orderId,
      prefill: {
        name: orderData.customerName,
        email: orderData.customerEmail,
      },
      theme: {
        color: '#2563eb',
      },
      handler: async function (response) {
        // 3. Verify signature on backend upon payment completion
        try {
          showToast('Verifying payment signature with gateway...', 'info');
          const verifyRes = await api.post('/payments/verify', {
            invoiceId: Number(invoiceId),
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          showToast('Payment successful & credited to invoice!', 'success');
          loadInvoice();
        } catch (vErr) {
          showToast('Gateway verification failed: ' + vErr.message, 'error');
        }
      },
      modal: {
        ondismiss: function () {
          showToast('Payment window closed', 'info');
        },
      },
    };

    // If Razorpay SDK is loaded, open popup modal; otherwise simulate success in dev test mode
    if (window.Razorpay && !orderData.keyId.includes('placeholder')) {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      // Dev Sandbox Simulator
      const simulate = confirm(
        `[SANDBOX SIMULATOR] Razorpay credentials are in test mode.\n\nSimulate successful payment of ${api.formatCurrency(orderData.amountRupees)} for ${orderData.invoiceNumber}?`
      );

      if (simulate) {
        await api.post('/payments/verify', {
          invoiceId: Number(invoiceId),
          razorpay_order_id: orderData.orderId,
          razorpay_payment_id: `pay_sim_${Date.now()}`,
          razorpay_signature: 'simulated_valid_test_signature',
        });
        showToast('Simulated payment succeeded!', 'success');
        loadInvoice();
      }
    }
  } catch (err) {
    showToast('Checkout initialization failed: ' + err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', loadInvoice);
window.loadPageData = loadInvoice;

