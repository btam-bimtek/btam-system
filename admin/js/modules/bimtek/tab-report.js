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
  container.innerHTML = `
    <div class="flex gap-2 mb-6 border-b border-gray-800">
      <button id="btn-sub-penyelenggara"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
               ${S.subTab === 'penyelenggara' ? 'text-[#2dd4bf] border-[#2dd4bf]' : 'text-gray-400 border-transparent hover:text-gray-200'}">
        Laporan Penyelenggara
      </button>
      <button id="btn-sub-peserta"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
               ${S.subTab === 'peserta' ? 'text-[#2dd4bf] border-[#2dd4bf]' : 'text-gray-400 border-transparent hover:text-gray-200'}">
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
  const active   = 'px-4 py-2 text-sm font-medium border-b-2 transition-colors text-[#2dd4bf] border-[#2dd4bf]';
  const inactive = 'px-4 py-2 text-sm font-medium border-b-2 transition-colors text-gray-400 border-transparent hover:text-gray-200';
  btnPenyelenggara.className = S.subTab === 'penyelenggara' ? active : inactive;
  btnPeserta.className       = S.subTab === 'peserta'       ? active : inactive;

  _renderSubTab(container.querySelector('#report-sub-content'));
}

function _renderSubTab(el) {
  if (!el) return;
  el.innerHTML = `
    <div class="flex items-center justify-center py-12">
      <div class="w-6 h-6 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin"></div>
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

