// admin/js/components/toast.js
// Toast notification yang muncul di pojok kanan atas.
// Tidak ada dependency — pure DOM manipulation.

let _container = null;

function _getContainer() {
  if (!_container) {
    _container = document.createElement('div');
    _container.id = 'toast-container';
    _container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none';
    document.body.appendChild(_container);
  }
  return _container;
}

/**
 * Tampilkan toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 * @param {number} [duration=4000] ms sebelum auto-dismiss
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = _getContainer();

  const styles = {
    success: 'bg-green-900  border-green-700  text-green-200',
    error:   'bg-red-900    border-red-700    text-red-200',
    warning: 'bg-yellow-900 border-yellow-700 text-yellow-200',
    info:    'bg-blue-900   border-blue-700   text-blue-200'
  };

  const icons = {
    success: `<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>`,
    error:   `<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>`,
    warning: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z"/>`,
    info:    `<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z"/>`
  };

  const toast = document.createElement('div');
  toast.className = [
    'pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 border text-sm shadow-xl',
    'translate-x-0 opacity-100 transition-all duration-300',
    styles[type] ?? styles.info
  ].join(' ');

  toast.innerHTML = `
    <svg class="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
      ${icons[type] ?? icons.info}
    </svg>
    <span class="flex-1 leading-snug">${_escapeHtml(message)}</span>
    <button class="shrink-0 opacity-60 hover:opacity-100 transition-opacity -mt-0.5"
            onclick="this.closest('[id]')?.remove()">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;

  container.appendChild(toast);

  // Auto-dismiss
  const timer = setTimeout(() => _dismiss(toast), duration);

  // Klik area toast juga dismiss (kecuali tombol close)
  toast.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    clearTimeout(timer);
    _dismiss(toast);
  });
}

function _dismiss(el) {
  el.style.opacity   = '0';
  el.style.transform = 'translateX(1rem)';
  setTimeout(() => el.remove(), 300);
}

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
