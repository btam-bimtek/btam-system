// peserta/js/pages/login.js

import { login, setSession } from '../api.js';

export function renderLogin(app) {
  app.innerHTML = `
    ${_header()}
    <main class="max-w-sm mx-auto px-4 py-10">
      <h1 class="text-xl font-bold text-gray-800 mb-1">Login Peserta</h1>
      <p class="text-sm text-gray-500 mb-6">Masukkan nomor peserta dan tanggal lahir Anda untuk melihat nilai, sertifikat, dan mengisi evaluasi.</p>

      <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1.5">Nomor Peserta</label>
          <input id="inp-nopeserta" type="text" class="form-input" placeholder="Contoh: BTAM-2026-001" autocomplete="username">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1.5">Tanggal Lahir</label>
          <input id="inp-tgl" type="date" class="form-input">
        </div>
        <div id="login-error" class="hidden text-xs text-red-600"></div>
        <button id="btn-login" class="btn-primary w-full">Masuk</button>
      </div>
    </main>
    ${_footer()}`;

  const doLogin = async () => {
    const noPeserta    = document.getElementById('inp-nopeserta')?.value.trim();
    const tanggalLahir = document.getElementById('inp-tgl')?.value;
    const err = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    if (!noPeserta || !tanggalLahir) {
      err.textContent = 'Nomor peserta dan tanggal lahir wajib diisi.';
      err.classList.remove('hidden');
      return;
    }
    err.classList.add('hidden');
    btn.disabled = true; btn.textContent = 'Memeriksa…';

    try {
      const peserta = await login(noPeserta, tanggalLahir);
      if (!peserta) {
        err.textContent = 'Nomor peserta atau tanggal lahir tidak cocok.';
        err.classList.remove('hidden');
        return;
      }
      setSession(peserta.id);
      window.location.hash = '#/';
    } catch (e) {
      err.textContent = 'Terjadi kesalahan: ' + e.message;
      err.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.textContent = 'Masuk';
    }
  };

  document.getElementById('btn-login')?.addEventListener('click', doLogin);
  document.getElementById('inp-tgl')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

function _header() {
  return `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-sm mx-auto px-4 h-14 flex items-center">
        <span class="flex items-center gap-2 text-blue-700 font-bold text-sm">
          <div class="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
          </div>
          Portal Peserta — SI-SABAT
        </span>
      </div>
    </header>`;
}
function _footer() { return `<footer class="text-center py-8 text-xs text-gray-400">Balai Teknik Air Minum — Direktorat Jenderal Cipta Karya</footer>`; }
