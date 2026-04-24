// admin/js/modules/bank-soal/index.js
// List view bank soal dengan filter bidang + bloom level.

import { setPageTitle } from '../../layout/navbar.js';
import { renderDataTable } from '../../components/data-table.js';
import { confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { requireWrite } from '../../auth-guard.js';
import { listSoal, countSoal, deleteSoal, toggleSoalActive, exportSoalWithAnswers } from './api.js';
import { openSoalForm } from './form.js';
import { openImportSoal } from './import.js';
import { BIDANG_LIST, BLOOM_LEVELS } from '../../../../shared/constants.js';

const PER_PAGE = 25;

let _state = {
  data: [], total: 0, page: 1, search: '',
  bidangId: '', bloomLevel: '', activeOnly: true,
  loading: false, lastDocs: [null]
};

export async function renderBankSoalList({ query = {} } = {}) {
  setPageTitle('Bank Soal');

  document.getElementById('app').innerHTML = `
    <div class="max-w-full">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-white">Bank Soal</h1>
          <p class="text-xs text-gray-500 mt-0.5">Kumpulan soal untuk pre-test dan post-test Bimtek</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-export" class="px-3 py-2 rounded-lg text-xs text-gray-400 border border-gray-700 hover:bg-gray-800 transition-colors">
            Export + Kunci
          </button>
          <button id="btn-import" class="px-3 py-2 rounded-lg text-xs text-gray-400 border border-gray-700 hover:bg-gray-800 transition-colors">
            Import Excel
          </button>
          <button id="btn-add" class="px-3 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Tambah Soal
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <!-- Search -->
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
               fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input id="search-input" type="search" placeholder="Cari pertanyaan, EK, tag…"
                 class="form-input pl-9 w-64" value="${_esc(_state.search)}" />
        </div>

        <!-- Filter bidang -->
        <select id="filter-bidang" class="form-select w-40">
          <option value="">Semua Bidang</option>
          ${BIDANG_LIST.filter(b => b.active)
            .map(b => `<option value="${b.bidangId}" ${_state.bidangId === b.bidangId ? 'selected' : ''}>${b.nama}</option>`)
            .join('')}
        </select>

        <!-- Filter bloom -->
        <select id="filter-bloom" class="form-select w-44">
          <option value="">Semua Bloom Level</option>
          ${BLOOM_LEVELS.map(b =>
            `<option value="${b.level}" ${_state.bloomLevel === b.level ? 'selected' : ''}>${b.level} — ${b.nama}</option>`)
            .join('')}
        </select>

        <!-- Toggle aktif/semua -->
        <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
          <input type="checkbox" id="filter-active" ${_state.activeOnly ? 'checked' : ''} class="w-4 h-4 rounded" />
          Sembunyikan nonaktif
        </label>

        <!-- Stats -->
        <span id="total-badge" class="ml-auto text-xs text-gray-500"></span>
      </div>

      <!-- Table -->
      <div id="table-container"></div>
    </div>
  `;

  _bindEvents();
  await _load();
}

async function _load() {
  _state.loading = true; _renderTable();

  try {
    const [{ data, lastDoc }, total] = await Promise.all([
      listSoal({
        search:     _state.search,
        bidangId:   _state.bidangId,
        bloomLevel: _state.bloomLevel,
        activeOnly: _state.activeOnly,
        pageSize:   PER_PAGE,
        lastDoc:    _state.lastDocs[_state.page - 1]
      }),
      countSoal({ bidangId: _state.bidangId, activeOnly: _state.activeOnly })
    ]);
    _state.data = data; _state.total = total;
    if (lastDoc) _state.lastDocs[_state.page] = lastDoc;
    const badge = document.getElementById('total-badge');
    if (badge) badge.textContent = `${total} soal`;
  } catch (err) { showToast('Gagal memuat: ' + err.message, 'error'); }

  _state.loading = false; _renderTable();
}

function _renderTable() {
  renderDataTable(document.getElementById('table-container'), {
    loading: _state.loading, data: _state.data, total: _state.total,
    page: _state.page, perPage: PER_PAGE,
    emptyMessage: 'Belum ada soal. Klik "Tambah Soal" atau import dari Excel.',
    columns: [
      { key: 'pertanyaan', label: 'Pertanyaan',
        render: (v, row) => `
          <div class="max-w-lg">
            <p class="text-sm text-gray-200 truncate">${_esc(v)}</p>
            <div class="flex items-center gap-1.5 mt-1">
              ${_bidangBadge(row.bidangId)}
              <span class="badge badge-gray">${row.bloomLevel}</span>
              ${row.elemenKompetensi ? `<span class="badge badge-gray font-mono">${_esc(row.elemenKompetensi)}</span>` : ''}
            </div>
          </div>` },
      { key: 'opsi',  label: 'Opsi', width: '60px',
        render: v => `<span class="text-gray-400">${(v ?? []).length}</span>` },
      { key: 'bobot', label: 'Bobot', width: '60px',
        render: v => `<span class="font-mono text-sm text-gray-300">${v ?? '—'}</span>` },
      { key: 'usedCount', label: 'Dipakai', width: '70px',
        render: v => `<span class="text-gray-400">${v ?? 0}×</span>` },
      { key: 'correctRate', label: 'Benar %', width: '70px',
        render: v => v != null
          ? `<span class="${v >= 60 ? 'text-green-400' : 'text-yellow-400'}">${Math.round(v)}%</span>`
          : '—' },
      { key: 'active', label: 'Status', width: '70px',
        render: v => v
          ? `<span class="badge badge-green">Aktif</span>`
          : `<span class="badge badge-gray">Nonaktif</span>` }
    ],
    rowActions: [
      { label: 'Edit', onClick: row => { if (!requireWrite()) return; openSoalForm(row.soalId, _reload); } },
      { label: 'Nonaktifkan', show: row => row.active,
        onClick: async row => {
          if (!requireWrite()) return;
          try {
            await toggleSoalActive(row.soalId, false);
            showToast('Soal dinonaktifkan. Centang "Sembunyikan nonaktif" untuk lihat semua soal.', 'success', 5000);
            _reload();
          }
          catch (err) { showToast(err.message, 'error'); }
        }},
      { label: 'Aktifkan', show: row => !row.active,
        onClick: async row => {
          if (!requireWrite()) return;
          try { await toggleSoalActive(row.soalId, true); showToast('Soal diaktifkan.', 'success'); _reload(); }
          catch (err) { showToast(err.message, 'error'); }
        }},
      { label: 'Hapus',
        onClick: async row => {
          if (!requireWrite()) return;
          const ok = await confirmDialog({
            title: 'Hapus Soal',
            message: `Hapus soal ini? Soal yang sudah pernah dipakai di exam tidak akan terhapus dari histori.`,
            confirmLabel: 'Hapus', danger: true
          });
          if (!ok) return;
          try { await deleteSoal(row.soalId); showToast('Soal dihapus.', 'success'); _reload(); }
          catch (err) { showToast(err.message, 'error'); }
        }}
    ],
    onPageChange: p => { _state.page = p; _load(); }
  });
}

function _bidangBadge(bidangId) {
  const b = BIDANG_LIST.find(x => x.bidangId === bidangId);
  if (!b) return '';
  const colors = { produksi:'badge-blue', trandis:'badge-green', me:'badge-yellow', pendukung:'badge-purple' };
  return `<span class="badge ${colors[bidangId] ?? 'badge-gray'}">${b.nama}</span>`;
}

function _bindEvents() {
  let _deb;
  document.getElementById('search-input')?.addEventListener('input', e => {
    clearTimeout(_deb);
    _deb = setTimeout(() => { _state.search = e.target.value.trim(); _reload(); }, 350);
  });

  document.getElementById('filter-bidang')?.addEventListener('change', e => {
    _state.bidangId = e.target.value; _reload();
  });

  document.getElementById('filter-bloom')?.addEventListener('change', e => {
    _state.bloomLevel = e.target.value; _reload();
  });

  document.getElementById('filter-active')?.addEventListener('change', e => {
    // Checkbox "Sembunyikan nonaktif": checked = activeOnly true, unchecked = tampil semua
    _state.activeOnly = e.target.checked; _reload();
  });

  document.getElementById('btn-add')?.addEventListener('click', () => {
    if (!requireWrite()) return; openSoalForm(null, _reload);
  });

  document.getElementById('btn-import')?.addEventListener('click', () => {
    if (!requireWrite()) return; openImportSoal(_reload);
  });

  document.getElementById('btn-export')?.addEventListener('click', async () => {
    try {
      const btn = document.getElementById('btn-export');
      if (btn) { btn.disabled = true; btn.textContent = 'Menyiapkan…'; }

      const data = await exportSoalWithAnswers(_state.bidangId);
      if (!data.length) { showToast('Tidak ada data untuk diekspor.', 'warning'); return; }
      await _loadSheetJS();

      const rows = data.map(s => ({
        'Soal ID':       s.soalId,
        'Pertanyaan':    s.pertanyaan,
        'Bidang':        s.bidangId,
        'Bloom':         s.bloomLevel,
        'EK':            s.elemenKompetensi ?? '',
        'Bobot':         s.bobot ?? '',
        'Opsi A':        s.opsi?.[0]?.text ?? '',
        'Opsi B':        s.opsi?.[1]?.text ?? '',
        'Opsi C':        s.opsi?.[2]?.text ?? '',
        'Opsi D':        s.opsi?.[3]?.text ?? '',
        'Opsi E':        s.opsi?.[4]?.text ?? '',
        'Opsi F':        s.opsi?.[5]?.text ?? '',
        'Kunci':         s.kunci ?? '',
        'Pembahasan':    s.pembahasan ?? '',
        'Tags':          (s.tags ?? []).join(', '),
        'Dipakai':       s.usedCount ?? 0,
        'Benar %':       s.correctRate != null ? Math.round(s.correctRate) : '',
        'Aktif':         s.active ? 'Ya' : 'Tidak'
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bank Soal');
      const filename = `bank-soal-btam${_state.bidangId ? '-' + _state.bidangId : ''}-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast(`${data.length} soal diekspor (termasuk kunci jawaban).`, 'success');
    } catch (err) {
      // Tangkap error index Firestore dan tampilkan pesan yang actionable
      if (err.message?.includes('index')) {
        showToast('Export gagal: index Firestore belum siap. Tunggu beberapa menit lalu coba lagi.', 'error', 7000);
      } else {
        showToast('Export gagal: ' + err.message, 'error');
      }
    } finally {
      const btn = document.getElementById('btn-export');
      if (btn) { btn.disabled = false; btn.textContent = 'Export + Kunci'; }
    }
  });
}

function _reload() { _state.page = 1; _state.lastDocs = [null]; _load(); }
function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _loadSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}
