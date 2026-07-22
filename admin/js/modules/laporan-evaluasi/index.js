// admin/js/modules/laporan-evaluasi/index.js
// Laporan evaluasi lintas bimtek untuk periode yang sama — gabungan tab
// Evaluasi per-bimtek (lihat ../bimtek/tab-evaluasi.js), tapi diagregasi
// lintas banyak bimtek sekaligus. Anonim di UI (lihat evaluasi-api.js).

import { listBimtek, listMapel } from '../bimtek/api.js';
import { listEvaluasiByBimtek, aggregateEvaluasi, unionPengajarIds } from '../bimtek/evaluasi-api.js';
import {
  PERTANYAAN_PENYELENGGARA, PERTANYAAN_KEPUASAN, PERTANYAAN_PENGAJAR
} from '../../../../shared/evaluasi-questions.js';
import { getPengajar } from '../pengajar-master/api.js';
import { renderEvaluasiGroupCard } from '../bimtek/evaluasi-ui.js';
import { setPageTitle } from '../../layout/navbar.js';

export async function renderLaporanEvaluasi() {
  setPageTitle('Laporan Evaluasi');
  const app = document.getElementById('app');
  if (!app) return;

  const today = new Date();
  const awalTahun = `${today.getFullYear()}-01-01`;
  const akhirTahun = `${today.getFullYear()}-12-31`;

  app.innerHTML = `
    <div class="px-6 pt-6 pb-2">
      <h1 class="text-lg font-semibold text-white mb-1">Laporan Evaluasi</h1>
      <p class="text-xs text-gray-500">Agregasi evaluasi peserta lintas bimtek untuk periode yang sama. Jawaban anonim — identitas peserta tidak ditampilkan.</p>
    </div>

    <div class="px-6 py-4 flex flex-wrap items-end gap-3">
      <div>
        <label class="block text-xs text-gray-500 mb-1">Periode mulai dari</label>
        <input type="date" id="filter-dari" class="form-input text-xs py-1.5 w-40" value="${awalTahun}">
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">sampai</label>
        <input type="date" id="filter-sampai" class="form-input text-xs py-1.5 w-40" value="${akhirTahun}">
      </div>
      <button id="btn-tampilkan" class="px-4 py-1.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">Tampilkan</button>
    </div>

    <div id="laporan-content" class="px-6 pb-8"></div>
  `;

  const load = () => _loadReport(
    document.getElementById('laporan-content'),
    document.getElementById('filter-dari').value,
    document.getElementById('filter-sampai').value
  );

  document.getElementById('btn-tampilkan').addEventListener('click', load);
  load();
}

async function _loadReport(content, dariStr, sampaiStr) {
  content.innerHTML = `
    <div class="flex justify-center py-10">
      <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  try {
    const dari    = dariStr ? new Date(dariStr) : null;
    const sampai  = sampaiStr ? new Date(sampaiStr + 'T23:59:59') : null;

    const allBimtek = await listBimtek({});
    const inRange = allBimtek.filter(b => {
      const mulai = b.periode?.mulai?.toDate ? b.periode.mulai.toDate() : (b.periode?.mulai ? new Date(b.periode.mulai) : null);
      if (!mulai) return false;
      if (dari && mulai < dari) return false;
      if (sampai && mulai > sampai) return false;
      return ['ongoing', 'completed'].includes(b.status);
    });

    if (!inRange.length) {
      content.innerHTML = `<div class="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-sm text-gray-500">Tidak ada bimtek pada periode ini.</div>`;
      return;
    }

    const [responsesPerBimtek, mapelsPerBimtek] = await Promise.all([
      Promise.all(inRange.map(b => listEvaluasiByBimtek(b.id))),
      Promise.all(inRange.map(b => listMapel(b.id))),
    ]);
    const allResponses = responsesPerBimtek.flat();
    const allPengajarIds = unionPengajarIds(mapelsPerBimtek.flat());

    if (!allResponses.length) {
      content.innerHTML = `<div class="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-sm text-gray-500">Belum ada evaluasi masuk untuk ${inRange.length} bimtek pada periode ini.</div>`;
      return;
    }

    const agg = aggregateEvaluasi(allResponses, allPengajarIds);
    const pengajarList = await Promise.all(allPengajarIds.map(id => getPengajar(id).catch(() => null)));
    const pengajarMap = Object.fromEntries(pengajarList.filter(Boolean).map(p => [p.id, p]));

    const perBimtekRows = inRange.map((b, i) => ({ bimtek: b, count: responsesPerBimtek[i].length }));

    content.innerHTML = `
      <div class="mb-4 text-xs text-gray-500">
        ${inRange.length} bimtek · ${agg.totalResponden} total responden evaluasi
      </div>

      <div class="space-y-4 mb-6">
        ${renderEvaluasiGroupCard('Penyelenggara', agg.penyelenggara, PERTANYAAN_PENYELENGGARA)}
        ${renderEvaluasiGroupCard('Kepuasan Peserta', agg.kepuasan, PERTANYAAN_KEPUASAN)}
        ${allPengajarIds.map(id => renderEvaluasiGroupCard(
          `Pengajar — ${pengajarMap[id]?.nama ?? id}`,
          agg.pengajar[id],
          PERTANYAAN_PENGAJAR
        )).join('')}
      </div>

      <h2 class="text-sm font-semibold text-gray-400 mb-2">Rincian per Bimtek</h2>
      <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-800">
              <th class="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase">Bimtek</th>
              <th class="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase">Periode</th>
              <th class="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase w-32">Responden</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800/60">
            ${perBimtekRows.map(({ bimtek: b, count }) => `
              <tr class="hover:bg-gray-800/40 cursor-pointer" data-bimtek="${b.id}">
                <td class="px-3 py-2.5 text-gray-200">${_esc(b.nama)}</td>
                <td class="px-3 py-2.5 text-xs text-gray-500">${_fmtDate(b.periode?.mulai)} – ${_fmtDate(b.periode?.selesai)}</td>
                <td class="px-3 py-2.5 text-xs text-gray-400">${count}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;

    content.querySelectorAll('[data-bimtek]').forEach(row => {
      row.addEventListener('click', () => { window.location.hash = `#/bimtek/${row.dataset.bimtek}`; });
    });
  } catch (err) {
    content.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat laporan: ${err.message}</div>`;
  }
}

function _fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
