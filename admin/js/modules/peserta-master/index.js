// admin/js/modules/peserta-master/index.js
// List view peserta master — search, filter, pagination, CRUD actions.

import { setPageTitle } from '../../layout/navbar.js';
import { renderDataTable } from '../../components/data-table.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { requireWrite } from '../../auth-guard.js';
import { listPeserta, countPeserta, deletePeserta, exportAllPeserta } from './api.js';
import { openPesertaForm } from './form.js';
import { openImportPeserta } from './import.js';
import { JENIS_KELAMIN } from '../../../../shared/constants.js';

const PER_PAGE = 25;

let _state = {
  data:     [],
  total:    0,
  page:     1,
  search:   '',
  loading:  false,
  lastDocs: [null], // index = page-1, untuk cursor pagination
};

export async function renderPesertaList({ query = {} } = {}) {
  setPageTitle('Peserta Master');

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="max-w-full">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-white">Peserta Master</h1>
          <p class="text-xs text-gray-500 mt-0.5">Data peserta Bimtek BTAM</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-export" class="px-3 py-2 rounded-lg text-xs text-gray-400
                  border border-gray-700 hover:bg-gray-800 transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export
          </button>
          <button id="btn-import" class="px-3 py-2 rounded-lg text-xs text-gray-400
                  border border-gray-700 hover:bg-gray-800 transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4 4l4-4m0 0l4-4m-4 4V4"/>
            </svg>
            Import
          </button>
          <button id="btn-add" class="px-3 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500
                  text-white transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Tambah Peserta
          </button>
        </div>
      </div>

      <!-- Search bar -->
      <div class="mb-4">
        <div class="relative max-w-sm">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
               fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input id="search-input" type="search" placeholder="Cari nama, no. peserta, instansi…"
            class="form-input pl-9" value="${_esc(_state.search)}" />
        </div>
      </div>

      <!-- Table container -->
      <div id="table-container"></div>
    </div>
  `;

  _bindEvents();
  await _load();
}

async function _load() {
  _state.loading = true;
  _renderTable();

  try {
    const [{ data, lastDoc }, total] = await Promise.all([
      listPeserta({
        search:   _state.search,
        pageSize: PER_PAGE,
        lastDoc:  _state.lastDocs[_state.page - 1] ?? null
      }),
      countPeserta()
    ]);

    _state.data  = data;
    _state.total = total;

    // Store cursor untuk halaman berikutnya
    if (lastDoc) _state.lastDocs[_state.page] = lastDoc;

  } catch (err) {
    showToast('Gagal memuat data: ' + err.message, 'error');
    _state.data = [];
  }

  _state.loading = false;
  _renderTable();
}

function _renderTable() {
  const container = document.getElementById('table-container');
  if (!container) return;

  renderDataTable(container, {
    loading:  _state.loading,
    data:     _state.data,
    total:    _state.total,
    page:     _state.page,
    perPage:  PER_PAGE,
    emptyMessage: _state.search
      ? `Tidak ditemukan peserta dengan kata kunci "${_state.search}".`
      : 'Belum ada peserta. Klik "Tambah Peserta" untuk mulai.',
    columns: [
      { key: 'noPeserta',   label: 'No. Peserta', width: '130px' },
      { key: 'nama',        label: 'Nama' },
      { key: 'jenisKelamin',label: 'JK',   width: '50px',
        render: v => v ? `<span class="badge ${v==='L'?'badge-blue':'badge-purple'}">${JENIS_KELAMIN[v]??v}</span>` : '—' },
      { key: 'pendidikan',  label: 'Pendidikan', width: '90px',
        render: v => v ? `<span class="badge badge-gray">${v}</span>` : '—' },
      { key: 'instansi',    label: 'Instansi' },
      { key: 'provinsi',    label: 'Provinsi',   width: '120px',
        render: v => v ?? '—' },
    ],
    rowActions: [
      { label: 'Edit',   onClick: row => openPesertaForm(row, () => _reload()) },
      {
        label: 'Hapus',
        show: () => true,
        onClick: async row => {
          if (!requireWrite()) return;
          const ok = await confirmDialog({
            title: 'Hapus Peserta',
            message: `Hapus <strong>${_esc(row.nama)}</strong> (${row.noPeserta})? Data tidak bisa dipulihkan melalui UI.`,
            confirmLabel: 'Hapus',
            danger: true
          });
          if (!ok) return;
          try {
            await deletePeserta(row.noPeserta);
            showToast('Peserta dihapus.', 'success');
            _reload();
          } catch (err) {
            showToast('Gagal hapus: ' + err.message, 'error');
          }
        }
      }
    ],
    onPageChange: (p) => { _state.page = p; _load(); }
  });
}

function _bindEvents() {
  // Search
  let _debounce;
  document.getElementById('search-input')?.addEventListener('input', e => {
    clearTimeout(_debounce);
    _debounce = setTimeout(() => {
      _state.search   = e.target.value.trim();
      _state.page     = 1;
      _state.lastDocs = [null];
      _load();
    }, 350);
  });

  // Add
  document.getElementById('btn-add')?.addEventListener('click', () => {
    if (!requireWrite()) return;
    openPesertaForm(null, () => _reload());
  });

  // Import
  document.getElementById('btn-import')?.addEventListener('click', () => {
    if (!requireWrite()) return;
    openImportPeserta(() => _reload());
  });

  // Export
  document.getElementById('btn-export')?.addEventListener('click', _doExport);
}

function _reload() {
  _state.page     = 1;
  _state.lastDocs = [null];
  _load();
}

async function _doExport() {
  try {
    const data = await exportAllPeserta();
    if (data.length === 0) { showToast('Tidak ada data untuk di-export.', 'warning'); return; }

    await _loadSheetJS();

    const rows = data.map(p => ({
      'No Peserta':   p.noPeserta,
      'Nama':         p.nama,
      'JK':           p.jenisKelamin ?? '',
      'Jabatan':      p.jabatan ?? '',
      'Pendidikan':   p.pendidikan ?? '',
      'Email':        p.email ?? '',
      'No HP':        p.noHp ?? '',
      'Instansi':     p.instansi ?? '',
      'Unit Kerja':   p.unitKerja ?? '',
      'Provinsi':     p.provinsi ?? '',
      'Kab/Kota':     p.kabKota ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Peserta');

    const date = new Date().toISOString().split('T')[0].replace(/-/g,'');
    XLSX.writeFile(wb, `peserta-btam-${date}.xlsx`);
    showToast(`${data.length} peserta diekspor.`, 'success');
  } catch (err) {
    showToast('Export gagal: ' + err.message, 'error');
  }
}

function _loadSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function _esc(str) {
  return String(str ?? '').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
