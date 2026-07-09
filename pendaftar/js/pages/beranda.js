// pendaftar/js/pages/beranda.js

import { getSiklusAktif } from '../api.js';

export async function renderBeranda(app) {
  app.innerHTML = _skeleton();

  let siklus = null;
  try { siklus = await getSiklusAktif(); } catch (e) {}

  app.innerHTML = siklus ? _renderAktif(siklus) : _renderTutup();
  if (siklus) _bindBimtekToggles(app);
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

      <!-- Persyaratan Umum -->
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
        </ul>
        <p class="text-xs text-gray-400 mt-3">Persyaratan administrasi tambahan berbeda per bimtek — lihat detail masing-masing bimtek di bawah.</p>
      </div>

      <!-- Bimtek tersedia -->
      ${bimteks.length ? `
        <div>
          <h3 class="font-semibold text-gray-800 mb-3">Bimtek yang Dibuka</h3>
          <div class="space-y-3">
            ${bimteks.map((b, i) => _renderBimtekCard(b, i)).join('')}
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

function _renderBimtekCard(b, i) {
  const panelId = `bimtek-panel-${i}`;
  const rules    = b.adminRules || [];
  const hasExtra = b.deskripsi || rules.length || b.larangRepeatBimtek3Tahun;

  return `
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <!-- Header bimtek -->
      <div class="flex items-center justify-between gap-3 p-4">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800">${_esc(b.namaBimtek)}</p>
          <p class="text-xs text-gray-500 mt-0.5">
            ${b.bidang ? _esc(b.bidang) + ' · ' : ''}${b.mode === 'online' ? 'Online' : 'Tatap Muka'}
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            Kuota ${b.kuota}
          </span>
          ${hasExtra ? `
            <button class="btn-toggle-bimtek text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                    data-target="${panelId}" aria-expanded="false">
              <span class="toggle-label">Lihat detail</span>
              <svg class="w-3.5 h-3.5 toggle-chevron transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>` : ''}
        </div>
      </div>

      <!-- Panel detail (collapsed by default) -->
      ${hasExtra ? `
        <div id="${panelId}" class="hidden border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          ${b.deskripsi ? `
            <div>
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Materi &amp; Deskripsi</p>
              <p class="text-sm text-gray-700 whitespace-pre-line">${_esc(b.deskripsi)}</p>
            </div>` : ''}

          ${(rules.length || b.larangRepeatBimtek3Tahun) ? `
            <div ${b.deskripsi ? 'class="border-t border-gray-100 pt-3"' : ''}>
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Persyaratan Administrasi</p>
              <ul class="space-y-1.5">
                ${rules.map(r => `
                  <li class="flex items-start gap-1.5 text-sm text-gray-700">
                    <span class="text-blue-500 mt-0.5 shrink-0">•</span>
                    ${_ruleToText(r)}
                  </li>`).join('')}
                ${b.larangRepeatBimtek3Tahun ? `
                  <li class="flex items-start gap-1.5 text-sm text-gray-700">
                    <span class="text-blue-500 mt-0.5 shrink-0">•</span>
                    Belum pernah terpilih di bimtek ini dalam 3 tahun terakhir
                  </li>` : ''}
              </ul>
            </div>` : ''}
        </div>` : ''}
    </div>`;
}

function _ruleToText(r) {
  const FIELD = { pendidikan: 'Pendidikan minimal', pengalamanTahun: 'Pengalaman kerja di bidang' };
  const OP    = { eq: '', not_eq: 'bukan', gte: 'minimal', lte: 'maksimal', in: 'salah satu dari' };
  const field = FIELD[r.field] ?? r.field;
  const op    = OP[r.operator] ?? r.operator;
  const val   = Array.isArray(r.value) ? r.value.join(' / ') : r.value;
  const unit  = r.field === 'pengalamanTahun' ? ' tahun' : '';
  return `${field}${op ? ' ' + op : ''} <strong>${_esc(String(val))}${unit}</strong>`;
}

function _bindBimtekToggles(app) {
  app.querySelectorAll('.btn-toggle-bimtek').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel   = document.getElementById(btn.dataset.target);
      const chevron = btn.querySelector('.toggle-chevron');
      const label   = btn.querySelector('.toggle-label');
      if (!panel) return;
      const isOpen = !panel.classList.toggle('hidden');
      chevron?.classList.toggle('rotate-180', isOpen);
      if (label) label.textContent = isOpen ? 'Tutup' : 'Lihat detail';
      btn.setAttribute('aria-expanded', String(isOpen));
    });
  });
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
