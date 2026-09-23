// ==============================================================
// MONEY ARNOLD — UTILITIES, FORMATTERS & TOASTS
// ==============================================================

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

  const formatInline = (str) => {
    return escapeHtml(str)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  };

  const rawLines = text.split('\n');
  const elements = [];
  let currentBullets = [];

  const flushBullets = () => {
    if (currentBullets.length > 0) {
      elements.push(`<div class="ai-bullet-list">${currentBullets.join('')}</div>`);
      currentBullets = [];
    }
  };

  for (let rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) {
      flushBullets();
      continue;
    }

    const isBullet = /^[•\-\*]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line);

    if (isBullet) {
      let cleanContent = line
        .replace(/^[•\-\*]\s*/, '')
        .replace(/^\d+[\.\)]\s*/, '')
        .trim();
      if (cleanContent) {
        currentBullets.push(`
          <div class="ai-bullet-point">
            <span class="ai-bullet-dot">•</span>
            <span class="ai-bullet-text">${formatInline(cleanContent)}</span>
          </div>
        `);
      }
    } else {
      flushBullets();
      elements.push(`<p class="ai-paragraph">${formatInline(line)}</p>`);
    }
  }

  flushBullets();
  return elements.join('');
}

function showToast(message, type = 'info', allowHtml = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'danger' ? '✕' : type === 'warning' ? '⚠️' : 'ℹ️';
  const msgHtml = allowHtml ? message : escapeHtml(message);
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${msgHtml}</span>
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

// Global Accessibility: Dismiss open modals when pressing Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal-overlay:not(.hidden)');
    if (activeModal) {
      closeModal(activeModal.id);
    }
  }
});
