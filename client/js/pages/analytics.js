// client/js/pages/analytics.js

let agingChartInstance = null;
let paymentMethodsChartInstance = null;

async function loadAnalytics() {
  try {
    // 1. Load Overview KPIs
    const overviewRes = await api.get('/analytics/overview');
    const o = overviewRes.data;

    document.getElementById('kpi-mrr').textContent = api.formatCurrency(o.mrr);
    document.getElementById('kpi-arr').textContent = api.formatCurrency(o.arr);
    document.getElementById('kpi-cash').textContent = api.formatCurrency(o.cashCollected);
    document.getElementById('kpi-invoiced').textContent = api.formatCurrency(o.invoicedRevenue);
    document.getElementById('kpi-outstanding').textContent = api.formatCurrency(o.outstandingAmount);
    document.getElementById('kpi-overdue').textContent = api.formatCurrency(o.overdueAmount);
    document.getElementById('kpi-overdue-sub').textContent = `${o.overdueCount || 0} overdue invoice(s)`;

    // 2. Load Aging Report
    const agingRes = await api.get('/analytics/aging');
    const aging = agingRes.data;
    renderAgingChart(aging);

    // 3. Load Payment Methods Breakdown
    const pmRes = await api.get('/analytics/payment-methods');
    const methods = pmRes.data || [];
    renderPaymentMethodsChart(methods);
  } catch (err) {
    showToast('Failed to load financial analytics: ' + err.message, 'error');
  }
}

function renderAgingChart(aging) {
  const ctx = document.getElementById('agingChart')?.getContext('2d');
  if (!ctx) return;

  if (agingChartInstance) agingChartInstance.destroy();

  const labels = ['Current (Not Due)', '1 - 30 Days', '31 - 60 Days', '60+ Days'];
  const values = [
    Number(aging.current.amount) || 0,
    Number(aging.days1_30.amount) || 0,
    Number(aging.days31_60.amount) || 0,
    Number(aging.days60_plus.amount) || 0,
  ];

  agingChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function (context) {
              return ` ${context.label}: ${api.formatCurrency(context.raw)}`;
            },
          },
        },
      },
    },
  });
}

function renderPaymentMethodsChart(methods) {
  const ctx = document.getElementById('paymentMethodsChart')?.getContext('2d');
  if (!ctx) return;

  if (paymentMethodsChartInstance) paymentMethodsChartInstance.destroy();

  const labels = methods.map((m) => m.method);
  const data = methods.map((m) => Number(m.amount) || 0);

  paymentMethodsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length > 0 ? labels : ['No payments recorded'],
      datasets: [
        {
          label: 'Total Collected (INR)',
          data: data.length > 0 ? data : [0],
          backgroundColor: '#4f46e5',
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              return ` Collected: ${api.formatCurrency(context.raw)}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => '₹' + val,
          },
        },
      },
    },
  });
}

document.addEventListener('DOMContentLoaded', loadAnalytics);
window.loadPageData = loadAnalytics;

