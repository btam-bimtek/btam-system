// admin/js/modules/bimtek/tab-evaluasi.js
// Tab Evaluasi di detail bimtek — rata-rata skor + komentar dari peserta.
// Pengajar ditampilkan per mapel (1 pengajar bisa dinilai terpisah untuk tiap
// mapel yang dia ajar). Untuk skor kumulatif pengajar lintas bimtek, lihat
// menu Laporan Evaluasi. Anonim di UI: tidak menampilkan noPeserta sama sekali.

import { listEvaluasiByBimtek, aggregateEvaluasi, aggregateEvaluasiPerMapel, unionPengajarIds } from './evaluasi-api.js';
import { PERTANYAAN_PENYELENGGARA, PERTANYAAN_KEPUASAN, PERTANYAAN_PENGAJAR } from '../../../../shared/evaluasi-questions.js';
import { getPengajar } from '../pengajar-master/api.js';
import { renderEvaluasiGroupCard } from './evaluasi-ui.js';

/**
 * @param {HTMLElement} el        - container #tab-content
 * @param {string}      bimtekId
 * @param {object}      bimtek
 * @param {object[]}    mapels    - S.mapels dari detail.js
 */
export async function renderTabEvaluasi(el, bimtekId, bimtek, mapels = []) {
  el.innerHTML = `
    <div class="flex justify-center py-8">
      <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  try {
    const pengajarIds = unionPengajarIds(mapels);
    const [responses, pengajarList] = await Promise.all([
      listEvaluasiByBimtek(bimtekId),
      pengajarIds.length ? Promise.all(pengajarIds.map(id => _getPengajarSafe(id))) : [],
    ]);

    if (!responses.length) {
      el.innerHTML = `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center space-y-2">
          <p class="text-gray-400 text-sm font-medium">Belum ada evaluasi masuk</p>
          <p class="text-gray-600 text-xs">Evaluasi hanya bisa diisi peserta saat bimtek berstatus berjalan atau selesai.</p>
        </div>`;
      return;
    }

    const agg = aggregateEvaluasi(responses, []); // hanya butuh Penyelenggara/Kepuasan di sini
    const perMapel = aggregateEvaluasiPerMapel(responses, mapels);
    const pengajarMap = Object.fromEntries(pengajarList.filter(Boolean).map(p => [p.id, p]));

    el.innerHTML = `
      <div class="mb-4 text-xs text-gray-500">${agg.totalResponden} peserta mengisi evaluasi (jawaban anonim — identitas tidak ditampilkan).</div>
      <div class="space-y-4">
        ${renderEvaluasiGroupCard('Penyelenggara', agg.penyelenggara, PERTANYAAN_PENYELENGGARA)}
        ${renderEvaluasiGroupCard('Kepuasan Peserta', agg.kepuasan, PERTANYAAN_KEPUASAN)}
        ${perMapel.map(({ mapel, pengajarId, agg: pAgg }) => renderEvaluasiGroupCard(
          `Pengajar — ${pengajarMap[pengajarId]?.nama ?? pengajarId} · Mapel: ${_esc(mapel.nama)}`,
          pAgg,
          PERTANYAAN_PENGAJAR
        )).join('')}
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat evaluasi: ${err.message}</div>`;
  }
}

async function _getPengajarSafe(id) {
  try { return await getPengajar(id); } catch { return null; }
}

function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
