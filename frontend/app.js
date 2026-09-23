// ==============================================================
// MONEY ARNOLD — APPLICATION CONTROLLER & ROUTER
// ==============================================================
// This application is modularized into specialized modules loaded in index.html:
//   - js/state.js   : Application state & API endpoints
//   - js/utils.js   : Formatters, toasts, search, markdown helpers
//   - js/auth.js    : User authentication, demo profiles, sessions
//   - js/api.js     : Backend sync, dynamic alerts, financial metrics
//   - js/charts.js  : Chart.js controllers & cashflow/spending visualizations
//   - js/modals.js  : Dialog managers & CRUD operations for transactions, budgets, bills, etc.
//   - js/pages.js   : Page view renderers (Dashboard, Transactions, Budgets, Bills, Goals, Accounts, Alerts, Setup, Settings)
//   - js/ai.js      : AI assistant conversational interface & action confirmation
// ==============================================================

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
      title: 'Money Arnold AI Assistant',
      subtitle: 'Powered by Microsoft Azure AI Foundry 4-agent pipeline with human-in-the-loop control'
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
