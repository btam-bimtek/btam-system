// admin/js/modules/bimtek/tab-evaluasi.js
// Tab Evaluasi di detail bimtek — rata-rata skor + komentar dari peserta.
// Anonim di UI: tidak menampilkan noPeserta sama sekali (lihat evaluasi-api.js).

import { listEvaluasiByBimtek, aggregateEvaluasi, unionPengajarIds } from './evaluasi-api.js';
import {
  PERTANYAAN_PENYELENGGARA, PERTANYAAN_KEPUASAN, PERTANYAAN_PENGAJAR
} from '../../../../shared/evaluasi-questions.js';
import { getPengajar } from '../pengajar-master/api.js';
import { renderEvaluasiGroupCard } from './evaluasi-ui.js';

/**
 * @param {HTMLElement} el        - container #tab-content
 * @param {string}      bimtekId
 * @param {object}      bimtek
 * @param {object[]}    mapels    - S.mapels dari detail.js, untuk union pengajarIds
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

    const agg = aggregateEvaluasi(responses, pengajarIds);
    const pengajarMap = Object.fromEntries(pengajarList.filter(Boolean).map(p => [p.id, p]));

    el.innerHTML = `
      <div class="mb-4 text-xs text-gray-500">${agg.totalResponden} peserta mengisi evaluasi (jawaban anonim — identitas tidak ditampilkan).</div>
      <div class="space-y-4">
        ${renderEvaluasiGroupCard('Penyelenggara', agg.penyelenggara, PERTANYAAN_PENYELENGGARA)}
        ${renderEvaluasiGroupCard('Kepuasan Peserta', agg.kepuasan, PERTANYAAN_KEPUASAN)}
        ${pengajarIds.map(id => renderEvaluasiGroupCard(
          `Pengajar — ${pengajarMap[id]?.nama ?? id}`,
          agg.pengajar[id],
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

