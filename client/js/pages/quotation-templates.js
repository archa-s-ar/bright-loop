// client/js/pages/quotation-templates.js

async function loadTemplates() {
  const tbody = document.getElementById('templates-tbody');
  try {
    const res = await api.get('/quotations/templates');
    const items = res.data?.items || [];

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--neutral-500); padding: 32px;">No templates configured yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map(
        (t) => `
        <tr>
          <td><strong>${t.name}</strong><br><small style="color: var(--neutral-500);">${t.description || ''}</small></td>
          <td>${t.plan ? `${t.plan.name} (${t.plan.billingCycle})` : '—'}</td>
          <td>${t.validityDays} days</td>
          <td>${t.paymentTerms || 'Standard'}</td>
          <td><span class="badge ${t.isActive ? 'badge-active' : 'badge-closed'}">${t.isActive ? 'ACTIVE' : 'INACTIVE'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="deactivateTemplate(${t.id})">Deactivate</button>
          </td>
        </tr>
      `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 32px;">Failed to load templates.</td></tr>`;
  }
}

async function loadPlans() {
  try {
    const res = await api.get('/plans');
    const select = document.getElementById('tpl-plan-id');
    (res.data?.items || res.data || []).forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.billingCycle}) — ₹${p.planPrice}`;
      select.appendChild(opt);
    });
  } catch (err) {
    // handled
  }
}

async function deactivateTemplate(id) {
  if (!confirm('Deactivate this quotation template?')) return;
  try {
    await api.delete(`/quotations/templates/${id}`);
    showToast('Template deactivated', 'info');
    loadTemplates();
  } catch (err) {
    // handled
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadTemplates();
  loadPlans();

  document.getElementById('template-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('tpl-name').value;
    const planId = document.getElementById('tpl-plan-id').value;
    const validityDays = document.getElementById('tpl-validity').value;
    const paymentTerms = document.getElementById('tpl-terms').value;
    const description = document.getElementById('tpl-desc').value;

    try {
      await api.post('/quotations/templates', {
        name,
        planId: Number(planId),
        validityDays: Number(validityDays) || 30,
        paymentTerms: paymentTerms || null,
        description: description || null,
      });

      showToast('Quotation template created', 'success');
      closeModal('create-template-modal');
      document.getElementById('template-form').reset();
      loadTemplates();
    } catch (err) {
      // handled
    }
  });
});

window.loadPageData = loadTemplates;

