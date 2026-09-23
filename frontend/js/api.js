// ==============================================================
// MONEY ARNOLD — BACKEND API, METRICS & DYNAMIC ALERTS
// ==============================================================

// ==============================================================
// BACKEND API & DATA SYNCHRONIZATION
// ==============================================================
async function checkBackendHealth() {
  const pill = document.getElementById('backend-status-pill');
  const text = document.getElementById('backend-status-text');
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error('Unhealthy');
    const data = await res.json();
    if (pill && text) {
      if (data.mock_fallback_enabled) {
        pill.className = 'status-pill';
        text.textContent = 'Foundry Simulation Mode';
      } else {
        pill.className = 'status-pill';
        text.textContent = 'Azure Foundry Connected';
      }
    }
  } catch (err) {
    if (pill && text) {
      pill.className = 'status-pill status-offline';
      text.textContent = 'Backend Offline';
    }
  }
}

async function loadFinancialData() {
  try {
    const res = await fetch(`${API_BASE}/api/financial-data`);
    if (!res.ok) return;
    const data = await res.json();

    state.profile = data.profile || state.profile;
    state.accounts = data.accounts || [];
    state.budgets = data.budgets || [];
    state.transactions = data.transactions || [];
    state.bills = data.bills || [];
    state.subscriptions = data.subscriptions || [];
    state.goals = data.goals || [];
    state.alerts = data.alerts || [];
    state.pending_action = data.pending_action || null;
    state.action_history = data.action_history || [];

    evaluateDynamicAlertsClient();
    updateBadgeCounts();
  } catch (err) {
    console.warn('Could not fetch financial data, using local fallback:', err);
    evaluateDynamicAlertsClient();
    updateBadgeCounts();
  }
}

function evaluateDynamicAlertsClient() {
  if (!state.budgets) return;

  const categorySpending = {};
  (state.transactions || []).forEach(t => {
    if (t.type !== 'income') {
      const cat = t.category || 'Other';
      categorySpending[cat] = (categorySpending[cat] || 0) + parseFloat(t.amount || 0);
    }
  });

  const c = (state.profile && state.profile.currency) || '₹';
  const existingAlerts = {};
  (state.alerts || []).forEach(a => {
    if (a.id) existingAlerts[a.id] = a;
  });

  const newAlerts = [];

  // 1. Dynamic Budget Alerts
  state.budgets.forEach(b => {
    const cat = b.category;
    const limit = parseFloat(b.amount || 0);
    if (!cat || limit <= 0) return;

    const spent = categorySpending[cat] || 0;
    const pct = Math.round((spent / limit) * 100);
    const remaining = Math.max(0, limit - spent);
    const alertId = `alert-budget-${cat.toLowerCase().replace(/\s+/g, '-')}`;
    const prev = existingAlerts[alertId];
    let prevStatus = prev ? prev.status : 'active';
    const prevPct = prev && prev.meta ? prev.meta.pct : 0;
    if (prevStatus === 'resolved' && pct > prevPct) {
      prevStatus = 'active';
    }

    if (pct >= 100) {
      newAlerts.push({
        id: alertId,
        level: 'danger',
        title: `${cat} Budget Exceeded (${pct}%)`,
        message: `You have spent ${c}${formatNumber(spent)} of your ${c}${formatNumber(limit)} ${cat} budget. Discretionary limit has been exceeded by ${c}${formatNumber(spent - limit)}.`,
        status: prevStatus,
        created_at: prev && prev.created_at ? prev.created_at : new Date().toISOString(),
        meta: { pct, category: cat, spent, limit }
      });
    } else if (pct >= 85) {
      newAlerts.push({
        id: alertId,
        level: 'warning',
        title: `${cat} Budget at ${pct}% Threshold`,
        message: `You have spent ${c}${formatNumber(spent)} of your ${c}${formatNumber(limit)} ${cat} budget (${pct}%). Only ${c}${formatNumber(remaining)} remains for this cycle.`,
        status: prevStatus,
        created_at: prev && prev.created_at ? prev.created_at : new Date().toISOString(),
        meta: { pct, category: cat, spent, limit }
      });
    }
  });

  // 2. Upcoming Obligations vs Liquid Balance
  const unpaidBills = (state.bills || []).filter(b => b.status !== 'paid');
  const billsAmt = unpaidBills.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
  const fin = computeFinancialState();

  if (billsAmt > 0 && billsAmt > fin.totalBalance) {
    const bId = 'alert-liquidity-deficit';
    const prev = existingAlerts[bId];
    newAlerts.push({
      id: bId,
      level: 'danger',
      title: 'Urgent Liquidity Shortfall',
      message: `Upcoming scheduled bills (${c}${formatNumber(billsAmt)}) exceed your available liquid balance (${c}${formatNumber(fin.totalBalance)}) by ${c}${formatNumber(billsAmt - fin.totalBalance)}.`,
      status: prev ? prev.status : 'active',
      created_at: prev && prev.created_at ? prev.created_at : new Date().toISOString()
    });
  } else if (billsAmt > 0) {
    const bId = 'alert-upcoming-bills';
    const prev = existingAlerts[bId];
    newAlerts.push({
      id: bId,
      level: 'info',
      title: 'Upcoming Bills Due Soon',
      message: `${c}${formatNumber(billsAmt)} in scheduled obligations due soon. Keep funds reserved for upcoming settlement.`,
      status: prev ? prev.status : 'active',
      created_at: prev && prev.created_at ? prev.created_at : new Date().toISOString()
    });
  }

  // 3. Preserve non-budget custom alerts
  (state.alerts || []).forEach(a => {
    if (!a.id || (!a.id.startsWith('alert-budget-') && a.id !== 'alert-liquidity-deficit' && a.id !== 'alert-upcoming-bills')) {
      newAlerts.push(a);
    }
  });

  state.alerts = newAlerts;
}

function updateBadgeCounts() {
  const unreadAlerts = (state.alerts || []).filter(a => a.status !== 'resolved').length;
  const sideBadge = document.getElementById('sidebar-alert-badge');
  const headBadge = document.getElementById('header-alert-badge');
  if (sideBadge) {
    sideBadge.textContent = unreadAlerts;
    sideBadge.style.display = unreadAlerts > 0 ? 'inline-flex' : 'none';
  }
  if (headBadge) {
    headBadge.style.display = unreadAlerts > 0 ? 'block' : 'none';
  }
}

// Trigger Full 3-Agent Workflow
async function triggerRunWorkflow() {
  const btn = document.getElementById('btn-run-workflow');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span><span>Analyzing via Azure Foundry...</span>';
  }

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, { method: 'POST' });
    if (!res.ok) throw new Error('Analysis failed');
    const result = await res.json();

    state.aiWorkflowData = result;
    if (result.alert_action && result.alert_action.action && result.alert_action.requires_confirmation) {
      state.pending_action = result.alert_action.action;
    }

    // Refresh store from backend to capture any server-side simulated changes
    await loadFinancialData();
    showToast('Azure AI Foundry 4-Agent Analysis complete!', 'success');

    // Re-render current page
    navigate(state.activePage, false);
  } catch (err) {
    showToast('Could not run AI workflow: ' + err.message, 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}

// Calculate dynamic facts from state
function computeFinancialState() {
  // 1. Current liquid balance: Sum of all non-credit-card accounts, or profile balance
  let totalBalance = 0;
  if (state.accounts.length > 0) {
    totalBalance = state.accounts.reduce((sum, acc) => {
      return sum + (acc.type !== 'Credit Card' ? parseFloat(acc.balance || 0) : 0);
    }, 0);
  } else {
    totalBalance = parseFloat(state.profile.current_balance || 0);
  }

  // 2. Monthly Income: Setup/profile baseline is the source of truth (transactions are activity, not salary)
  const incomeTxs = state.transactions.filter(t => t.type === 'income');
  const txIncomeTotal = incomeTxs.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const profileIncome = parseFloat(state.profile.monthly_income);
  const monthlyIncome = Number.isFinite(profileIncome)
    ? profileIncome
    : (txIncomeTotal || 0);

  // 3. Monthly Expenses: Sum of expense transactions or profile
  const expenseTxs = state.transactions.filter(t => t.type !== 'income');
  const monthlyExpenses = expenseTxs.length > 0
    ? expenseTxs.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
    : parseFloat(state.profile.monthly_expenses || 0);

  // 4. Surplus / Deficit
  const monthlySurplus = monthlyIncome - monthlyExpenses;

  // 5. Savings
  const currentSavings = parseFloat(state.profile.current_savings || 0);
  const savingsGoal = parseFloat(state.profile.savings_goal || 0);
  const savingsRate = monthlyIncome > 0 ? Math.round((monthlySurplus / monthlyIncome) * 100) : 0;

  // 6. Upcoming Obligations (Sum of unpaid bills)
  const unpaidBills = state.bills.filter(b => b.status !== 'paid');
  const upcomingBills = unpaidBills.length > 0
    ? unpaidBills.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0)
    : parseFloat(state.profile.upcoming_bills || 0);

  return {
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    monthlySurplus,
    currentSavings,
    savingsGoal,
    savingsRate,
    upcomingBills,
    currency: state.profile.currency || '₹'
  };
}

