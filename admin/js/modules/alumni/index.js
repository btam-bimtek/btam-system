// admin/js/modules/alumni/index.js
// Entry point Tab Alumni — sub-tab Riwayat (+ Direktori kelak).

import { setPageTitle } from '../../layout/navbar.js';
import { renderSubRiwayat } from './sub-riwayat.js';

const TABS = [
  { id: 'riwayat',  label: 'Riwayat' },
  { id: 'direktori', label: 'Direktori', disabled: true },
];

export function renderAlumni({ tab = 'riwayat' } = {}) {
  setPageTitle('Alumni');

  const app = document.getElementById('app-content');
  if (!app) return;

  app.innerHTML = `
    <div class="px-6 pt-6 pb-2">
      <h1 class="text-lg font-semibold text-white mb-1">Alumni</h1>
      <p class="text-xs text-gray-500">Riwayat keikutsertaan bimtek dari seluruh sumber data.</p>
    </div>

    <!-- Sub-tab nav -->
    <div class="px-6 border-b border-gray-800 mb-4">
      <nav class="flex gap-1" id="alumni-tab-nav">
        ${TABS.map(t => `
          <button data-tab="${t.id}"
            class="alumni-tab-btn px-4 py-2.5 text-xs font-medium border-b-2 transition-colors
              ${t.disabled ? 'text-gray-600 border-transparent cursor-not-allowed' : 'text-gray-400 border-transparent hover:text-gray-200'}
              ${t.id === tab && !t.disabled ? 'active-tab' : ''}"
            ${t.disabled ? 'disabled title="Belum tersedia"' : ''}>
            ${t.label}${t.disabled ? ' <span class="text-[10px] text-gray-700 ml-1">segera</span>' : ''}
          </button>`).join('')}
      </nav>
    </div>

    <!-- Pane -->
    <div id="alumni-pane" class="px-6 pb-8"></div>
  `;

  _applyTabStyle(tab);
  _renderTab(tab);

  // Tab switch
  app.querySelectorAll('.alumni-tab-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      app.querySelectorAll('.alumni-tab-btn').forEach(b => b.classList.remove('active-tab'));
      btn.classList.add('active-tab');
      _applyTabStyle(t);
      _renderTab(t);
    });
  });
}

function _applyTabStyle(activeTab) {
  const style = document.getElementById('alumni-tab-style') ?? (() => {
    const s = document.createElement('style');
    s.id = 'alumni-tab-style';
    document.head.appendChild(s);
    return s;
  })();
  style.textContent = `.alumni-tab-btn.active-tab { color:#14b8a6; border-bottom-color:#14b8a6; }`;
}

function _renderTab(tab) {
  const pane = document.getElementById('alumni-pane');
  if (!pane) return;
  if (tab === 'riwayat') {
    renderSubRiwayat(pane);
  } else {
    pane.innerHTML = `<p class="text-sm text-gray-500 py-10 text-center">Sub-tab ini belum tersedia.</p>`;
  }
}
