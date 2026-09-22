// ==============================================================
// FINANCIAL BUDDY — COMPLETE FRONTEND CONTROLLER & ROUTER
// ==============================================================

const API_BASE = window.location.origin.includes(':8000')
  ? window.location.origin
  : 'http://localhost:8000';

// Global Application State
const state = {
  profile: {
    current_balance: 120000,
    monthly_income: 60000,
    monthly_expenses: 28500,
    upcoming_bills: 19999,
    savings_goal: 200000,
    current_savings: 80000,
    planned_purchase: { item: 'Laptop', amount: 50000 },
    currency: '₹',
    user_name: 'Demo User',
    user_email: 'demo@financialbuddy.ai'
  },
  accounts: [],
  budgets: [],
  transactions: [],
  bills: [],
  subscriptions: [],
  goals: [],
  alerts: [],
  pending_action: null,
  action_history: [],
  activePage: 'dashboard',
  periodFilter: '30d',
  txSearchQuery: '',
  txCategoryFilter: 'all',
  txTypeFilter: 'all',
  txAccountFilter: 'all',
  alertSeverityFilter: 'all',
  billsTab: 'bills',
  chatMessages: [],
  aiWorkflowData: null,
  authUser: null,
  charts: {}
};

// ==============================================================
// INITIALIZATION
// ==============================================================
document.addEventListener('DOMContentLoaded', async () => {
  initAuth();
  loadChatHistory();
  await checkBackendHealth();
  await loadFinancialData();
  setupRouteListener();
  handleRouting();
});

// Setup browser hash routing (#dashboard, #transactions, etc.)
function setupRouteListener() {
  window.addEventListener('hashchange', handleRouting);
}

function handleRouting() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigate(hash, false);
}

function navigate(page, updateHash = true) {
  if (!state.authUser && page !== 'login' && page !== 'signup') {
    showAuthScreen('login');
    return;
  }

  state.activePage = page;
  if (updateHash) {
    window.location.hash = page;
  }

  // Update sidebar active link
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('data-page') === page) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Close mobile sidebar on navigate
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');

  // Update Page Title & Subtitle in Header
  updatePageHeader(page);

  // Render Page Content
  const container = document.getElementById('page-container');
  if (!container) return;

  // Destroy previous charts to avoid canvas reuse conflicts
  destroyCharts();

  switch (page) {
    case 'dashboard':
      renderDashboard(container);
      break;
    case 'transactions':
      renderTransactionsPage(container);
      break;
    case 'budgets':
      renderBudgetsPage(container);
      break;
    case 'bills':
      renderBillsPage(container);
      break;
    case 'goals':
      renderGoalsPage(container);
      break;
    case 'accounts':
      renderAccountsPage(container);
      break;
    case 'ai':
      renderAIAssistantPage(container);
      break;
    case 'alerts':
      renderAlertsPage(container);
      break;
    case 'setup':
      renderSetupPage(container);
      break;
    case 'settings':
      renderSettingsPage(container);
      break;
    default:
      renderDashboard(container);
  }
}

function updatePageHeader(page) {
  const titleEl = document.getElementById('page-title');
  const subEl = document.getElementById('page-subtitle');
  if (!titleEl || !subEl) return;

  const meta = {
    dashboard: {
      title: 'Financial Dashboard',
      subtitle: 'Real-time overview of your factual financial situation and multi-agent intelligence'
    },
    transactions: {
      title: 'Transactions Ledger',
      subtitle: 'Full record of income, expenses, categorization, and account movements'
    },
    budgets: {
      title: 'Budget Management',
      subtitle: 'Spending limits, category utilization, and dynamic pace analysis'
    },
    bills: {
      title: 'Bills & Subscriptions',
      subtitle: 'Upcoming obligations, recurring payments, and monthly subscription overhead'
    },
    goals: {
      title: 'Financial Goals',
      subtitle: 'Track emergency buffers, big purchases, and surplus-driven completion dates'
    },
    accounts: {
      title: 'Accounts & Liquidity',
      subtitle: 'Overview of bank accounts, savings reserves, cash wallets, and credit cards'
    },
    ai: {
      title: 'Financial Buddy AI Assistant',
      subtitle: 'Powered by Microsoft Azure AI Foundry 3-agent pipeline with human-in-the-loop control'
    },
    alerts: {
      title: 'Alerts & Action Center',
      subtitle: 'Agent 3 proactive alerts, budget warnings, and simulated financial actions'
    },
    setup: {
      title: 'Financial Setup / Add Your Data',
      subtitle: 'Input your personal financial profile, accounts, budgets, and bills'
    },
    settings: {
      title: 'Settings & Investment Optimizer',
      subtitle: 'Profile customization, idle cash FD/Bond yield optimization, and demo data tools'
    }
  };

  const curr = meta[page] || meta.dashboard;
  titleEl.textContent = curr.title;
  subEl.textContent = curr.subtitle;
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// ==============================================================
// ==============================================================
// AUTHENTICATION SYSTEM (LOCAL STORAGE BASED)
// ==============================================================

function getLocalUsers() {
  try {
    const raw = localStorage.getItem('fb_users');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  // Default seeded demo user
  const defaultUsers = [
    {
      email: 'demo@financialbuddy.ai',
      password: 'demo1234',
      name: 'Demo User',
      monthly_income: 60000,
      primary_goal: 'Emergency Fund',
      is_authenticated: true
    }
  ];
  try {
    localStorage.setItem('fb_users', JSON.stringify(defaultUsers));
  } catch (e) {}
  return defaultUsers;
}

function saveLocalUsers(users) {
  try {
    localStorage.setItem('fb_users', JSON.stringify(users));
  } catch (e) {}
}

function initAuth() {
  getLocalUsers(); // Ensure demo user is seeded
  const savedUser = localStorage.getItem('fb_user');
  if (savedUser) {
    try {
      state.authUser = JSON.parse(savedUser);
      hideAuthScreen();
      updateUserUI();
    } catch (e) {
      state.authUser = null;
      localStorage.removeItem('fb_user');
      showAuthScreen('login');
    }
  } else {
    // If no active session, stay on login screen (do not auto-login)
    state.authUser = null;
    showAuthScreen('login');
  }
}

function showAuthScreen(tab = 'login') {
  const screen = document.getElementById('auth-screen');
  if (screen) screen.classList.remove('hidden');
  switchAuthTab(tab);
}

function hideAuthScreen() {
  const screen = document.getElementById('auth-screen');
  if (screen) screen.classList.add('hidden');
}

function switchAuthTab(tab) {
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');

  if (tab === 'login') {
    if (tabLogin) tabLogin.classList.add('active');
    if (tabSignup) tabSignup.classList.remove('active');
    if (formLogin) formLogin.classList.remove('hidden');
    if (formSignup) formSignup.classList.add('hidden');
  } else {
    if (tabSignup) tabSignup.classList.add('active');
    if (tabLogin) tabLogin.classList.remove('active');
    if (formSignup) formSignup.classList.remove('hidden');
    if (formLogin) formLogin.classList.add('hidden');
  }
}

async function handleLogin(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById('login-email');
  const pwdInput = document.getElementById('login-password');
  if (!emailInput || !pwdInput) return;

  const email = emailInput.value.trim().toLowerCase();
  const password = pwdInput.value;

  const users = getLocalUsers();
  const matched = users.find(u => u.email.toLowerCase() === email && u.password === password);

  // Match demo or local storage user
  if (matched || (email === 'demo@financialbuddy.ai' && (password === 'demo1234' || password === 'demo'))) {
    const activeUser = matched || {
      email: 'demo@financialbuddy.ai',
      name: 'Demo User',
      monthly_income: 60000,
      primary_goal: 'Emergency Fund',
      is_authenticated: true
    };
    activeUser.is_authenticated = true;
    state.authUser = activeUser;

    localStorage.setItem('fb_user', JSON.stringify(activeUser));

    // Optional backend sync
    try {
      await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: activeUser.name })
      });
    } catch (err) {}

    hideAuthScreen();
    updateUserUI();
    loadChatHistory();
    showToast(`Signed in successfully as ${activeUser.name}`, 'success');
    navigate('dashboard');
    return;
  }

  // Fallback: try backend auth
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Invalid email or password');

    state.authUser = data.user;
    localStorage.setItem('fb_user', JSON.stringify(state.authUser));

    users.push({ ...data.user, password });
    saveLocalUsers(users);

    hideAuthScreen();
    updateUserUI();
    loadChatHistory();
    showToast(`Signed in successfully as ${state.authUser.name}`, 'success');
    navigate('dashboard');
  } catch (err) {
    showToast(err.message || 'Invalid email or password. Use Instant Demo Login or create an account.', 'danger');
  }
}

async function handleSignup(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById('signup-name');
  const emailInput = document.getElementById('signup-email');
  const pwdInput = document.getElementById('signup-password');
  const confirmPwdInput = document.getElementById('signup-confirm-password');
  const incomeInput = document.getElementById('signup-income');
  const goalInput = document.getElementById('signup-goal');
  const errEl = document.getElementById('signup-error-msg');

  if (!nameInput || !emailInput || !pwdInput) return;

  const name = nameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const password = pwdInput.value;
  const confirmPassword = confirmPwdInput ? confirmPwdInput.value : '';
  const income = incomeInput ? (parseFloat(incomeInput.value) || 60000) : 60000;
  const goal = goalInput ? goalInput.value : 'Emergency Fund';

  if (password !== confirmPassword) {
    if (errEl) {
      errEl.textContent = 'Passwords do not match!';
      errEl.classList.remove('hidden');
    }
    return;
  }
  if (password.length < 6) {
    if (errEl) {
      errEl.textContent = 'Password must be at least 6 characters long!';
      errEl.classList.remove('hidden');
    }
    return;
  }
  if (errEl) errEl.classList.add('hidden');

  const users = getLocalUsers();
  if (users.some(u => u.email.toLowerCase() === email)) {
    if (errEl) {
      errEl.textContent = 'An account with this email already exists. Please sign in.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  const newUser = {
    name,
    email,
    password,
    monthly_income: income,
    primary_goal: goal,
    is_authenticated: true
  };

  users.push(newUser);
  saveLocalUsers(users);

  state.authUser = {
    name,
    email,
    monthly_income: income,
    primary_goal: goal,
    is_authenticated: true
  };
  localStorage.setItem('fb_user', JSON.stringify(state.authUser));

  // Update profile in state
  state.profile.user_name = name;
  state.profile.user_email = email;
  state.profile.monthly_income = income;

  // Optional backend sync
  try {
    await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        monthly_income: income,
        primary_goal: goal
      })
    });
  } catch (err) {}

  hideAuthScreen();
  updateUserUI();
  await loadFinancialData();
  loadChatHistory();
  showToast(`Welcome to Financial Buddy, ${name}!`, 'success');
  navigate('dashboard');
}

function handleQuickDemoLogin() {
  const demoUser = {
    email: 'demo@financialbuddy.ai',
    name: 'Demo User',
    monthly_income: 60000,
    primary_goal: 'Emergency Fund',
    is_authenticated: true
  };
  state.authUser = demoUser;
  localStorage.setItem('fb_user', JSON.stringify(demoUser));
  hideAuthScreen();
  updateUserUI();
  loadChatHistory();
  showToast('Signed in with Demo Financial Profile', 'info');
  navigate('dashboard');
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
  } catch (e) {}

  state.authUser = null;
  localStorage.removeItem('fb_user');
  sessionStorage.removeItem('fb_user');

  // Reset UI and reveal auth screen on login tab
  showAuthScreen('login');
  showToast('Logged out securely', 'info');
}

function updateUserUI() {
  if (!state.authUser) return;
  const initials = state.authUser.name
    ? state.authUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : 'FB';
  
  const sideAvatar = document.getElementById('sidebar-user-avatar');
  const headAvatar = document.getElementById('header-user-avatar');
  const sideName = document.getElementById('sidebar-user-name');
  const sideEmail = document.getElementById('sidebar-user-email');

  if (sideAvatar) sideAvatar.textContent = initials;
  if (headAvatar) headAvatar.textContent = initials;
  if (sideName) sideName.textContent = state.authUser.name || 'Demo User';
  if (sideEmail) sideEmail.textContent = state.authUser.email || 'demo@financialbuddy.ai';
}

function openForgotPwdModal(e) {
  if (e) e.preventDefault();
  openModal('modal-forgot-pwd');
}

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

    updateBadgeCounts();
  } catch (err) {
    console.warn('Could not fetch financial data, using local fallback:', err);
  }
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
    showToast('Azure AI Foundry 3-Agent Analysis complete!', 'success');

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
  const monthlyIncome = Number.isFinite(profileIncome) && profileIncome > 0
    ? profileIncome
    : (txIncomeTotal || 60000);

  // 3. Monthly Expenses: Sum of expense transactions or profile
  const expenseTxs = state.transactions.filter(t => t.type !== 'income');
  const monthlyExpenses = expenseTxs.length > 0
    ? expenseTxs.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
    : parseFloat(state.profile.monthly_expenses || 28500);

  // 4. Surplus / Deficit
  const monthlySurplus = monthlyIncome - monthlyExpenses;

  // 5. Savings
  const currentSavings = parseFloat(state.profile.current_savings || 80000);
  const savingsGoal = parseFloat(state.profile.savings_goal || 200000);
  const savingsRate = monthlyIncome > 0 ? Math.round((monthlySurplus / monthlyIncome) * 100) : 0;

  // 6. Upcoming Obligations (Sum of unpaid bills)
  const unpaidBills = state.bills.filter(b => b.status !== 'paid');
  const upcomingBills = unpaidBills.length > 0
    ? unpaidBills.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0)
    : parseFloat(state.profile.upcoming_bills || 19999);

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
            <span class="text-muted">Across ${state.accounts.length || 3} accounts</span>
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
              ${Math.round((fin.currentSavings / fin.savingsGoal) * 100)}% of ${c}${formatNumber(fin.savingsGoal)}
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

      <!-- FINANCIAL INTELLIGENCE SECTION: 3 AZURE AI FOUNDRY AGENTS -->
      ${renderFinancialIntelligenceHtml(fin)}

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

  const planned = state.profile.planned_purchase || { item: 'Laptop', amount: 50000 };

  return `
    <section class="financial-intelligence-section">
      <div class="fi-header">
        <div>
          <div class="fi-title-badge">
            <h2>Financial Intelligence</h2>
            <span class="badge badge-purple">Microsoft Azure AI Foundry 3-Agent Workflow</span>
          </div>
          <p class="text-secondary" style="font-size:13px;">
            Continuous multi-agent reasoning: <strong>Observe → Understand → Connect Context → Explain → Predict → Recommend → Human Confirmation</strong>
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
              <span><strong>Transaction Patterns:</strong> ${state.transactions.length} transactions processed. Top spend in Food and Shopping.</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>Subscription Audit:</strong> ${state.subscriptions.length} active recurring subscriptions identified (${c}${formatNumber(calculateMonthlySubscriptionTotal())}/mo).</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>Budget Alert:</strong> ${
                analyzer && analyzer.alerts && analyzer.alerts.length > 0
                  ? analyzer.alerts[0]
                  : 'Shopping budget reached 75% limit threshold.'
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
                  : `Purchasing the ${c}${formatNumber(planned.amount)} ${planned.item} is affordable with caution, maintaining ${c}${formatNumber(fin.totalBalance - planned.amount)} liquid buffer.`
              }</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>30/60/90 Day Forecast:</strong> Projected balance is ${c}${formatNumber(fin.totalBalance + fin.monthlySurplus - fin.upcomingBills)} in 30 days at surplus pace.</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span><strong>Goal Pace:</strong> Emergency fund shortfall is ${c}${formatNumber(Math.max(0, fin.savingsGoal - fin.currentSavings))} (~${fin.monthlySurplus > 0 ? Math.ceil(Math.max(0, fin.savingsGoal - fin.currentSavings) / fin.monthlySurplus) : '∞'} months away).</span>
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
                  : `Reserve ${c}${formatNumber(fin.upcomingBills)} for upcoming obligations.`
              }</span>
            </div>
            <div class="agent-body-item">
              <span>●</span>
              <span class="text-warning"><strong>Human-in-the-Loop:</strong> Actions require human confirmation. No real bank accounts are accessed.</span>
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
          <p>${action.description || `Simulated reservation of ${c}${formatNumber(action.amount || 19999)} to safeguard upcoming obligations.`}</p>
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
  document.getElementById('modal-action-amount').textContent = `${c}${formatNumber(action.amount || 19999)}`;
  document.getElementById('modal-action-description').textContent =
    action.description || 'Agent 3 has prepared a simulated fund reservation to safeguard upcoming obligations.';

  openModal('modal-action-confirm');
}

async function handleExecuteActionDecision(confirmed, actionParam = null) {
  closeModal('modal-action-confirm');
  const action = actionParam || state.pending_action || {
    type: 'reserve_bill_funds',
    amount: 19999,
    description: 'Reserve funds for upcoming bills'
  };

  try {
    const res = await fetch(`${API_BASE}/api/action/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_type: action.type || 'reserve_bill_funds',
        confirmed: confirmed,
        amount: action.amount || 19999,
        description: action.description
      })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || 'Action failed');

    state.pending_action = null;
    await loadFinancialData();

    if (result.action_executed) {
      showToast(result.message, 'success');
    } else {
      showToast('Simulated action was dismissed. No balances modified.', 'info');
    }

    if (state.activePage === 'ai') {
      state.chatMessages.push({
        role: 'assistant',
        content: confirmed
          ? `✅ **Action Confirmed:** ${result.message}`
          : `❌ **Action Dismissed:** The simulated action was cancelled. No balances were modified.`
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
          <span>${isIncome ? '💰' : '💳'}</span>
          <span>${t.merchant}</span>
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
                      <span>${isIncome ? '💰' : '💳'}</span>
                      <strong>${t.merchant}</strong>
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
          ${state.budgets.map(b => {
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
        ${state.accounts.map(a => {
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
              Financial Buddy operates as an intelligent advisory layer. No live bank credentials, PINs, or UPI passwords are ever stored or requested.
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
// 7. AI ASSISTANT PAGE (CONVERSATIONAL 3-AGENT INTERFACE)
// ==============================================================

function getChatStorageKey() {
  const email = (state.authUser && state.authUser.email) ? state.authUser.email.replace(/[^a-zA-Z0-9]/g, '_') : 'guest';
  return `fb_ai_chat_${email}`;
}

function loadChatHistory() {
  try {
    const key = getChatStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      state.chatMessages = JSON.parse(saved);
    } else {
      state.chatMessages = [];
    }
  } catch (e) {
    console.error('Failed to load chat history from localStorage', e);
  }
}

function saveChatHistory() {
  try {
    const key = getChatStorageKey();
    localStorage.setItem(key, JSON.stringify(state.chatMessages));
  } catch (e) {
    console.error('Failed to save chat history to localStorage', e);
  }
}

function renderAIAssistantPage(container) {
  const fin = computeFinancialState();
  const c = fin.currency;

  container.innerHTML = `
    <div class="ai-assistant-container">
      <!-- Left: Conversational Area -->
      <div class="ai-chat-card">
        <div class="ai-chat-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="chat-avatar ai-avatar">🤖</div>
            <div>
              <h3 style="font-size:15px; font-weight:700;">Financial Buddy AI</h3>
              <span class="badge badge-purple" style="font-size:10px;">Microsoft Azure AI Foundry 3-Agent Workflow</span>
            </div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="clearAIChat()" title="Clear history and start fresh">
            ✨ New Conversation
          </button>
        </div>

        <!-- Quick Prompt Chips -->
        <div class="ai-prompt-chips">
          <button class="prompt-chip" onclick="sendQuickAIPrompt('Can I afford a ₹50,000 laptop?')">
            💻 Can I afford a ₹50,000 laptop?
          </button>
          <button class="prompt-chip" onclick="sendQuickAIPrompt('What if I buy it next month instead?')">
            🔄 What if I buy it next month?
          </button>
          <button class="prompt-chip" onclick="sendQuickAIPrompt('Why am I spending more this month?')">
            📊 Why am I spending more this month?
          </button>
          <button class="prompt-chip" onclick="sendQuickAIPrompt('Am I on track for my emergency fund?')">
            🛡️ Am I on track for my emergency fund?
          </button>
          <button class="prompt-chip" onclick="sendQuickAIPrompt('What bills are coming up?')">
            📅 What bills are coming up?
          </button>
          <button class="prompt-chip" onclick="sendQuickAIPrompt('How much can I safely spend this month?')">
            💳 How much can I safely spend?
          </button>
        </div>

        <!-- Chat Message Stream -->
        <div class="ai-chat-messages" id="ai-chat-messages">
          <!-- Initial AI Welcome Bubble -->
          <div class="chat-message">
            <div class="chat-avatar ai-avatar">🤖</div>
            <div class="chat-bubble">
              <p>Hello! I am your <strong>Financial Buddy</strong>, powered by Microsoft Azure AI Foundry's 3-agent intelligence pipeline.</p>
              <p style="margin-top:6px; color:var(--text-secondary);">
                Every inquiry flows across our coordinated multi-agent workflow: <strong>Agent 1 (Financial Analyzer)</strong> categorizes & audits your spending, <strong>Agent 2 (Financial Planner)</strong> models cash-flow forecasts & scenario feasibility, and <strong>Agent 3 (Proactive Alerts & Action)</strong> safeguards your balance with human-authorized simulation gates.
              </p>
              <p style="margin-top:6px;">Ask me anything about major purchases, multi-turn what-if scenarios, bills, or budget limits!</p>
            </div>
          </div>

          ${state.chatMessages.map(msg => renderChatMessageHtml(msg)).join('')}
        </div>

        <!-- Input Bar -->
        <form class="ai-chat-input-bar" onsubmit="handleSendAIChat(event)">
          <input type="text" id="ai-chat-input" placeholder="Ask Financial Buddy (e.g. 'Can I buy a ₹30,000 phone?' or 'What if I wait 2 months?')..." required autocomplete="off">
          <button type="submit" id="btn-ai-send" class="btn btn-primary">
            <span>Ask AI</span>
          </button>
        </form>
      </div>

      <!-- Right: Real-time Financial Facts Context Panel -->
      <div class="ai-context-panel">
        <div class="context-card">
          <h4>Live Financial Facts</h4>
          <div class="context-item">
            <span class="text-secondary">Liquid Balance:</span>
            <strong>${c}${formatNumber(fin.totalBalance)}</strong>
          </div>
          <div class="context-item">
            <span class="text-secondary">Monthly Surplus:</span>
            <strong class="${fin.monthlySurplus >= 0 ? 'text-success' : 'text-danger'}">${fin.monthlySurplus >= 0 ? '+' : ''}${c}${formatNumber(fin.monthlySurplus)}/mo</strong>
          </div>
          <div class="context-item">
            <span class="text-secondary">Emergency Savings:</span>
            <strong>${c}${formatNumber(fin.currentSavings)} <small class="text-muted">(${Math.round((fin.currentSavings/fin.savingsGoal)*100)}%)</small></strong>
          </div>
          <div class="context-item">
            <span class="text-secondary">Upcoming Bills:</span>
            <strong class="text-warning">${c}${formatNumber(fin.upcomingBills)}</strong>
          </div>
          <div class="context-item">
            <span class="text-secondary">Discretionary Remaining:</span>
            <strong>${c}${formatNumber(fin.remainingBudget)}</strong>
          </div>
        </div>

        <div class="context-card">
          <h4>3-Agent Foundry Pipeline</h4>
          <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:10px;">
            <div>
              <strong style="color:#38bdf8;">Agent 1: Financial Analyzer</strong>
              <div style="font-size:11px; color:var(--text-muted);">Categorization, merchant recognition & spending audits.</div>
            </div>
            <div>
              <strong style="color:#c084fc;">Agent 2: Financial Planner</strong>
              <div style="font-size:11px; color:var(--text-muted);">30/60/90-day cash flow projections & what-if scenario modeling.</div>
            </div>
            <div>
              <strong style="color:#fbbf24;">Agent 3: Proactive Alerts & Action</strong>
              <div style="font-size:11px; color:var(--text-muted);">Overdraft safeguards & simulated action prep with human gate.</div>
            </div>
            <div class="text-muted" style="font-size:11px; border-top:1px solid var(--border-subtle); padding-top:8px;">
              Connected to Azure AI Foundry endpoint with live context injection.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Scroll to bottom of chat
  setTimeout(() => {
    const chat = document.getElementById('ai-chat-messages');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }, 50);
}

function renderChatMessageHtml(msg) {
  if (msg.role === 'user') {
    return `
      <div class="chat-message user-msg">
        <div class="chat-avatar">👤</div>
        <div class="chat-bubble">
          <p>${escapeHtml(msg.content)}</p>
        </div>
      </div>
    `;
  }

  // Structured AI response
  const structured = msg.structured;
  if (structured) {
    const c = state.profile.currency || '₹';
    const fin = computeFinancialState();
    const actionJsonStr = structured.action ? escapeHtml(JSON.stringify(structured.action)) : '';

    return `
      <div class="chat-message">
        <div class="chat-avatar ai-avatar">🤖</div>
        <div class="chat-bubble" style="max-width:100%;">
          <div class="structured-ai-response">

            <!-- Executive Summary / Direct Answer -->
            ${structured.summary ? `
              <div class="ai-section-box summary">
                <div class="ai-section-label">📋 Executive Summary</div>
                <div style="font-weight:600; font-size:13px; line-height:1.5;">${formatMarkdownSnippet(structured.summary)}</div>
              </div>
            ` : (structured.message && !structured.understanding ? `
              <div class="ai-section-box summary">
                <div class="ai-section-label">📋 Financial Buddy Answer</div>
                <div>${formatMarkdownSnippet(structured.message)}</div>
              </div>
            ` : '')}

            <!-- Understanding (Agent 1 Context & Categorization) -->
            ${structured.understanding ? `
              <div class="ai-section-box understanding">
                <div class="ai-section-label">🧠 Agent 1: Financial Context & Baseline</div>
                <div>${formatMarkdownSnippet(structured.understanding)}</div>
              </div>
            ` : ''}

            <!-- Why It Matters (Contextual Impact) -->
            ${structured.why_it_matters ? `
              <div class="ai-section-box why-matters">
                <div class="ai-section-label">💡 Why It Matters</div>
                <div>${formatMarkdownSnippet(structured.why_it_matters)}</div>
              </div>
            ` : ''}

            <!-- Forecast (Agent 2 Cash Flow Projections) -->
            ${structured.forecast ? `
              <div class="ai-section-box forecast">
                <div class="ai-section-label">📈 Agent 2: 30 / 60 / 90 Day Cash Flow Forecast</div>
                <div>${formatMarkdownSnippet(structured.forecast)}</div>
              </div>
            ` : ''}

            <!-- What-If Scenario Comparison Card -->
            ${structured.what_if ? `
              <div class="what-if-card">
                <div class="what-if-header">
                  <div class="what-if-title">🔄 Scenario Comparison: ${escapeHtml(structured.what_if.scenario || structured.what_if.scenario_name || 'What-If Analysis')}</div>
                  <span class="badge badge-purple" style="font-size:10px;">Agent 2 Scenario Model</span>
                </div>
                <div class="what-if-grid">
                  <div class="what-if-stat">
                    <div class="stat-label">Current Balance</div>
                    <div class="stat-value">${c}${formatNumber(structured.what_if.current_balance ?? structured.what_if.current_surplus ?? fin.totalBalance)}</div>
                  </div>
                  <div class="what-if-stat">
                    <div class="stat-label">Projected Balance</div>
                    <div class="stat-value text-primary">${c}${formatNumber(structured.what_if.projected_balance ?? structured.what_if.projected_surplus ?? 0)}</div>
                  </div>
                  <div class="what-if-stat">
                    <div class="stat-label">Emergency Savings</div>
                    <div class="stat-value text-success">${c}${formatNumber(structured.what_if.current_savings ?? fin.currentSavings)}</div>
                  </div>
                  <div class="what-if-stat">
                    <div class="stat-label">Projected Savings</div>
                    <div class="stat-value text-success">${c}${formatNumber(structured.what_if.projected_savings ?? fin.currentSavings)}</div>
                  </div>
                </div>
                <div class="what-if-verdict feasible">
                  <span style="font-size:16px;">💡</span>
                  <div>
                    <strong>Scenario Impact:</strong> ${formatMarkdownSnippet(structured.what_if.impact_summary || '')}
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Recommendations (Agent 2) -->
            ${((structured.recommendations && structured.recommendations.length > 0) || structured.recommendation) ? `
              <div class="ai-section-box recommendation">
                <div class="ai-section-label">🎯 Recommendations & Strategic Next Steps</div>
                ${structured.recommendations && structured.recommendations.length > 0 ? `
                  <ul class="ai-rec-list">
                    ${structured.recommendations.map(r => `
                      <li class="ai-rec-item">
                        <span class="ai-rec-icon">✔</span>
                        <span>${formatMarkdownSnippet(r)}</span>
                      </li>
                    `).join('')}
                  </ul>
                ` : `
                  <div>${formatMarkdownSnippet(structured.recommendation)}</div>
                `}
              </div>
            ` : ''}

            <!-- Active Safeguard Alerts (Agent 3) -->
            ${structured.alerts && structured.alerts.length > 0 ? `
              <div class="ai-section-box alerts-box">
                <div class="ai-section-label">⚠️ Agent 3 Active Safeguard Alerts</div>
                <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
                  ${structured.alerts.map(a => {
                    let alertContent = '';
                    if (typeof a === 'string') {
                      alertContent = formatMarkdownSnippet(a);
                    } else if (a && typeof a === 'object') {
                      alertContent = a.title ? `<strong>${escapeHtml(a.title)}:</strong> ${escapeHtml(a.message || '')}` : escapeHtml(a.message || JSON.stringify(a));
                    }
                    return `
                      <div class="ai-alert-pill">
                        <span>⚠️</span>
                        <span>${alertContent}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Agent 3 Proposed Simulated Action & Human Confirmation Gate -->
            ${structured.action ? `
              <div class="pending-action-banner" style="margin-top:6px; padding:14px 18px; border-radius:var(--radius-md);">
                <div class="p-action-left">
                  <div class="p-action-icon" style="font-size:22px;">🛡️</div>
                  <div class="p-action-text">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <h4 style="font-size:13px; margin:0;">Agent 3 Proposed Action: ${escapeHtml(structured.action.type || 'Simulated Action')}</h4>
                      <span class="badge badge-warning" style="font-size:10px;">Human Authorization Required</span>
                    </div>
                    <p style="font-size:12px; margin-top:4px; color:var(--text-secondary);">${escapeHtml(structured.action.description || '')}</p>
                    ${structured.action.amount ? `
                      <div style="font-size:12px; margin-top:4px;">
                        <strong>Target Amount:</strong> <span style="font-weight:700; color:var(--primary);">${c}${formatNumber(structured.action.amount)}</span>
                      </div>
                    ` : ''}
                  </div>
                </div>
                <div class="p-action-buttons">
                  <button class="btn btn-secondary btn-sm" onclick='handleExecuteActionDecision(false, ${actionJsonStr})'>✕ Dismiss</button>
                  <button class="btn btn-success btn-sm" onclick='handleExecuteActionDecision(true, ${actionJsonStr})'>✓ Review & Confirm</button>
                </div>
              </div>
            ` : ''}

            <!-- Agent Contributions (Full 3-Agent Workflow Trace) -->
            ${structured.agent_contributions && structured.agent_contributions.length > 0 ? `
              <div class="agent-contributions-card">
                <div class="agent-contributions-summary" onclick="toggleAgentTrail(this)">
                  <span style="font-size:11px; font-weight:700; color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
                    <span>⚡</span> Azure AI Foundry 3-Agent Workflow Trace (${structured.agent_contributions.length} Agents)
                  </span>
                  <span class="trail-chevron" style="font-size:10px;">▼</span>
                </div>
                <div class="agent-trail-list" style="display:none;">
                  ${structured.agent_contributions.map(ac => {
                    const agentName = ac.agent || ac.agent_name || ac.agent_id || 'Foundry Agent';
                    const stage = ac.stage ? `Stage ${ac.stage}: ` : '';
                    const role = ac.role || '';
                    const obs = ac.observation || ac.contribution || '';
                    const badgeClass = (ac.stage === '1' || agentName.includes('Analyzer')) ? 'badge-agent-1' : ((ac.stage === '2' || agentName.includes('Planner')) ? 'badge-agent-2' : 'badge-agent-3');
                    return `
                      <div class="agent-trail-step">
                        <span class="agent-step-badge ${badgeClass}">${escapeHtml(stage + agentName)}</span>
                        <div>
                          ${role ? `<strong style="font-size:11px; color:var(--text-primary);">${escapeHtml(role)}: </strong>` : ''}
                          <span style="font-size:11px; color:var(--text-secondary);">${formatMarkdownSnippet(obs)}</span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="chat-message">
      <div class="chat-avatar ai-avatar">🤖</div>
      <div class="chat-bubble">
        <p>${formatMarkdownSnippet(msg.content)}</p>
      </div>
    </div>
  `;
}

function toggleAgentTrail(el) {
  const trail = el.nextElementSibling;
  const chev = el.querySelector('.trail-chevron');
  if (trail) {
    if (trail.style.display === 'none' || !trail.style.display) {
      trail.style.display = 'flex';
      if (chev) chev.textContent = '▲';
    } else {
      trail.style.display = 'none';
      if (chev) chev.textContent = '▼';
    }
  }
}

// Progressive Multi-Stage Pipeline Loader
let aiLoaderInterval = null;

function showProgressiveLoader() {
  const chatMessagesEl = document.getElementById('ai-chat-messages');
  if (!chatMessagesEl) return;

  const loaderDiv = document.createElement('div');
  loaderDiv.id = 'ai-active-loader';
  loaderDiv.className = 'chat-message';
  loaderDiv.innerHTML = `
    <div class="chat-avatar ai-avatar">🤖</div>
    <div class="ai-progressive-loader">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle); padding-bottom:6px;">
        <span style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">
          Azure AI Foundry Workflow
        </span>
        <span class="loader-spinner-inline"></span>
      </div>
      <div class="loader-step active" id="loader-step-1">
        <span class="loader-icon">🔍</span>
        <span><strong>Agent 1 (Financial Analyzer):</strong> Analyzing transactions & spending categories...</span>
      </div>
      <div class="loader-step pending" id="loader-step-2">
        <span class="loader-icon">📈</span>
        <span><strong>Agent 2 (Financial Planner):</strong> Modeling 30/60/90 day forecast & feasibility...</span>
      </div>
      <div class="loader-step pending" id="loader-step-3">
        <span class="loader-icon">🛡️</span>
        <span><strong>Agent 3 (Alerts & Action):</strong> Evaluating proactive safeguards & action gates...</span>
      </div>
    </div>
  `;
  chatMessagesEl.appendChild(loaderDiv);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

  let stage = 1;
  aiLoaderInterval = setInterval(() => {
    stage++;
    const s1 = document.getElementById('loader-step-1');
    const s2 = document.getElementById('loader-step-2');
    const s3 = document.getElementById('loader-step-3');
    if (stage === 2 && s1 && s2) {
      s1.className = 'loader-step done';
      s1.querySelector('.loader-icon').textContent = '✓';
      s2.className = 'loader-step active';
    } else if (stage >= 3 && s2 && s3) {
      s2.className = 'loader-step done';
      s2.querySelector('.loader-icon').textContent = '✓';
      s3.className = 'loader-step active';
      clearInterval(aiLoaderInterval);
    }
  }, 900);
}

function removeProgressiveLoader() {
  if (aiLoaderInterval) {
    clearInterval(aiLoaderInterval);
    aiLoaderInterval = null;
  }
  const el = document.getElementById('ai-active-loader');
  if (el) el.remove();
}

async function handleSendAIChat(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('ai-chat-input');
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  await sendAIPrompt(message);
}

function sendQuickAIPrompt(promptText) {
  sendAIPrompt(promptText);
}

// Deep-link helper to ask AI from any card with financial context
function askAIWithContext(prompt, extraContext = null, extraIntent = null) {
  window.location.hash = '#ai';
  setTimeout(() => {
    sendAIPrompt(prompt, extraContext, extraIntent);
  }, 100);
}

async function sendAIPrompt(message, extraContext = null, extraIntent = null) {
  if (!message || !message.trim()) return;

  // 1. Push user message to state & storage
  state.chatMessages.push({ role: 'user', content: message });
  saveChatHistory();
  renderAIAssistantPage(document.getElementById('page-container'));

  const btn = document.getElementById('btn-ai-send');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="loader-spinner-inline" style="margin-right:6px;"></span> <span>Consulting Agents...</span>';
  }

  showProgressiveLoader();

  // 2. Prepare payload with multi-turn conversation history
  const historyForBackend = state.chatMessages.map(m => {
    let text = '';
    if (m.role === 'user') {
      text = m.content || '';
    } else if (m.structured) {
      text = m.structured.message || m.structured.summary || m.structured.understanding || '';
    } else {
      text = m.content || '';
    }
    return { role: m.role, content: text };
  });

  const payload = {
    message: message,
    conversation: historyForBackend,
    context: extraContext || null,
    intent: extraIntent || null
  };

  try {
    const res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || `Server error ${res.status}`);
    }

    const data = await res.json();
    state.chatMessages.push({
      role: 'assistant',
      structured: data
    });

    if (data.action && data.requires_confirmation) {
      state.pending_action = data.action;
    }
    saveChatHistory();
  } catch (err) {
    state.chatMessages.push({
      role: 'assistant',
      content: `I encountered an issue connecting to the Azure AI Foundry workflow: ${err.message}. Please check if the FastAPI backend is running.`
    });
    saveChatHistory();
  } finally {
    removeProgressiveLoader();
    renderAIAssistantPage(document.getElementById('page-container'));
  }
}

function clearAIChat() {
  state.chatMessages = [];
  try {
    const key = getChatStorageKey();
    localStorage.removeItem(key);
    sessionStorage.removeItem('fb_ai_chat_history');
  } catch (e) {}
  renderAIAssistantPage(document.getElementById('page-container'));
  showToast('Chat history cleared. Started fresh conversation.', 'info');
}

// ==============================================================
// 8. ALERTS & ACTIONS PAGE
// ==============================================================
function renderAlertsPage(container) {
  let filteredAlerts = state.alerts;
  if (state.alertSeverityFilter !== 'all') {
    filteredAlerts = state.alerts.filter(a => a.level === state.alertSeverityFilter);
  }

  container.innerHTML = `
    <div class="dashboard-grid">
      <!-- Severity Filter Bar -->
      <div class="card" style="padding:16px 24px;">
        <div class="alerts-filter-bar" style="margin-bottom:0;">
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <button class="btn ${state.alertSeverityFilter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="setAlertSeverity('all')">All Alerts (${state.alerts.length})</button>
            <button class="btn ${state.alertSeverityFilter === 'danger' ? 'btn-danger' : 'btn-secondary'} btn-sm" onclick="setAlertSeverity('danger')">Critical</button>
            <button class="btn ${state.alertSeverityFilter === 'warning' ? 'btn-warning' : 'btn-secondary'} btn-sm" onclick="setAlertSeverity('warning')">Warnings</button>
            <button class="btn ${state.alertSeverityFilter === 'info' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="setAlertSeverity('info')">Info</button>
            <button class="btn-ask-ai btn-sm" onclick="askAIWithContext('Provide an overview of all active alerts and prioritize remediation steps to protect cash flow', null, 'alert_explanation')">🤖 Ask AI: Remediate</button>
          </div>
          <button class="btn btn-outline btn-sm" onclick="resolveAllAlerts()">✓ Mark All Resolved</button>
        </div>
      </div>

      <!-- Alerts List -->
      <div class="alerts-list">
        ${filteredAlerts.length === 0 ? `
          <div class="card" style="padding:48px; text-align:center;">
            <div class="empty-state">
              <span class="empty-icon">🛡️</span>
              <span class="empty-title">All Clear! No Pending Alerts</span>
              <span class="empty-desc">Agent 3 has not detected any budget breaches or urgent cash-flow bottlenecks.</span>
            </div>
          </div>
        ` : filteredAlerts.map(a => {
          const isResolved = a.status === 'resolved';
          return `
            <div class="alert-card-item ${a.level || 'warning'}" style="opacity:${isResolved ? '0.6' : '1'};">
              <div class="alert-item-left">
                <div class="alert-item-icon">
                  ${a.level === 'danger' ? '🚨' : a.level === 'info' ? 'ℹ️' : '⚠️'}
                </div>
                <div class="alert-item-content">
                  <h4>${a.title}</h4>
                  <p>${a.message}</p>
                  <div class="alert-item-meta">
                    <span class="badge badge-neutral">${a.level ? a.level.toUpperCase() : 'ALERT'}</span>
                    <span>Status: ${isResolved ? 'Resolved' : 'Active'}</span>
                  </div>
                </div>
              </div>
              <div class="alert-item-actions" style="display:flex; align-items:center; gap:8px;">
                <button class="btn-ask-ai btn-ask-ai-sm" onclick="askAIWithContext('Explain this alert in detail and suggest preventative actions: ${escapeHtml(a.title).replace(/'/g, "\\'")}. Details: ${escapeHtml(a.message).replace(/'/g, "\\'")}', { alert_id: '${a.id}', title: '${escapeHtml(a.title).replace(/'/g, "\\'")}', message: '${escapeHtml(a.message).replace(/'/g, "\\'")}', level: '${a.level}' }, 'alert_explanation')">🤖 Ask AI</button>
                ${!isResolved ? `
                  <button class="btn btn-outline btn-sm" onclick="resolveAlert('${a.id}')">Mark Resolved</button>
                ` : `
                  <span class="badge badge-success">Resolved</span>
                `}
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
  const alert = state.alerts.find(a => a.id === id);
  if (alert) alert.status = 'resolved';
  updateBadgeCounts();
  renderAlertsPage(document.getElementById('page-container'));
  showToast('Alert marked as resolved', 'info');
}

function resolveAllAlerts() {
  state.alerts.forEach(a => a.status = 'resolved');
  updateBadgeCounts();
  renderAlertsPage(document.getElementById('page-container'));
  showToast('All alerts marked as resolved', 'success');
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
            <input type="number" id="setup-income" min="0" step="any" value="${state.profile.monthly_income || 60000}">
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
            <input type="number" id="setup-savings-goal" min="0" step="any" value="${state.profile.savings_goal || 200000}">
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
            <input type="text" id="setup-purchase-item" value="${escapeHtml(planned.item || 'Laptop')}">
          </div>
          <div class="form-group">
            <label for="setup-purchase-cost">Planned Purchase Cost (${escapeHtml(c)})</label>
            <input type="number" id="setup-purchase-cost" min="0" step="any" value="${planned.amount || 50000}">
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
    monthly_income: Number.isFinite(income) ? income : 60000,
    currency,
    current_savings: Number.isFinite(currentSavings) ? currentSavings : 0,
    savings_goal: Number.isFinite(savingsGoal) ? savingsGoal : 200000,
    planned_purchase: { item, amount: Number.isFinite(cost) ? cost : 50000 },
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
      <!-- Azure AI Foundry Agents Connection Manager -->
      <div class="card" style="grid-column: 1 / -1;">
        <div class="card-header">
          <div class="card-header-left">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span class="badge badge-purple">Microsoft Azure AI Foundry</span>
              <span class="status-pill ${foundryConfig && !foundryConfig.use_mock_fallback ? 'status-connected' : 'status-connecting'}">
                <span class="status-dot"></span>
                <span>${foundryConfig && !foundryConfig.use_mock_fallback ? 'Live Azure Mode' : 'Simulation Fallback Mode'}</span>
              </span>
            </div>
            <h3>Azure AI Foundry Agents & Workflow Integration</h3>
            <p>Connect your Azure AI Project and Agent IDs (found in Microsoft Azure AI Foundry &gt; Agents)</p>
          </div>
          <div class="card-header-right">
            <button class="btn btn-outline btn-sm" onclick="testFoundryConnection()">
              <span>⚡ Test Connection & Discover Agents</span>
            </button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group" style="flex:2;">
            <label>Azure AI Project Endpoint *</label>
            <input type="text" id="foundry-endpoint" placeholder="https://<name>.services.ai.azure.com/api/projects/<name>" value="${foundryConfig ? escapeHtml(foundryConfig.endpoint || '') : 'https://MoneyArnold-01.services.ai.azure.com/api/projects/MoneyArnold-01'}">
            <small class="text-muted">Found in your Foundry Project Overview &gt; Project details &gt; Target URI / Endpoint</small>
          </div>
          <div class="form-group" style="flex:1;">
            <label>Project / Azure OpenAI Key (Optional)</label>
            <input type="password" id="foundry-api-key" placeholder="${foundryConfig && foundryConfig.has_api_key ? '••••••••••••••••' : 'Enter API Key if using key auth'}">
            <small class="text-muted">Leave blank if using Azure CLI (<code>az login</code>)</small>
          </div>
        </div>

        <div class="form-row" style="margin-top:12px;">
          <div class="form-group">
            <label>Option A: Single Workflow / Orchestrator Agent ID</label>
            <input type="text" id="foundry-workflow-id" placeholder="e.g. asst_xxx or workflow agent ID" value="${foundryConfig ? escapeHtml(foundryConfig.workflow_id || '') : ''}">
            <small class="text-muted">If your multi-agent workflow is packaged into a single Foundry Agent</small>
          </div>
          <div class="form-group">
            <label>Agent 1 ID: Financial Analyzer</label>
            <input type="text" id="foundry-analyzer-id" placeholder="e.g. asst_analyzer_xxx" value="${foundryConfig ? escapeHtml(foundryConfig.analyzer_id || '') : ''}">
            <small class="text-muted">Categorization &amp; spending audit agent</small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Agent 2 ID: Financial Planner</label>
            <input type="text" id="foundry-planner-id" placeholder="e.g. asst_planner_xxx" value="${foundryConfig ? escapeHtml(foundryConfig.planner_id || '') : ''}">
            <small class="text-muted">Cash-flow forecasting &amp; what-if planner agent</small>
          </div>
          <div class="form-group">
            <label>Agent 3 ID: Proactive Alerts &amp; Actions</label>
            <input type="text" id="foundry-action-id" placeholder="e.g. asst_action_xxx" value="${foundryConfig ? escapeHtml(foundryConfig.action_id || '') : ''}">
            <small class="text-muted">Action preparation with human confirmation gate</small>
          </div>
        </div>

        <div style="margin-top:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <label class="checkbox-label" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" id="foundry-mock-fallback" ${foundryConfig && foundryConfig.use_mock_fallback ? 'checked' : ''}>
            <span>Enable Local Simulation Fallback (Use verified offline multi-agent dataset)</span>
          </label>
          <button class="btn btn-primary btn-sm" onclick="saveFoundrySettings()">
            <span>💾 Save Azure Foundry Configuration</span>
          </button>
        </div>

        <div id="foundry-discovery-results" style="margin-top:16px; display:none; padding:12px 16px; background:var(--bg-app); border:1px solid var(--border-subtle); border-radius:var(--radius-md);"></div>
      </div>

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
          <button class="btn btn-danger btn-sm" onclick="handleLogout()">Sign Out of Financial Buddy</button>
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
  const useMockFallback = document.getElementById('foundry-mock-fallback')?.checked;

  try {
    const payload = {
      endpoint,
      workflow_id: workflowId,
      analyzer_id: analyzerId,
      planner_id: plannerId,
      action_id: actionId,
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
  let expenseData = [fin.monthlyExpenses * 0.2, fin.monthlyExpenses * 0.35, fin.monthlyExpenses * 0.25, fin.monthlyExpenses * 0.2];

  if (state.periodFilter === '7d') {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    incomeData = [0, 0, 0, 0, fin.monthlyIncome * 0.2, 0, 0];
    expenseData = [1200, 450, 2500, 800, 1500, 3200, 950];
  } else if (state.periodFilter === '3m') {
    labels = ['July 2026', 'August 2026', 'September 2026'];
    incomeData = [58000, 60000, fin.monthlyIncome];
    expenseData = [27000, 29000, fin.monthlyExpenses];
  } else if (state.periodFilter === '6m') {
    labels = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    incomeData = [55000, 58000, 58000, 60000, 60000, fin.monthlyIncome];
    expenseData = [26000, 28000, 31000, 27000, 29000, fin.monthlyExpenses];
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
          labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 12 } }
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
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#64748b',
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

  state.charts['spendingDonut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length > 0 ? labels : ['Food', 'Shopping', 'Transport', 'Bills'],
      datasets: [
        {
          data: data.length > 0 ? data : [4350, 6000, 2200, 2500],
          backgroundColor: [
            '#3b82f6',
            '#8b5cf6',
            '#06b6d4',
            '#f59e0b',
            '#10b981',
            '#ec4899',
            '#64748b'
          ],
          borderColor: '#131b2e',
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
          labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 12 } }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ₹${ctx.parsed.toLocaleString()}`
          }
        }
      }
    }
  });
}

// ==============================================================
// MODAL MANAGEMENT & CRUD HANDLERS
// ==============================================================
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('hidden');
}

function openAddAccountModal() {
  document.getElementById('modal-account-title').textContent = '🏦 Add Financial Account';
  document.getElementById('account-edit-id').value = '';
  const form = document.getElementById('form-modal-account');
  if (form) form.reset();
  openModal('modal-account');
}

function openAddBudgetModal() {
  document.getElementById('modal-budget-title').textContent = '🎯 Create Monthly Budget';
  document.getElementById('budget-edit-id').value = '';
  const form = document.getElementById('form-modal-budget');
  if (form) form.reset();
  openModal('modal-budget');
}

function openAddBillModal() {
  document.getElementById('modal-bill-title').textContent = '📅 Add Upcoming Bill';
  document.getElementById('bill-edit-id').value = '';
  const form = document.getElementById('form-modal-bill');
  if (form) form.reset();
  const due = document.getElementById('bill-form-due-date');
  if (due && !due.value) due.value = new Date().toISOString().split('T')[0];
  openModal('modal-bill');
}

function openAddGoalModal() {
  document.getElementById('modal-goal-title').textContent = '🏆 Create Financial Goal';
  document.getElementById('goal-edit-id').value = '';
  const form = document.getElementById('form-modal-goal');
  if (form) form.reset();
  openModal('modal-goal');
}

function openAddSubscriptionModal() {
  document.getElementById('modal-sub-title').textContent = '🔁 Add Subscription';
  document.getElementById('sub-edit-id').value = '';
  const form = document.getElementById('form-modal-sub');
  if (form) form.reset();
  openModal('modal-sub');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('hidden');
}

function handleModalOverlayClick(e, id) {
  if (e.target.id === id) closeModal(id);
}

// Transaction Modals
function openAddTxModal() {
  document.getElementById('modal-tx-title').textContent = '➕ Add Transaction';
  document.getElementById('tx-edit-id').value = '';
  document.getElementById('tx-form-merchant').value = '';
  document.getElementById('tx-form-amount').value = '';
  document.getElementById('tx-form-type').value = 'expense';
  document.getElementById('tx-form-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('tx-form-notes').value = '';

  populateAccountSelect('tx-form-account');
  openModal('modal-tx');
}

function openEditTxModal(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;

  document.getElementById('modal-tx-title').textContent = '✏️ Edit Transaction';
  document.getElementById('tx-edit-id').value = tx.id;
  document.getElementById('tx-form-merchant').value = tx.merchant || '';
  document.getElementById('tx-form-amount').value = tx.amount || '';
  document.getElementById('tx-form-type').value = tx.type || 'expense';
  document.getElementById('tx-form-category').value = tx.category || 'Food';
  document.getElementById('tx-form-date').value = tx.date || '';
  document.getElementById('tx-form-notes').value = tx.notes || '';

  populateAccountSelect('tx-form-account', tx.account);
  openModal('modal-tx');
}

function populateAccountSelect(selectId, selectedVal) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = state.accounts.map(a => `
    <option value="${a.name}" ${selectedVal === a.name ? 'selected' : ''}>${a.name} (₹${formatNumber(a.balance)})</option>
  `).join('');
}

async function handleSaveTransaction(e) {
  e.preventDefault();
  const id = document.getElementById('tx-edit-id').value;
  const merchant = document.getElementById('tx-form-merchant').value.trim();
  const amount = parseFloat(document.getElementById('tx-form-amount').value);
  const type = document.getElementById('tx-form-type').value;
  const category = document.getElementById('tx-form-category').value;
  const account = document.getElementById('tx-form-account').value;
  const date = document.getElementById('tx-form-date').value;
  const notes = document.getElementById('tx-form-notes').value.trim();

  const payload = { merchant, amount, type, category, account, date, notes };

  try {
    if (id) {
      // Edit
      await fetch(`${API_BASE}/api/financial-data/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Transaction updated', 'success');
    } else {
      // Add
      await fetch(`${API_BASE}/api/financial-data/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Transaction added', 'success');
    }
    closeModal('modal-tx');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (err) {
    showToast('Failed to save transaction', 'danger');
  }
}

async function handleDeleteTx(txId) {
  if (!confirm('Remove this transaction?')) return;
  try {
    await fetch(`${API_BASE}/api/financial-data/transactions/${txId}`, { method: 'DELETE' });
    showToast('Transaction removed', 'info');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (err) {
    showToast('Failed to delete transaction', 'danger');
  }
}

// Budget Modals
function openEditBudgetModal(bId) {
  const b = state.budgets.find(item => (item.id === bId || item.category === bId));
  if (!b) return;
  document.getElementById('modal-budget-title').textContent = '✏️ Edit Monthly Budget';
  document.getElementById('budget-edit-id').value = b.id || b.category;
  document.getElementById('budget-form-category').value = b.category;
  document.getElementById('budget-form-amount').value = b.amount;
  openModal('modal-budget');
}

async function handleSaveBudget(e) {
  e.preventDefault();
  const id = document.getElementById('budget-edit-id').value;
  const category = document.getElementById('budget-form-category').value.trim();
  const amount = parseFloat(document.getElementById('budget-form-amount').value);

  const payload = { category, amount };

  try {
    if (id) {
      await fetch(`${API_BASE}/api/financial-data/budgets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Budget updated', 'success');
    } else {
      await fetch(`${API_BASE}/api/financial-data/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Budget created', 'success');
    }
    closeModal('modal-budget');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (err) {
    showToast('Failed to save budget', 'danger');
  }
}

async function handleDeleteBudget(bId) {
  if (!confirm('Delete this budget limit?')) return;
  try {
    await fetch(`${API_BASE}/api/financial-data/budgets/${bId}`, { method: 'DELETE' });
    showToast('Budget removed', 'info');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (e) {
    showToast('Failed to delete budget', 'danger');
  }
}

// Bill Modals
function openEditBillModal(billId) {
  const b = state.bills.find(item => item.id === billId);
  if (!b) return;
  document.getElementById('modal-bill-title').textContent = '✏️ Edit Bill';
  document.getElementById('bill-edit-id').value = b.id;
  document.getElementById('bill-form-name').value = b.name;
  document.getElementById('bill-form-amount').value = b.amount;
  document.getElementById('bill-form-due-date').value = b.due_date;
  document.getElementById('bill-form-status').value = b.status || 'unpaid';
  document.getElementById('bill-form-recurring').checked = b.recurring !== false;
  openModal('modal-bill');
}

async function handleSaveBill(e) {
  e.preventDefault();
  const id = document.getElementById('bill-edit-id').value;
  const name = document.getElementById('bill-form-name').value.trim();
  const amount = parseFloat(document.getElementById('bill-form-amount').value);
  const due_date = document.getElementById('bill-form-due-date').value;
  const status = document.getElementById('bill-form-status').value;
  const recurring = document.getElementById('bill-form-recurring').checked;

  const payload = { name, amount, due_date, status, recurring };

  try {
    if (id) {
      await fetch(`${API_BASE}/api/financial-data/bills/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Bill updated', 'success');
    } else {
      await fetch(`${API_BASE}/api/financial-data/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Bill scheduled', 'success');
    }
    closeModal('modal-bill');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (err) {
    showToast('Failed to save bill', 'danger');
  }
}

async function toggleBillPaidStatus(billId) {
  const bill = state.bills.find(b => b.id === billId);
  if (!bill) return;
  bill.status = bill.status === 'paid' ? 'unpaid' : 'paid';

  try {
    await fetch(`${API_BASE}/api/financial-data/bills/${billId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bill)
    });
    showToast(`Bill marked as ${bill.status}`, 'info');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (err) {
    showToast('Failed to update bill status', 'danger');
  }
}

async function handleDeleteBill(billId) {
  if (!confirm('Remove this bill?')) return;
  try {
    await fetch(`${API_BASE}/api/financial-data/bills/${billId}`, { method: 'DELETE' });
    showToast('Bill removed', 'info');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (err) {
    showToast('Failed to delete bill', 'danger');
  }
}

// Subscription Modals
function openEditSubscriptionModal(subId) {
  const s = state.subscriptions.find(item => item.id === subId);
  if (!s) return;
  document.getElementById('modal-sub-title').textContent = '✏️ Edit Subscription';
  document.getElementById('sub-edit-id').value = s.id;
  document.getElementById('sub-form-name').value = s.name;
  document.getElementById('sub-form-amount').value = s.amount;
  document.getElementById('sub-form-frequency').value = s.frequency || 'monthly';
  document.getElementById('sub-form-next-date').value = s.next_date || '';
  openModal('modal-sub');
}

async function handleSaveSubscription(e) {
  e.preventDefault();
  const id = document.getElementById('sub-edit-id').value;
  const name = document.getElementById('sub-form-name').value.trim();
  const amount = parseFloat(document.getElementById('sub-form-amount').value);
  const frequency = document.getElementById('sub-form-frequency').value;
  const next_date = document.getElementById('sub-form-next-date').value;

  const payload = { name, amount, frequency, next_date };

  try {
    if (id) {
      await fetch(`${API_BASE}/api/financial-data/subscriptions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Subscription updated', 'success');
    } else {
      await fetch(`${API_BASE}/api/financial-data/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Subscription tracked', 'success');
    }
    closeModal('modal-sub');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (e) {
    showToast('Failed to save subscription', 'danger');
  }
}

async function handleDeleteSubscription(subId) {
  if (!confirm('Remove this subscription?')) return;
  try {
    await fetch(`${API_BASE}/api/financial-data/subscriptions/${subId}`, { method: 'DELETE' });
    showToast('Subscription removed', 'info');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (err) {
    showToast('Failed to delete subscription', 'danger');
  }
}

// Goal Modals
function openEditGoalModal(goalId) {
  const g = state.goals.find(item => item.id === goalId);
  if (!g) return;
  document.getElementById('modal-goal-title').textContent = '✏️ Edit Goal';
  document.getElementById('goal-edit-id').value = g.id;
  document.getElementById('goal-form-name').value = g.name;
  document.getElementById('goal-form-target').value = g.target_amount;
  document.getElementById('goal-form-current').value = g.current_amount || 0;
  document.getElementById('goal-form-date').value = g.target_date || '';
  document.getElementById('goal-form-contribution').value = g.monthly_contribution || '';
  openModal('modal-goal');
}

async function handleSaveGoal(e) {
  e.preventDefault();
  const id = document.getElementById('goal-edit-id').value;
  const name = document.getElementById('goal-form-name').value.trim();
  const target_amount = parseFloat(document.getElementById('goal-form-target').value);
  const current_amount = parseFloat(document.getElementById('goal-form-current').value) || 0;
  const target_date = document.getElementById('goal-form-date').value;
  const monthly_contribution = parseFloat(document.getElementById('goal-form-contribution').value) || 0;

  const payload = { name, target_amount, current_amount, target_date, monthly_contribution };

  try {
    if (id) {
      await fetch(`${API_BASE}/api/financial-data/goals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Goal updated', 'success');
    } else {
      await fetch(`${API_BASE}/api/financial-data/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Goal created', 'success');
    }
    closeModal('modal-goal');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (err) {
    showToast('Failed to save goal', 'danger');
  }
}

async function handleDeleteGoal(goalId) {
  if (!confirm('Remove this goal?')) return;
  try {
    await fetch(`${API_BASE}/api/financial-data/goals/${goalId}`, { method: 'DELETE' });
    showToast('Goal removed', 'info');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (e) {
    showToast('Failed to delete goal', 'danger');
  }
}

// Account Modals
function openEditAccountModal(accId) {
  const a = state.accounts.find(item => item.id === accId);
  if (!a) return;
  document.getElementById('modal-account-title').textContent = '✏️ Edit Account';
  document.getElementById('account-edit-id').value = a.id;
  document.getElementById('acc-form-name').value = a.name;
  document.getElementById('acc-form-type').value = a.type || 'Bank';
  document.getElementById('acc-form-balance').value = a.balance;
  document.getElementById('acc-form-mask').value = a.masked_number || '';
  openModal('modal-account');
}

async function handleSaveAccount(e) {
  e.preventDefault();
  const id = document.getElementById('account-edit-id').value;
  const name = document.getElementById('acc-form-name').value.trim();
  const type = document.getElementById('acc-form-type').value;
  const balance = parseFloat(document.getElementById('acc-form-balance').value);
  const masked_number = document.getElementById('acc-form-mask').value.trim();

  const payload = { name, type, balance, masked_number };

  try {
    if (id) {
      await fetch(`${API_BASE}/api/financial-data/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Account updated', 'success');
    } else {
      await fetch(`${API_BASE}/api/financial-data/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Account added', 'success');
    }
    closeModal('modal-account');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (err) {
    showToast('Failed to save account', 'danger');
  }
}

async function handleDeleteAccount(accId) {
  if (!confirm('Remove this account?')) return;
  try {
    await fetch(`${API_BASE}/api/financial-data/accounts/${accId}`, { method: 'DELETE' });
    showToast('Account removed', 'info');
    await loadFinancialData();
    navigate(state.activePage, false);
  } catch (err) {
    showToast('Failed to delete account', 'danger');
  }
}

// ==============================================================
// UTILITIES & HELPERS
// ==============================================================
function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function formatMarkdownSnippet(text) {
  if (!text) return '';
  if (typeof text === 'object') {
    text = text.message || text.title || text.description || JSON.stringify(text);
  } else if (typeof text !== 'string') {
    text = String(text);
  }
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^[•\-\*]\s*(.*?)(?=\n|$)/gm, '<div style="margin-left:8px;">• $1</div>')
    .replace(/\n/g, '<br>');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'danger' ? '✕' : type === 'warning' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function handleGlobalSearch(query) {
  state.txSearchQuery = query;
  if (query && state.activePage !== 'transactions') {
    navigate('transactions');
  } else if (state.activePage === 'transactions') {
    renderTransactionsPage(document.getElementById('page-container'));
  }
}
