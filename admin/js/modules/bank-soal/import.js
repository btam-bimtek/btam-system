// admin/js/modules/bank-soal/import.js
// Import soal dari Excel. Satu baris = satu soal.
// Format kolom: Pertanyaan | Bidang | Bloom | EK | Opsi A | Opsi B | Opsi C | Opsi D | Kunci | Pembahasan | Tags

import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { createSoal } from './api.js';
import { BIDANG_LIST, BLOOM_LEVELS } from '../../../../shared/constants.js';

// Map nama bidang → bidangId
const BIDANG_ALIAS = {};
BIDANG_LIST.forEach(b => {
  BIDANG_ALIAS[b.bidangId.toLowerCase()] = b.bidangId;
  BIDANG_ALIAS[b.nama.toLowerCase()]     = b.bidangId;
});

// Map nama bloom → level code
const BLOOM_ALIAS = {};
BLOOM_LEVELS.forEach(b => {
  BLOOM_ALIAS[b.level.toLowerCase()]              = b.level;
  BLOOM_ALIAS[b.nama.toLowerCase()]               = b.level;
  BLOOM_ALIAS[b.level.toLowerCase().slice(1)]     = b.level; // '1' → 'C1'
});

// Column header map (lowercase → field)
const COLUMN_MAP = {
  'pertanyaan': 'pertanyaan', 'soal': 'pertanyaan', 'question': 'pertanyaan',
  'bidang': 'bidang', 'bidangid': 'bidang',
  'bloom': 'bloomLevel', 'bloom level': 'bloomLevel', 'level': 'bloomLevel',
  'elemen kompetensi': 'elemenKompetensi', 'ek': 'elemenKompetensi', 'elemen': 'elemenKompetensi',
  'opsi a': 'opsiA', 'a': 'opsiA', 'pilihan a': 'opsiA',
  'opsi b': 'opsiB', 'b': 'opsiB', 'pilihan b': 'opsiB',
  'opsi c': 'opsiC', 'c': 'opsiC', 'pilihan c': 'opsiC',
  'opsi d': 'opsiD', 'd': 'opsiD', 'pilihan d': 'opsiD',
  'opsi e': 'opsiE', 'e': 'opsiE',
  'opsi f': 'opsiF', 'f': 'opsiF',
  'kunci': 'kunci', 'jawaban': 'kunci', 'kunci jawaban': 'kunci', 'answer': 'kunci',
  'pembahasan': 'pembahasan', 'penjelasan': 'pembahasan',
  'tags': 'tags', 'tag': 'tags', 'kategori': 'tags'
};

export function openImportSoal(onDone) {
  let _parsedRows = [];

  const body = `
    <div class="space-y-5">
      <!-- Template download -->
      <div class="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4">
        <p class="text-sm font-medium text-blue-300 mb-1">Format kolom Excel:</p>
        <p class="text-xs text-blue-400/80 font-mono">
          Pertanyaan | Bidang | Bloom | EK | Opsi A | Opsi B | Opsi C | Opsi D | Kunci | Pembahasan | Tags
        </p>
        <p class="text-xs text-blue-400/60 mt-2">
          Bidang: produksi / trandis / me / pendukung<br/>
          Bloom: C1–C6 atau nama (Mengingat, Memahami, …)<br/>
          Kunci: a / b / c / d (huruf kecil atau kapital)
        </p>
        <button id="btn-download-template" class="mt-3 text-xs text-blue-400 hover:text-blue-300 underline">
          Download template Excel
        </button>
      </div>

      <!-- Upload -->
      <div>
        <div id="drop-zone" class="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center
                                   hover:border-blue-600 transition-colors cursor-pointer">
          <input type="file" id="import-file" accept=".xlsx,.xls,.csv" class="hidden" />
          <svg class="w-10 h-10 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor"
               stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293
                     l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="text-sm text-gray-400">Klik atau seret file ke sini</p>
        </div>
      </div>

      <!-- Preview -->
      <div id="import-preview" class="hidden">
        <p class="text-xs text-gray-400 mb-2" id="preview-count"></p>
        <div class="max-h-48 overflow-auto rounded-lg border border-gray-800">
          <table class="btam-table text-xs w-full">
            <thead><tr>
              <th>Pertanyaan</th><th>Bidang</th><th>Bloom</th><th>Kunci</th>
            </tr></thead>
            <tbody id="preview-body"></tbody>
          </table>
        </div>
        <div id="parse-errors" class="hidden mt-3 text-xs text-red-400 space-y-1 max-h-24 overflow-auto"></div>
      </div>

      <!-- Progress / Result -->
      <div id="import-progress" class="hidden">
        <div class="flex items-center gap-3">
          <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
          <p class="text-sm text-gray-300" id="progress-msg">Mengimpor soal…</p>
        </div>
        <div class="mt-2 bg-gray-800 rounded-full h-1.5">
          <div id="progress-bar" class="bg-blue-500 h-1.5 rounded-full transition-all" style="width:0%"></div>
        </div>
      </div>
      <div id="import-result" class="hidden"></div>
    </div>
  `;

  const { close, bodyEl } = openModal({
    title: 'Import Soal dari Excel',
    body,
    size: 'lg',
    actions: [
      { label: 'Batal',  type: 'secondary', onClick: ({ close }) => close() },
      { label: 'Import', type: 'primary',   onClick: () => _doImport(bodyEl, onDone) }
    ]
  });

  _loadSheetJS().then(() => {
    _bindEvents(bodyEl);
    bodyEl.querySelector('#btn-download-template')?.addEventListener('click', _downloadTemplate);
  });
}

function _bindEvents(bodyEl) {
  const dropZone  = bodyEl.querySelector('#drop-zone');
  const fileInput = bodyEl.querySelector('#import-file');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('border-blue-500'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('border-blue-500');
    _processFile(e.dataTransfer.files[0], bodyEl);
  });
  fileInput.addEventListener('change', () => _processFile(fileInput.files[0], bodyEl));
}

function _processFile(file, bodyEl) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb  = XLSX.read(e.target.result, { type: 'array' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!raw.length) { showToast('File kosong.', 'error'); return; }

      // Map headers
      const headers = Object.keys(raw[0]);
      const headerMap = {};
      headers.forEach(h => {
        const key = COLUMN_MAP[h.toLowerCase().trim()];
        if (key) headerMap[h] = key;
      });

      const rows = raw.map(row => {
        const mapped = {};
        Object.entries(headerMap).forEach(([rawKey, field]) => { mapped[field] = String(row[rawKey] ?? '').trim(); });
        return mapped;
      }).filter(r => r.pertanyaan);

      // Store di closure parent
      bodyEl._parsedRows = rows;

      _renderPreview(rows, bodyEl);
    } catch (err) {
      showToast('Gagal baca file: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function _renderPreview(rows, bodyEl) {
  const previewEl = bodyEl.querySelector('#import-preview');
  const countEl   = bodyEl.querySelector('#preview-count');
  const tbody     = bodyEl.querySelector('#preview-body');
  const errorsEl  = bodyEl.querySelector('#parse-errors');

  countEl.textContent = `${rows.length} soal siap diimpor`;

  tbody.innerHTML = rows.slice(0, 8).map(r => `
    <tr>
      <td class="max-w-xs truncate">${_esc(r.pertanyaan?.slice(0, 60))}…</td>
      <td>${_esc(r.bidang)}</td>
      <td>${_esc(r.bloomLevel)}</td>
      <td>${_esc(r.kunci)}</td>
    </tr>`).join('') +
    (rows.length > 8 ? `<tr><td colspan="4" class="text-center text-gray-600 py-2">…${rows.length - 8} soal lainnya</td></tr>` : '');

  previewEl.classList.remove('hidden');
  errorsEl.classList.add('hidden');
}

async function _doImport(bodyEl, onDone) {
  const rows = bodyEl._parsedRows ?? [];
  if (!rows.length) { showToast('Pilih file terlebih dahulu.', 'warning'); return; }

  const progressEl = bodyEl.querySelector('#import-progress');
  const barEl      = bodyEl.querySelector('#progress-bar');
  const msgEl      = bodyEl.querySelector('#progress-msg');
  const resultEl   = bodyEl.querySelector('#import-result');
  const importBtn  = document.querySelector('[data-action="Import"]');

  progressEl.classList.remove('hidden');
  resultEl.classList.add('hidden');
  if (importBtn) importBtn.disabled = true;

  let created = 0, errorList = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (barEl) barEl.style.width = `${Math.round((i / rows.length) * 100)}%`;
    if (msgEl) msgEl.textContent = `Mengimpor soal ${i + 1} dari ${rows.length}…`;

    try {
      const data = _mapRowToSoal(row);
      await createSoal(data);
      created++;
    } catch (err) {
      errorList.push({ baris: i + 2, pertanyaan: row.pertanyaan?.slice(0, 40), error: err.message });
    }
  }

  if (barEl) barEl.style.width = '100%';
  progressEl.classList.add('hidden');
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <div class="bg-green-900/30 border border-green-800 rounded-lg p-3">
      <p class="text-green-300 font-medium">Import selesai</p>
      <p class="text-green-400/80 text-xs mt-1">Berhasil: ${created} | Gagal: ${errorList.length}</p>
    </div>
    ${errorList.length ? `
      <div class="bg-red-900/20 border border-red-800 rounded-lg p-3 text-xs text-red-300 max-h-32 overflow-auto mt-2">
        ${errorList.slice(0, 15).map(e => `<p>• Baris ${e.baris}: ${_esc(e.pertanyaan)}… — ${_esc(e.error)}</p>`).join('')}
      </div>` : ''}`;

  if (created > 0) { showToast(`${created} soal berhasil diimpor.`, 'success'); onDone?.(); }
  if (importBtn) importBtn.disabled = false;
}

function _mapRowToSoal(row) {
  const bidangId   = BIDANG_ALIAS[(row.bidang ?? '').toLowerCase()] ?? row.bidang;
  const bloomLevel = BLOOM_ALIAS[(row.bloomLevel ?? '').toLowerCase()] ?? row.bloomLevel?.toUpperCase();
  const kunci      = (row.kunci ?? '').toLowerCase().trim().replace(/^opsi\s*/i, '');

  const opsi = [];
  ['a','b','c','d','e','f'].forEach(id => {
    const text = row[`opsi${id.toUpperCase()}`] ?? row[`opsi_${id}`] ?? '';
    if (text) opsi.push({ id, text, image: null });
  });

  return {
    pertanyaan:              row.pertanyaan,
    bidangId,
    bloomLevel,
    elemenKompetensi:        row.elemenKompetensi ?? '',
    opsi,
    kunci,
    pembahasan:              row.pembahasan ?? '',
    tags:                    row.tags ?? '',
    jenisPelatihanPreferensi: null,
    active:                  true
  };
}

function _downloadTemplate() {
  if (!window.XLSX) { showToast('SheetJS belum dimuat.', 'error'); return; }

  const template = [
    {
      'Pertanyaan': 'Apa fungsi utama bak sedimentasi pada proses pengolahan air?',
      'Bidang': 'produksi',
      'Bloom': 'C2',
      'EK': 'EK-01',
      'Opsi A': 'Mengendapkan partikel tersuspensi',
      'Opsi B': 'Membunuh kuman patogen',
      'Opsi C': 'Mengurangi kekeruhan dengan koagulan',
      'Opsi D': 'Menghilangkan bau dan rasa',
      'Kunci': 'a',
      'Pembahasan': 'Sedimentasi adalah proses pengendapan partikel tersuspensi oleh gravitasi.',
      'Tags': 'IPA, sedimentasi, pengolahan air'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  ws['!cols'] = [{ wch: 50 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
                 { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
                 { wch: 8 }, { wch: 40 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Soal');
  XLSX.writeFile(wb, 'template-import-soal-btam.xlsx');
}

function _loadSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
