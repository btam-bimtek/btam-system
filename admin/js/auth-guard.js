// admin/js/auth-guard.js
// Proteksi route admin — redirect ke login kalau belum authenticated.

import { subscribe, getState } from './store.js';
import { navigate } from './router.js';

let _guardActive = false;

/**
 * Pasang auth guard.
 * Harus dipanggil SEKALI di main.js setelah router diinisialisasi.
 *
 * - Saat auth.loading = true: tampilkan overlay loading, jangan render apapun.
 * - Saat auth.loading = false && user = null: redirect ke /login.
 * - Saat auth.loading = false && user ada: biarkan router jalan normal.
 */
export function installAuthGuard() {
  if (_guardActive) return;
  _guardActive = true;

  subscribe('auth', (authState) => {
    if (authState.loading) {
      _showLoadingOverlay();
      return;
    }

    _hideLoadingOverlay();

    const path = window.location.hash.slice(1) || '/';
    const isLoginPage = path === '/login';

    if (!authState.user && !isLoginPage) {
      navigate('/login');
    } else if (authState.user && isLoginPage) {
      navigate('/');
    }
  });
}

/**
 * Guard function untuk dipanggil di handler route yang butuh auth.
 * Return true kalau aman, false kalau sudah di-redirect.
 *
 * Contoh penggunaan:
 *   route('/peserta', ({ params }) => {
 *     if (!requireAuth()) return;
 *     // ... render halaman
 *   });
 */
export function requireAuth() {
  const auth = getState('auth');
  if (auth.loading) return false; // tunggu
  if (!auth.user) {
    navigate('/login');
    return false;
  }
  return true;
}

/**
 * Guard tambahan untuk operasi superadmin-only.
 */
export function requireSuperAdmin() {
  if (!requireAuth()) return false;
  const profile = getState('auth.profile');
  if (profile?.role !== 'superadmin') {
    _showForbidden();
    return false;
  }
  return true;
}

/**
 * Guard untuk operasi write (bukan viewer).
 */
export function requireWrite() {
  if (!requireAuth()) return false;
  const profile = getState('auth.profile');
  if (profile?.role === 'viewer') {
    _showForbidden('Akun Viewer tidak dapat melakukan perubahan data.');
    return false;
  }
  return true;
}

// ─── Loading overlay ─────────────────────────────────────────
function _showLoadingOverlay() {
  let el = document.getElementById('auth-loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'auth-loading-overlay';
    el.className = 'fixed inset-0 bg-gray-900 flex items-center justify-center z-50';
    el.innerHTML = `
      <div class="text-center">
        <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-gray-400 text-sm">Memverifikasi sesi…</p>
      </div>`;
    document.body.appendChild(el);
  }
  el.classList.remove('hidden');
}

function _hideLoadingOverlay() {
  document.getElementById('auth-loading-overlay')?.classList.add('hidden');
}

function _showForbidden(msg = 'Anda tidak memiliki akses ke fitur ini.') {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div class="flex flex-col items-center justify-center h-64 text-gray-400">
        <p class="text-5xl mb-4">403</p>
        <p class="text-lg">${msg}</p>
        <a href="#/" class="mt-4 text-blue-400 hover:underline">Kembali ke Dashboard</a>
      </div>`;
  }
}
