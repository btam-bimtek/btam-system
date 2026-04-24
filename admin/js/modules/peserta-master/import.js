// admin/js/modules/peserta-master/import.js
// Import peserta dari file Excel/CSV menggunakan SheetJS.

import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { bulkImportPeserta } from './api.js';
import { normalizePeserta } from '../../../../shared/normalize.js';

// Kolom yang dikenali saat import (case-insensitive header matching)
const COLUMN_MAP = {
  'no peserta': 'noPeserta', 'nopeserta': 'noPeserta', 'nomor peserta': 'noPeserta', 'id': 'noPeserta',
  'nama': 'nama', 'nama lengkap': 'nama',
  'jenis kelamin': 'jenisKelamin', 'kelamin': 'jenisKelamin', 'jk': 'jenisKelamin',
  'jabatan': 'jabatan', 'posisi': 'jabatan',
  'pendidikan': 'pendidikan', 'pendidikan terakhir': 'pendidikan',
  'email': 'email',
  'no hp': 'noHp', 'nohp': 'noHp', 'telepon': 'noHp', 'hp': 'noHp', 'whatsapp': 'noHp',
  'instansi': 'instansi', 'nama instansi': 'instansi', 'kantor': 'instansi', 'perusahaan': 'instansi',
  'unit kerja': 'unitKerja', 'bagian': 'unitKerja', 'divisi': 'unitKerja',
  'provinsi': 'provinsi',
  'kabupaten': 'kabKota', 'kota': 'kabKota', 'kab/kota': 'kabKota', 'kabkota': 'kabKota'
};

export function openImportPeserta(onDone) {
  let _parsedRows = [];
  let _errors     = [];
  let _skipDupes  = true;

  const body = `
    <div class="space-y-5">
      <!-- Upload area -->
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-2">
          File Excel (.xlsx, .xls) atau CSV
        </label>
        <div id="drop-zone"
             class="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center
                    hover:border-blue-600 transition-colors cursor-pointer">
          <input type="file" id="import-file" accept=".xlsx,.xls,.csv" class="hidden" />
          <svg class="w-10 h-10 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor"
               stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293
                     l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="text-sm text-gray-400">Klik atau seret file ke sini</p>
          <p class="text-xs text-gray-600 mt-1">Format: .xlsx, .xls, atau .csv</p>
        </div>
      </div>

      <!-- Options -->
      <div class="flex items-center gap-3">
        <input type="checkbox" id="skip-dupes" checked class="w-4 h-4 rounded" />
        <label for="skip-dupes" class="text-sm text-gray-400 cursor-pointer">
          Lewati duplikat (jangan error, langsung skip)
        </label>
      </div>

      <!-- Preview -->
      <div id="import-preview" class="hidden">
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs font-medium text-gray-400" id="preview-count"></p>
          <button id="reset-file" class="text-xs text-gray-500 hover:text-gray-300">Ganti file</button>
        </div>
        <div class="max-h-56 overflow-auto rounded-lg border border-gray-800">
          <table class="btam-table text-xs w-full">
            <thead id="preview-head"></thead>
            <tbody id="preview-body"></tbody>
          </table>
        </div>
        <!-- Errors dari parse -->
        <div id="parse-errors" class="hidden mt-3 text-xs text-red-400 space-y-1"></div>
      </div>

      <!-- Import progress -->
      <div id="import-progress" class="hidden">
        <div class="flex items-center gap-3">
          <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
          <p class="text-sm text-gray-300" id="progress-msg">Mengimpor data…</p>
        </div>
      </div>

      <!-- Import result -->
      <div id="import-result" class="hidden text-sm space-y-2"></div>
    </div>
  `;

  const { close, bodyEl } = openModal({
    title: 'Import Peserta dari Excel',
    body,
    size: 'lg',
    actions: [
      { label: 'Batal', type: 'secondary', onClick: ({ close }) => close() },
      { label: 'Import', type: 'primary', onClick: () => _doImport() }
    ]
  });

  // Load SheetJS
  _loadSheetJS().then(() => _bindImportEvents(bodyEl, close, onDone));

  function _bindImportEvents(bodyEl, close, onDone) {
    const dropZone = bodyEl.querySelector('#drop-zone');
    const fileInput = bodyEl.querySelector('#import-file');
    const skipDupesEl = bodyEl.querySelector('#skip-dupes');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('border-blue-500'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('border-blue-500');
      _processFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => _processFile(fileInput.files[0]));
    skipDupesEl.addEventListener('change', () => { _skipDupes = skipDupesEl.checked; });

    bodyEl.querySelector('#reset-file')?.addEventListener('click', () => {
      _parsedRows = []; _errors = [];
      bodyEl.querySelector('#import-preview').classList.add('hidden');
      bodyEl.querySelector('#import-result').classList.add('hidden');
      fileInput.value = '';
    });
  }

  function _processFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (raw.length === 0) { showToast('File kosong atau tidak ada data.', 'error'); return; }

        // Map headers
        const headers = Object.keys(raw[0]);
        const headerMap = {};
        headers.forEach(h => {
          const key = COLUMN_MAP[h.toLowerCase().trim()];
          if (key) headerMap[h] = key;
        });

        _parsedRows = raw.map(row => {
          const mapped = {};
          Object.entries(headerMap).forEach(([rawKey, fieldKey]) => {
            mapped[fieldKey] = row[rawKey];
          });
          return mapped;
        }).filter(r => r.noPeserta || r.nama); // skip empty rows

        _renderPreview(_parsedRows, bodyEl);
      } catch (err) {
        showToast('Gagal baca file: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function _doImport() {
    if (_parsedRows.length === 0) {
      showToast('Pilih file terlebih dahulu.', 'warning'); return;
    }

    const progressEl = bodyEl.querySelector('#import-progress');
    const resultEl   = bodyEl.querySelector('#import-result');
    const importBtn  = document.querySelector('[data-action="Import"]');

    progressEl.classList.remove('hidden');
    resultEl.classList.add('hidden');
    if (importBtn) importBtn.disabled = true;

    try {
      const result = await bulkImportPeserta(_parsedRows, { skipDupes: _skipDupes });

      progressEl.classList.add('hidden');
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `
        <div class="bg-green-900/30 border border-green-800 rounded-lg p-3">
          <p class="text-green-300 font-medium">Import selesai</p>
          <p class="text-green-400/80 text-xs mt-1">
            Berhasil: ${result.created} | Dilewati: ${result.skipped} | Error: ${result.errors.length}
          </p>
        </div>
        ${result.errors.length ? `
          <div class="bg-red-900/20 border border-red-800 rounded-lg p-3 text-xs text-red-300 max-h-32 overflow-auto">
            <p class="font-medium mb-1">Data yang gagal:</p>
            ${result.errors.slice(0, 20).map(e =>
              `<p>• ${e.noPeserta ?? '?'} — ${e.errors.join(', ')}</p>`
            ).join('')}
            ${result.errors.length > 20 ? `<p class="text-red-500">…dan ${result.errors.length - 20} lainnya</p>` : ''}
          </div>` : ''}
      `;

      if (result.created > 0) {
        showToast(`${result.created} peserta berhasil diimpor.`, 'success');
        onDone?.();
      }
    } catch (err) {
      progressEl.classList.add('hidden');
      showToast('Import gagal: ' + err.message, 'error');
    } finally {
      if (importBtn) importBtn.disabled = false;
    }
  }
}

function _renderPreview(rows, bodyEl) {
  const previewEl   = bodyEl.querySelector('#import-preview');
  const countEl     = bodyEl.querySelector('#preview-count');
  const headEl      = bodyEl.querySelector('#preview-head');
  const bodyTable   = bodyEl.querySelector('#preview-body');

  const COLS = ['noPeserta','nama','jenisKelamin','pendidikan','instansi','provinsi'];
  const LABELS = { noPeserta:'No Peserta', nama:'Nama', jenisKelamin:'JK', pendidikan:'Pendidikan', instansi:'Instansi', provinsi:'Provinsi' };

  countEl.textContent = `${rows.length} baris siap diimpor`;
  headEl.innerHTML = `<tr>${COLS.map(c => `<th class="text-xs">${LABELS[c]}</th>`).join('')}</tr>`;
  bodyTable.innerHTML = rows.slice(0, 10).map(r => `
    <tr>${COLS.map(c => `<td class="text-xs">${r[c] ?? '—'}</td>`).join('')}</tr>
  `).join('') + (rows.length > 10 ? `<tr><td colspan="${COLS.length}" class="text-xs text-gray-600 text-center py-2">…dan ${rows.length-10} baris lainnya</td></tr>` : '');

  previewEl.classList.remove('hidden');
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
