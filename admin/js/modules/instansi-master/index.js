// admin/js/modules/instansi-master/index.js

import { setPageTitle } from '../../layout/navbar.js';
import { renderDataTable } from '../../components/data-table.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { requireWrite } from '../../auth-guard.js';
import { listInstansi, countInstansi, createInstansi, updateInstansi, deleteInstansi, exportAllInstansi } from './api.js';
import { slugify } from '../../../../shared/normalize.js';

const KATEGORI_OPTIONS = ['PDAM','PERUMDAM','PERUMDA','PT','UPTD','Dinas PUPR','Pusat','Regional','Lainnya'];
const JENIS_LOKASI_OPTIONS = ['Kabupaten','Kota','Pusat','Regional'];
const PER_PAGE = 25;

let _state = { data: [], total: 0, page: 1, search: '', loading: false, lastDocs: [null] };

export async function renderInstansiList({ query = {} } = {}) {
  setPageTitle('Instansi Master');

  document.getElementById('app').innerHTML = `
    <div class="max-w-full">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-white">Instansi Master</h1>
          <p class="text-xs text-gray-500 mt-0.5">PDAM, PERUMDAM, dan instansi terkait</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-export" class="px-3 py-2 rounded-lg text-xs text-gray-400 border border-gray-700 hover:bg-gray-800 transition-colors">Export</button>
          <button id="btn-add" class="px-3 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Tambah Instansi
          </button>
        </div>
      </div>

      <div class="mb-4">
        <div class="relative max-w-sm">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input id="search-input" type="search" placeholder="Cari nama instansi…" class="form-input pl-9" />
        </div>
      </div>

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
      listInstansi({ search: _state.search, pageSize: PER_PAGE, lastDoc: _state.lastDocs[_state.page - 1] }),
      countInstansi()
    ]);
    _state.data = data; _state.total = total;
    if (lastDoc) _state.lastDocs[_state.page] = lastDoc;
  } catch (err) { showToast('Gagal memuat: ' + err.message, 'error'); }
  _state.loading = false; _renderTable();
}

function _renderTable() {
  renderDataTable(document.getElementById('table-container'), {
    loading: _state.loading, data: _state.data, total: _state.total,
    page: _state.page, perPage: PER_PAGE,
    emptyMessage: 'Belum ada instansi.',
    columns: [
      { key: 'nama',        label: 'Nama Instansi' },
      { key: 'singkatan',   label: 'Singkatan', width: '100px', render: v => v ?? '—' },
      { key: 'kategori',    label: 'Kategori', width: '110px',
        render: v => v ? `<span class="badge badge-blue">${v}</span>` : '—' },
      { key: 'jenisLokasi', label: 'Jenis', width: '100px', render: v => v ?? '—' },
      { key: 'isPnbpClient',label: 'PNBP', width: '60px',
        render: v => v ? `<span class="badge badge-yellow">Ya</span>` : '—' },
    ],
    rowActions: [
      { label: 'Edit', onClick: row => _openForm(row) },
      { label: 'Hapus', onClick: async row => {
        if (!requireWrite()) return;
        const ok = await confirmDialog({ title:'Hapus Instansi', message:`Hapus <strong>${_esc(row.nama)}</strong>?`, confirmLabel:'Hapus', danger:true });
        if (!ok) return;
        try { await deleteInstansi(row._id); showToast('Instansi dihapus.', 'success'); _reload(); }
        catch (err) { showToast('Gagal: ' + err.message, 'error'); }
      }}
    ],
    onPageChange: p => { _state.page = p; _load(); }
  });
}

function _openForm(existing = null) {
  const isEdit = !!existing;
  const { close } = openModal({
    title: isEdit ? `Edit: ${existing.nama}` : 'Tambah Instansi',
    size: 'lg',
    body: `
      <form id="instansi-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Nama Resmi <span class="text-red-400">*</span></label>
            <input name="nama" class="form-input" required value="${_esc(existing?.nama ?? '')}" placeholder="Misal: PERUMDAM Tirta Meulaboh" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">ID Instansi</label>
            <input name="instansiId" class="form-input font-mono text-xs"
                   value="${_esc(existing?.instansiId ?? '')}"
                   placeholder="otomatis dari nama" ${isEdit ? 'readonly class="opacity-60"' : ''} />
            ${!isEdit ? '<p class="text-xs text-gray-600 mt-1">Kosongkan untuk auto-generate dari nama.</p>' : ''}
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Singkatan</label>
            <input name="singkatan" class="form-input" value="${_esc(existing?.singkatan ?? '')}" placeholder="Misal: PDAM" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Kategori</label>
            <select name="kategori" class="form-select">
              <option value="">— Pilih —</option>
              ${KATEGORI_OPTIONS.map(k => `<option value="${k}" ${existing?.kategori===k?'selected':''}>${k}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Jenis Lokasi</label>
            <select name="jenisLokasi" class="form-select">
              <option value="">— Pilih —</option>
              ${JENIS_LOKASI_OPTIONS.map(j => `<option value="${j}" ${existing?.jenisLokasi===j?'selected':''}>${j}</option>`).join('')}
            </select>
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Nama Alias (pisah koma)</label>
            <input name="namaAlias" class="form-input" value="${_esc((existing?.namaAlias ?? []).join(', '))}" placeholder="Nama lama atau variasi penulisan" />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Alamat</label>
            <input name="alamat" class="form-input" value="${_esc(existing?.alamat ?? '')}" />
          </div>
          <div class="col-span-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="isPnbpClient" ${existing?.isPnbpClient ? 'checked' : ''} class="w-4 h-4 rounded" />
              <span class="text-sm text-gray-300">Pernah jadi klien Bimtek PNBP</span>
            </label>
          </div>
        </div>
        <div id="form-error" class="hidden text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2"></div>
      </form>`,
    actions: [
      { label: 'Batal', type: 'secondary', onClick: ({ close }) => close() },
      { label: isEdit ? 'Simpan' : 'Tambah', type: 'primary', onClick: ({ close }) => _submit(close, existing) }
    ]
  });
}

async function _submit(close, existing) {
  const form = document.getElementById('instansi-form');
  const errorEl = document.getElementById('form-error');
  const btn = document.querySelector(`[data-action="${existing ? 'Simpan' : 'Tambah'}"]`);
  errorEl.classList.add('hidden');

  const fd = new FormData(form);
  const data = {
    nama:          fd.get('nama'),
    instansiId:    fd.get('instansiId') || slugify(fd.get('nama') ?? ''),
    singkatan:     fd.get('singkatan') || null,
    kategori:      fd.get('kategori') || null,
    jenisLokasi:   fd.get('jenisLokasi') || null,
    namaAlias:     fd.get('namaAlias'),
    alamat:        fd.get('alamat') || null,
    isPnbpClient:  fd.get('isPnbpClient') === 'on'
  };

  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }
  try {
    if (existing) { await updateInstansi(existing._id, data); showToast('Instansi diperbarui.', 'success'); }
    else { await createInstansi(data); showToast('Instansi ditambahkan.', 'success'); }
    close(); _reload();
  } catch (err) {
    errorEl.textContent = err.message; errorEl.classList.remove('hidden');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = existing ? 'Simpan' : 'Tambah'; }
  }
}

function _bindEvents() {
  let _deb;
  document.getElementById('search-input')?.addEventListener('input', e => {
    clearTimeout(_deb);
    _deb = setTimeout(() => { _state.search = e.target.value.trim(); _state.page = 1; _state.lastDocs = [null]; _load(); }, 350);
  });
  document.getElementById('btn-add')?.addEventListener('click', () => { if (!requireWrite()) return; _openForm(null); });
  document.getElementById('btn-export')?.addEventListener('click', async () => {
    try {
      const data = await exportAllInstansi();
      if (!data.length) { showToast('Tidak ada data.', 'warning'); return; }
      await _loadSheetJS();
      const rows = data.map(i => ({ 'ID': i.instansiId, 'Nama': i.nama, 'Singkatan': i.singkatan??'', 'Kategori': i.kategori??'', 'Jenis': i.jenisLokasi??'', 'PNBP': i.isPnbpClient?'Ya':'Tidak' }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Instansi');
      XLSX.writeFile(wb, `instansi-btam-${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`${data.length} instansi diekspor.`, 'success');
    } catch (err) { showToast('Export gagal: ' + err.message, 'error'); }
  });
}

function _reload() { _state.page = 1; _state.lastDocs = [null]; _load(); }
function _esc(s) { return String(s??'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _loadSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
}
