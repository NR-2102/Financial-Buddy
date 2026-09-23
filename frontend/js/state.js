// ==============================================================
// MONEY ARNOLD — GLOBAL APPLICATION STATE & CONSTANTS
// ==============================================================

// ==============================================================
// FINANCIAL BUDDY — COMPLETE FRONTEND CONTROLLER & ROUTER
// ==============================================================

const API_BASE = window.location.origin.includes(':8000')
  ? window.location.origin
  : 'http://localhost:8000';

// Global Application State
const state = {
  profile: {
    current_balance: 0.0,
    monthly_income: 0.0,
    monthly_expenses: 0.0,
    upcoming_bills: 0.0,
    savings_goal: 0.0,
    current_savings: 0.0,
    planned_purchase: { item: '', amount: 0.0 },
    currency: '₹',
    user_name: 'New User',
    user_email: ''
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

