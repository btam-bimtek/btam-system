// pendaftar/js/pages/beranda.js

import { getSiklusAktif } from '../api.js';

export async function renderBeranda(app) {
  app.innerHTML = _skeleton();

  let siklus = null;
  try { siklus = await getSiklusAktif(); } catch (e) {}

  app.innerHTML = siklus ? _renderAktif(siklus) : _renderTutup();
}

// ─── Layout aktif ────────────────────────────────────────────

function _renderAktif(s) {
  const daftarEnd = s.phases?.pendaftaran?.end;
  const bimteks   = s.bimtekPilihan || [];

  return `
    ${_header()}
    <main class="max-w-2xl mx-auto px-4 py-8 space-y-6">

      <!-- Banner siklus -->
      <div class="bg-blue-600 text-white rounded-2xl p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <span class="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
              Pendaftaran Dibuka
            </span>
            <h2 class="text-xl font-bold mt-2">${_esc(s.nama)}</h2>
            ${daftarEnd ? `<p class="text-blue-200 text-sm mt-1">Ditutup: ${_fmtDate(daftarEnd)}</p>` : ''}
          </div>
          <div class="text-4xl">📋</div>
        </div>
      </div>

      <!-- Persyaratan -->
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <h3 class="font-semibold text-gray-800 mb-3">Persyaratan Umum</h3>
        <ul class="space-y-2 text-sm text-gray-600">
          <li class="flex items-start gap-2">
            <span class="text-blue-500 mt-0.5">✓</span>
            Pegawai PDAM / PERUMDAM / instansi pengelola air minum
          </li>
          <li class="flex items-start gap-2">
            <span class="text-blue-500 mt-0.5">✓</span>
            Mendapat surat tugas / rekomendasi dari instansi
          </li>
          <li class="flex items-start gap-2">
            <span class="text-blue-500 mt-0.5">✓</span>
            Memiliki KTP yang masih berlaku
          </li>
          <li class="flex items-start gap-2">
            <span class="text-blue-500 mt-0.5">✓</span>
            Belum pernah mengikuti bimtek yang sama dalam 3 tahun terakhir
          </li>
        </ul>
        ${s.adminRules?.length ? _renderRulesPublic(s.adminRules) : ''}
      </div>

      <!-- Bimtek tersedia -->
      ${bimteks.length ? `
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <h3 class="font-semibold text-gray-800 mb-3">Bimtek yang Dibuka</h3>
          <div class="space-y-2">
            ${bimteks.map(b => `
              <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p class="text-sm font-medium text-gray-800">${_esc(b.namaBimtek)}</p>
                  <p class="text-xs text-gray-500">${_esc(b.bidang || '')} · ${b.mode === 'online' ? 'Online' : 'Tatap Muka'}</p>
                </div>
                <span class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  Kuota ${b.kuota}
                </span>
              </div>`).join('')}
          </div>
        </div>` : ''}

      <!-- CTA -->
      <div class="flex flex-col sm:flex-row gap-3">
        <a href="#/daftar" class="btn-primary text-center flex-1">
          Daftar Sekarang
        </a>
        <a href="#/status" class="btn-secondary text-center flex-1">
          Cek Status Pendaftaran
        </a>
      </div>

    </main>
    ${_footer()}`;
}

// ─── Layout tutup ─────────────────────────────────────────────

function _renderTutup() {
  return `
    ${_header()}
    <main class="max-w-lg mx-auto px-4 py-12 text-center">
      <div class="text-5xl mb-4">🔒</div>
      <h2 class="text-xl font-bold text-gray-800 mb-2">Pendaftaran Belum Dibuka</h2>
      <p class="text-gray-500 text-sm mb-6">
        Saat ini tidak ada periode pendaftaran yang aktif.<br>
        Pantau pengumuman resmi dari BTAM.
      </p>
      <a href="#/status" class="btn-secondary inline-block">
        Cek Status Pendaftaran Lama
      </a>
    </main>
    ${_footer()}`;
}

function _renderRulesPublic(rules) {
  const fieldLabel = { pendidikan: 'Pendidikan', jenisKelamin: 'Jenis Kelamin', instansiKategori: 'Kategori Instansi' };
  const opLabel = { eq: '=', not_eq: '≠', in: 'salah satu dari', gte: '≥', lte: '≤' };
  return `
    <div class="mt-4 pt-4 border-t border-gray-100">
      <p class="text-xs font-medium text-gray-500 mb-2">Kriteria Administrasi:</p>
      <ul class="space-y-1">
        ${rules.map(r => `
          <li class="flex items-center gap-1.5 text-xs text-gray-600">
            <span class="text-blue-400">•</span>
            ${fieldLabel[r.field] ?? r.field} ${opLabel[r.operator] ?? r.operator}
            <strong>${Array.isArray(r.value) ? r.value.join(' / ') : r.value}</strong>
          </li>`).join('')}
      </ul>
    </div>`;
}

// ─── Shared layout parts ─────────────────────────────────────

function _header() {
  return `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="#/" class="flex items-center gap-2 text-blue-700 font-bold text-sm">
          <div class="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
          </div>
          SI-SABAT
        </a>
        <a href="#/status" class="text-xs text-gray-500 hover:text-blue-600 transition-colors">
          Cek Status →
        </a>
      </div>
    </header>`;
}

function _footer() {
  return `
    <footer class="text-center py-8 text-xs text-gray-400">
      Balai Teknik Air Minum — Direktorat Jenderal Cipta Karya
    </footer>`;
}

function _skeleton() {
  return `${_header()}<main class="max-w-2xl mx-auto px-4 py-8">
    <div class="animate-pulse space-y-4">
      <div class="h-32 bg-gray-200 rounded-2xl"></div>
      <div class="h-40 bg-gray-100 rounded-xl"></div>
    </div>
  </main>`;
}

function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
