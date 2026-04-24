// admin/js/layout/navbar.js
// Top navigation bar — page title + quick actions.

import { getState, subscribe } from '../store.js';

export function renderNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  navbar.innerHTML = `
    <div class="flex items-center justify-between w-full">
      <!-- Page title (diupdate oleh setPageTitle) -->
      <h2 id="page-title" class="text-sm font-semibold text-gray-100">Dashboard</h2>

      <!-- Right side -->
      <div class="flex items-center gap-3">
        <!-- Lembaga label -->
        <span id="navbar-lembaga" class="text-xs text-gray-500 hidden sm:block">BTAM</span>
      </div>
    </div>
  `;

  // Update nama lembaga dari settings
  subscribe('settings.namaLembaga', (val) => {
    const el = document.getElementById('navbar-lembaga');
    if (el) el.textContent = val ?? 'BTAM';
  });
}

/**
 * Update judul halaman di navbar.
 * Dipanggil oleh tiap module saat render.
 * @param {string} title
 */
export function setPageTitle(title) {
  const el = document.getElementById('page-title');
  if (el) el.textContent = title;
  document.title = `${title} — BTAM Terpadu`;
}
