// admin/js/layout/sidebar.js
// Sidebar navigasi admin. Highlight route aktif otomatis.

import { signOut } from '../../../shared/auth.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

const NAV_ITEMS = [
  {
    section: 'Utama',
    items: [
      { label: 'Dashboard',     icon: 'home',     href: '/' },
      { label: 'Bimtek',        icon: 'calendar', href: '/bimtek' }
    ]
  },
  {
    section: 'Master Data',
    items: [
      { label: 'Peserta',       icon: 'users',    href: '/peserta' },
      { label: 'Pengajar',      icon: 'academic', href: '/pengajar' },
      { label: 'Instansi',      icon: 'office',   href: '/instansi' },
      { label: 'Bank Soal',     icon: 'document', href: '/bank-soal' }
    ]
  },
  {
    section: 'Sistem',
    items: [
      { label: 'Pengaturan',    icon: 'cog',      href: '/settings' },
      { label: 'Admin Users',   icon: 'shield',   href: '/admin-users', superadminOnly: true }
    ]
  }
];

const ICONS = {
  home:     `<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>`,
  calendar: `<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>`,
  users:    `<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>`,
  academic: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>`,
  office:   `<path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>`,
  document: `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>`,
  cog:      `<path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>`,
  shield:   `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>`,
  logout:   `<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>`
};

let _currentProfile = null;

export function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <!-- Logo -->
    <div class="px-5 py-5 border-b border-gray-800">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <svg class="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor"
               stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-semibold text-white leading-none">BTAM Terpadu</p>
          <p class="text-xs text-gray-500 mt-0.5">Admin Panel</p>
        </div>
      </div>
    </div>

    <!-- Nav -->
    <nav class="flex-1 overflow-y-auto py-4 px-3" id="sidebar-nav">
      ${_buildNavHTML()}
    </nav>

    <!-- User info + logout -->
    <div class="px-3 py-4 border-t border-gray-800" id="sidebar-user">
      <div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/50 mb-2">
        <div class="w-7 h-7 bg-blue-700 rounded-full flex items-center justify-center shrink-0">
          <span id="user-initial" class="text-xs font-bold text-white">?</span>
        </div>
        <div class="min-w-0 flex-1">
          <p id="user-name" class="text-xs font-medium text-gray-200 truncate">—</p>
          <p id="user-role" class="text-xs text-gray-500 capitalize">—</p>
        </div>
      </div>
      <button id="logout-btn"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400
                     hover:bg-gray-800 hover:text-red-400 transition-colors text-sm">
        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          ${ICONS.logout}
        </svg>
        Keluar
      </button>
    </div>
  `;

  _bindSidebarEvents();
  _highlightActive();

  // Re-highlight saat hash berubah
  window.addEventListener('hashchange', _highlightActive);
}

function _buildNavHTML() {
  return NAV_ITEMS.map(section => {
    const itemsHTML = section.items
      .filter(item => !item.superadminOnly || _currentProfile?.role === 'superadmin')
      .map(item => `
        <a href="#${item.href}"
           data-href="${item.href}"
           class="nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                  text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-colors">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
               stroke-width="1.75" viewBox="0 0 24 24">
            ${ICONS[item.icon] ?? ''}
          </svg>
          ${item.label}
        </a>`).join('');

    if (!itemsHTML) return '';

    return `
      <div class="mb-5">
        <p class="text-xs font-medium text-gray-600 uppercase tracking-wider px-3 mb-1">
          ${section.section}
        </p>
        ${itemsHTML}
      </div>`;
  }).join('');
}

function _highlightActive() {
  const current = window.location.hash.slice(1) || '/';
  document.querySelectorAll('.nav-item').forEach(el => {
    const href = el.dataset.href;
    // Exact match untuk /, prefix match untuk yang lain
    const isActive = href === '/'
      ? current === '/'
      : current === href || current.startsWith(href + '/');

    el.classList.toggle('bg-gray-800',    isActive);
    el.classList.toggle('text-white',     isActive);
    el.classList.toggle('text-gray-400',  !isActive);
  });
}

function _bindSidebarEvents() {
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      showToast('Gagal logout: ' + err.message, 'error');
    }
  });
}

export function updateSidebarAuth(profile) {
  _currentProfile = profile;

  const nameEl    = document.getElementById('user-name');
  const roleEl    = document.getElementById('user-role');
  const initialEl = document.getElementById('user-initial');
  const nav       = document.getElementById('sidebar-nav');

  if (profile) {
    if (nameEl)    nameEl.textContent    = profile.nama ?? profile.email;
    if (roleEl)    roleEl.textContent    = profile.role;
    if (initialEl) initialEl.textContent = (profile.nama ?? profile.email ?? '?')[0].toUpperCase();
  } else {
    if (nameEl)    nameEl.textContent    = '—';
    if (roleEl)    roleEl.textContent    = '—';
    if (initialEl) initialEl.textContent = '?';
  }

  // Re-render nav untuk superadmin-only items
  if (nav) nav.innerHTML = _buildNavHTML();
  _highlightActive();
}
