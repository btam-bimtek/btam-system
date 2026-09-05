// admin/js/modules/bimtek/form-skl.js
// Tab Standar Kompetensi Lulusan pada form bimtek.
// Satu baris per UK: sampai level kognitif mana lulusan harus menguasainya.
//
// Tab ini juga menjadi satu-satunya tempat UK bimtek ditentukan — bimtek.ukIds
// diturunkan dari baris di sini saat submit, bukan dikumpulkan terpisah.

import { buildStokMatrix } from '../bank-soal/api.js';
import { listUKAktif } from '../master-uk/api.js';
import { BLOOM_LEVELS } from '../../../../shared/constants.js';

const TARGET_DEFAULT = 'C3';
const AMBANG_DEFAULT = 70;
const JUMLAH_DEFAULT = 8;

/**
 * @param {HTMLElement} el        - panel #tab-skl
 * @param {object[]}    sklAwal   - bimtek.skl yang sudah tersimpan
 * @param {string[]}    bidangIds - bidang bimtek, membatasi pilihan UK
 */
export async function renderTabSKL(el, sklAwal = [], bidangIds = []) {
  el.innerHTML = `<div class="flex justify-center py-8">
    <div class="w-5 h-5 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin"></div>
  </div>`;

  try {
  const [ukAktif, stok] = await Promise.all([
    listUKAktif({ bidangIds }),
    buildStokMatrix(),
  ]);
  const stokMap = Object.fromEntries(stok.rows.map(r => [r.ukKode.toUpperCase(), r]));

  const baris = (sklAwal ?? []).map(s => ({
    ukId:        s.ukId,
    ukKode:      s.ukKode,
    ukNama:      s.ukNama,
    targetBloom: s.targetBloom ?? TARGET_DEFAULT,
    ambang:      s.ambang      ?? AMBANG_DEFAULT,
    jumlahSoal:  s.jumlahSoal  ?? JUMLAH_DEFAULT,
  }));

  el.innerHTML = `
    <div class="space-y-4">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-white mb-1">Standar Kompetensi Lulusan</h3>
        <p class="text-xs text-gray-500 mb-3">
          Tetapkan unit kompetensi yang dicakup bimtek ini, lalu untuk tiap UK: sampai level
          kognitif mana lulusan harus menguasainya, persentase benar minimal di tiap level,
          dan berapa butir soal yang diujikan.
          Kolom Stok menunjukkan apakah bank soal sanggup membuktikan target itu.
        </p>
        <div class="flex items-center gap-2">
          <select id="skl-pilih-uk" class="form-select text-xs flex-1">
            <option value="">— pilih unit kompetensi untuk ditambahkan —</option>
            ${ukAktif.map(u => `
              <option value="${_esc(u.id)}"
                      data-kode="${_esc(u.kode ?? u.id.toUpperCase())}"
                      data-nama="${_esc(u.nama)}">${_esc(u.kode ?? u.id.toUpperCase())} — ${_esc(u.nama)}</option>`).join('')}
          </select>
          <button type="button" id="skl-tambah"
            class="shrink-0 px-3 py-2 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
            Tambah
          </button>
        </div>
      </div>

      <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table class="btam-table min-w-[780px]">
          <thead>
            <tr>
              <th>Unit Kompetensi</th>
              <th class="w-40">Target</th>
              <th class="w-24">Ambang %</th>
              <th class="w-24">Jml Soal</th>
              <th class="w-56">Stok bank soal</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody id="skl-tbody">
            ${baris.map(b => _baris(b, stokMap[b.ukKode.toUpperCase()])).join('') || _barisKosong()}
          </tbody>
        </table>
      </div>
    </div>`;

  const tbody = el.querySelector('#skl-tbody');

  el.querySelector('#skl-tambah').addEventListener('click', () => {
    const sel = el.querySelector('#skl-pilih-uk');
    const opt = sel.selectedOptions[0];
    if (!sel.value) return;

    if (tbody.querySelector(`tr[data-uk-id="${CSS.escape(sel.value)}"]`)) {
      sel.value = '';
      return; // sudah ada, jangan digandakan
    }

    const b = {
      ukId:        sel.value,
      ukKode:      opt.dataset.kode,
      ukNama:      opt.dataset.nama,
      targetBloom: TARGET_DEFAULT,
      ambang:      AMBANG_DEFAULT,
      jumlahSoal:  JUMLAH_DEFAULT,
    };
    tbody.querySelector('[data-kosong]')?.closest('tr')?.remove();
    tbody.insertAdjacentHTML('beforeend', _baris(b, stokMap[b.ukKode.toUpperCase()]));
    sel.value = '';
  });

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-skl-hapus]');
    if (!btn) return;
    btn.closest('tr').remove();
    if (!tbody.querySelector('tr[data-uk-id]')) tbody.innerHTML = _barisKosong();
  });

  // Kolom stok dihitung ulang tiap target berubah — target C4 pada UK yang
  // sel C4-nya kosong tidak akan pernah bisa dibuktikan, dan admin perlu
  // tahu itu sebelum menyimpan, bukan setelah ujian berlangsung.
  tbody.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-skl-target]');
    if (!sel) return;
    const tr   = sel.closest('tr');
    const kode = tr.dataset.ukKode.toUpperCase();
    tr.querySelector('[data-skl-stok]').innerHTML = _stokTeks(sel.value, stokMap[kode]);
  });

  el.dataset.siap = '1';
  } catch (err) {
    el.innerHTML = `<div class="bg-red-900/20 border border-red-700/30 rounded-xl p-4 text-sm text-red-400">
      Gagal memuat data SKL: ${err.message}. Silakan coba buka tab ini lagi.
    </div>`;
  }
}

function _barisKosong() {
  return `<tr><td colspan="6" data-kosong class="text-center py-8 text-gray-500 text-xs">
    Belum ada unit kompetensi. Pilih dari daftar di atas lalu tekan Tambah.
  </td></tr>`;
}

/**
 * Baca isi tab SKL menjadi array siap simpan.
 * Hanya baris ber-`data-uk-id` yang dibaca, sehingga baris placeholder
 * "belum ada unit kompetensi" tidak ikut terbaca sebagai data.
 */
export function bacaSKL(el) {
  return [...el.querySelectorAll('#skl-tbody tr[data-uk-id]')].map(tr => ({
    ukId:        tr.dataset.ukId,
    ukKode:      tr.dataset.ukKode,
    ukNama:      tr.dataset.ukNama,
    targetBloom: tr.querySelector('[data-skl-target]').value,
    ambang:      Number(tr.querySelector('[data-skl-ambang]').value) || AMBANG_DEFAULT,
    jumlahSoal:  Number(tr.querySelector('[data-skl-jumlah]').value) || JUMLAH_DEFAULT,
  }));
}

function _baris(b, stokRow) {
  return `
    <tr data-uk-id="${_esc(b.ukId)}" data-uk-kode="${_esc(b.ukKode)}" data-uk-nama="${_esc(b.ukNama)}">
      <td>
        <div class="font-mono text-xs text-[#2dd4bf]">${_esc(b.ukKode)}</div>
        <div class="text-xs text-gray-400">${_esc(b.ukNama)}</div>
      </td>
      <td>
        <select data-skl-target class="form-select text-xs w-full">
          ${BLOOM_LEVELS.map(l =>
            `<option value="${l.level}" ${l.level === b.targetBloom ? 'selected' : ''}>${l.level} — ${l.nama}</option>`
          ).join('')}
        </select>
      </td>
      <td><input data-skl-ambang type="number" min="1" max="100" value="${b.ambang}" class="form-input text-xs w-full"></td>
      <td><input data-skl-jumlah type="number" min="1" max="50" value="${b.jumlahSoal}" class="form-input text-xs w-full"></td>
      <td data-skl-stok class="text-xs">${_stokTeks(b.targetBloom, stokRow)}</td>
      <td class="text-center">
        <button type="button" data-skl-hapus title="Hapus UK ini"
          class="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </td>
    </tr>`;
}

function _stokTeks(target, stokRow) {
  const targetIdx = BLOOM_LEVELS.findIndex(l => l.level === target);
  const levels    = BLOOM_LEVELS.slice(0, targetIdx + 1).map(l => l.level);
  if (!stokRow) return `<span class="text-red-400">✗ belum ada soal untuk UK ini</span>`;

  const kosong = levels.filter(l => (stokRow.lv[l] ?? 0) === 0);
  const tipis  = levels.filter(l => (stokRow.lv[l] ?? 0) === 1);

  if (kosong.length) return `<span class="text-red-400">✗ tidak ada soal ${kosong.join(', ')}</span>`;
  if (tipis.length)  return `<span class="text-yellow-400">⚠ hanya 1 butir di ${tipis.join(', ')}</span>`;
  return `<span class="text-teal-400">✓ memadai</span>`;
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
