// admin/js/modules/auth/login.js
// Halaman login admin.

import { signIn, requestPasswordReset } from '../../../../shared/auth.js';
import { navigate } from '../../router.js';
import { showToast } from '../../components/toast.js';

export function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div class="w-full max-w-md">

        <!-- Logo / Header -->
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" stroke-width="2"
                 viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-white">BTAM Terpadu</h1>
          <p class="text-gray-500 text-sm mt-1">Sistem Manajemen Bimtek</p>
        </div>

        <!-- Card -->
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
          <h2 class="text-lg font-semibold text-white mb-6">Masuk ke Akun Admin</h2>

          <form id="login-form" novalidate>
            <!-- Email -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-400 mb-1.5" for="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autocomplete="email"
                required
                placeholder="admin@btam.go.id"
                class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5
                       text-white placeholder-gray-600 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       transition-colors"
              />
            </div>

            <!-- Password -->
            <div class="mb-6">
              <div class="flex justify-between items-center mb-1.5">
                <label class="block text-sm font-medium text-gray-400" for="password">
                  Password
                </label>
                <button
                  type="button"
                  id="forgot-btn"
                  class="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Lupa password?
                </button>
              </div>
              <div class="relative">
                <input
                  id="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  placeholder="••••••••"
                  class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5
                         text-white placeholder-gray-600 text-sm pr-10
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-colors"
                />
                <button
                  type="button"
                  id="toggle-pw"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  tabindex="-1"
                >
                  <svg id="eye-icon" class="w-4 h-4" fill="none" stroke="currentColor"
                       stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7
                             -1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Error message -->
            <p id="login-error" class="hidden text-sm text-red-400 mb-4 bg-red-900/20
                                       border border-red-800 rounded-lg px-3 py-2"></p>

            <!-- Submit -->
            <button
              type="submit"
              id="login-btn"
              class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium
                     rounded-lg py-2.5 text-sm transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Masuk
            </button>
          </form>
        </div>

        <p class="text-center text-xs text-gray-600 mt-6">
          BTAM — Balai Teknik Air Minum
        </p>
      </div>
    </div>
  `;

  _bindEvents();
}

function _bindEvents() {
  const form      = document.getElementById('login-form');
  const emailEl   = document.getElementById('email');
  const passwordEl= document.getElementById('password');
  const errorEl   = document.getElementById('login-error');
  const loginBtn  = document.getElementById('login-btn');
  const togglePw  = document.getElementById('toggle-pw');
  const forgotBtn = document.getElementById('forgot-btn');

  // Toggle show/hide password
  togglePw.addEventListener('click', () => {
    const isPassword = passwordEl.type === 'password';
    passwordEl.type  = isPassword ? 'text' : 'password';
    document.getElementById('eye-icon').innerHTML = isPassword
      ? `<path stroke-linecap="round" stroke-linejoin="round"
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7
                 a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878
                 l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59
                 m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0
                 01-4.132 5.411m0 0L21 21"/>`
      : `<path stroke-linecap="round" stroke-linejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
         <path stroke-linecap="round" stroke-linejoin="round"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7
                 -1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>`;
  });

  // Forgot password
  forgotBtn.addEventListener('click', async () => {
    const email = emailEl.value.trim();
    if (!email) {
      _showError('Masukkan email terlebih dahulu.');
      emailEl.focus();
      return;
    }
    try {
      forgotBtn.disabled = true;
      forgotBtn.textContent = 'Mengirim…';
      await requestPasswordReset(email);
      showToast('Link reset password dikirim ke ' + email, 'success');
    } catch (err) {
      _showError('Gagal kirim reset: ' + _friendlyError(err.code));
    } finally {
      forgotBtn.disabled = false;
      forgotBtn.textContent = 'Lupa password?';
    }
  });

  // Submit login
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    _hideError();

    const email    = emailEl.value.trim();
    const password = passwordEl.value;

    if (!email || !password) {
      _showError('Email dan password wajib diisi.');
      return;
    }

    loginBtn.disabled     = true;
    loginBtn.textContent  = 'Memverifikasi…';

    try {
      await signIn(email, password);
      // onAuthChange di main.js akan handle redirect
    } catch (err) {
      _showError(_friendlyError(err.code ?? err.message));
      loginBtn.disabled    = false;
      loginBtn.textContent = 'Masuk';
    }
  });
}

function _showError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function _hideError() {
  document.getElementById('login-error')?.classList.add('hidden');
}

function _friendlyError(code) {
  const map = {
    'auth/invalid-email':          'Format email tidak valid.',
    'auth/user-disabled':          'Akun dinonaktifkan.',
    'auth/user-not-found':         'Email atau password salah.',
    'auth/wrong-password':         'Email atau password salah.',
    'auth/invalid-credential':     'Email atau password salah.',
    'auth/too-many-requests':      'Terlalu banyak percobaan. Coba lagi nanti.',
    'auth/network-request-failed': 'Tidak ada koneksi internet.'
  };
  return map[code] ?? code ?? 'Terjadi kesalahan. Coba lagi.';
}
