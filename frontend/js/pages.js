// ==============================================================
// MONEY ARNOLD — PAGE VIEWS & UI RENDERERS
// ==============================================================

// ==============================================================
// 1. MAIN DASHBOARD VIEW
// ==============================================================
function renderDashboard(container) {
  const fin = computeFinancialState();
  const c = fin.currency;

  container.innerHTML = `
    <div class="dashboard-grid">
      
      <!-- ROW 1: Financial Overview Metric Cards -->
      <section class="overview-metrics-grid">
        <!-- Current Balance -->
        <div class="metric-card card-primary">
          <div class="metric-header">
            <span class="metric-title">Available Liquid Balance</span>
            <span class="metric-icon-badge">🏦</span>
          </div>
          <div class="metric-amount">${c}${formatNumber(fin.totalBalance)}</div>
          <div class="metric-footer">
            <span class="delta-badge delta-positive">● Liquid Ready</span>
            <span class="text-muted">Across ${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <!-- Monthly Income -->
        <div class="metric-card card-success">
          <div class="metric-header">
            <span class="metric-title">Monthly Income</span>
            <span class="metric-icon-badge">📈</span>
          </div>
          <div class="metric-amount">${c}${formatNumber(fin.monthlyIncome)}</div>
          <div class="metric-footer">
            <span class="delta-badge delta-positive">↑ Active Inflow</span>
            <span class="text-muted">Current billing period</span>
          </div>
        </div>

        <!-- Monthly Expenses -->
        <div class="metric-card card-warning">
          <div class="metric-header">
            <span class="metric-title">Monthly Expenses</span>
            <span class="metric-icon-badge">📉</span>
          </div>
          <div class="metric-amount">${c}${formatNumber(fin.monthlyExpenses)}</div>
          <div class="metric-footer">
            <span class="delta-badge ${fin.monthlySurplus >= 0 ? 'delta-neutral' : 'delta-negative'}">
              ${fin.monthlySurplus >= 0 ? 'Within Budget' : 'Deficit Warning'}
            </span>
            <span class="text-muted">${state.transactions.filter(t => t.type !== 'income').length} total txs</span>
          </div>
        </div>

        <!-- Monthly Surplus / Deficit -->
        <div class="metric-card ${fin.monthlySurplus >= 0 ? 'card-success' : 'card-warning'}">
          <div class="metric-header">
            <span class="metric-title">Net Monthly Cash Flow</span>
            <span class="metric-icon-badge">${fin.monthlySurplus >= 0 ? '💰' : '⚠️'}</span>
          </div>
          <div class="metric-amount" style="color: ${fin.monthlySurplus >= 0 ? 'var(--success)' : 'var(--danger)'}">
            ${fin.monthlySurplus >= 0 ? '+' : '-'}${c}${formatNumber(Math.abs(fin.monthlySurplus))}
          </div>
          <div class="metric-footer">
            <span class="delta-badge ${fin.monthlySurplus >= 0 ? 'delta-positive' : 'delta-negative'}">
              ${fin.savingsRate}% Savings Rate
            </span>
            <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('How can I optimize my monthly cash flow and savings rate?', null, 'spending_analysis')">🤖 Ask AI</button>
          </div>
        </div>

        <!-- Savings -->
        <div class="metric-card card-purple">
          <div class="metric-header">
            <span class="metric-title">Emergency Savings</span>
            <span class="metric-icon-badge">🛡️</span>
          </div>
          <div class="metric-amount">${c}${formatNumber(fin.currentSavings)}</div>
          <div class="metric-footer">
            <span class="delta-badge delta-positive">
              ${fin.savingsGoal > 0 ? Math.round((fin.currentSavings / fin.savingsGoal) * 100) : 0}% of ${c}${formatNumber(fin.savingsGoal)}
            </span>
            <span class="text-muted">Target Goal</span>
          </div>
        </div>

        <!-- Upcoming Obligations -->
        <div class="metric-card card-primary">
          <div class="metric-header">
            <span class="metric-title">Upcoming Obligations</span>
            <span class="metric-icon-badge">📅</span>
          </div>
          <div class="metric-amount">${c}${formatNumber(fin.upcomingBills)}</div>
          <div class="metric-footer">
            <span class="delta-badge delta-neutral">${state.bills.filter(b => b.status !== 'paid').length} due this month</span>
            <span class="text-muted">Requires Reserve</span>
          </div>
        </div>
      </section>

      <!-- PENDING SIMULATED ACTION BANNER (Agent 3 Human Confirmation) -->
      ${renderPendingActionBannerHtml()}

      <!-- ROW 2: Cash Flow Chart + Budget Section -->
      <section class="grid-2-col">
        <!-- Cash Flow Chart -->
        <div class="card">
          <div class="card-header">
            <div class="card-header-left">
              <h3>Cash Flow Dynamics</h3>
              <p>Income vs Expenses over time with projected liquidity</p>
            </div>
            <div class="period-pills">
              <button class="period-pill ${state.periodFilter === '7d' ? 'active' : ''}" onclick="setPeriodFilter('7d')">7D</button>
              <button class="period-pill ${state.periodFilter === '30d' ? 'active' : ''}" onclick="setPeriodFilter('30d')">30D</button>
              <button class="period-pill ${state.periodFilter === '3m' ? 'active' : ''}" onclick="setPeriodFilter('3m')">3M</button>
              <button class="period-pill ${state.periodFilter === '6m' ? 'active' : ''}" onclick="setPeriodFilter('6m')">6M</button>
            </div>
          </div>
          <div class="chart-wrapper">
            <canvas id="chart-cash-flow"></canvas>
          </div>
        </div>

        <!-- Budget Utilization -->
        <div class="card">
          <div class="card-header">
            <div class="card-header-left">
              <h3>Monthly Budget Utilization</h3>
              <p>Dynamic spending tracking against configured limits</p>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('Analyze my monthly budgets and recommend where to cut back to maximize surplus', null, 'budget_analysis')">🤖 Ask AI</button>
              <button class="btn btn-outline btn-sm" onclick="openAddBudgetModal()">➕ Budget</button>
            </div>
          </div>
          <div class="budget-items-list" id="dashboard-budget-list">
            ${renderBudgetBarsHtml(fin)}
          </div>
        </div>
      </section>

      <!-- ROW 3: Spending Analysis (Donut) + Upcoming Bills List -->
      <section class="grid-2-col">
        <!-- Spending Category Donut -->
        <div class="card">
          <div class="card-header">
            <div class="card-header-left">
              <h3>Spending by Category</h3>
              <p>Proportional breakdown of current month outflows</p>
            </div>
          </div>
          <div class="chart-wrapper" style="height: 260px;">
            <canvas id="chart-spending-donut"></canvas>
          </div>
        </div>

        <!-- Upcoming Bills Preview -->
        <div class="card">
          <div class="card-header">
            <div class="card-header-left">
              <h3>Upcoming Bills & Obligations</h3>
              <p>Scheduled expenses due before next paycheck</p>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('Can I comfortably cover all upcoming obligations without draining my safety buffer?', null, 'bill_analysis')">🤖 Ask AI</button>
              <a href="#bills" class="btn btn-outline btn-sm" onclick="navigate('bills')">View All Bills</a>
            </div>
          </div>
          <div class="table-responsive">
            <table class="fintech-table">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th style="text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${renderBillsPreviewRowsHtml(fin)}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ROW 4: Goals Progress + Alerts Preview -->
      <section class="grid-2-col-equal">
        <!-- Goals Progress -->
        <div class="card">
          <div class="card-header">
            <div class="card-header-left">
              <h3>Target Financial Goals</h3>
              <p>Progress towards emergency savings and planned purchases</p>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('Analyze my financial goals and tell me how I can reach them faster', null, 'goal_analysis')">🤖 Ask AI</button>
              <button class="btn btn-outline btn-sm" onclick="openAddGoalModal()">➕ Goal</button>
            </div>
          </div>
          <div class="budget-items-list">
            ${renderGoalsListHtml(fin)}
          </div>
        </div>

        <!-- Proactive Alerts Preview (Agent 3) -->
        <div class="card">
          <div class="card-header">
            <div class="card-header-left">
              <h3>Proactive Alerts & Warnings</h3>
              <p>Detected by Agent 3 from live transaction patterns</p>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('Explain all active alerts and recommend preventative financial actions', null, 'alert_explanation')">🤖 Ask AI</button>
              <a href="#alerts" class="btn btn-outline btn-sm" onclick="navigate('alerts')">Alerts Center</a>
            </div>
          </div>
          <div class="alerts-list">
            ${renderAlertsPreviewHtml()}
          </div>
        </div>
      </section>

      <!-- ROW 5: Recent Transactions Table -->
      <section class="card">
        <div class="card-header">
          <div class="card-header-left">
            <h3>Recent Financial Transactions</h3>
            <p>Categorized transaction stream across all user accounts</p>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-primary btn-sm" onclick="openAddTxModal()">➕ Add Transaction</button>
            <a href="#transactions" class="btn btn-outline btn-sm" onclick="navigate('transactions')">View Ledger</a>
          </div>
        </div>
        <div class="table-responsive">
          <table class="fintech-table">
            <thead>
              <tr>
                <th>Merchant / Description</th>
                <th>Category</th>
                <th>Account</th>
                <th>Date</th>
                <th style="text-align:right;">Amount</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${renderRecentTransactionsRowsHtml(fin)}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  `;

  // Initialize interactive charts on next frame
  setTimeout(() => {
    initCashFlowChart();
    initSpendingDonutChart();
  }, 50);
}

function setPeriodFilter(period) {
  state.periodFilter = period;
  navigate('dashboard', false);
}

// -------------------------------------------------------------
// Financial Intelligence (Agent 1, Agent 2, Agent 3) HTML
// -------------------------------------------------------------
function renderFinancialIntelligenceHtml(fin) {
  const c = fin.currency;
  const wf = state.aiWorkflowData;
  const analyzer = wf ? wf.analyzer : null;
  const planner = wf ? wf.planner : null;
  const alertAction = wf ? wf.alert_action : null;

  const planned = state.profile.planned_purchase || { item: '', amount: 0 };

  return `
    <section class="financial-intelligence-section">
      <div class="fi-header">
        <div>
          <div class="fi-title-badge">
            <h2>Financial Intelligence</h2>
            <span class="badge badge-purple">Microsoft Azure AI Foundry 4-Agent Workflow</span>
          </div>
          <p class="text-secondary" style="font-size:13px;">
            Continuous multi-agent reasoning: <strong>Observe → Understand → Connect Context → Explain → Predict → Recommend → Synthesize → Human Confirmation</strong>
          </p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="triggerRunWorkflow()">
          <span class="btn-icon">⚡</span> Run Workflow
        </button>
      </div>

      <div class="fi-agents-grid">
        <!-- Agent 1: Financial Analyzer -->
        <div class="agent-card">
          <div class="agent-card-header">
            <div class="agent-icon-box agent-1-icon">🔍</div>
            <div class="agent-info">
              <h4>Agent 1: Financial Analyzer</h4>
              <span>Categorization & Budget Monitoring</span>
            </div>
          </div>
          <div class="agent-body-list">
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>Transaction Patterns:</strong> ${state.transactions.length > 0 ? `${state.transactions.length} transactions processed.` : '0 transactions recorded.'}</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>Subscription Audit:</strong> ${state.subscriptions.length > 0 ? `${state.subscriptions.length} active recurring subscriptions (${c}${formatNumber(calculateMonthlySubscriptionTotal())}/mo).` : '0 active subscriptions.'}</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>Budget Alert:</strong> ${
                analyzer && analyzer.alerts && analyzer.alerts.length > 0
                  ? analyzer.alerts[0]
                  : state.alerts.length > 0
                    ? state.alerts[0].message
                    : 'All category budgets healthy and clear.'
              }</span>
            </div>
          </div>
        </div>

        <!-- Agent 2: Financial Planner -->
        <div class="agent-card">
          <div class="agent-card-header">
            <div class="agent-icon-box agent-2-icon">📈</div>
            <div class="agent-info">
              <h4>Agent 2: Financial Planner</h4>
              <span>Forecasting & Decision Feasibility</span>
            </div>
          </div>
          <div class="agent-body-list">
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>Affordability Verdict:</strong> ${
                planner && planner.affordability_analysis
                  ? planner.affordability_analysis.verdict
                  : (planned.item && planned.amount > 0)
                    ? `Evaluating purchase of ${c}${formatNumber(planned.amount)} ${planned.item}.`
                    : 'Ready to evaluate purchase feasibility and cash flow projections.'
              }</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>30/60/90 Day Forecast:</strong> Projected balance is ${c}${formatNumber(fin.totalBalance + fin.monthlySurplus - fin.upcomingBills)} in 30 days.</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>Goal Pace:</strong> ${fin.savingsGoal > 0 ? `Savings goal shortfall is ${c}${formatNumber(Math.max(0, fin.savingsGoal - fin.currentSavings))}.` : 'No savings goals configured yet.'}</span>
            </div>
          </div>
        </div>

        <!-- Agent 3: Proactive Alerts & Action -->
        <div class="agent-card">
          <div class="agent-card-header">
            <div class="agent-icon-box agent-3-icon">🛡️</div>
            <div class="agent-info">
              <h4>Agent 3: Alert & Action</h4>
              <span>Simulated Action with Human Gate</span>
            </div>
          </div>
          <div class="agent-body-list">
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>Active Proactive Alerts:</strong> ${state.alerts.filter(a => a.status !== 'resolved').length} alerts requiring attention.</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>Prepared Action:</strong> ${
                state.pending_action
                  ? state.pending_action.description
                  : fin.upcomingBills > 0
                    ? `Reserve ${c}${formatNumber(fin.upcomingBills)} for upcoming obligations.`
                    : 'No pending financial actions required.'
              }</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span class="text-warning"><strong>Human-in-the-Loop:</strong> Actions require human confirmation. No real bank accounts are accessed.</span>
            </div>
          </div>
        </div>

        <!-- Agent 4: Executive Summarizer & Synthesizer -->
        <div class="agent-card">
          <div class="agent-card-header">
            <div class="agent-icon-box agent-4-icon" style="background:rgba(56, 189, 248, 0.18); color:#38bdf8;">📋</div>
            <div class="agent-info">
              <h4>Agent 4: Executive Summarizer</h4>
              <span>Multi-Agent Synthesis & Health Verdict</span>
            </div>
          </div>
          <div class="agent-body-list">
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>Synthesis:</strong> Unified briefing condensing Analyzer, Planner, and Alert insights.</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>Health Status:</strong> ${fin.monthlySurplus > 0 && fin.totalBalance > fin.monthlyExpenses ? '<span class="text-success" style="font-weight:700;">Healthy & Stable</span>' : '<span class="text-warning" style="font-weight:700;">Moderate Attention Needed</span>'} (Liquidity: ${c}${formatNumber(fin.totalBalance)}).</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>AI Assistant Tab:</strong> Direct conversational access with executive summary cards.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

// Pending Action Banner
function renderPendingActionBannerHtml() {
  if (!state.pending_action) return '';
  const action = state.pending_action;
  const c = state.profile.currency || '₹';

  return `
    <div class="pending-action-banner" id="dashboard-action-banner">
      <div class="p-action-left">
        <div class="p-action-icon">🛡️</div>
        <div class="p-action-text">
          <h4>Agent 3 Action Pending Confirmation: ${action.type || 'Reserve Funds'}</h4>
          <p>${action.description || (action.amount ? `Simulated reservation of ${c}${formatNumber(action.amount)} to safeguard upcoming obligations.` : 'Simulated fund reservation.')}</p>
        </div>
      </div>
      <div class="p-action-buttons">
        <button class="btn btn-secondary btn-sm" onclick="handleExecuteActionDecision(false)">✗ Dismiss</button>
        <button class="btn btn-success btn-sm" onclick="openActionConfirmModal()">✓ Review & Confirm</button>
      </div>
    </div>
  `;
}

function openActionConfirmModal() {
  if (!state.pending_action) return;
  const action = state.pending_action;
  const c = state.profile.currency || '₹';

  document.getElementById('modal-action-title').textContent = 'Confirm Simulated Action';
  document.getElementById('modal-action-type').textContent = action.type || 'reserve_bill_funds';
  document.getElementById('modal-action-amount').textContent = action.amount ? `${c}${formatNumber(action.amount)}` : 'N/A';
  document.getElementById('modal-action-description').textContent =
    action.description || 'Agent 3 has prepared a simulated fund reservation to safeguard upcoming obligations.';

  openModal('modal-action-confirm');
}

async function handleExecuteActionDecision(confirmed, actionParam = null) {
  closeModal('modal-action-confirm');
  const action = actionParam || state.pending_action || {
    type: 'reserve_bill_funds',
    amount: 0,
    description: 'Reserve funds for upcoming bills'
  };

  // If the action is a real CRUD operation (from AI chat), route to the execute endpoint
  const isExecuteAction = ['add_transaction', 'update_budget', 'add_budget', 'update_balance', 'update_savings', 'update_goal'].includes(action.type);

  if (!confirmed) {
    state.pending_action = null;
    showToast('Action dismissed. No changes made.', 'info');
    if (state.activePage === 'ai') {
      state.chatMessages.push({
        role: 'assistant',
        content: `❌ **Action Dismissed:** No changes were made.`
      });
      saveChatHistory();
      renderAIAssistantPage(document.getElementById('page-container'));
    }
    return;
  }

  try {
    let result;
    if (isExecuteAction) {
      // Route to the new execute endpoint for add_transaction / update_budget
      const payload = action.payload || {};
      const res = await fetch(`${API_BASE}/api/action/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: action.type,
          payload: payload
        })
      });
      result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'Action failed');
    } else {
      // Legacy: reserve_bill_funds / reserve_purchase_funds etc.
      const res = await fetch(`${API_BASE}/api/action/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: action.type || 'reserve_bill_funds',
          confirmed: true,
          amount: action.amount || 0,
          description: action.description
        })
      });
      result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'Action failed');
    }

    state.pending_action = null;
    await loadFinancialData();

    const successMsg = result.message || 'Action applied successfully.';
    showToast(successMsg, 'success');

    if (state.activePage === 'ai') {
      state.chatMessages.push({
        role: 'assistant',
        content: `✅ **Done!** ${successMsg}`
      });
      saveChatHistory();
      renderAIAssistantPage(document.getElementById('page-container'));
    } else {
      navigate(state.activePage, false);
    }
  } catch (err) {
    showToast('Error processing action: ' + err.message, 'danger');
  }
}

// Budget Bars HTML
function renderBudgetBarsHtml(fin) {
  const c = fin.currency;
  if (!state.budgets || state.budgets.length === 0) {
    return `
      <div class="empty-state" style="padding:20px 0;">
        <span class="empty-icon">🎯</span>
        <span class="empty-title">No Budgets Configured</span>
        <button class="btn btn-primary btn-sm" onclick="openAddBudgetModal()">Create First Budget</button>
      </div>
    `;
  }

  // Calculate actual spending per category from transactions
  const categorySpending = {};
  state.transactions.forEach(t => {
    if (t.type !== 'income') {
      const cat = t.category || 'Other';
      categorySpending[cat] = (categorySpending[cat] || 0) + parseFloat(t.amount || 0);
    }
  });

  return state.budgets.map(b => {
    const limit = parseFloat(b.amount || 0);
    const spent = categorySpending[b.category] || 0;
    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const remaining = Math.max(0, limit - spent);

    let statusBadge = '<span class="badge badge-success">Healthy</span>';
    let fillClass = 'progress-fill';
    if (pct >= 100) {
      statusBadge = '<span class="badge badge-danger">Exceeded</span>';
      fillClass = 'progress-fill danger';
    } else if (pct >= 75) {
      statusBadge = '<span class="badge badge-warning">Approaching Limit</span>';
      fillClass = 'progress-fill warning';
    }

    return `
      <div class="budget-item">
        <div class="budget-item-header">
          <div class="budget-name-group">
            <span>${b.category}</span>
            ${statusBadge}
          </div>
          <div class="budget-numbers">
            <strong>${c}${formatNumber(spent)}</strong> of ${c}${formatNumber(limit)} (${pct}%)
          </div>
        </div>
        <div class="progress-track">
          <div class="${fillClass}" style="width: ${Math.min(100, pct)}%"></div>
        </div>
        <div style="font-size:11px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
          <span>Remaining: ${c}${formatNumber(remaining)}</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('How am I tracking on my ${escapeHtml(b.category)} budget and how can I stay under limit?', { category: '${escapeHtml(b.category)}', limit: ${limit}, spent: ${spent} }, 'budget_analysis')">🤖 Ask AI</button>
            <span style="cursor:pointer; color:var(--accent);" onclick="openEditBudgetModal('${b.id || b.category}')">Edit Limit</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Bills Preview Rows
function renderBillsPreviewRowsHtml(fin) {
  const c = fin.currency;
  if (!state.bills || state.bills.length === 0) {
    return `<tr><td colspan="5" style="text-align:center; padding:24px;">No upcoming bills scheduled.</td></tr>`;
  }

  return state.bills.slice(0, 4).map(b => {
    const isPaid = b.status === 'paid';
    return `
      <tr>
        <td><strong>${b.name}</strong></td>
        <td>${b.due_date || 'Due this month'}</td>
        <td style="font-weight:700;">${c}${formatNumber(b.amount)}</td>
        <td>
          <span class="badge ${isPaid ? 'badge-success' : 'badge-warning'}">
            ${isPaid ? 'Paid' : 'Unpaid'}
          </span>
        </td>
        <td style="text-align:right;">
          <div style="display:flex; justify-content:flex-end; align-items:center; gap:6px;">
            <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('Can I comfortably pay ${escapeHtml(b.name)} of ${c}${formatNumber(b.amount)} due on ${b.due_date || 'this month'}?', { bill_name: '${escapeHtml(b.name)}', amount: ${b.amount} }, 'bill_analysis')">🤖 Ask AI</button>
            <button class="btn btn-outline btn-sm" onclick="toggleBillPaidStatus('${b.id}')">
              ${isPaid ? 'Mark Unpaid' : '✓ Mark Paid'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Goals List HTML
function renderGoalsListHtml(fin) {
  const c = fin.currency;
  if (!state.goals || state.goals.length === 0) {
    return `
      <div class="empty-state" style="padding:20px 0;">
        <span class="empty-icon">🏆</span>
        <span class="empty-title">No Goals Created</span>
        <button class="btn btn-primary btn-sm" onclick="openAddGoalModal()">Create Financial Goal</button>
      </div>
    `;
  }

  return state.goals.map(g => {
    const target = parseFloat(g.target_amount || 1);
    const current = parseFloat(g.current_amount || 0);
    const pct = Math.min(100, Math.round((current / target) * 100));
    const shortfall = Math.max(0, target - current);
    const months = fin.monthlySurplus > 0 ? Math.ceil(shortfall / fin.monthlySurplus) : '∞';

    return `
      <div class="budget-item">
        <div class="budget-item-header">
          <div class="budget-name-group">
            <span>${g.name}</span>
            <span class="badge badge-purple">${pct}%</span>
          </div>
          <div class="budget-numbers">
            ${c}${formatNumber(current)} / ${c}${formatNumber(target)}
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${pct}%; background: linear-gradient(90deg, #8b5cf6, #c084fc);"></div>
        </div>
        <div style="font-size:11px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
          <span>Gap: ${c}${formatNumber(shortfall)} (~${months} months away at surplus)</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('How can I reach my ${escapeHtml(g.name)} goal faster given my current surplus?', { goal_name: '${escapeHtml(g.name)}', target_amount: ${target}, current_amount: ${current} }, 'goal_analysis')">🤖 Ask AI</button>
            <span style="cursor:pointer; color:var(--accent);" onclick="openEditGoalModal('${g.id}')">Edit</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Alerts Preview HTML
function renderAlertsPreviewHtml() {
  const activeAlerts = state.alerts.filter(a => a.status !== 'resolved');
  if (activeAlerts.length === 0) {
    return `
      <div class="empty-state" style="padding:20px 0;">
        <span class="empty-icon">🛡️</span>
        <span class="empty-title">No Active Alerts</span>
        <span class="empty-desc">Your financial health is currently stable and balanced.</span>
      </div>
    `;
  }

  return activeAlerts.slice(0, 3).map(a => {
    return `
      <div class="alert-card-item ${a.level || 'warning'}">
        <div class="alert-item-left">
          <div class="alert-item-icon">${a.level === 'danger' ? '🚨' : '⚠️'}</div>
          <div class="alert-item-content">
            <h4>${a.title}</h4>
            <p>${a.message}</p>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('Explain alert: ${escapeHtml(a.title).replace(/'/g, "\\'")}. What actions should I take?', { alert_id: '${a.id}', title: '${escapeHtml(a.title).replace(/'/g, "\\'")}', message: '${escapeHtml(a.message).replace(/'/g, "\\'")}' }, 'alert_explanation')">🤖 Ask AI</button>
          <button class="action-btn" title="Dismiss" onclick="resolveAlert('${a.id}')">✓</button>
        </div>
      </div>
    `;
  }).join('');
}

// Recent Transactions Rows HTML
function renderRecentTransactionsRowsHtml(fin) {
  const c = fin.currency;
  if (!state.transactions || state.transactions.length === 0) {
    return `<tr><td colspan="6" style="text-align:center; padding:32px;">No transactions recorded. Click "+ Add Transaction" above!</td></tr>`;
  }

  return state.transactions.slice(0, 6).map(t => {
    const isIncome = t.type === 'income';
    return `
      <tr>
        <td class="tx-merchant-col">
          <div class="tx-merchant-inner">
            <span>${isIncome ? '💰' : '💳'}</span>
            <span>${t.merchant}</span>
          </div>
        </td>
        <td><span class="badge badge-info">${t.category || 'General'}</span></td>
        <td><span class="text-muted" style="font-size:12px;">${t.account || 'Primary Checking'}</span></td>
        <td>${t.date || 'Today'}</td>
        <td class="tx-amount-col ${isIncome ? 'amount-income' : 'amount-expense'}">
          ${isIncome ? '+' : '-'}${c}${formatNumber(t.amount)}
        </td>
        <td>
          <div class="table-actions">
            <button class="action-btn" title="Edit" onclick="openEditTxModal('${t.id}')">✏️</button>
            <button class="action-btn delete" title="Delete" onclick="handleDeleteTx('${t.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ==============================================================
// 2. TRANSACTIONS PAGE
// ==============================================================
function renderTransactionsPage(container) {
  const fin = computeFinancialState();
  const c = fin.currency;

  // Filter transactions based on active search & filters
  let filtered = state.transactions.filter(t => {
    const matchSearch = state.txSearchQuery
      ? (t.merchant || '').toLowerCase().includes(state.txSearchQuery.toLowerCase()) ||
        (t.notes || '').toLowerCase().includes(state.txSearchQuery.toLowerCase())
      : true;
    const matchCat = state.txCategoryFilter === 'all' ? true : t.category === state.txCategoryFilter;
    const matchType = state.txTypeFilter === 'all' ? true : (t.type || 'expense') === state.txTypeFilter;
    const matchAcc = state.txAccountFilter === 'all' ? true : t.account === state.txAccountFilter;
    return matchSearch && matchCat && matchType && matchAcc;
  });

  const totalIn = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const totalOut = filtered.filter(t => t.type !== 'income').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const categories = Array.from(new Set(state.transactions.map(t => t.category).filter(Boolean)));
  const accountsList = Array.from(new Set(state.accounts.map(a => a.name)));

  container.innerHTML = `
    <div class="dashboard-grid">
      <!-- Filter and Action Bar -->
      <div class="card" style="padding:18px 24px;">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:16px;">
          <!-- Search & Filters -->
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:12px; flex:1;">
            <input type="text" placeholder="Search merchant, notes..." value="${state.txSearchQuery}"
                   oninput="handleTxSearch(this.value)"
                   style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:8px 14px; color:var(--text-primary); min-width:200px;">
            
            <select onchange="handleTxFilter('category', this.value)" style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:8px 12px; color:var(--text-primary);">
              <option value="all">All Categories</option>
              ${categories.map(cat => `<option value="${cat}" ${state.txCategoryFilter === cat ? 'selected' : ''}>${cat}</option>`).join('')}
            </select>

            <select onchange="handleTxFilter('type', this.value)" style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:8px 12px; color:var(--text-primary);">
              <option value="all">All Types</option>
              <option value="expense" ${state.txTypeFilter === 'expense' ? 'selected' : ''}>Expenses Only</option>
              <option value="income" ${state.txTypeFilter === 'income' ? 'selected' : ''}>Income Only</option>
            </select>

            <select onchange="handleTxFilter('account', this.value)" style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:8px 12px; color:var(--text-primary);">
              <option value="all">All Accounts</option>
              ${accountsList.map(acc => `<option value="${acc}" ${state.txAccountFilter === acc ? 'selected' : ''}>${acc}</option>`).join('')}
            </select>
          </div>

          <!-- Add Button -->
          <button class="btn btn-primary" onclick="openAddTxModal()">
            <span class="btn-icon">➕</span> Add New Transaction
          </button>
        </div>
      </div>

      <!-- Quick Summary Stats Chips -->
      <div style="display:flex; gap:16px; flex-wrap:wrap;">
        <div class="card" style="flex:1; padding:16px 20px;">
          <span style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Filtered Inflow</span>
          <div style="font-size:20px; font-weight:800; color:var(--success); margin-top:4px;">+${c}${formatNumber(totalIn)}</div>
        </div>
        <div class="card" style="flex:1; padding:16px 20px;">
          <span style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Filtered Outflow</span>
          <div style="font-size:20px; font-weight:800; color:var(--text-primary); margin-top:4px;">-${c}${formatNumber(totalOut)}</div>
        </div>
        <div class="card" style="flex:1; padding:16px 20px;">
          <span style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Net Balance Movement</span>
          <div style="font-size:20px; font-weight:800; color:${totalIn - totalOut >= 0 ? 'var(--success)' : 'var(--danger)'}; margin-top:4px;">
            ${totalIn - totalOut >= 0 ? '+' : ''}${c}${formatNumber(totalIn - totalOut)}
          </div>
        </div>
      </div>

      <!-- Full Transactions Table -->
      <div class="card">
        <div class="table-responsive">
          <table class="fintech-table">
            <thead>
              <tr>
                <th>Merchant / Details</th>
                <th>Category</th>
                <th>Type</th>
                <th>Account</th>
                <th>Date</th>
                <th>Notes</th>
                <th style="text-align:right;">Amount</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr><td colspan="8" style="text-align:center; padding:40px;">
                  <div class="empty-state">
                    <span class="empty-icon">🔍</span>
                    <span class="empty-title">No Transactions Match Filter</span>
                    <span class="empty-desc">Try clearing the search query or category filters.</span>
                  </div>
                </td></tr>
              ` : filtered.map(t => {
                const isIncome = t.type === 'income';
                return `
                  <tr>
                    <td class="tx-merchant-col">
                      <div class="tx-merchant-inner">
                        <span>${isIncome ? '💰' : '💳'}</span>
                        <strong>${t.merchant}</strong>
                      </div>
                    </td>
                    <td><span class="badge badge-info">${t.category || 'Other'}</span></td>
                    <td>
                      <span class="badge ${isIncome ? 'badge-success' : 'badge-neutral'}">
                        ${isIncome ? 'Income' : 'Expense'}
                      </span>
                    </td>
                    <td><span class="text-secondary">${t.account || 'Primary Account'}</span></td>
                    <td>${t.date || '—'}</td>
                    <td><span class="text-muted">${t.notes || '—'}</span></td>
                    <td class="tx-amount-col ${isIncome ? 'amount-income' : 'amount-expense'}">
                      ${isIncome ? '+' : '-'}${c}${formatNumber(t.amount)}
                    </td>
                    <td>
                      <div class="table-actions">
                        <button class="action-btn" title="Edit" onclick="openEditTxModal('${t.id}')">✏️</button>
                        <button class="action-btn delete" title="Delete" onclick="handleDeleteTx('${t.id}')">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function handleTxSearch(val) {
  state.txSearchQuery = val;
  renderTransactionsPage(document.getElementById('page-container'));
}

function handleTxFilter(type, val) {
  if (type === 'category') state.txCategoryFilter = val;
  if (type === 'type') state.txTypeFilter = val;
  if (type === 'account') state.txAccountFilter = val;
  renderTransactionsPage(document.getElementById('page-container'));
}

// ==============================================================
// 3. BUDGETS PAGE
// ==============================================================
function renderBudgetsPage(container) {
  const fin = computeFinancialState();
  const c = fin.currency;

  const totalBudgetLimit = state.budgets.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
  const totalBudgetSpent = state.transactions
    .filter(t => t.type !== 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const overallPct = totalBudgetLimit > 0 ? Math.round((totalBudgetSpent / totalBudgetLimit) * 100) : 0;

  container.innerHTML = `
    <div class="dashboard-grid">
      <!-- Overall Budget Utilization Banner -->
      <div class="card" style="padding:28px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <span class="badge badge-accent">Monthly Overall Limit</span>
            <h2 style="font-size:24px; font-weight:800; margin-top:6px;">
              ${c}${formatNumber(totalBudgetSpent)} <small class="text-secondary" style="font-size:16px;">/ ${c}${formatNumber(totalBudgetLimit)} Limit</small>
            </h2>
          </div>
          <div style="text-align:right;">
            <div style="font-size:28px; font-weight:800; color:${overallPct >= 100 ? 'var(--danger)' : overallPct >= 75 ? 'var(--warning)' : 'var(--success)'};">
              ${overallPct}%
            </div>
            <span class="text-muted" style="font-size:12px;">Overall Utilization</span>
          </div>
        </div>
        <div class="progress-track" style="height:12px;">
          <div class="progress-fill ${overallPct >= 100 ? 'danger' : overallPct >= 75 ? 'warning' : ''}" style="width:${Math.min(100, overallPct)}%;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; font-size:12px; color:var(--text-secondary); flex-wrap:wrap; gap:8px;">
          <span>Remaining Discretionary Capacity: <strong>${c}${formatNumber(Math.max(0, totalBudgetLimit - totalBudgetSpent))}</strong></span>
          <button class="btn-ask-ai" onclick="askAIWithContext('Analyze all my category budgets and give recommendations to increase monthly savings', null, 'budget_analysis')">🤖 Ask AI: Analyze Budgets</button>
        </div>
      </div>

      <!-- Category Budgets Grid -->
      <div class="card">
        <div class="card-header">
          <div class="card-header-left">
            <h3>Category Budgets</h3>
            <p>Target thresholds monitored by Agent 1 (Financial Analyzer)</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openAddBudgetModal()">
            ➕ Add Category Budget
          </button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
          ${state.budgets.length === 0 ? `
            <div class="card" style="grid-column: 1 / -1; padding:48px; text-align:center;">
              <div class="empty-state">
                <span class="empty-icon">🎯</span>
                <span class="empty-title">No Category Budgets Configured</span>
                <span class="empty-desc">Create monthly spending limits for Food, Shopping, Transport, or Bills to track utilization.</span>
                <button class="btn btn-primary" onclick="openAddBudgetModal()">➕ Create First Budget</button>
              </div>
            </div>
          ` : state.budgets.map(b => {
            const limit = parseFloat(b.amount || 0);
            const spent = state.transactions
              .filter(t => t.type !== 'income' && t.category === b.category)
              .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
            const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const remaining = Math.max(0, limit - spent);

            return `
              <div class="card" style="background:var(--bg-surface); border:1px solid var(--border-subtle); padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                  <div>
                    <h4 style="font-size:15px; font-weight:700;">${b.category}</h4>
                    <span class="text-muted" style="font-size:12px;">Allocated Limit</span>
                  </div>
                  <span class="badge ${pct >= 100 ? 'badge-danger' : pct >= 75 ? 'badge-warning' : 'badge-success'}">
                    ${pct >= 100 ? 'Exceeded' : pct >= 75 ? 'Approaching' : 'Healthy'}
                  </span>
                </div>
                <div style="font-size:22px; font-weight:800; margin-bottom:10px;">
                  ${c}${formatNumber(spent)} <small class="text-secondary" style="font-size:13px;">/ ${c}${formatNumber(limit)}</small>
                </div>
                <div class="progress-track">
                  <div class="progress-fill ${pct >= 100 ? 'danger' : pct >= 75 ? 'warning' : ''}" style="width:${Math.min(100, pct)}%;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; font-size:12px; color:var(--text-secondary);">
                  <span>Remaining: <strong>${c}${formatNumber(remaining)}</strong></span>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('How am I pacing on my ${escapeHtml(b.category)} budget and what can I cut back on?', { category: '${escapeHtml(b.category)}', limit: ${limit}, spent: ${spent} }, 'budget_analysis')">🤖 Ask AI</button>
                    <button class="action-btn" title="Edit" onclick="openEditBudgetModal('${b.id || b.category}')">✏️</button>
                    <button class="action-btn delete" title="Delete" onclick="handleDeleteBudget('${b.id || b.category}')">🗑️</button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ==============================================================
// 4. BILLS & SUBSCRIPTIONS PAGE
// ==============================================================
function renderBillsPage(container) {
  const fin = computeFinancialState();
  const c = fin.currency;

  const totalUpcomingBills = state.bills
    .filter(b => b.status !== 'paid')
    .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
  const totalMonthlySubs = calculateMonthlySubscriptionTotal();

  container.innerHTML = `
    <div class="dashboard-grid">
      <!-- Metric Highlights -->
      <div style="display:flex; gap:20px; flex-wrap:wrap;">
        <div class="card" style="flex:1; padding:20px;">
          <span class="metric-title">Total Upcoming Bills Due</span>
          <div style="font-size:26px; font-weight:800; color:var(--warning); margin:8px 0;">
            ${c}${formatNumber(totalUpcomingBills)}
          </div>
          <span class="text-secondary" style="font-size:12px;">
            ${state.bills.filter(b => b.status !== 'paid').length} unpaid bills requiring liquidity reservation
          </span>
        </div>

        <div class="card" style="flex:1; padding:20px;">
          <span class="metric-title">Monthly Subscription Overhead</span>
          <div style="font-size:26px; font-weight:800; color:var(--indigo); margin:8px 0;">
            ${c}${formatNumber(totalMonthlySubs)}/mo
          </div>
          <span class="text-secondary" style="font-size:12px;">
            ${state.subscriptions.length} active recurring recurring services
          </span>
        </div>
      </div>

      <!-- Bills vs Subscriptions Tabs -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle); padding-bottom:16px; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <button class="btn ${state.billsTab === 'bills' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="setBillsTab('bills')">
              📅 Upcoming Bills (${state.bills.length})
            </button>
            <button class="btn ${state.billsTab === 'subscriptions' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="setBillsTab('subscriptions')">
              🔁 Subscriptions (${state.subscriptions.length})
            </button>
            <button class="btn-ask-ai btn-sm" onclick="askAIWithContext('Audit all my upcoming bills and active subscriptions for cash flow optimization', null, 'bill_analysis')">🤖 Ask AI: Audit Bills & Subs</button>
          </div>

          ${state.billsTab === 'bills'
            ? `<button class="btn btn-primary btn-sm" onclick="openAddBillModal()">➕ Add Bill</button>`
            : `<button class="btn btn-primary btn-sm" onclick="openAddSubscriptionModal()">➕ Add Subscription</button>`
          }
        </div>

        <!-- Tab Content -->
        ${state.billsTab === 'bills' ? `
          <div class="table-responsive">
            <table class="fintech-table">
              <thead>
                <tr>
                  <th>Bill Name</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                  <th>Recurring</th>
                  <th>Status</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${state.bills.length === 0 ? `
                  <tr><td colspan="6" style="text-align:center; padding:32px;">No bills scheduled. Click "+ Add Bill" to record one!</td></tr>
                ` : state.bills.map(b => {
                  const isPaid = b.status === 'paid';
                  return `
                    <tr>
                      <td><strong>${b.name}</strong></td>
                      <td style="font-weight:700;">${c}${formatNumber(b.amount)}</td>
                      <td>${b.due_date}</td>
                      <td><span class="badge badge-neutral">${b.recurring ? 'Monthly Recurring' : 'One-time'}</span></td>
                      <td>
                        <span class="badge ${isPaid ? 'badge-success' : 'badge-warning'}">
                          ${isPaid ? 'Paid' : 'Due Soon'}
                        </span>
                      </td>
                      <td>
                        <div class="table-actions" style="display:flex; align-items:center; gap:6px;">
                          <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('Can I comfortably pay ${escapeHtml(b.name)} of ${c}${formatNumber(b.amount)} due on ${b.due_date || 'this month'}?', { bill_name: '${escapeHtml(b.name)}', amount: ${b.amount} }, 'bill_analysis')">🤖 Ask AI</button>
                          <button class="btn btn-outline btn-sm" onclick="toggleBillPaidStatus('${b.id}')">
                            ${isPaid ? 'Mark Unpaid' : '✓ Mark Paid'}
                          </button>
                          <button class="action-btn" title="Edit" onclick="openEditBillModal('${b.id}')">✏️</button>
                          <button class="action-btn delete" title="Delete" onclick="handleDeleteBill('${b.id}')">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="table-responsive">
            <table class="fintech-table">
              <thead>
                <tr>
                  <th>Service / Subscription</th>
                  <th>Billing Amount</th>
                  <th>Cycle</th>
                  <th>Monthly Equivalent</th>
                  <th>Next Date</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${state.subscriptions.length === 0 ? `
                  <tr><td colspan="6" style="text-align:center; padding:32px;">No subscriptions recorded. Click "+ Add Subscription" to track recurring charges!</td></tr>
                ` : state.subscriptions.map(s => {
                  const monthlyEq = s.frequency === 'yearly' ? (s.amount / 12) : s.amount;
                  return `
                    <tr>
                      <td><strong>${s.name}</strong></td>
                      <td style="font-weight:700;">${c}${formatNumber(s.amount)}</td>
                      <td><span class="badge badge-info">${s.frequency || 'monthly'}</span></td>
                      <td>${c}${formatNumber(Math.round(monthlyEq))}/mo</td>
                      <td>${s.next_date || 'Auto-renews'}</td>
                      <td>
                        <div class="table-actions" style="display:flex; align-items:center; gap:6px;">
                          <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('Evaluate if my ${escapeHtml(s.name)} subscription (${c}${formatNumber(s.amount)}/${s.frequency || 'mo'}) fits my current budget', { subscription: '${escapeHtml(s.name)}', amount: ${s.amount}, frequency: '${s.frequency}' }, 'bill_analysis')">🤖 Ask AI</button>
                          <button class="action-btn" title="Edit" onclick="openEditSubscriptionModal('${s.id}')">✏️</button>
                          <button class="action-btn delete" title="Delete" onclick="handleDeleteSubscription('${s.id}')">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
}

function setBillsTab(tab) {
  state.billsTab = tab;
  renderBillsPage(document.getElementById('page-container'));
}

function calculateMonthlySubscriptionTotal() {
  return state.subscriptions.reduce((sum, s) => {
    const amt = parseFloat(s.amount || 0);
    return sum + (s.frequency === 'yearly' ? amt / 12 : amt);
  }, 0);
}

// ==============================================================
// 5. GOALS PAGE
// ==============================================================
function renderGoalsPage(container) {
  const fin = computeFinancialState();
  const c = fin.currency;

  container.innerHTML = `
    <div class="dashboard-grid">
      <!-- Header with Quick Goal Presets -->
      <div class="card" style="padding:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <h3 style="font-size:18px; font-weight:800;">Target Financial Milestones</h3>
            <p class="text-secondary" style="font-size:13px; margin-top:2px;">
              Surplus pace: <strong>+${c}${formatNumber(fin.monthlySurplus)}/mo</strong> available for goal contributions
            </p>
          </div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <button class="btn-ask-ai btn-sm" onclick="askAIWithContext('Provide a strategic acceleration roadmap for my financial goals based on my monthly surplus', null, 'goal_analysis')">🤖 Ask AI: Goal Strategy</button>
            <button class="btn btn-outline btn-sm" onclick="quickAddGoalPreset('Emergency Fund', 200000)">+ Emergency Fund</button>
            <button class="btn btn-outline btn-sm" onclick="quickAddGoalPreset('Laptop / Tech', 50000)">+ Tech Purchase</button>
            <button class="btn btn-primary btn-sm" onclick="openAddGoalModal()">➕ Custom Goal</button>
          </div>
        </div>
      </div>

      <!-- Goals Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:24px;">
        ${state.goals.length === 0 ? `
          <div class="card" style="grid-column: 1 / -1; padding:48px; text-align:center;">
            <div class="empty-state">
              <span class="empty-icon">🏆</span>
              <span class="empty-title">No Financial Goals Defined</span>
              <span class="empty-desc">Create clear savings milestones for emergency reserves, major purchases, or investments.</span>
              <button class="btn btn-primary" onclick="openAddGoalModal()">Create First Goal</button>
            </div>
          </div>
        ` : state.goals.map(g => {
          const target = parseFloat(g.target_amount || 1);
          const current = parseFloat(g.current_amount || 0);
          const pct = Math.min(100, Math.round((current / target) * 100));
          const shortfall = Math.max(0, target - current);
          const months = fin.monthlySurplus > 0 ? Math.ceil(shortfall / fin.monthlySurplus) : '∞';

          return `
            <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; gap:16px;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <h4 style="font-size:16px; font-weight:700;">${g.name}</h4>
                  <span class="badge badge-purple">${pct}%</span>
                </div>
                <div style="font-size:26px; font-weight:800; margin:12px 0 6px;">
                  ${c}${formatNumber(current)} <small class="text-secondary" style="font-size:14px;">/ ${c}${formatNumber(target)}</small>
                </div>
                <div class="progress-track" style="height:10px;">
                  <div class="progress-fill" style="width:${pct}%; background:linear-gradient(90deg, #8b5cf6, #38bdf8);"></div>
                </div>
              </div>

              <div style="background:var(--bg-surface); padding:12px 14px; border-radius:var(--radius-sm); font-size:12px; display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between;">
                  <span class="text-muted">Remaining Shortfall:</span>
                  <strong>${c}${formatNumber(shortfall)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span class="text-muted">Target Completion Date:</span>
                  <span>${g.target_date || 'Flexible'}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span class="text-muted">Estimated at Surplus:</span>
                  <span class="text-success"><strong>~${months} months</strong></span>
                </div>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:12px;">
                <button class="btn btn-outline btn-sm" onclick="quickContributeToGoal('${g.id}', 5000)">+ Quick Add ${c}5,000</button>
                <div style="display:flex; align-items:center; gap:6px;">
                  <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('How can I reach my ${escapeHtml(g.name)} goal faster given my current surplus?', { goal_name: '${escapeHtml(g.name)}', target_amount: ${target}, current_amount: ${current} }, 'goal_analysis')">🤖 Ask AI</button>
                  <button class="action-btn" title="Edit" onclick="openEditGoalModal('${g.id}')">✏️</button>
                  <button class="action-btn delete" title="Delete" onclick="handleDeleteGoal('${g.id}')">🗑️</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function quickAddGoalPreset(name, amount) {
  document.getElementById('goal-form-name').value = name;
  document.getElementById('goal-form-target').value = amount;
  document.getElementById('goal-form-current').value = Math.round(amount * 0.3);
  document.getElementById('goal-edit-id').value = '';
  openModal('modal-goal');
}

async function quickContributeToGoal(goalId, amt) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;
  goal.current_amount = parseFloat(goal.current_amount || 0) + amt;

  try {
    await fetch(`${API_BASE}/api/financial-data/goals/${goalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal)
    });
    showToast(`Added ${state.profile.currency || '₹'}${formatNumber(amt)} to ${goal.name}`, 'success');
    renderGoalsPage(document.getElementById('page-container'));
  } catch (err) {
    showToast('Failed to update goal', 'danger');
  }
}

// ==============================================================
// 6. ACCOUNTS PAGE
// ==============================================================
function renderAccountsPage(container) {
  const fin = computeFinancialState();
  const c = fin.currency;

  container.innerHTML = `
    <div class="dashboard-grid">
      <!-- Liquidity Summary -->
      <div class="card" style="padding:28px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <span class="badge badge-success">Consolidated Net Liquid Position</span>
            <div style="font-size:32px; font-weight:800; margin-top:8px;">
              ${c}${formatNumber(fin.totalBalance)}
            </div>
            <p class="text-secondary" style="font-size:13px; margin-top:4px;">
              Factual liquid money available across ${state.accounts.length} monitored accounts
            </p>
          </div>
          <button class="btn btn-primary" onclick="openAddAccountModal()">
            <span class="btn-icon">➕</span> Add Account
          </button>
        </div>
      </div>

      <!-- Accounts Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
        ${state.accounts.length === 0 ? `
          <div class="card" style="grid-column: 1 / -1; padding:48px; text-align:center;">
            <div class="empty-state">
              <span class="empty-icon">🏦</span>
              <span class="empty-title">No Accounts Linked</span>
              <span class="empty-desc">Link your bank accounts, savings reserves, cash wallets, or credit cards to monitor liquidity.</span>
              <button class="btn btn-primary" onclick="openAddAccountModal()">➕ Add First Account</button>
            </div>
          </div>
        ` : state.accounts.map(a => {
          const isNegative = parseFloat(a.balance || 0) < 0;
          return `
            <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; gap:16px;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div>
                    <h4 style="font-size:16px; font-weight:700;">${a.name}</h4>
                    <span class="text-muted" style="font-size:12px;">${a.masked_number || '•••• 4892'}</span>
                  </div>
                  <span class="badge ${a.type === 'Credit Card' ? 'badge-warning' : a.type === 'Savings' ? 'badge-purple' : 'badge-info'}">
                    ${a.type}
                  </span>
                </div>
                <div style="font-size:24px; font-weight:800; margin-top:16px; color:${isNegative ? 'var(--danger)' : 'var(--text-primary)'};">
                  ${c}${formatNumber(a.balance)}
                </div>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:12px;">
                <button class="btn btn-outline btn-sm" onclick="quickUpdateAccountBalance('${a.id}')">Update Balance</button>
                <div style="display:flex; gap:8px;">
                  <button class="action-btn" title="Edit" onclick="openEditAccountModal('${a.id}')">✏️</button>
                  <button class="action-btn delete" title="Delete" onclick="handleDeleteAccount('${a.id}')">🗑️</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Security Notice Card -->
      <div class="card" style="background:var(--bg-surface); border:1px solid var(--border-subtle); padding:20px;">
        <div style="display:flex; gap:14px; align-items:center;">
          <div style="font-size:24px;">🔒</div>
          <div>
            <h4 style="font-size:14px; font-weight:700;">Simulated Security Guarantee</h4>
            <p class="text-secondary" style="font-size:12px; margin-top:2px;">
              Money Arnold operates as an intelligent advisory layer. No live bank credentials, PINs, or UPI passwords are ever stored or requested.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function quickUpdateAccountBalance(accId) {
  const acc = state.accounts.find(a => a.id === accId);
  if (!acc) return;
  const newBal = prompt(`Enter new balance for ${acc.name}:`, acc.balance);
  if (newBal === null || isNaN(parseFloat(newBal))) return;

  acc.balance = parseFloat(newBal);
  try {
    await fetch(`${API_BASE}/api/financial-data/accounts/${accId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(acc)
    });
    showToast('Balance updated for ' + acc.name, 'success');
    renderAccountsPage(document.getElementById('page-container'));
  } catch (e) {
    showToast('Failed to update balance', 'danger');
  }
}



// ==============================================================
// 8. ALERTS & ACTIONS PAGE
// ==============================================================
function renderAlertsPage(container) {
  // Only show non-resolved alerts
  let filteredAlerts = state.alerts.filter(a => a.status !== 'resolved');
  if (state.alertSeverityFilter !== 'all') {
    filteredAlerts = filteredAlerts.filter(a => a.level === state.alertSeverityFilter);
  }

  container.innerHTML = `
    <div class="dashboard-grid">
      <!-- Severity Filter Bar -->
      <div class="card" style="padding:16px 24px;">
        <div class="alerts-filter-bar" style="margin-bottom:0;">
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <button class="btn ${state.alertSeverityFilter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="setAlertSeverity('all')">All Alerts (${state.alerts.filter(a => a.status !== 'resolved').length})</button>
            <button class="btn ${state.alertSeverityFilter === 'danger' ? 'btn-danger' : 'btn-secondary'} btn-sm" onclick="setAlertSeverity('danger')">Critical</button>
            <button class="btn ${state.alertSeverityFilter === 'warning' ? 'btn-warning' : 'btn-secondary'} btn-sm" onclick="setAlertSeverity('warning')">Warnings</button>
            <button class="btn ${state.alertSeverityFilter === 'info' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="setAlertSeverity('info')">Info</button>
            <button class="btn-ask-ai btn-sm" onclick="askAIWithContext('Provide an overview of all active alerts and prioritize remediation steps to protect cash flow', null, 'alert_explanation')">🤖 Ask AI: Remediate</button>
          </div>
          <button class="btn btn-outline btn-sm" onclick="resolveAllAlerts()">✓ Dismiss All</button>
        </div>
      </div>

      <!-- Alerts List -->
      <div class="alerts-list">
        ${filteredAlerts.length === 0 ? `
          <div class="card" style="padding:48px; text-align:center;">
            <div class="empty-state">
              <span class="empty-icon">🛡️</span>
              <span class="empty-title">All Clear! No Active Alerts</span>
              <span class="empty-desc">No budget breaches or urgent cash-flow bottlenecks detected.</span>
            </div>
          </div>
        ` : filteredAlerts.map(a => {
          return `
            <div class="alert-card-item ${a.level || 'warning'}">
              <div class="alert-item-left">
                <div class="alert-item-icon">
                  ${a.level === 'danger' ? '🚨' : a.level === 'info' ? 'ℹ️' : '⚠️'}
                </div>
                <div class="alert-item-content">
                  <h4>${a.title}</h4>
                  <p>${a.message}</p>
                  <div class="alert-item-meta">
                    <span class="badge badge-neutral">${a.level ? a.level.toUpperCase() : 'ALERT'}</span>
                    <span>Active</span>
                  </div>
                </div>
              </div>
              <div class="alert-item-actions" style="display:flex; align-items:center; gap:8px;">
                <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('Explain this alert in detail and suggest preventative actions: ${escapeHtml(a.title).replace(/'/g, "\\'")}. Details: ${escapeHtml(a.message).replace(/'/g, "\\'")}', { alert_id: '${a.id}', title: '${escapeHtml(a.title).replace(/'/g, "\\'")}', message: '${escapeHtml(a.message).replace(/'/g, "\\'")}', level: '${a.level}' }, 'alert_explanation')">🤖 Ask AI</button>
                <button class="btn btn-outline btn-sm" onclick="resolveAlert('${a.id}')">✓ Dismiss</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function setAlertSeverity(sev) {
  state.alertSeverityFilter = sev;
  renderAlertsPage(document.getElementById('page-container'));
}

function resolveAlert(id) {
  // Remove from state entirely so it disappears from the alerts tab
  state.alerts = state.alerts.filter(a => a.id !== id);
  updateBadgeCounts();
  renderAlertsPage(document.getElementById('page-container'));
  showToast('Alert dismissed', 'info');
}

function resolveAllAlerts() {
  state.alerts = [];
  updateBadgeCounts();
  renderAlertsPage(document.getElementById('page-container'));
  showToast('All alerts dismissed', 'success');
}

// ==============================================================
// 9. FINANCIAL SETUP / ADD YOUR DATA PAGE
// ==============================================================
function renderSetupPage(container) {
  const fin = computeFinancialState();
  const c = fin.currency;
  const planned = state.profile.planned_purchase || { item: 'Laptop', amount: 50000 };
  const accountTypes = ['Bank', 'Savings', 'Cash', 'Credit Card', 'Investment', 'Other'];

  container.innerHTML = `
    <div class="setup-container">
      <div class="setup-header-banner">
        <div>
          <h2>Financial Setup & Manual Data Entry</h2>
          <p>
            Edit any field below, then save. Name, income, accounts, budgets, bills, and goals are written to the live store and used on the dashboard.
          </p>
        </div>
        <button type="button" class="btn btn-demo" onclick="loadSampleDemoData()">
          ↺ Reset to Verified Demo Data
        </button>
      </div>

      <div class="setup-section-card">
        <div class="setup-section-title">
          <h3>👤 1. Personal Financial Baseline</h3>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="setup-name">Full Name</label>
            <input type="text" id="setup-name" value="${escapeHtml(state.profile.user_name || 'Demo User')}">
          </div>
          <div class="form-group">
            <label for="setup-email">Email Address</label>
            <input type="email" id="setup-email" value="${escapeHtml(state.profile.user_email || 'demo@financialbuddy.ai')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="setup-income">Monthly Take-Home Income (${escapeHtml(c)})</label>
            <input type="number" id="setup-income" min="0" step="any" value="${Number.isFinite(state.profile.monthly_income) ? state.profile.monthly_income : 0}">
          </div>
          <div class="form-group">
            <label for="setup-currency">Preferred Currency Symbol</label>
            <input type="text" id="setup-currency" value="${escapeHtml(c)}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="setup-savings">Current Savings (${escapeHtml(c)})</label>
            <input type="number" id="setup-savings" min="0" step="any" value="${state.profile.current_savings || 0}">
          </div>
          <div class="form-group">
            <label for="setup-savings-goal">Savings Goal (${escapeHtml(c)})</label>
            <input type="number" id="setup-savings-goal" min="0" step="any" value="${Number.isFinite(state.profile.savings_goal) ? state.profile.savings_goal : 0}">
          </div>
        </div>
      </div>

      <div class="setup-section-card">
        <div class="setup-section-title">
          <h3>🏦 2. Financial Accounts (${state.accounts.length})</h3>
          <button type="button" class="btn btn-outline btn-sm" onclick="openAddAccountModal()">+ Add Account</button>
        </div>
        <div class="table-responsive">
          <table class="fintech-table">
            <thead>
              <tr>
                <th>Account Name</th>
                <th>Type</th>
                <th>Current Balance</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.accounts.map(a => `
                <tr>
                  <td>
                    <input class="setup-table-input" type="text" data-setup-acc="${escapeHtml(a.id)}" data-field="name" value="${escapeHtml(a.name || '')}">
                  </td>
                  <td>
                    <select class="setup-table-input" data-setup-acc="${escapeHtml(a.id)}" data-field="type">
                      ${accountTypes.map(t => `<option value="${t}" ${a.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                  </td>
                  <td>
                    <input class="setup-table-input" type="number" step="any" data-setup-acc="${escapeHtml(a.id)}" data-field="balance" value="${a.balance}">
                  </td>
                  <td style="text-align:right;">
                    <button type="button" class="action-btn" title="Edit" onclick="openEditAccountModal('${a.id}')">✏️</button>
                    <button type="button" class="action-btn delete" title="Delete" onclick="handleDeleteAccount('${a.id}')">🗑️</button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="4" class="text-secondary">No accounts yet. Add one to set your liquid balance.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="setup-section-card">
        <div class="setup-section-title">
          <h3>🎯 3. Monthly Budgets (${state.budgets.length})</h3>
          <button type="button" class="btn btn-outline btn-sm" onclick="openAddBudgetModal()">+ Add Budget</button>
        </div>
        <div class="table-responsive">
          <table class="fintech-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Monthly Limit</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.budgets.map(b => {
                const bKey = b.id || b.category;
                return `
                <tr>
                  <td>
                    <input class="setup-table-input" type="text" data-setup-budget="${escapeHtml(bKey)}" data-field="category" value="${escapeHtml(b.category || '')}">
                  </td>
                  <td>
                    <input class="setup-table-input" type="number" min="0" step="any" data-setup-budget="${escapeHtml(bKey)}" data-field="amount" value="${b.amount}">
                  </td>
                  <td style="text-align:right;">
                    <button type="button" class="action-btn" title="Edit" onclick="openEditBudgetModal('${bKey}')">✏️</button>
                    <button type="button" class="action-btn delete" title="Delete" onclick="handleDeleteBudget('${bKey}')">🗑️</button>
                  </td>
                </tr>`;
              }).join('') || '<tr><td colspan="3" class="text-secondary">No budgets yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="setup-section-card">
        <div class="setup-section-title">
          <h3>📅 4. Upcoming Bills (${state.bills.length})</h3>
          <button type="button" class="btn btn-outline btn-sm" onclick="openAddBillModal()">+ Add Bill</button>
        </div>
        <div class="table-responsive">
          <table class="fintech-table">
            <thead>
              <tr>
                <th>Bill Name</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.bills.map(b => `
                <tr>
                  <td>
                    <input class="setup-table-input" type="text" data-setup-bill="${escapeHtml(b.id)}" data-field="name" value="${escapeHtml(b.name || '')}">
                  </td>
                  <td>
                    <input class="setup-table-input" type="number" min="0" step="any" data-setup-bill="${escapeHtml(b.id)}" data-field="amount" value="${b.amount}">
                  </td>
                  <td>
                    <input class="setup-table-input" type="date" data-setup-bill="${escapeHtml(b.id)}" data-field="due_date" value="${escapeHtml(b.due_date || '')}">
                  </td>
                  <td style="text-align:right;">
                    <button type="button" class="action-btn" title="Edit" onclick="openEditBillModal('${b.id}')">✏️</button>
                    <button type="button" class="action-btn delete" title="Delete" onclick="handleDeleteBill('${b.id}')">🗑️</button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="4" class="text-secondary">No bills yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="setup-section-card">
        <div class="setup-section-title">
          <h3>🏆 5. Goals & Planned Purchase Affordability Test</h3>
          <button type="button" class="btn btn-outline btn-sm" onclick="openAddGoalModal()">+ Add Goal</button>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="setup-purchase-item">Planned Purchase Item Name</label>
            <input type="text" id="setup-purchase-item" value="${escapeHtml(planned.item || '')}">
          </div>
          <div class="form-group">
            <label for="setup-purchase-cost">Planned Purchase Cost (${escapeHtml(c)})</label>
            <input type="number" id="setup-purchase-cost" min="0" step="any" value="${Number.isFinite(planned.amount) ? planned.amount : 0}">
          </div>
        </div>
        <div class="table-responsive">
          <table class="fintech-table">
            <thead>
              <tr>
                <th>Goal</th>
                <th>Saved</th>
                <th>Target</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.goals.map(g => `
                <tr>
                  <td>
                    <input class="setup-table-input" type="text" data-setup-goal="${escapeHtml(g.id)}" data-field="name" value="${escapeHtml(g.name || '')}">
                  </td>
                  <td>
                    <input class="setup-table-input" type="number" min="0" step="any" data-setup-goal="${escapeHtml(g.id)}" data-field="current_amount" value="${g.current_amount || 0}">
                  </td>
                  <td>
                    <input class="setup-table-input" type="number" min="0" step="any" data-setup-goal="${escapeHtml(g.id)}" data-field="target_amount" value="${g.target_amount || 0}">
                  </td>
                  <td style="text-align:right;">
                    <button type="button" class="action-btn" title="Edit" onclick="openEditGoalModal('${g.id}')">✏️</button>
                    <button type="button" class="action-btn delete" title="Delete" onclick="handleDeleteGoal('${g.id}')">🗑️</button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="4" class="text-secondary">No goals yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="setup-sticky-footer">
        <div>
          <strong>Save & Sync Financial Profile</strong>
          <p class="text-secondary" style="font-size:12px;">Writes every edited field above to the data store and refreshes dashboard metrics</p>
        </div>
        <button type="button" class="btn btn-primary" id="btn-save-setup" onclick="handleSaveFullSetup()">
          ✓ Save Financial Profile & Recalculate
        </button>
      </div>
    </div>
  `;
}

function collectSetupKeyedRows(attrName) {
  const map = {};
  document.querySelectorAll(`[${attrName}]`).forEach(el => {
    const key = el.getAttribute(attrName);
    const field = el.getAttribute('data-field');
    if (!key || !field) return;
    if (!map[key]) map[key] = {};
    map[key][field] = el.type === 'number' ? parseFloat(el.value) : el.value;
  });
  return map;
}

async function handleSaveFullSetup() {
  const nameEl = document.getElementById('setup-name');
  const emailEl = document.getElementById('setup-email');
  const incomeEl = document.getElementById('setup-income');
  const currencyEl = document.getElementById('setup-currency');
  const savingsEl = document.getElementById('setup-savings');
  const savingsGoalEl = document.getElementById('setup-savings-goal');
  const itemEl = document.getElementById('setup-purchase-item');
  const costEl = document.getElementById('setup-purchase-cost');
  const saveBtn = document.getElementById('btn-save-setup');

  if (!nameEl || !incomeEl) {
    showToast('Setup form is not ready. Refresh and try again.', 'danger');
    return;
  }

  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  const income = parseFloat(incomeEl.value);
  const currency = currencyEl.value.trim() || '₹';
  const currentSavings = parseFloat(savingsEl.value);
  const savingsGoal = parseFloat(savingsGoalEl.value);
  const item = itemEl.value.trim() || 'Laptop';
  const cost = parseFloat(costEl.value);

  const accEdits = collectSetupKeyedRows('data-setup-acc');
  const budgetEdits = collectSetupKeyedRows('data-setup-budget');
  const billEdits = collectSetupKeyedRows('data-setup-bill');
  const goalEdits = collectSetupKeyedRows('data-setup-goal');

  state.accounts = state.accounts.map(a => {
    const patch = accEdits[a.id] || {};
    return {
      ...a,
      name: patch.name != null ? String(patch.name).trim() : a.name,
      type: patch.type != null ? patch.type : a.type,
      balance: Number.isFinite(patch.balance) ? patch.balance : parseFloat(a.balance || 0)
    };
  });

  state.budgets = state.budgets.map(b => {
    const key = b.id || b.category;
    const patch = budgetEdits[key] || {};
    return {
      ...b,
      category: patch.category != null ? String(patch.category).trim() : b.category,
      amount: Number.isFinite(patch.amount) ? patch.amount : parseFloat(b.amount || 0)
    };
  });

  state.bills = state.bills.map(b => {
    const patch = billEdits[b.id] || {};
    return {
      ...b,
      name: patch.name != null ? String(patch.name).trim() : b.name,
      amount: Number.isFinite(patch.amount) ? patch.amount : parseFloat(b.amount || 0),
      due_date: patch.due_date || b.due_date
    };
  });

  state.goals = state.goals.map(g => {
    const patch = goalEdits[g.id] || {};
    return {
      ...g,
      name: patch.name != null ? String(patch.name).trim() : g.name,
      current_amount: Number.isFinite(patch.current_amount) ? patch.current_amount : parseFloat(g.current_amount || 0),
      target_amount: Number.isFinite(patch.target_amount) ? patch.target_amount : parseFloat(g.target_amount || 0)
    };
  });

  const liquidBalance = state.accounts.reduce((sum, acc) => {
    return sum + (acc.type !== 'Credit Card' ? parseFloat(acc.balance || 0) : 0);
  }, 0);
  const unpaidBills = state.bills
    .filter(b => b.status !== 'paid')
    .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

  state.profile = {
    ...state.profile,
    user_name: name,
    user_email: email,
    monthly_income: Number.isFinite(income) ? income : 0,
    currency,
    current_savings: Number.isFinite(currentSavings) ? currentSavings : 0,
    savings_goal: Number.isFinite(savingsGoal) ? savingsGoal : 0,
    planned_purchase: { item, amount: Number.isFinite(cost) ? cost : 0 },
    current_balance: liquidBalance,
    upcoming_bills: unpaidBills
  };

  // Keep a primary income transaction aligned so analyzers see the same salary figure
  const incomeTx = state.transactions.find(t => t.type === 'income');
  if (incomeTx) {
    incomeTx.amount = state.profile.monthly_income;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/financial-data/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: state.profile,
        accounts: state.accounts,
        budgets: state.budgets,
        transactions: state.transactions,
        bills: state.bills,
        subscriptions: state.subscriptions,
        goals: state.goals
      })
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || `Sync failed (${res.status})`);
    }

    await loadFinancialData();
    if (state.authUser) {
      state.authUser.name = name || state.authUser.name;
      state.authUser.email = email || state.authUser.email;
      try { localStorage.setItem('fb_user', JSON.stringify(state.authUser)); } catch (e) {}
    }
    updateUserUI();
    showToast('Financial Profile Saved & Synchronized!', 'success');
    navigate('dashboard');
    triggerRunWorkflow();
  } catch (err) {
    showToast('Error syncing profile: ' + err.message, 'danger');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '✓ Save Financial Profile & Recalculate';
    }
  }
}

async function loadSampleDemoData() {
  if (!confirm('Reset data store to original verified demo values?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/financial-data/reset`, { method: 'POST' });
    if (!res.ok) throw new Error('Reset failed');
    await loadFinancialData();
    showToast('Demo data reloaded successfully!', 'success');
    navigate('setup');
  } catch (err) {
    showToast('Failed to reset demo data', 'danger');
  }
}

// ==============================================================
// 10. SETTINGS & YIELD OPTIMIZER PAGE
// ==============================================================
async function renderSettingsPage(container) {
  const fin = computeFinancialState();
  const c = fin.currency;

  let investmentData = null;
  let foundryConfig = null;
  try {
    const res = await fetch(`${API_BASE}/api/investments/rates`);
    if (res.ok) investmentData = await res.json();
  } catch (e) {}

  try {
    const fRes = await fetch(`${API_BASE}/api/foundry/config`);
    if (fRes.ok) {
      const fData = await fRes.json();
      foundryConfig = fData.config || null;
    }
  } catch (e) {}

  container.innerHTML = `
    <div class="dashboard-grid">
      <!-- User Profile Settings -->
      <div class="card">
        <div class="card-header">
          <div class="card-header-left">
            <h3>Profile & Preferences</h3>
            <p>Manage your display details and local session</p>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="settings-name" value="${state.authUser ? state.authUser.name : 'Demo User'}">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="settings-email" value="${state.authUser ? state.authUser.email : 'demo@financialbuddy.ai'}" disabled>
          </div>
        </div>
        <div style="margin-top:16px; display:flex; gap:12px;">
          <button class="btn btn-primary btn-sm" onclick="saveProfilePreferences()">Save Preferences</button>
          <button class="btn btn-danger btn-sm" onclick="handleLogout()">Sign Out of Money Arnold</button>
        </div>
      </div>

      <!-- Senior Citizen FD & Bond Yield Optimizer (Verified Endpoint) -->
      ${investmentData ? `
        <div class="card">
          <div class="card-header">
            <div class="card-header-left">
              <span class="badge badge-purple" style="margin-bottom:6px;">Yield Optimization Engine</span>
              <h3>Idle Cash Optimization (Senior Citizen FDs & Sovereign Bonds)</h3>
              <p>Top verified fixed return instruments to optimize return on your ${c}${formatNumber(investmentData.summary.idle_cash)} surplus buffer</p>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:16px; margin-bottom:20px;">
            <div class="card" style="background:var(--bg-surface); padding:16px;">
              <span class="text-secondary" style="font-size:12px;">Recommended Safe Buffer</span>
              <div style="font-size:20px; font-weight:800; margin-top:4px;">${c}${formatNumber(investmentData.summary.recommended_liquid_buffer)}</div>
              <span class="text-muted" style="font-size:11px;">2 Mo Living Expenses + Bills</span>
            </div>
            <div class="card" style="background:var(--bg-surface); padding:16px;">
              <span class="text-secondary" style="font-size:12px;">Idle Optimization Surplus</span>
              <div style="font-size:20px; font-weight:800; color:var(--success); margin-top:4px;">${c}${formatNumber(investmentData.summary.idle_cash)}</div>
              <span class="text-muted" style="font-size:11px;">Safe to deploy in guaranteed yield</span>
            </div>
            <div class="card" style="background:var(--bg-surface); padding:16px;">
              <span class="text-secondary" style="font-size:12px;">Potential Extra Annual Income</span>
              <div style="font-size:20px; font-weight:800; color:var(--accent); margin-top:4px;">+${c}${formatNumber(investmentData.summary.extra_annual_income)}/yr</div>
              <span class="text-muted" style="font-size:11px;">Senior FD Rate vs Savings</span>
            </div>
          </div>

          <h4 style="font-size:14px; font-weight:700; margin-bottom:10px;">Guaranteed Government & Sovereign Bonds</h4>
          <div class="table-responsive" style="margin-bottom:20px;">
            <table class="fintech-table">
              <thead>
                <tr>
                  <th>Scheme</th>
                  <th>Yield Rate</th>
                  <th>Issuer</th>
                  <th>Payout Frequency</th>
                  <th>Safety</th>
                </tr>
              </thead>
              <tbody>
                ${investmentData.government_bonds.map(b => `
                  <tr>
                    <td><strong>${b.name}</strong></td>
                    <td><span class="badge badge-success" style="font-size:12px;">${b.rate}</span></td>
                    <td>${b.type}</td>
                    <td>${b.payout}</td>
                    <td><span class="badge badge-neutral">${b.safety}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <h4 style="font-size:14px; font-weight:700; margin-bottom:10px;">Top Insured Bank Fixed Deposits</h4>
          <div class="table-responsive">
            <table class="fintech-table">
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Senior Rate</th>
                  <th>Regular Rate</th>
                  <th>Tenure</th>
                  <th>DICGC Insurance</th>
                </tr>
              </thead>
              <tbody>
                ${investmentData.bank_fds.map(f => `
                  <tr>
                    <td><strong>${f.institution}</strong></td>
                    <td><span class="badge badge-success" style="font-size:12px;">${f.senior_rate}</span></td>
                    <td>${f.regular_rate}</td>
                    <td>${f.tenure}</td>
                    <td><span class="badge badge-neutral">${f.safety}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

    </div>
  `;
}

async function saveProfilePreferences() {
  const nameInput = document.getElementById('settings-name');
  if (nameInput && state.authUser) {
    state.authUser.name = nameInput.value.trim();
    localStorage.setItem('fb_user', JSON.stringify(state.authUser));
    const users = getLocalUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === state.authUser.email.toLowerCase());
    if (idx !== -1) {
      users[idx].name = state.authUser.name;
      saveLocalUsers(users);
    }
    updateUserUI();
    showToast('Profile preferences updated', 'success');
  }
}

async function saveFoundrySettings() {
  const endpoint = document.getElementById('foundry-endpoint')?.value.trim();
  const apiKey = document.getElementById('foundry-api-key')?.value.trim();
  const workflowId = document.getElementById('foundry-workflow-id')?.value.trim();
  const analyzerId = document.getElementById('foundry-analyzer-id')?.value.trim();
  const plannerId = document.getElementById('foundry-planner-id')?.value.trim();
  const actionId = document.getElementById('foundry-action-id')?.value.trim();
  const summarizerId = document.getElementById('foundry-summarizer-id')?.value.trim();
  const useMockFallback = document.getElementById('foundry-mock-fallback')?.checked;

  try {
    const payload = {
      endpoint,
      workflow_id: workflowId,
      analyzer_id: analyzerId,
      planner_id: plannerId,
      action_id: actionId,
      summarizer_id: summarizerId,
      use_mock_fallback: useMockFallback
    };
    if (apiKey) payload.api_key = apiKey;

    const res = await fetch(`${API_BASE}/api/foundry/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update Foundry configuration');
    showToast('Azure AI Foundry configuration saved successfully!', 'success');
    renderSettingsPage(document.getElementById('page-container'));
  } catch (err) {
    showToast('Error saving Foundry config: ' + err.message, 'danger');
  }
}

async function testFoundryConnection() {
  const box = document.getElementById('foundry-discovery-results');
  if (box) {
    box.style.display = 'block';
    box.innerHTML = '<span class="loader-spinner-inline" style="margin-right:6px;"></span> Contacting Azure AI Foundry and querying agents...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/agents/discover`);
    const data = await res.json();
    const agents = data.discovered_agents || {};
    const keys = Object.keys(agents);

    let html = `
      <div style="font-size:13px; font-weight:700; margin-bottom:8px; color:var(--text-primary);">
        Azure Connection Diagnostics
      </div>
      <div style="font-size:12px; color:var(--text-secondary); margin-bottom:10px;">
        Active Auth Method: <strong>${data.active_config?.auth_method || 'Azure CLI / Default'}</strong> | Endpoint: <code>${data.active_config?.endpoint || 'None'}</code>
      </div>
    `;

    if (keys.length > 0) {
      html += `
        <div style="font-size:12px; font-weight:600; color:var(--success); margin-bottom:6px;">
          ✓ Found ${keys.length} Agent(s) in project:
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${keys.map(k => `
            <div style="display:flex; justify-content:space-between; font-size:12px; background:var(--bg-surface); padding:6px 12px; border-radius:4px;">
              <span><strong>${escapeHtml(k)}</strong></span>
              <code style="color:var(--accent);">${escapeHtml(agents[k])}</code>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      html += `
        <div style="font-size:12px; color:var(--warning); line-height:1.5;">
          ℹ️ No remote agents were automatically returned yet. If you have created agents in Azure AI Foundry, you can paste their Agent IDs directly into the fields above, or authenticate with <code>az login</code> in your terminal if using Azure Identity.
        </div>
      `;
    }

    if (box) box.innerHTML = html;
    showToast('Foundry connection test completed', 'info');
  } catch (err) {
    if (box) {
      box.innerHTML = `<div style="color:var(--danger); font-size:12px;">Error checking Azure AI Foundry: ${escapeHtml(err.message)}</div>`;
    }
    showToast('Connection test failed: ' + err.message, 'danger');
  }
}

