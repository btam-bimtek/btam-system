// admin/js/modules/dashboard/index.js
// Dashboard home — placeholder skeleton untuk M1.1.
// Akan diisi dengan widget & data nyata di M1.9.

import { setPageTitle } from '../../layout/navbar.js';
import { getState } from '../../store.js';

export function renderDashboard() {
  setPageTitle('Dashboard');

  const profile = getState('auth.profile');
  const nama    = profile?.nama ?? profile?.email ?? 'Admin';

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="max-w-5xl mx-auto">

      <!-- Greeting -->
      <div class="mb-8">
        <h1 class="text-xl font-bold text-white">Selamat datang, ${_escHtml(nama)} 👋</h1>
        <p class="text-gray-500 text-sm mt-1">
          Sistem Manajemen Bimtek BTAM — Phase 1
        </p>
      </div>

      <!-- Status card: Firebase belum dikonfigurasi -->
      <div class="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-5 mb-8 flex items-start gap-4">
        <svg class="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" fill="none" stroke="currentColor"
             stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z"/>
        </svg>
        <div>
          <p class="text-sm font-medium text-yellow-200">Firebase belum dikonfigurasi</p>
          <p class="text-xs text-yellow-400/80 mt-1">
            Buka <code class="font-mono bg-yellow-900/50 px-1 rounded">shared/firebase-config.js</code>
            dan ganti semua nilai <code class="font-mono bg-yellow-900/50 px-1 rounded">YOUR_*</code>
            dengan credentials dari Firebase Console.
          </p>
        </div>
      </div>

      <!-- Quick nav cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${_quickCard('Bimtek', 'Kelola kegiatan Bimtek', '/bimtek', 'calendar', 'blue')}
        ${_quickCard('Peserta', 'Manajemen data peserta', '/peserta', 'users', 'green')}
        ${_quickCard('Pengajar', 'Manajemen pengajar', '/pengajar', 'academic', 'yellow')}
        ${_quickCard('Bank Soal', 'Kelola soal ujian', '/bank-soal', 'document', 'purple')}
        ${_quickCard('Instansi', 'Manajemen instansi', '/instansi', 'office', 'pink')}
        ${_quickCard('Pengaturan', 'Konfigurasi sistem', '/settings', 'cog', 'gray')}
      </div>

      <!-- Milestone progress (dev helper, bisa dihapus setelah selesai) -->
      <div class="mt-10 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-3">Progress Milestone 1.1 — Foundation</h3>
        <ul class="space-y-1.5 text-xs text-gray-400">
          <li class="flex items-center gap-2">
            <span class="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center shrink-0">✓</span>
            firebase-config.js (placeholder — ganti credentials)
          </li>
          <li class="flex items-center gap-2">
            <span class="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center shrink-0">✓</span>
            shared/auth.js — login, logout, onAuthChange
          </li>
          <li class="flex items-center gap-2">
            <span class="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center shrink-0">✓</span>
            Hash-based router
          </li>
          <li class="flex items-center gap-2">
            <span class="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center shrink-0">✓</span>
            Pub-sub store
          </li>
          <li class="flex items-center gap-2">
            <span class="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center shrink-0">✓</span>
            Halaman login admin
          </li>
          <li class="flex items-center gap-2">
            <span class="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center shrink-0">✓</span>
            Auth guard + protected route
          </li>
          <li class="flex items-center gap-2">
            <span class="w-4 h-4 rounded-full bg-yellow-600 flex items-center justify-center shrink-0">!</span>
            Deploy Firestore rules (manual di Firebase Console)
          </li>
          <li class="flex items-center gap-2">
            <span class="w-4 h-4 rounded-full bg-yellow-600 flex items-center justify-center shrink-0">!</span>
            Seed admin_users (manual di Firebase Console)
          </li>
        </ul>
      </div>

    </div>
  `;
}

function _quickCard(title, desc, href, icon, color) {
  const colors = {
    blue:   'bg-blue-600/10   border-blue-800/50   hover:border-blue-600',
    green:  'bg-green-600/10  border-green-800/50  hover:border-green-600',
    yellow: 'bg-yellow-600/10 border-yellow-800/50 hover:border-yellow-600',
    purple: 'bg-purple-600/10 border-purple-800/50 hover:border-purple-600',
    pink:   'bg-pink-600/10   border-pink-800/50   hover:border-pink-600',
    gray:   'bg-gray-800/50   border-gray-700      hover:border-gray-500'
  };
  const iconColors = {
    blue: 'text-blue-400', green: 'text-green-400', yellow: 'text-yellow-400',
    purple: 'text-purple-400', pink: 'text-pink-400', gray: 'text-gray-400'
  };

  const icons = {
    calendar: `<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>`,
    users:    `<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>`,
    academic: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>`,
    document: `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>`,
    office:   `<path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>`,
    cog:      `<path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>`
  };

  return `
    <a href="#${href}"
       class="block border rounded-xl p-5 transition-colors cursor-pointer ${colors[color] ?? colors.gray}">
      <svg class="w-6 h-6 mb-3 ${iconColors[color]}" fill="none" stroke="currentColor"
           stroke-width="1.75" viewBox="0 0 24 24">
        ${icons[icon] ?? ''}
      </svg>
      <p class="text-sm font-semibold text-gray-100">${title}</p>
      <p class="text-xs text-gray-500 mt-0.5">${desc}</p>
    </a>`;
}

function _escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
