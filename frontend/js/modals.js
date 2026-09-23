// ==============================================================
// MONEY ARNOLD — MODAL DIALOGS & CRUD EVENT HANDLERS
// ==============================================================

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
  const balInput = document.getElementById('acc-form-balance');
  if (balInput) balInput.value = '0';
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
  document.getElementById('tx-form-category').value = 'auto'; // Default to AI Guess
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
  let category = document.getElementById('tx-form-category').value;
  const account = document.getElementById('tx-form-account').value;
  const date = document.getElementById('tx-form-date').value;
  const notes = document.getElementById('tx-form-notes').value.trim();

  // Auto-categorize via AI if the user left it on "Auto / AI Guess"
  if (category === 'auto') {
    try {
      const catRes = await fetch(`${API_BASE}/api/ai/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant, amount, notes })
      });
      if (catRes.ok) {
        const catData = await catRes.json();
        category = catData.category || 'Other';
        showToast(`🤖 AI categorized as <strong>${category}</strong>`, 'info', true);
      } else {
        category = 'Other';
      }
    } catch {
      category = 'Other';
    }
  }

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

    // Check if category budget triggered warning or breach
    if (type !== 'income') {
      const budget = (state.budgets || []).find(b => b.category.toLowerCase() === category.toLowerCase());
      if (budget) {
        const limit = parseFloat(budget.amount || 0);
        let catSpent = 0;
        (state.transactions || []).forEach(t => {
          if (t.type !== 'income' && (t.category || '').toLowerCase() === category.toLowerCase()) {
            catSpent += parseFloat(t.amount || 0);
          }
        });
        const pct = limit > 0 ? Math.round((catSpent / limit) * 100) : 0;
        if (pct >= 100) {
          showToast(`🚨 Alert: ${category} budget exceeded (${pct}%)!`, 'danger');
        } else if (pct >= 85) {
          showToast(`⚠️ Alert: ${category} budget has reached ${pct}% threshold!`, 'warning');
        }
      }
    }

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

