// admin/js/modules/bank-soal/stok.js
// Matriks stok soal per Unit Kompetensi per level Bloom.
// Menjawab: untuk UK ini, level kognitif mana yang sudah bisa diuji?

import { buildStokMatrix } from './api.js';
import { BLOOM_LEVELS } from '../../../../shared/constants.js';

export async function renderStokMatrix(container) {
  container.innerHTML = `<div class="flex justify-center py-10">
    <div class="w-5 h-5 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin"></div>
  </div>`;

  let data;
  try {
    data = await buildStokMatrix();
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red-400 p-4">Gagal memuat: ${_esc(err.message)}</p>`;
    return;
  }

  const LEVELS = BLOOM_LEVELS.map(b => b.level);

  const head = LEVELS.map(l =>
    `<th class="w-12 text-center text-xs font-semibold text-gray-400">${l}</th>`).join('');

  const rows = data.rows.map((r, i) => `
    <tr>
      <td class="text-center text-gray-600 w-8 text-xs">${i + 1}</td>
      <td class="font-mono text-xs text-[#2dd4bf] whitespace-nowrap">${_esc(r.ukKode)}</td>
      <td class="text-xs text-gray-300">${_esc(r.ukNama)}</td>
      ${LEVELS.map(l => `<td class="text-center text-xs ${_selClass(r.lv[l])}">${r.lv[l] || '·'}</td>`).join('')}
      <td class="text-center text-xs text-yellow-500">${r.tanpaLevel || '·'}</td>
      <td class="text-center text-xs text-gray-300 font-medium">${r.total}</td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="space-y-4">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-white mb-1">Stok Soal per Kompetensi &amp; Level Kognitif</h3>
        <p class="text-xs text-gray-500 mb-3">
          Satu sel = satu kombinasi UK &times; level. Sel kosong berarti level itu belum bisa diujikan
          untuk UK tersebut, jadi target SKL di level itu tidak akan pernah terbukti.
        </p>
        <div class="flex flex-wrap gap-4 text-xs">
          <span class="text-gray-400">Total soal aktif ber-UK: <strong class="text-gray-200">${data.totalSoal}</strong></span>
          <span class="text-gray-600">Sel kosong: <strong>${data.selKosong}</strong></span>
          <span class="text-yellow-400">Sel tipis (1 soal): <strong>${data.selTipis}</strong></span>
          <span class="text-teal-400">Sel siap (&ge;2 soal): <strong>${data.selSiap}</strong></span>
        </div>
      </div>

      <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table class="btam-table min-w-[760px]">
          <thead>
            <tr>
              <th class="w-8"></th>
              <th class="w-40">Kode UK</th>
              <th>Nama Unit Kompetensi</th>
              ${head}
              <th class="w-12 text-center text-xs" title="Soal yang belum punya level Bloom">?</th>
              <th class="w-12 text-center text-xs">Tot</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="${LEVELS.length + 5}" class="text-center py-10 text-gray-500 text-xs">Belum ada soal ber-UK</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

// Sel dibedakan karena konsekuensinya berbeda: 0 tidak bisa diuji sama
// sekali, 1 bisa diuji tapi kesimpulannya bersandar pada satu jawaban.
function _selClass(n) {
  if (n === 0) return 'text-gray-700';
  if (n === 1) return 'text-yellow-400';
  return 'text-teal-400';
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
