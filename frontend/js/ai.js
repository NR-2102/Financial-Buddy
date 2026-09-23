// ==============================================================
// MONEY ARNOLD — AI ASSISTANT CONVERSATIONAL INTERFACE
// ==============================================================

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

function cleanAgentMentions(text) {
  if (!text || typeof text !== 'string') return text || '';
  return text
    .replace(/\bAgent\s*[1-4]\b:?/gi, '')
    .replace(/\bStage\s*[1-4]\b:?/gi, '')
    .replace(/\(Agent\s*[1-4][^)]*\)/gi, '')
    .replace(/Agent 1 \(Financial Analyzer\)/gi, 'Financial Analyzer')
    .replace(/Agent 2 \(Financial Planner\)/gi, 'Financial Planner')
    .replace(/Agent 3 \(Proactive Alerts & Action\)/gi, 'Safeguards')
    .replace(/Agent 4 \(Executive Summarizer\)/gi, 'Financial Assistant')
    .replace(/Coordinated across Agent[^\n.]*\./gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function renderAIAssistantPage(container) {
  const fin = computeFinancialState();
  const c = fin.currency;

  container.innerHTML = `
    <div class="ai-assistant-container">
      <!-- Conversational Area -->
      <div class="ai-chat-card">
        <div class="ai-chat-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="chat-avatar ai-avatar">🤖</div>
            <div>
              <h3 style="font-size:15px; font-weight:700;">Financial Assistant</h3>
              <span class="badge badge-purple" style="font-size:10px;">Online</span>
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
        <div class="ai-chat-messages" id="ai-chat-messages" role="log" aria-live="polite">
          <!-- Initial AI Welcome Bubble -->
          <div class="chat-message">
            <div class="chat-avatar ai-avatar">🤖</div>
            <div class="chat-bubble">
              <p>Hello! I am your <strong>Financial Assistant</strong>.</p>
              <p style="margin-top:6px; color:var(--text-secondary);">
                Ask me any questions about your finances—like whether you can afford a purchase, how your spending is tracking, or what bills are coming up.
              </p>
            </div>
          </div>

          ${state.chatMessages.map(msg => renderChatMessageHtml(msg)).join('')}
        </div>

        <!-- Input Bar -->
        <form class="ai-chat-input-bar" onsubmit="handleSendAIChat(event)">
          <input type="text" id="ai-chat-input" placeholder="Ask anything (e.g. 'Can I buy a ₹30,000 phone?' or 'How is my budget?')..." required autocomplete="off" aria-label="Ask Financial Assistant">
          <button type="submit" id="btn-ai-send" class="btn btn-primary" aria-label="Send message to AI assistant">
            <span>Send</span>
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
            <strong>${c}${formatNumber(fin.currentSavings)} <small class="text-muted">(${fin.savingsGoal > 0 ? Math.round((fin.currentSavings/fin.savingsGoal)*100) : 0}%)</small></strong>
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

  // Assistant response (synthesized from the multi-agent pipeline into a single direct answer)
  let answerHtml = '';
  let actionHtml = '';
  let recommendationHtml = '';

  if (msg.structured) {
    const s = msg.structured;
    let text = s.message || (s.summarizer && s.summarizer.executive_summary) || s.summary || '';
    text = cleanAgentMentions(text);

    answerHtml = formatMarkdownSnippet(text);

    // Red urgent recommendation alert (from s.recommendations array or s.recommendation string)
    const recList = Array.isArray(s.recommendations) && s.recommendations.length > 0
      ? s.recommendations
      : (s.recommendation ? [s.recommendation] : []);
    if (recList.length > 0) {
      const recItems = recList.slice(0, 2).map(r => {
        const clean = cleanAgentMentions(String(r)).replace(/^\u2022\s*/, '').trim();
        return `<span class="chat-rec-item">⚠️ ${escapeHtml(clean)}</span>`;
      }).join('');
      recommendationHtml = `
        <div class="chat-recommendation-alert">
          <div class="chat-rec-header">
            <span class="chat-rec-icon">🚨</span>
            <span class="chat-rec-label">Action Required</span>
          </div>
          <div class="chat-rec-body">${recItems}</div>
        </div>
      `;
    }

    // If an actionable recommendation is present (e.g. reserve upcoming bill funds or add transaction)
    if (s.action) {
      const actionJsonStr = escapeHtml(JSON.stringify(s.action));
      const c = state.profile.currency || '₹';
      const actionDesc = cleanAgentMentions(s.action.description || 'Reserve funds for scheduled obligations');
      const isExecuteAction = ['add_transaction', 'update_budget', 'add_budget', 'update_balance', 'update_savings', 'update_goal'].includes(s.action.type);
      const actionIcon = isExecuteAction
        ? (s.action.type === 'add_transaction' ? '➕'
           : s.action.type === 'update_balance' ? '💰'
           : s.action.type === 'update_savings' ? '🏦'
           : '🎯')
        : '🛡️';
      const confirmLabel = isExecuteAction ? '✓ Confirm & Apply' : 'Confirm &amp; Apply';
      actionHtml = `
        <div class="chat-action-card${isExecuteAction ? ' execute-action-card' : ''}">
          <div class="chat-action-info">
            <span class="chat-action-icon">${actionIcon}</span>
            <div>
              <div class="chat-action-title">${escapeHtml(actionDesc)}</div>
              ${s.action.amount ? `<div class="chat-action-amount">Amount: <strong>${c}${formatNumber(s.action.amount)}</strong></div>` : ''}
            </div>
          </div>
          <div class="chat-action-btns">
            <button class="btn btn-secondary btn-sm" onclick='handleExecuteActionDecision(false, ${actionJsonStr})'>✗ Dismiss</button>
            <button class="btn btn-primary btn-sm" onclick='handleExecuteActionDecision(true, ${actionJsonStr})'>${confirmLabel}</button>
          </div>
        </div>
      `;
    }
  } else {
    answerHtml = formatMarkdownSnippet(cleanAgentMentions(msg.content || ''));
  }

  return `
    <div class="chat-message">
      <div class="chat-avatar ai-avatar">🤖</div>
      <div class="chat-bubble">
        <div class="chat-answer-content">
          ${answerHtml}
        </div>
        ${recommendationHtml}
        ${actionHtml}
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

