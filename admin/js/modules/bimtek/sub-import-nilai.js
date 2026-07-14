// admin/js/modules/bimtek/sub-import-nilai.js
// Import nilai peserta dari file Excel (.xlsx)

import { bulkImportNilai } from './penilaian-api.js';
import { showToast } from '../../components/toast.js';

const FIELDS = ['pretest', 'posttest', 'kehadiran', 'keaktifan', 'respek'];

export function renderSubImportNilai(container, bimtekId, onDone, bimtek) {
  container.innerHTML = `
    <div class="space-y-6 max-w-2xl">

      <!-- Panduan -->
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm text-gray-300 space-y-2">
        <p class="font-medium text-white">Format Excel (.xlsx)</p>
        <p>Baris pertama = header. Kolom wajib: <code class="text-blue-300">noPeserta</code>. Kolom nilai boleh dikosongkan jika tidak ada data.</p>
        <div class="mt-2 overflow-x-auto">
          <table class="text-xs text-gray-400 border border-gray-700 rounded">
            <thead class="bg-gray-900">
              <tr>
                ${['noPeserta','pretest','posttest','kehadiran','keaktifan','respek'].map(h =>
                  `<th class="px-3 py-1 border-r border-gray-700">${h}</th>`
                ).join('')}
              </tr>
            </thead>
            <tbody>
              <tr>
                ${['P001','70','85','90','80','75'].map(v =>
                  `<td class="px-3 py-1 border-r border-gray-700">${v}</td>`
                ).join('')}
              </tr>
              <tr>
                ${['P002','65','80','','75','70'].map(v =>
                  `<td class="px-3 py-1 border-r border-gray-700">${v}</td>`
                ).join('')}
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-yellow-400 text-xs">⚠ Nilai kehadiran adalah persentase (0–100), bukan jumlah sesi hadir.</p>
      </div>

      <!-- Download template -->
      <div>
        <button id="btn-download-template"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
          Unduh Template Excel
        </button>
      </div>

      <!-- Upload -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-300">Pilih File Excel (.xlsx)</label>
        <input type="file" id="xlsx-file-input" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4
                 file:rounded-lg file:border-0 file:text-sm file:font-medium
                 file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" />
        <p id="parse-error" class="text-red-400 text-xs hidden"></p>
      </div>

      <!-- Preview -->
      <div id="import-preview" class="hidden space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-gray-300">Preview (<span id="preview-count">0</span> baris valid)</p>
          <div id="preview-errors" class="text-xs text-red-400"></div>
        </div>
        <div class="overflow-x-auto">
          <table class="btam-table text-xs">
            <thead>
              <tr>
                <th>No Peserta</th>
                <th class="text-center">Pretest</th>
                <th class="text-center">Posttest</th>
                <th class="text-center">Kehadiran %</th>
                <th class="text-center">Keaktifan</th>
                <th class="text-center">Respek</th>
              </tr>
            </thead>
            <tbody id="preview-tbody"></tbody>
          </table>
        </div>
        <button id="btn-import-confirm"
          class="px-5 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          disabled>
          Simpan ke Firestore
        </button>
      </div>

    </div>
  `;

  let parsedRows = [];

  // Download template
  container.querySelector('#btn-download-template').addEventListener('click', () => {
    if (!window.XLSX) { showToast('Library Excel belum dimuat', 'error'); return; }
    const ws = window.XLSX.utils.aoa_to_sheet([
      ['noPeserta', 'pretest', 'posttest', 'kehadiran', 'keaktifan', 'respek'],
      ['P001', 70, 85, 90, 80, 75],
      ['P002', 65, 80, '', 75, 70],
    ]);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Nilai');
    window.XLSX.writeFile(wb, `template-nilai-${bimtekId}.xlsx`);
  });

  // File upload → parse + preview
  container.querySelector('#xlsx-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const errEl = container.querySelector('#parse-error');
    errEl.classList.add('hidden');

    if (!window.XLSX) {
      errEl.textContent = 'Library SheetJS belum dimuat. Refresh halaman dan coba lagi.';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const wb = window.XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = window.XLSX.utils.sheet_to_json(ws, { defval: '' });

      const pesertaIds = new Set(bimtek?.pesertaIds ?? []);
      const { rows, errors, skipped } = _parseRows(raw, pesertaIds);
      parsedRows = rows;

      _renderPreview(container, rows, errors, skipped);
      container.querySelector('#btn-import-confirm').disabled = rows.length === 0;
    } catch (err) {
      errEl.textContent = `Gagal membaca file: ${err.message}`;
      errEl.classList.remove('hidden');
      console.error(err);
    }
  });

  // Confirm
  container.querySelector('#btn-import-confirm').addEventListener('click', async () => {
    if (parsedRows.length === 0) return;
    const btn = container.querySelector('#btn-import-confirm');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    try {
      await bulkImportNilai(bimtekId, parsedRows);
      showToast(`${parsedRows.length} peserta berhasil diimpor`, 'ok');
      if (onDone) onDone();
    } catch (err) {
      showToast(`Gagal import: ${err.message}`, 'error');
      console.error(err);
      btn.disabled = false;
      btn.textContent = 'Simpan ke Firestore';
    }
  });
}

// ─── PARSER ──────────────────────────────────────────────────────────────────

function _parseRows(rawRows, pesertaIds = new Set()) {
  const rows = [];
  const errors = [];
  const skipped = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    // Cari kolom noPeserta case-insensitive
    const keyMap = {};
    for (const k of Object.keys(raw)) {
      keyMap[k.toLowerCase().replace(/\s/g, '')] = k;
    }

    const noPeserta = String(raw[keyMap['nopeserta']] ?? '').trim();
    if (!noPeserta) {
      errors.push(`Baris ${i + 2}: noPeserta kosong`);
      continue;
    }

    // Validasi: hanya peserta yang terdaftar di bimtek
    if (pesertaIds.size > 0 && !pesertaIds.has(noPeserta)) {
      skipped.push(noPeserta);
      continue;
    }

    const row = { noPeserta };
    let rowErr = null;

    for (const f of FIELDS) {
      const origKey = keyMap[f];
      if (!origKey) { row[f] = null; continue; }

      const rawVal = raw[origKey];
      if (rawVal === '' || rawVal === null || rawVal === undefined) {
        row[f] = null;
        continue;
      }

      const num = parseFloat(rawVal);
      if (isNaN(num) || num < 0 || num > 100) {
        rowErr = `Baris ${i + 2}: nilai ${f} tidak valid (${rawVal})`;
        break;
      }
      row[f] = Math.round(num * 100) / 100;
    }

    if (rowErr) {
      errors.push(rowErr);
    } else {
      rows.push(row);
    }
  }

  return { rows, errors, skipped };
}

function _renderPreview(container, rows, errors, skipped = []) {
  const preview = container.querySelector('#import-preview');
  const tbody = container.querySelector('#preview-tbody');
  const countEl = container.querySelector('#preview-count');
  const errEl = container.querySelector('#preview-errors');

  preview.classList.remove('hidden');
  countEl.textContent = rows.length;
  const msgs = [];
  if (errors.length > 0)  msgs.push(`${errors.length} baris diabaikan (nilai tidak valid)`);
  if (skipped.length > 0) msgs.push(`${skipped.length} baris dilewati (bukan peserta bimtek ini: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '…' : ''})`);
  errEl.textContent = msgs.join(' · ');

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="font-mono">${_esc(r.noPeserta)}</td>
      ${FIELDS.map(f => `
        <td class="text-center">
          ${r[f] !== null && r[f] !== undefined ? r[f] : '<span class="text-gray-600">—</span>'}
        </td>
      `).join('')}
    </tr>
  `).join('');
}

function _esc(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
