// admin/js/modules/bimtek/tab-report.js
// Orchestrator tab "Report" dengan 2 sub-tab: Penyelenggara + Peserta.
// Dipanggil oleh detail.js

import { renderSubReportPenyelenggara } from './sub-report-penyelenggara.js';
import { renderSubReportPeserta }       from './sub-report-peserta.js';

let S = {
  bimtekId: null,
  bimtek:   null,
  mapels:   [],
  pengajars:[],
  subTab:   'penyelenggara'
};

export async function renderTabReport(container, bimtekId, bimtek, mapels = [], pengajars = []) {
  S.bimtekId  = bimtekId;
  S.bimtek    = bimtek;
  S.mapels    = mapels;
  S.pengajars = pengajars;
  S.subTab    = 'penyelenggara';

  _render(container);
}

function _render(container) {
  // Warning jika ukIds belum diset
  const ukWarning = (!S.bimtek?.ukIds?.length) ? `
    <div class="mb-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      <p class="text-xs text-yellow-400">
        UK belum didefinisikan untuk bimtek ini. Laporan Section C menggunakan UK auto-discovered dari soal.
        Untuk laporan yang lebih akurat, definisikan UK di tab <strong>Kompetensi</strong>.
      </p>
    </div>` : '';

  container.innerHTML = `
    ${ukWarning}
    <div class="flex gap-2 mb-6 border-b border-gray-800">
      <button id="btn-sub-penyelenggara"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
               ${S.subTab === 'penyelenggara' ? 'text-blue-400 border-blue-400' : 'text-gray-400 border-transparent hover:text-gray-200'}">
        Laporan Penyelenggara
      </button>
      <button id="btn-sub-peserta"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
               ${S.subTab === 'peserta' ? 'text-blue-400 border-blue-400' : 'text-gray-400 border-transparent hover:text-gray-200'}">
        Laporan Peserta
      </button>
    </div>
    <div id="report-sub-content"></div>
  `;

  container.querySelector('#btn-sub-penyelenggara').addEventListener('click', () => _switchTab('penyelenggara', container));
  container.querySelector('#btn-sub-peserta').addEventListener('click',       () => _switchTab('peserta',       container));

  _renderSubTab(container.querySelector('#report-sub-content'));
}

function _switchTab(tab, container) {
  if (S.subTab === tab) return;
  S.subTab = tab;

  // Update tab button styles
  const btnPenyelenggara = container.querySelector('#btn-sub-penyelenggara');
  const btnPeserta       = container.querySelector('#btn-sub-peserta');
  const active   = 'px-4 py-2 text-sm font-medium border-b-2 transition-colors text-blue-400 border-blue-400';
  const inactive = 'px-4 py-2 text-sm font-medium border-b-2 transition-colors text-gray-400 border-transparent hover:text-gray-200';
  btnPenyelenggara.className = S.subTab === 'penyelenggara' ? active : inactive;
  btnPeserta.className       = S.subTab === 'peserta'       ? active : inactive;

  _renderSubTab(container.querySelector('#report-sub-content'));
}

function _renderSubTab(el) {
  if (!el) return;
  el.innerHTML = `
    <div class="flex items-center justify-center py-12">
      <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  if (S.subTab === 'penyelenggara') {
    renderSubReportPenyelenggara(el, S.bimtekId, S.bimtek, S.mapels, S.pengajars).catch(err => {
      el.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat laporan penyelenggara: ${err.message}</div>`;
      console.error(err);
    });
  } else {
    renderSubReportPeserta(el, S.bimtekId, S.bimtek).catch(err => {
      el.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat laporan peserta: ${err.message}</div>`;
      console.error(err);
    });
  }
}

