// admin/js/components/modal.js
// Generic modal dialog. Dipakai di seluruh admin app.

let _stack = []; // support nested modal

/**
 * Buka modal.
 * @param {object} opts
 * @param {string}   opts.title
 * @param {string}   opts.body        - HTML string untuk isi modal
 * @param {object[]} [opts.actions]   - [{label, type:'primary'|'danger'|'secondary', onClick}]
 * @param {string}   [opts.size]      - 'sm'|'md'|'lg'|'xl' (default 'md')
 * @param {boolean}  [opts.closable]  - default true
 * @returns {object} { close }
 */
export function openModal({ title, body, actions = [], size = 'md', closable = true }) {
  const id = 'modal-' + Date.now();

  const sizeClass = {
    sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl'
  }[size] ?? 'max-w-lg';

  const actionsHTML = actions.map(a => {
    const styles = {
      primary:   'bg-blue-600 hover:bg-blue-500 text-white',
      danger:    'bg-red-700 hover:bg-red-600 text-white',
      secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200'
    }[a.type ?? 'secondary'];
    return `<button data-action="${a.label}" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${styles}">
      ${a.label}
    </button>`;
  }).join('');

  const el = document.createElement('div');
  el.id = id;
  el.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
  el.innerHTML = `
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="${id}-backdrop"></div>
    <div class="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full ${sizeClass}
                flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
        <h3 class="text-base font-semibold text-white">${title}</h3>
        ${closable ? `<button id="${id}-close" class="text-gray-500 hover:text-gray-300 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>` : ''}
      </div>
      <!-- Body -->
      <div class="px-6 py-5 overflow-y-auto flex-1" id="${id}-body">
        ${body}
      </div>
      <!-- Footer -->
      ${actionsHTML ? `<div class="px-6 py-4 border-t border-gray-800 flex justify-end gap-3 shrink-0">
        ${actionsHTML}
      </div>` : ''}
    </div>
  `;

  document.body.appendChild(el);
  _stack.push(id);

  // Bind actions
  actions.forEach(a => {
    el.querySelector(`[data-action="${a.label}"]`)
      ?.addEventListener('click', () => a.onClick?.({ close }));
  });

  // Close button
  if (closable) {
    el.querySelector(`#${id}-close`)?.addEventListener('click', close);
    el.querySelector(`#${id}-backdrop`)?.addEventListener('click', close);
  }

  // ESC key
  const onKey = (e) => { if (e.key === 'Escape' && closable) close(); };
  document.addEventListener('keydown', onKey);

  function close() {
    el.remove();
    document.removeEventListener('keydown', onKey);
    _stack = _stack.filter(s => s !== id);
  }

  return { close, id, bodyEl: el.querySelector(`#${id}-body`) };
}

/**
 * Confirm dialog sederhana.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title = 'Konfirmasi', message, confirmLabel = 'Ya', danger = false }) {
  return new Promise(resolve => {
    openModal({
      title,
      body: `<p class="text-gray-300 text-sm">${message}</p>`,
      size: 'sm',
      actions: [
        {
          label: 'Batal',
          type: 'secondary',
          onClick: ({ close }) => { close(); resolve(false); }
        },
        {
          label: confirmLabel,
          type: danger ? 'danger' : 'primary',
          onClick: ({ close }) => { close(); resolve(true); }
        }
      ]
    });
  });
}
