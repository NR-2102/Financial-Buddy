// ==============================================================
// MONEY ARNOLD — CHART.JS CONTROLLERS & GAUGES
// ==============================================================

// ==============================================================
// CHART.JS CONTROLLERS
// ==============================================================
function destroyCharts() {
  Object.keys(state.charts).forEach(key => {
    if (state.charts[key]) {
      state.charts[key].destroy();
      delete state.charts[key];
    }
  });
}

function initCashFlowChart() {
  const canvas = document.getElementById('chart-cash-flow');
  if (!canvas || typeof Chart === 'undefined') return;

  const fin = computeFinancialState();
  const ctx = canvas.getContext('2d');

  // Multi-day labels depending on filter
  let labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  let incomeData = [fin.monthlyIncome * 0.25, fin.monthlyIncome * 0.25, fin.monthlyIncome * 0.25, fin.monthlyIncome * 0.25];
  let expenseData = [fin.monthlyExpenses * 0.25, fin.monthlyExpenses * 0.25, fin.monthlyExpenses * 0.25, fin.monthlyExpenses * 0.25];

  if (state.periodFilter === '7d') {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    incomeData = [0, 0, 0, 0, fin.monthlyIncome * 0.2, 0, 0];
    expenseData = fin.monthlyExpenses > 0
      ? [fin.monthlyExpenses * 0.1, fin.monthlyExpenses * 0.05, fin.monthlyExpenses * 0.2, fin.monthlyExpenses * 0.15, fin.monthlyExpenses * 0.15, fin.monthlyExpenses * 0.25, fin.monthlyExpenses * 0.1]
      : [0, 0, 0, 0, 0, 0, 0];
  } else if (state.periodFilter === '3m') {
    labels = ['Month -2', 'Month -1', 'Current Month'];
    incomeData = [fin.monthlyIncome, fin.monthlyIncome, fin.monthlyIncome];
    expenseData = [fin.monthlyExpenses, fin.monthlyExpenses, fin.monthlyExpenses];
  } else if (state.periodFilter === '6m') {
    labels = ['Month -5', 'Month -4', 'Month -3', 'Month -2', 'Month -1', 'Current Month'];
    incomeData = [fin.monthlyIncome, fin.monthlyIncome, fin.monthlyIncome, fin.monthlyIncome, fin.monthlyIncome, fin.monthlyIncome];
    expenseData = [fin.monthlyExpenses, fin.monthlyExpenses, fin.monthlyExpenses, fin.monthlyExpenses, fin.monthlyExpenses, fin.monthlyExpenses];
  }

  state.charts['cashFlow'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Inflow / Income',
          data: incomeData,
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: 'Outflow / Expenses',
          data: expenseData,
          backgroundColor: 'rgba(59, 130, 246, 0.75)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#334155', font: { family: 'Plus Jakarta Sans', size: 12 } }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString()}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0, 0, 0, 0.06)' },
          ticks: { color: '#475569', font: { family: 'Plus Jakarta Sans' } }
        },
        y: {
          grid: { color: 'rgba(0, 0, 0, 0.06)' },
          ticks: {
            color: '#475569',
            font: { family: 'Plus Jakarta Sans' },
            callback: (val) => '₹' + Number(val).toLocaleString()
          }
        }
      }
    }
  });
}

function initSpendingDonutChart() {
  const canvas = document.getElementById('chart-spending-donut');
  if (!canvas || typeof Chart === 'undefined') return;

  const ctx = canvas.getContext('2d');

  // Derive categories & spending
  const categoryTotals = {};
  state.transactions.forEach(t => {
    if (t.type !== 'income') {
      const cat = t.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(t.amount || 0);
    }
  });

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);
  const hasData = data.length > 0 && data.some(v => v > 0);

  state.charts['spendingDonut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: hasData ? labels : ['No Outflows Recorded'],
      datasets: [
        {
          data: hasData ? data : [1],
          backgroundColor: hasData ? [
            '#3b82f6',
            '#8b5cf6',
            '#06b6d4',
            '#f59e0b',
            '#10b981',
            '#ec4899',
            '#64748b'
          ] : ['#e2e8f0'],
          borderColor: '#ffffff',
          borderWidth: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#334155', font: { family: 'Plus Jakarta Sans', size: 12 } }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          callbacks: {
            label: (ctx) => hasData ? ` ${ctx.label}: ₹${ctx.parsed.toLocaleString()}` : ' No spending recorded yet'
          }
        }
      }
    }
  });
}

