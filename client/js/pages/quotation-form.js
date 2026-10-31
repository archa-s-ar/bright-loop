// client/js/pages/quotation-form.js

let availableProducts = [];
let availablePlans = [];

async function initForm() {
  try {
    // 1. Fetch Customers
    const custRes = await api.get('/customers');
    const customerSelect = document.getElementById('quote-customer-id');
    (custRes.data?.items || custRes.data || []).forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.companyName} (${c.email})`;
      customerSelect.appendChild(opt);
    });

    // 2. Fetch Plans
    const planRes = await api.get('/plans');
    availablePlans = planRes.data?.items || planRes.data || [];
    const planSelect = document.getElementById('quote-plan-id');
    availablePlans.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.billingCycle}) — ₹${p.planPrice} [${p.pricingMode}]`;
      planSelect.appendChild(opt);
    });

    // 3. Fetch Templates
    const tplRes = await api.get('/quotations/templates');
    const tplSelect = document.getElementById('quote-template-id');
    (tplRes.data?.items || []).forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (${t.plan?.name || 'Plan'})`;
      tplSelect.appendChild(opt);
    });

    // 4. Fetch Products for line items
    const prodRes = await api.get('/products');
    availableProducts = prodRes.data?.items || prodRes.data || [];
  } catch (err) {
    showToast('Failed to load customers, plans, or products', 'error');
  }
}

function addLineItem(initial = {}) {
  const container = document.getElementById('lines-container');
  const div = document.createElement('div');
  div.className = 'line-item-row';

  div.innerHTML = `
    <select class="form-control line-product-select" style="flex: 2;">
      <option value="">Select product...</option>
      ${availableProducts.map((p) => `<option value="${p.id}" ${initial.productId == p.id ? 'selected' : ''}>${p.name} (₹${p.salesPrice})</option>`).join('')}
    </select>
    <input type="number" class="form-control line-qty" value="${initial.quantity || 1}" min="1" style="width: 80px;" placeholder="Qty">
    <button type="button" class="btn btn-secondary btn-sm" onclick="this.parentElement.remove(); updateEstimate();">&times;</button>
  `;

  container.appendChild(div);
  div.querySelector('.line-product-select').addEventListener('change', updateEstimate);
  div.querySelector('.line-qty').addEventListener('input', updateEstimate);
  updateEstimate();
}

function updateEstimate() {
  const planId = document.getElementById('quote-plan-id').value;
  const plan = availablePlans.find((p) => p.id == planId);

  let basePrice = 0;
  if (plan) {
    basePrice = Number(plan.planPrice) || 0;
    document.getElementById('plan-pricing-info').innerHTML = `
      <strong>Plan:</strong> ${plan.name} (${plan.billingCycle})<br>
      <strong>Mode:</strong> ${plan.pricingMode === 'FIXED' ? 'FIXED (Base bundle price charged)' : 'ITEMIZED (Sum of product lines)'}
    `;
  }

  let addonsPrice = 0;
  document.querySelectorAll('.line-item-row').forEach((row) => {
    const pId = row.querySelector('.line-product-select').value;
    const qty = Number(row.querySelector('.line-qty').value) || 1;
    const prod = availableProducts.find((p) => p.id == pId);
    if (prod) {
      addonsPrice += (Number(prod.salesPrice) || 0) * qty;
    }
  });

  const subtotal = plan && plan.pricingMode === 'FIXED' ? basePrice + addonsPrice : addonsPrice || basePrice;
  const tax = subtotal * 0.18; // approx 18% GST estimate
  const total = subtotal + tax;

  document.getElementById('summary-base').textContent = api.formatCurrency(basePrice);
  document.getElementById('summary-addons').textContent = api.formatCurrency(addonsPrice);
  document.getElementById('summary-tax').textContent = api.formatCurrency(tax);
  document.getElementById('summary-total').textContent = api.formatCurrency(total);
}

document.addEventListener('DOMContentLoaded', () => {
  initForm();
  document.getElementById('add-line-btn').addEventListener('click', () => addLineItem());
  document.getElementById('quote-plan-id').addEventListener('change', updateEstimate);

  document.getElementById('quote-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const customerId = document.getElementById('quote-customer-id').value;
    const planId = document.getElementById('quote-plan-id').value;
    const templateId = document.getElementById('quote-template-id').value;
    const validityDays = document.getElementById('quote-validity').value;
    const discountName = document.getElementById('quote-promo-code').value.trim();

    const lines = [];
    document.querySelectorAll('.line-item-row').forEach((row) => {
      const productId = row.querySelector('.line-product-select').value;
      const quantity = row.querySelector('.line-qty').value;
      if (productId) {
        lines.push({ productId: Number(productId), quantity: Number(quantity) });
      }
    });

    try {
      const res = await api.post('/quotations', {
        customerId: Number(customerId),
        planId: Number(planId),
        templateId: templateId ? Number(templateId) : null,
        validityDays: Number(validityDays) || 30,
        discountName: discountName || null,
        lines,
      });

      showToast('Quotation drafted successfully!', 'success');
      setTimeout(() => {
        window.location.href = `quotation-detail.html?id=${res.data.id}`;
      }, 800);
    } catch (err) {
      // Toast already shown by api wrapper
    }
  });
});

