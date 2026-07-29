// admin/js/modules/bimtek/tab-uk.js
// Tab Kompetensi di detail bimtek — UK yang berasal dari soal ujian bimtek ini.

import { listExams } from './exam-api.js';
import { db, doc, getDoc } from '../../../../shared/db.js';
import { COL, BIDANG_LIST } from '../../../../shared/constants.js';

/**
 * @param {HTMLElement} el        - container #tab-content
 * @param {string}      bimtekId
 */
export async function renderTabUK(el, bimtekId) {
  el.innerHTML = `
    <div class="flex justify-center py-8">
      <div class="w-5 h-5 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  try {
    // 1. Load semua exam config bimtek ini
    const exams = await listExams(bimtekId);

    if (!exams.length) {
      el.innerHTML = `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center space-y-2">
          <p class="text-gray-400 text-sm font-medium">Belum ada ujian</p>
          <p class="text-gray-600 text-xs">Tambahkan ujian di tab Ujian terlebih dahulu.</p>
        </div>`;
      return;
    }

    // 2. Kumpulkan soalIds unik dari semua exam
    const allSoalIds = [...new Set(exams.flatMap(e => e.soalIds ?? []))];

    if (!allSoalIds.length) {
      el.innerHTML = `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center space-y-2">
          <p class="text-gray-400 text-sm font-medium">Belum ada soal dipilih</p>
          <p class="text-gray-600 text-xs">Pilih soal di konfigurasi ujian untuk melihat kompetensi yang diukur.</p>
        </div>`;
      return;
    }

    // 3. Batch fetch soal docs (chunk 30)
    const soalMap = {};
    const CHUNK = 30;
    for (let i = 0; i < allSoalIds.length; i += CHUNK) {
      const chunk = allSoalIds.slice(i, i + CHUNK);
      const snaps = await Promise.all(chunk.map(id => getDoc(doc(db, COL.BANK_SOAL, id))));
      snaps.forEach(snap => {
        if (snap.exists()) soalMap[snap.id] = { id: snap.id, ...snap.data() };
      });
    }

    // 4. Group soal by unitKompetensi
    const ukMap = {}; // ukKey → { ekKey, ekNama, bidangIds, soalCount, examNames }
    for (const soal of Object.values(soalMap)) {
      const ukRaw  = soal.unitKompetensi?.toUpperCase() || null;
      const ukKey  = ukRaw || '__tanpa_uk__';
      const ekNama = soal.ekNama || ukRaw || 'Tanpa Unit Kompetensi';
      if (!ukMap[ukKey]) {
        ukMap[ukKey] = {
          ekKey:     ukRaw,
          ekNama,
          bidangIds: soal.bidangId ? [soal.bidangId] : [],
          soalCount: 0,
        };
      }
      ukMap[ukKey].soalCount++;
      // Kumpulkan bidang unik
      if (soal.bidangId && !ukMap[ukKey].bidangIds.includes(soal.bidangId)) {
        ukMap[ukKey].bidangIds.push(soal.bidangId);
      }
    }

    const ukList = Object.values(ukMap).sort((a, b) => {
      if (!a.ekKey) return 1;
      if (!b.ekKey) return -1;
      return a.ekKey.localeCompare(b.ekKey);
    });

    const tanpaUK = ukList.filter(u => !u.ekKey);
    const denganUK = ukList.filter(u => u.ekKey);

    _render(el, denganUK, tanpaUK, allSoalIds.length, exams);
  } catch (err) {
    el.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat: ${err.message}</div>`;
  }
}

function _render(el, denganUK, tanpaUK, totalSoal, exams) {
  const ukRows = denganUK.map((uk, i) => `
    <tr>
      <td class="text-center text-gray-500 w-8">${i + 1}</td>
      <td>
        <span class="font-mono text-sm font-semibold text-[#2dd4bf]">${_esc(uk.ekKey)}</span>
      </td>
      <td>
        <div class="text-sm text-white">${_esc(uk.ekNama !== uk.ekKey ? uk.ekNama : '')}</div>
      </td>
      <td>
        <div class="flex flex-wrap gap-1">
          ${_renderBidangBadges(uk.bidangIds)}
        </div>
      </td>
      <td class="text-center text-sm text-gray-400">${uk.soalCount}</td>
    </tr>`).join('');

  const tanpaUkBlock = tanpaUK.length ? `
    <div class="mt-4 bg-yellow-900/10 border border-yellow-700/30 rounded-xl p-3 flex items-center gap-3">
      <svg class="w-4 h-4 text-yellow-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      <span class="text-xs text-yellow-400">
        <strong>${tanpaUK[0].soalCount} soal</strong> belum diberi tag Unit Kompetensi — tidak akan muncul dalam analisis per-UK.
      </span>
    </div>` : '';

  const examChips = exams.map(e =>
    `<span class="inline-flex items-center px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs text-gray-300">${_esc(e.judul)}</span>`
  ).join(' ');

  el.innerHTML = `
    <div class="space-y-4">
      <!-- Header -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-white mb-1">Unit Kompetensi yang Diukur</h3>
        <p class="text-xs text-gray-500 mb-3">
          Berasal dari tag UK pada soal ujian bimtek ini. Total <strong class="text-gray-300">${totalSoal} soal</strong> dari ${exams.length} ujian:
        </p>
        <div class="flex flex-wrap gap-1.5">${examChips}</div>
      </div>

      ${denganUK.length ? `
        <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-800">
            <span class="text-xs text-gray-400">${denganUK.length} UK teridentifikasi</span>
          </div>
          <table class="btam-table">
            <thead>
              <tr>
                <th class="w-8 text-center">#</th>
                <th class="w-36">Kode UK</th>
                <th>Nama Unit Kompetensi</th>
                <th class="w-40">Bidang</th>
                <th class="w-20 text-center">Soal</th>
              </tr>
            </thead>
            <tbody>${ukRows}</tbody>
          </table>
        </div>` : `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p class="text-gray-500 text-sm">Belum ada soal dengan tag Unit Kompetensi.</p>
          <p class="text-gray-600 text-xs mt-1">Beri tag UK pada soal di Bank Soal agar kompetensi dapat diidentifikasi.</p>
        </div>`}

      ${tanpaUkBlock}
    </div>`;
}

function _renderBidangBadges(bidangIds = []) {
  if (!bidangIds?.length) return `<span class="text-xs text-gray-600 italic">—</span>`;
  return bidangIds.map(id => {
    const b = BIDANG_LIST.find(x => x.bidangId === id);
    if (!b) return `<span class="badge badge-gray text-xs">${id}</span>`;
    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white"
      style="background-color:${b.color}55;border:1px solid ${b.color}80">${b.nama}</span>`;
  }).join('');
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
