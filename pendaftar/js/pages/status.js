// pendaftar/js/pages/status.js

import { cekStatus } from '../api.js';

export function renderStatus(app) {
  app.innerHTML = `
    ${_header()}
    <main class="max-w-lg mx-auto px-4 py-8">
      <a href="#/" class="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 mb-5">← Beranda</a>

      <h1 class="text-xl font-bold text-gray-800 mb-1">Cek Status Pendaftaran</h1>
      <p class="text-sm text-gray-500 mb-6">Masukkan nomor pendaftaran atau alamat email yang Anda gunakan saat mendaftar.</p>

      <div class="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <label class="block text-xs font-medium text-gray-600 mb-2">
          Nomor Pendaftaran / Email
        </label>
        <div class="flex gap-2">
          <input id="inp-query" type="text" class="form-input flex-1"
                 placeholder="REG-2027-XXXXXX atau email@..." />
          <button id="btn-cek" class="btn-primary px-4 whitespace-nowrap">Cek</button>
        </div>
        <div id="cek-error" class="hidden text-xs text-red-600 mt-2"></div>
      </div>

      <div id="result-area"></div>

    </main>
    ${_footer()}`;

  document.getElementById('inp-query')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-cek')?.click();
  });

  document.getElementById('btn-cek')?.addEventListener('click', async () => {
    const q   = document.getElementById('inp-query')?.value.trim();
    const err = document.getElementById('cek-error');
    const res = document.getElementById('result-area');
    const btn = document.getElementById('btn-cek');

    if (!q) { err.textContent = 'Masukkan nomor pendaftaran atau email.'; err.classList.remove('hidden'); return; }
    err.classList.add('hidden');

    btn.disabled = true; btn.textContent = 'Mencari…';
    res.innerHTML = '';

    try {
      const data = await cekStatus(q);
      if (!data) {
        res.innerHTML = `
          <div class="text-center py-8">
            <div class="text-3xl mb-2">🔍</div>
            <p class="text-sm font-medium text-gray-700">Data tidak ditemukan</p>
            <p class="text-xs text-gray-500 mt-1">Pastikan nomor pendaftaran atau email yang dimasukkan sudah benar.</p>
          </div>`;
      } else {
        res.innerHTML = _renderResult(data);
      }
    } catch (e) {
      err.textContent = 'Terjadi kesalahan: ' + e.message;
      err.classList.remove('hidden');
    }

    btn.disabled = false; btn.textContent = 'Cek';
  });
}

// ─── Render hasil ─────────────────────────────────────────────

function _renderResult(d) {
  const statusAdmin = {
    pending: { label: 'Menunggu Verifikasi', color: 'bg-yellow-100 text-yellow-700' },
    lulus:   { label: 'Lulus Administrasi',  color: 'bg-green-100 text-green-700' },
    gugur:   { label: 'Gugur Administrasi',  color: 'bg-red-100 text-red-700' }
  }[d.statusAdmin] ?? { label: d.statusAdmin, color: 'bg-gray-100 text-gray-600' };

  const statusTertulis = {
    belum_ujian: { label: 'Belum Ujian',   color: 'bg-gray-100 text-gray-600' },
    ujian:       { label: 'Sedang Ujian',  color: 'bg-blue-100 text-blue-700' },
    lulus:       { label: 'Lulus',         color: 'bg-green-100 text-green-700' },
    gugur:       { label: 'Tidak Lulus',   color: 'bg-red-100 text-red-700' }
  }[d.statusTertulis];

  const statusFinal = {
    terpilih:       { label: 'Terpilih sebagai Peserta', color: 'bg-green-100 text-green-700', icon: '🎉' },
    cadangan:       { label: 'Daftar Cadangan',           color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
    tidak_terpilih: { label: 'Tidak Terpilih',            color: 'bg-gray-100 text-gray-600', icon: '—' }
  }[d.statusFinal];

  const steps = [
    {
      label: 'Pendaftaran',
      done: true,
      detail: `Terdaftar ${_fmtDate(d.submittedAt)}`,
      status: { label: 'Selesai', color: 'bg-green-100 text-green-700' }
    },
    {
      label: 'Seleksi Administrasi',
      done: !!d.statusAdmin && d.statusAdmin !== 'pending',
      detail: d.statusAdmin === 'gugur' && d.statusAdminReason ? `Alasan: ${d.statusAdminReason}` : null,
      status: d.statusAdmin !== 'pending' ? statusAdmin : null
    },
    {
      label: 'Seleksi Tertulis',
      done: !!d.statusTertulis,
      detail: d.nilaiTertulis != null ? `Nilai: ${d.nilaiTertulis}` : null,
      status: statusTertulis ?? null
    },
    {
      label: 'Penentuan Peserta',
      done: !!d.statusFinal,
      detail: d.bimtekIdTerpilih ? `Bimtek: ${d.bimtekIdTerpilih}` : null,
      status: statusFinal ?? null
    }
  ];

  return `
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <!-- Header -->
      <div class="p-4 border-b border-gray-100">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-semibold text-gray-800">${_esc(d.nama)}</p>
            <p class="text-xs text-gray-500 mt-0.5">${_esc(d.instansi || '')} · ${_esc(d.provinsi || '')}</p>
          </div>
          <p class="text-xs font-mono text-gray-500 shrink-0">${_esc(d.pendaftarId)}</p>
        </div>
      </div>

      <!-- Steps -->
      <div class="p-4 space-y-3">
        ${steps.map((step, i) => `
          <div class="flex gap-3">
            <div class="flex flex-col items-center">
              <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                          ${step.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}">
                ${step.done ? '✓' : i + 1}
              </div>
              ${i < steps.length - 1 ? `<div class="w-0.5 h-4 ${step.done ? 'bg-green-400' : 'bg-gray-200'} my-0.5"></div>` : ''}
            </div>
            <div class="flex-1 pb-1">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-medium text-gray-700">${step.label}</p>
                ${step.status ? `<span class="text-xs px-2 py-0.5 rounded-full font-medium ${step.status.color}">${step.status.label}</span>` : ''}
              </div>
              ${step.detail ? `<p class="text-xs text-gray-500 mt-0.5">${_esc(step.detail)}</p>` : ''}
            </div>
          </div>`).join('')}
      </div>

      ${statusFinal?.icon === '🎉' ? `
        <div class="bg-green-50 border-t border-green-100 p-4 text-center">
          <p class="text-sm font-semibold text-green-700">🎉 Selamat! Anda terpilih sebagai peserta bimtek.</p>
          <p class="text-xs text-green-600 mt-1">Informasi lebih lanjut akan dikirimkan melalui email dan WhatsApp.</p>
        </div>` : ''}
    </div>`;
}

function _header() {
  return `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-lg mx-auto px-4 h-14 flex items-center">
        <a href="#/" class="flex items-center gap-2 text-blue-700 font-bold text-sm">
          <div class="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
          </div>
          SI-SABAT
        </a>
      </div>
    </header>`;
}
function _footer() { return `<footer class="text-center py-8 text-xs text-gray-400">Balai Teknik Air Minum — Direktorat Jenderal Cipta Karya</footer>`; }
function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
