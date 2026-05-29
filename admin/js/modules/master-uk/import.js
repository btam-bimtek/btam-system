// admin/js/modules/master-uk/import.js
// Import Unit Kompetensi dari Excel.
// Format: Kode | Nama | Deskripsi | Bidang | Status

import { openModal } from '../../components/modal.js';
import { showToast }  from '../../components/toast.js';
import { bulkImportUK } from './api.js';
import { BIDANG_LIST }  from '../../../../shared/constants.js';

const BIDANG_ALIAS = {};
BIDANG_LIST.forEach(b => {
  BIDANG_ALIAS[b.bidangId.toLowerCase()] = b.bidangId;
  BIDANG_ALIAS[b.nama.toLowerCase()]     = b.bidangId;
});

const COLUMN_MAP = {
  'kode': 'kode', 'kode ek': 'kode', 'ek': 'kode', 'id': 'kode',
  'nama': 'nama', 'nama ek': 'nama', 'name': 'nama',
  'deskripsi': 'deskripsi', 'description': 'deskripsi', 'keterangan': 'deskripsi',
  'bidang': 'bidang', 'bidang relevan': 'bidang', 'bidangids': 'bidang',
  'status': 'status',
};

export function openImportUK(onDone) {
  let _parsedRows = [];

  const { close } = openModal({
    title: 'Import Unit Kompetensi dari Excel',
    size:  'lg',
    body: `
      <div class="space-y-5">
        <div class="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4">
          <p class="text-sm font-medium text-blue-300 mb-1">Format kolom Excel:</p>
          <p class="text-xs text-blue-400/80 font-mono">Kode | Nama | Deskripsi | Bidang | Status</p>
          <p class="text-xs text-blue-400/60 mt-2">
            <strong>Kode:</strong> unik, misal UK-001<br/>
            <strong>Bidang:</strong> produksi / trandis / me / pendukung, pisahkan dengan koma jika lebih dari satu. Kosongkan = semua bidang.<br/>
            <strong>Status:</strong> aktif (default) atau nonaktif<br/>
            Baris yang sudah ada akan di-update.
          </p>
          <button id="btn-dl-template" class="mt-3 text-xs text-blue-400 hover:text-blue-300 underline">
            Download template Excel
          </button>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">Pilih file Excel (.xlsx / .xls)</label>
          <input type="file" id="ek-file-input" accept=".xlsx,.xls"
                 class="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg
                        file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white
                        hover:file:bg-blue-500 cursor-pointer" />
        </div>

        <div id="ek-preview" class="hidden"></div>
        <div id="ek-import-error" class="hidden text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2"></div>
      </div>`,
    actions: [
      { label: 'Batal',   type: 'secondary', onClick: ({ close }) => close() },
      { label: 'Import',  type: 'primary',   onClick: ({ close }) => _doImport(close, onDone) },
    ],
  });

  document.getElementById('ek-file-input')?.addEventListener('change', e => _parseFile(e.target.files[0]));
  document.getElementById('btn-dl-template')?.addEventListener('click', _downloadTemplate);
}

async function _parseFile(file) {
  if (!file) return;
  const preview  = document.getElementById('ek-preview');
  const errorEl  = document.getElementById('ek-import-error');
  errorEl.classList.add('hidden');

  try {
    await _loadSheetJS();
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (raw.length < 2) throw new Error('File tidak memiliki data (minimal 2 baris: header + 1 data).');

    const headers = raw[0].map(h => String(h).trim().toLowerCase());
    const rows    = [];

    for (let i = 1; i < raw.length; i++) {
      const row = raw[i];
      if (row.every(v => v === '' || v == null)) continue;

      const mapped = {};
      headers.forEach((h, idx) => {
        const field = COLUMN_MAP[h];
        if (field) mapped[field] = String(row[idx] ?? '').trim();
      });

      // Normalize bidang
      const bidangRaw = mapped.bidang ?? '';
      mapped.bidangIds = bidangRaw
        ? bidangRaw.split(',').map(s => BIDANG_ALIAS[s.trim().toLowerCase()]).filter(Boolean)
        : [];
      delete mapped.bidang;

      rows.push(mapped);
    }

    // Store parsed
    window._ekImportRows = rows;

    // Preview
    const previewRows = rows.slice(0, 5).map(r => `
      <tr>
        <td class="font-mono text-blue-400">${_esc(r.kode)}</td>
        <td>${_esc(r.nama)}</td>
        <td>${r.bidangIds?.length ? r.bidangIds.join(', ') : '<span class="text-gray-600 italic">semua</span>'}</td>
        <td>${r.status || 'aktif'}</td>
      </tr>`).join('');

    preview.innerHTML = `
      <div class="bg-gray-800/50 rounded-lg overflow-hidden">
        <p class="text-xs text-gray-400 px-3 py-2 border-b border-gray-700">${rows.length} baris siap diimport. Preview 5 pertama:</p>
        <table class="btam-table text-xs">
          <thead><tr><th>Kode</th><th>Nama</th><th>Bidang</th><th>Status</th></tr></thead>
          <tbody>${previewRows}</tbody>
        </table>
        ${rows.length > 5 ? `<p class="text-xs text-gray-600 px-3 py-2">...dan ${rows.length - 5} baris lainnya</p>` : ''}
      </div>`;
    preview.classList.remove('hidden');
  } catch (err) {
    document.getElementById('ek-import-error').textContent = 'Gagal membaca file: ' + err.message;
    document.getElementById('ek-import-error').classList.remove('hidden');
    window._ekImportRows = [];
  }
}

async function _doImport(close, onDone) {
  const rows = window._ekImportRows;
  if (!rows?.length) {
    showToast('Pilih file Excel terlebih dahulu.', 'warning'); return;
  }

  const btn = document.querySelector('[data-action="Import"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Mengimport…'; }

  try {
    const result = await bulkImportUK(rows);

    if (result.errors.length) {
      const errEl = document.getElementById('ek-import-error');
      errEl.innerHTML = `${result.errors.length} error:<br>${result.errors.slice(0, 5).join('<br>')}`;
      errEl.classList.remove('hidden');
    }

    close();
    onDone?.(result);
    window._ekImportRows = [];
  } catch (err) {
    showToast('Import gagal: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Import'; }
  }
}

function _downloadTemplate() {
  _loadSheetJS().then(() => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Kode', 'Nama', 'Deskripsi', 'Bidang', 'Status'],
      ['UK-001', 'Perencanaan Sistem Distribusi Air Minum', 'Mencakup desain jaringan perpipaan...', 'produksi,trandis', 'aktif'],
      ['UK-002', 'Operasi Instalasi Pengolahan Air', '', 'produksi', 'aktif'],
      ['UK-003', 'Pemeliharaan Pompa dan Mekanikal', '', 'me', 'aktif'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Unit Kompetensi');
    XLSX.writeFile(wb, 'template-elemen-kompetensi.xlsx');
  });
}

function _loadSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}

function _esc(s) { return String(s ?? '').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

