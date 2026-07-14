// admin/js/modules/bimtek/tab-penilaian.js
// Orchestrator tab "Penilaian" dengan 5 sub-tab: Kehadiran, Nilai Manual, Pre/Post, Kelulusan, Pelanggaran
// Dipakai oleh detail.js

import { listBimtekScores } from './penilaian-api.js';
import { listSesi } from './api.js';
import { renderSubKehadiran } from './sub-kehadiran.js';
import { renderSubNilaiManual } from './sub-nilai-manual.js';
import { renderSubPrePost } from './sub-prepost.js';
import { renderSubKelulusan } from './sub-kelulusan.js';
import { renderSubPelanggaran } from './sub-pelanggaran.js';
import { renderSubImportNilai } from './sub-import-nilai.js';

// ─── STATE ──────────────────────────────────────────────────────────

let S = {
  bimtekId: null,
  bimtek: null,
  scores: [],
  sesis: [],
  subTab: 'kehadiran', // kehadiran | nilai | prepost | kelulusan | pelanggaran | import
};

// ─── ENTRY POINT ────────────────────────────────────────────────────

export async function renderTabPenilaian(container, bimtekId, bimtek) {
  S.bimtekId = bimtekId;
  S.bimtek = bimtek;
  S.subTab = 'kehadiran';

  // Load data
  try {
    const [scores, sesis] = await Promise.all([
      listBimtekScores(bimtekId),
      listSesi(bimtekId)
    ]);
    S.scores = scores;
    S.sesis = sesis;

    _render(container);
  } catch (err) {
    container.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat: ${err.message}</div>`;
    console.error(err);
  }
}

// ─── RENDER SHELL ───────────────────────────────────────────────────

function _render(container) {
  container.innerHTML = `
    <!-- Sub-tab navigation -->
    <div class="flex gap-2 mb-6 border-b border-gray-800 flex-wrap">
      <button id="btn-sub-kehadiran" class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white border-b-2 border-transparent ${S.subTab === 'kehadiran' ? 'text-blue-400 border-blue-400' : ''}">
        Kehadiran
      </button>
      <button id="btn-sub-nilai" class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white border-b-2 border-transparent ${S.subTab === 'nilai' ? 'text-blue-400 border-blue-400' : ''}">
        Nilai Manual
      </button>
      <button id="btn-sub-prepost" class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white border-b-2 border-transparent ${S.subTab === 'prepost' ? 'text-blue-400 border-blue-400' : ''}">
        Pre/Post Test
      </button>
      <button id="btn-sub-kelulusan" class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white border-b-2 border-transparent ${S.subTab === 'kelulusan' ? 'text-blue-400 border-blue-400' : ''}">
        Kelulusan
      </button>
      <button id="btn-sub-pelanggaran" class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white border-b-2 border-transparent ${S.subTab === 'pelanggaran' ? 'text-red-400 border-red-400' : ''}">
        Pelanggaran
      </button>
      <button id="btn-sub-import" class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white border-b-2 border-transparent ${S.subTab === 'import' ? 'text-yellow-400 border-yellow-400' : ''}">
        Import CSV
      </button>
    </div>

    <!-- Sub-tab content -->
    <div id="sub-tab-content" class="space-y-4"></div>
  `;

  const contentDiv = container.querySelector('#sub-tab-content');

  // Render active sub-tab
  switch (S.subTab) {
    case 'kehadiran':
      renderSubKehadiran(contentDiv, S.bimtekId, S.bimtek, S.scores, S.sesis, async () => {
        S.scores = await listBimtekScores(S.bimtekId);
        S.subTab = 'kelulusan';
        _render(container);
      });
      break;
    case 'nilai':
      renderSubNilaiManual(contentDiv, S.bimtekId, S.bimtek, S.scores);
      break;
    case 'prepost':
      renderSubPrePost(contentDiv, S.bimtekId, S.bimtek, S.scores, async () => {
        // Setelah sync berhasil: refresh scores lalu pindah ke tab kelulusan
        S.scores = await listBimtekScores(S.bimtekId);
        S.subTab = 'kelulusan';
        _render(container);
      });
      break;
    case 'kelulusan':
      renderSubKelulusan(contentDiv, S.bimtekId, S.bimtek, S.scores);
      break;
    case 'pelanggaran':
      renderSubPelanggaran(contentDiv, S.bimtekId);
      break;
    case 'import':
      renderSubImportNilai(contentDiv, S.bimtekId, async () => {
        S.scores = await listBimtekScores(S.bimtekId);
        S.subTab = 'kelulusan';
        _render(container);
      }, S.bimtek);
      break;
  }

  // Bind sub-tab buttons
  container.querySelector('#btn-sub-kehadiran')?.addEventListener('click', () => {
    S.subTab = 'kehadiran';
    _render(container);
  });

  container.querySelector('#btn-sub-nilai')?.addEventListener('click', () => {
    S.subTab = 'nilai';
    _render(container);
  });

  container.querySelector('#btn-sub-prepost')?.addEventListener('click', () => {
    S.subTab = 'prepost';
    _render(container);
  });

  container.querySelector('#btn-sub-kelulusan')?.addEventListener('click', () => {
    S.subTab = 'kelulusan';
    _render(container);
  });

  container.querySelector('#btn-sub-pelanggaran')?.addEventListener('click', () => {
    S.subTab = 'pelanggaran';
    _render(container);
  });

  container.querySelector('#btn-sub-import')?.addEventListener('click', () => {
    S.subTab = 'import';
    _render(container);
  });
}
