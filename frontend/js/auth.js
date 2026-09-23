// ==============================================================
// MONEY ARNOLD — AUTHENTICATION & SESSION MANAGEMENT
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
      email: 'demo@gmail.com',
      password: 'demo1234',
      name: 'Demo User',
      monthly_income: 60000,
      primary_goal: 'Emergency Fund',
      is_authenticated: true
    },
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
  const isDemoEmail = email === 'demo@gmail.com' || email === 'demouser@gmail.com' || email === 'demo@financialbuddy.ai';
  const isDemoPwd = password === 'demo1234' || password === 'demo';
  const isDemoLogin = isDemoEmail && isDemoPwd;

  if (matched || isDemoLogin) {
    const activeUser = matched || {
      email: email || 'demo@gmail.com',
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
      if (isDemoEmail) {
        await loadFinancialData();
      }
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
  const income = incomeInput ? (parseFloat(incomeInput.value) || 0) : 0;
  const goal = goalInput ? goalInput.value : 'General Savings';

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
  const existingIndex = users.findIndex(u => u.email.toLowerCase() === email);

  const newUser = {
    name,
    email,
    password,
    monthly_income: income,
    primary_goal: goal,
    is_authenticated: true
  };

  if (existingIndex >= 0) {
    users[existingIndex] = newUser;
  } else {
    users.push(newUser);
  }
  saveLocalUsers(users);

  state.authUser = newUser;
  localStorage.setItem('fb_user', JSON.stringify(state.authUser));

  // Initialize new account with all default values set to zero
  state.profile = {
    current_balance: 0.0,
    monthly_income: income,
    monthly_expenses: 0.0,
    upcoming_bills: 0.0,
    savings_goal: 0.0,
    current_savings: 0.0,
    planned_purchase: { item: '', amount: 0.0 },
    currency: '₹',
    user_name: name,
    user_email: email
  };
  state.accounts = [];
  state.budgets = [];
  state.transactions = [];
  state.bills = [];
  state.subscriptions = [];
  state.goals = [];
  state.alerts = [];
  state.actionHistory = [];
  state.action_history = [];
  state.pending_action = null;
  state.chatMessages = [];
  saveChatHistory();

  // Reset filter states
  state.txSearchQuery = '';
  state.txCategoryFilter = 'all';

  // Backend sync to persist fresh zero state
  try {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
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
    if (res.ok) {
      await loadFinancialData();
    }
  } catch (err) {
    console.warn('Backend signup error, using zero state:', err);
  }

  hideAuthScreen();
  updateUserUI();
  updateBadgeCounts();
  showToast(`Welcome, ${name}! Your new account is ready with zero starting balances.`, 'success');
  navigate('dashboard');
}

async function handleQuickDemoLogin() {
  const demoUser = {
    email: 'demo@gmail.com',
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
  try {
    await loadFinancialData();
  } catch (e) {}
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

