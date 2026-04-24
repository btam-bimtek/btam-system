// admin/js/modules/pengajar-master/index.js
// List + form pengajar master.

import { setPageTitle } from '../../layout/navbar.js';
import { renderDataTable } from '../../components/data-table.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { requireWrite } from '../../auth-guard.js';
import { listPengajar, countPengajar, createPengajar, updatePengajar, deletePengajar, exportAllPengajar, hitungSkorPengajar } from './api.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';

const PER_PAGE = 25;

let _state = { data: [], total: 0, page: 1, search: '', loading: false, lastDocs: [null] };

export async function renderPengajarList({ query = {} } = {}) {
  setPageTitle('Pengajar Master');

  document.getElementById('app').innerHTML = `
    <div class="max-w-full">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-white">Pengajar Master</h1>
          <p class="text-xs text-gray-500 mt-0.5">Data pengajar & fasilitator Bimtek</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-export" class="px-3 py-2 rounded-lg text-xs text-gray-400 border border-gray-700 hover:bg-gray-800 transition-colors">Export</button>
          <button id="btn-add" class="px-3 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Tambah Pengajar
          </button>
        </div>
      </div>

      <div class="mb-4">
        <div class="relative max-w-sm">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
               fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input id="search-input" type="search" placeholder="Cari nama atau keahlian…" class="form-input pl-9" />
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
      listPengajar({ search: _state.search, pageSize: PER_PAGE, lastDoc: _state.lastDocs[_state.page - 1] }),
      countPengajar()
    ]);
    _state.data = data; _state.total = total;
    if (lastDoc) _state.lastDocs[_state.page] = lastDoc;
  } catch (err) { showToast('Gagal memuat: ' + err.message, 'error'); _state.data = []; }
  _state.loading = false; _renderTable();
}

function _renderTable() {
  renderDataTable(document.getElementById('table-container'), {
    loading: _state.loading, data: _state.data, total: _state.total,
    page: _state.page, perPage: PER_PAGE,
    emptyMessage: 'Belum ada pengajar.',
    columns: [
      { key: 'nama',           label: 'Nama' },
      { key: 'noHp',           label: 'No. HP', width: '130px' },
      { key: 'bidangUtama',    label: 'Bidang', width: '140px',
        render: v => (v ?? []).map(b => {
          const bd = BIDANG_LIST.find(x => x.bidangId === b);
          if (!bd) return '<span class="badge badge-gray">' + b + '</span>';
          const bg  = bd.color + '55';
          const bdr = bd.color + '80';
          return '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white" ' +
            'style="background-color:' + bg + ';border:1px solid ' + bdr + '">' + bd.nama + '</span>';
        }).join(' ') || '—' },
      { key: 'keahlian',       label: 'Keahlian', width: '180px',
        render: v => (v ?? []).slice(0,3).map(k => `<span class="badge badge-gray">${k}</span>`).join(' ') },
      { key: 'pedagogiScore',  label: 'Pedagogi', width: '80px',
        render: v => `<span class="font-mono text-sm">${v ?? 0}</span>` },
      { key: 'experienceYears',label: 'Exp', width: '60px',
        render: v => `${v ?? 0}th` },
      { key: 'available',      label: 'Status', width: '80px',
        render: v => v
          ? `<span class="badge badge-green">Aktif</span>`
          : `<span class="badge badge-gray">Tidak tersedia</span>` },
    ],
    rowActions: [
      { label: 'Edit',   onClick: row => _openForm(row) },
      { label: 'Hapus',  onClick: async row => {
        if (!requireWrite()) return;
        const ok = await confirmDialog({ title: 'Hapus Pengajar', message: `Hapus <strong>${row.nama}</strong>?`, confirmLabel: 'Hapus', danger: true });
        if (!ok) return;
        try { await deletePengajar(row._id); showToast('Pengajar dihapus.', 'success'); _reload(); }
        catch (err) { showToast('Gagal: ' + err.message, 'error'); }
      }}
    ],
    onPageChange: p => { _state.page = p; _load(); }
  });
}

function _openForm(existing = null) {
  const isEdit = !!existing;

  const bidangCheckboxes = BIDANG_LIST.map(b => `
    <label class="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" name="bidangUtama" value="${b.bidangId}"
             ${existing?.bidangUtama?.includes(b.bidangId) ? 'checked' : ''}
             class="w-4 h-4 rounded" />
      <span class="text-sm text-gray-300">${b.nama}</span>
    </label>`).join('');

  // Scoring preview (computed on the fly)
  const skorPreview = existing
    ? `<div class="bg-gray-800 rounded-lg p-3 mt-2">
        <p class="text-xs text-gray-400 mb-1">Skor matching (estimasi, tanpa filter keahlian):</p>
        <p class="text-2xl font-bold text-blue-400" id="skor-preview">${hitungSkorPengajar(existing)}</p>
       </div>` : '';

  const { close } = openModal({
    title: isEdit ? `Edit: ${existing.nama}` : 'Tambah Pengajar',
    size: 'lg',
    body: `
      <form id="pengajar-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Nama <span class="text-red-400">*</span></label>
            <input name="nama" class="form-input" value="${_esc(existing?.nama ?? '')}" required />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">No. HP / WA <span class="text-red-400">*</span></label>
            <input name="noHp" class="form-input" value="${_esc(existing?.noHp ?? '')}" placeholder="08xx" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
            <input name="email" type="email" class="form-input" value="${_esc(existing?.email ?? '')}" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Skor Pedagogi (0-100)</label>
            <input name="pedagogiScore" type="number" min="0" max="100" class="form-input"
                   value="${existing?.pedagogiScore ?? 0}" id="input-pedagogi" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Tahun Pengalaman</label>
            <input name="experienceYears" type="number" min="0" class="form-input"
                   value="${existing?.experienceYears ?? 0}" id="input-exp" />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-400 mb-2">Bidang Utama</label>
            <div class="flex flex-wrap gap-3">${bidangCheckboxes}</div>
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Keahlian (pisah koma)</label>
            <input name="keahlian" class="form-input"
                   value="${_esc((existing?.keahlian ?? []).join(', '))}"
                   placeholder="Misal: SPAM, perpipaan, pompa" />
          </div>
          <div class="col-span-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="available" ${existing?.available !== false ? 'checked' : ''} class="w-4 h-4 rounded" />
              <span class="text-sm text-gray-300">Tersedia untuk penugasan</span>
            </label>
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Catatan Khusus</label>
            <textarea name="catatanKhusus" class="form-textarea h-20">${_esc(existing?.catatanKhusus ?? '')}</textarea>
          </div>
        </div>
        ${skorPreview}
        <div id="form-error" class="hidden text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2"></div>
      </form>`,
    actions: [
      { label: 'Batal', type: 'secondary', onClick: ({ close }) => close() },
      { label: isEdit ? 'Simpan' : 'Tambah', type: 'primary', onClick: ({ close }) => _submitPengajar(close, existing) }
    ]
  });

  // Live skor preview update
  ['input-pedagogi','input-exp'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _updateSkorPreview);
  });
}

function _updateSkorPreview() {
  const form = document.getElementById('pengajar-form');
  if (!form) return;
  const fd = new FormData(form);
  const dummy = {
    pedagogiScore:   Number(fd.get('pedagogiScore') ?? 0),
    experienceYears: Number(fd.get('experienceYears') ?? 0),
    keahlian:        [],
    bidangUtama:     fd.getAll('bidangUtama')
  };
  const skor = hitungSkorPengajar(dummy);
  const el = document.getElementById('skor-preview');
  if (el) el.textContent = skor;
}

async function _submitPengajar(close, existing) {
  const form    = document.getElementById('pengajar-form');
  const errorEl = document.getElementById('form-error');
  const btn     = document.querySelector(`[data-action="${existing ? 'Simpan' : 'Tambah'}"]`);

  errorEl.classList.add('hidden');
  const fd = new FormData(form);
  const data = {
    nama:            fd.get('nama'),
    noHp:            fd.get('noHp'),
    email:           fd.get('email'),
    pedagogiScore:   Number(fd.get('pedagogiScore') ?? 0),
    experienceYears: Number(fd.get('experienceYears') ?? 0),
    bidangUtama:     fd.getAll('bidangUtama'),
    keahlian:        fd.get('keahlian'),
    available:       fd.get('available') === 'on',
    catatanKhusus:   fd.get('catatanKhusus')
  };

  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }
  try {
    if (existing) { await updatePengajar(existing._id, data); showToast('Pengajar diperbarui.', 'success'); }
    else { await createPengajar(data); showToast('Pengajar ditambahkan.', 'success'); }
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
    _deb = setTimeout(() => {
      _state.search = e.target.value.trim(); _state.page = 1; _state.lastDocs = [null]; _load();
    }, 350);
  });
  document.getElementById('btn-add')?.addEventListener('click', () => {
    if (!requireWrite()) return; _openForm(null);
  });
  document.getElementById('btn-export')?.addEventListener('click', async () => {
    try {
      const data = await exportAllPengajar();
      if (!data.length) { showToast('Tidak ada data.', 'warning'); return; }
      await _loadSheetJS();
      const rows = data.map(p => ({
        'Nama': p.nama, 'No HP': p.noHp, 'Email': p.email ?? '',
        'Bidang Utama': (p.bidangUtama ?? []).join(', '),
        'Keahlian': (p.keahlian ?? []).join(', '),
        'Skor Pedagogi': p.pedagogiScore, 'Pengalaman (th)': p.experienceYears,
        'Tersedia': p.available ? 'Ya' : 'Tidak'
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pengajar');
      XLSX.writeFile(wb, `pengajar-btam-${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`${data.length} pengajar diekspor.`, 'success');
    } catch (err) { showToast('Export gagal: ' + err.message, 'error'); }
  });
}

function _reload() { _state.page = 1; _state.lastDocs = [null]; _load(); }
function _esc(s) { return String(s ?? '').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _loadSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}
