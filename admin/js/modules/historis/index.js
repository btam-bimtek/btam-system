// admin/js/modules/historis/index.js
// Halaman Data Historis — dua tab: Import Alumni & Import Kinerja PDAM.

import { setPageTitle }         from '../../layout/navbar.js';
import { showToast }            from '../../components/toast.js';
import { confirmDialog }        from '../../components/modal.js';
import { requireWrite }         from '../../auth-guard.js';
import { getState }             from '../../store.js';
import { batchImportAlumni, batchImportKinerja, clearAlumniHistoris, clearKinerjaInstansi, countAlumniHistoris, listKinerjaInstansi, buildMasterExportRows }
  from './api.js';
import { renderKorelasiTab } from './tab-korelasi.js';
import { normalizeAlumniRow, normalizeKinerjaBPPSPAM } from './normalize.js';
import { HISTORIS_BIDANG, HISTORIS_TIPE, HISTORIS_MODE, HISTORIS_LOKASI } from '../../../../shared/constants.js';

// Field Grup A alumni — wajib di-mapping
const ALUMNI_FIELDS_A = [
  { key: 'tahun',        label: 'Tahun',          hint: 'angka, misal 2019' },
  { key: 'nama_bimtek',  label: 'Nama Bimtek',    hint: 'nama kegiatan' },
  { key: 'bidang',       label: 'Bidang',          hint: HISTORIS_BIDANG.join(' / ') },
  { key: 'tipe',         label: 'Tipe',            hint: HISTORIS_TIPE.join(' / ') },
  { key: 'mode',         label: 'Mode',            hint: HISTORIS_MODE.join(' / ') },
  { key: 'instansi',     label: 'Instansi',        hint: 'nama canonical PDAM' },
  { key: 'jenis_lokasi', label: 'Jenis Lokasi',    hint: HISTORIS_LOKASI.join(' / ') },
  { key: 'provinsi',     label: 'Provinsi',        hint: 'nama resmi provinsi' },
  { key: 'kab_kota',     label: 'Kab/Kota',       hint: 'misal Kota Bogor' },
  { key: 'nama_peserta', label: 'Nama Peserta',   hint: 'tanpa gelar' },
];

const ALUMNI_FIELDS_B = [
  { key: 'tanggal_mulai',   label: 'Tanggal Mulai' },
  { key: 'tanggal_selesai', label: 'Tanggal Selesai' },
  { key: 'jabatan',         label: 'Jabatan' },
  { key: 'kelas_jabatan',   label: 'Kelas Jabatan' },
  { key: 'pendidikan',      label: 'Pendidikan' },
  { key: 'jenis_kelamin',   label: 'Jenis Kelamin' },
];

const ALUMNI_FIELDS_C = [
  { key: 'email', label: 'Email' },
  { key: 'noHP',  label: 'No. HP' },
  { key: 'NIK',   label: 'NIK' },
];

let S = {
  tab:           'alumni',  // 'alumni' | 'kinerja'
  // alumni state
  alumniHeaders: [],        // kolom dari Excel
  alumniRows:    [],        // semua baris data (array of objects keyed by header)
  alumniMapping: {},        // { field_key: excel_column_name }
  // kinerja state
  kinerjaHeaders: [],
  kinerjaRows:    [],
  tahunCols:      [],       // kolom yang berisi tahun (auto-detected)
};

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────

export async function renderHistoris() {
  setPageTitle('Data Historis');
  if (!requireWrite()) return;

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="max-w-4xl">
      <div class="mb-6">
        <h1 class="text-lg font-bold text-white">Data Historis Bimtek</h1>
        <p class="text-xs text-gray-500 mt-0.5">Import data peserta historis dan kinerja PDAM untuk analisis sebaran & korelasi</p>
      </div>

      <!-- Export master data -->
      <div class="mb-5 flex items-center gap-3">
        <button id="btn-export-master"
                class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                       bg-green-700 hover:bg-green-600 text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export Master Data (.xlsx)
        </button>
        <span class="text-xs text-gray-500">
          Gabungan alumni historis + peserta bimtek selesai dari sistem
        </span>
      </div>

      <!-- Tab buttons -->
      <div class="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        <button id="tab-alumni"   class="tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Bimtek Historis
        </button>
        <button id="tab-kinerja"  class="tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Kinerja PDAM
        </button>
        <button id="tab-korelasi" class="tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Korelasi
        </button>
      </div>

      <div id="tab-content"></div>
    </div>`;

  _bindTabs();
  _switchTab('alumni');

  document.getElementById('btn-export-master').addEventListener('click', _doExportMaster);
}

async function _doExportMaster() {
  const btn = document.getElementById('btn-export-master');
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Menyiapkan…`;

  try {
    const XLSX  = await _loadXLSX();
    const rows  = await buildMasterExportRows();

    if (rows.length === 0) {
      showToast('Tidak ada data untuk diekspor.', 'warning');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master Data');

    // Lebar kolom otomatis (max 40 char)
    const cols = Object.keys(rows[0]).map(k => ({ wch: Math.min(40, Math.max(k.length, 12)) }));
    ws['!cols'] = cols;

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `master_alumni_${today}.xlsx`);
    showToast(`${rows.length.toLocaleString('id-ID')} baris diekspor.`, 'success');
  } catch (err) {
    showToast('Export gagal: ' + err.message, 'error');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

function _bindTabs() {
  document.getElementById('tab-alumni')  .addEventListener('click', () => _switchTab('alumni'));
  document.getElementById('tab-kinerja') .addEventListener('click', () => _switchTab('kinerja'));
  document.getElementById('tab-korelasi').addEventListener('click', () => _switchTab('korelasi'));
}

function _switchTab(tab) {
  S.tab = tab;
  ['alumni','kinerja','korelasi'].forEach(t => {
    const btn = document.getElementById('tab-' + t);
    if (!btn) return;
    btn.classList.toggle('bg-gray-700',   t === tab);
    btn.classList.toggle('text-white',    t === tab);
    btn.classList.toggle('text-gray-400', t !== tab);
  });
  if (tab === 'alumni')   _renderAlumniTab();
  if (tab === 'kinerja')  _renderKinerjaTab();
  if (tab === 'korelasi') renderKorelasiTab();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB ALUMNI HISTORIS
// ═══════════════════════════════════════════════════════════════════════════════

async function _renderAlumniTab() {
  const el = document.getElementById('tab-content');
  const total = await countAlumniHistoris().catch(() => 0);

  el.innerHTML = `
    <div class="space-y-5">

      <!-- Status -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-white">${total.toLocaleString('id-ID')} record tersimpan</p>
          <p class="text-xs text-gray-500 mt-0.5">
            ${total > 0
              ? 'Re-import aman — data existing diperbarui, tidak duplikat'
              : 'Belum ada data historis — upload file Excel untuk memulai'}
          </p>
        </div>
        <div class="flex items-center gap-3">
          ${total > 0
            ? `<span class="badge badge-green text-xs">Ada data</span>`
            : `<span class="badge badge-gray text-xs">Kosong</span>`}
          ${total > 0 ? `
            <button id="btn-clear-alumni"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                           bg-red-900/40 hover:bg-red-800/60 text-red-400
                           border border-red-800/50 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Hapus Semua
            </button>` : ''}
        </div>
      </div>

      <!-- Upload area -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white mb-3">1. Upload File Excel</h2>
        <p class="text-xs text-gray-500 mb-4">
          Format: <code class="bg-gray-800 px-1 py-0.5 rounded">.xlsx</code> atau
          <code class="bg-gray-800 px-1 py-0.5 rounded">.xls</code>.
          Baris pertama harus header kolom.
        </p>
        <label class="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg
                       bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Pilih File Excel
          <input id="alumni-file-input" type="file" accept=".xlsx,.xls" class="hidden" />
        </label>
        <span id="alumni-filename" class="ml-3 text-xs text-gray-500"></span>
      </div>

      <!-- Column mapping + preview (muncul setelah file dipilih) -->
      <div id="alumni-mapping-section" class="hidden"></div>

      <!-- Validation result (muncul setelah mapping) -->
      <div id="alumni-validation-section" class="hidden"></div>

      <!-- Import button -->
      <div id="alumni-import-section" class="hidden"></div>

    </div>`;

  document.getElementById('alumni-file-input').addEventListener('change', _onAlumniFileSelected);

  if (total > 0) {
    document.getElementById('btn-clear-alumni').addEventListener('click', _doClearAlumni);
  }
}

async function _onAlumniFileSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  document.getElementById('alumni-filename').textContent = file.name;

  const XLSX = await _loadXLSX();
  const wb   = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const all  = XLSX.utils.sheet_to_json(ws, { defval: '' });

  if (!all.length) { showToast('File kosong atau tidak terbaca.', 'error'); return; }

  S.alumniHeaders = Object.keys(all[0]);
  S.alumniRows    = all;
  S.alumniMapping = {};

  _renderAlumniMapping(file.name);
}

function _renderAlumniMapping(fileName) {
  const el = document.getElementById('alumni-mapping-section');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 class="text-sm font-semibold text-white mb-1">2. Mapping Kolom</h2>
      <p class="text-xs text-gray-500 mb-4">
        Kolom di file: <span class="text-gray-300">${S.alumniHeaders.join(', ')}</span>
      </p>

      <div class="space-y-4">
        <!-- Grup A -->
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Grup A — Wajib
          </p>
          <div class="grid grid-cols-2 gap-2">
            ${ALUMNI_FIELDS_A.map(f => _mappingRow(f, 'A')).join('')}
          </div>
        </div>

        <!-- Grup B -->
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Grup B — Opsional (isi kalau ada)
          </p>
          <div class="grid grid-cols-2 gap-2">
            ${ALUMNI_FIELDS_B.map(f => _mappingRow(f, 'B')).join('')}
          </div>
        </div>

        <!-- Grup C -->
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Grup C — Simpan apa adanya
          </p>
          <div class="grid grid-cols-2 gap-2">
            ${ALUMNI_FIELDS_C.map(f => _mappingRow(f, 'C')).join('')}
          </div>
        </div>
      </div>

      <div class="mt-5 flex items-center gap-3">
        <button id="btn-alumni-preview"
                class="px-4 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-white transition-colors">
          Preview &amp; Validasi
        </button>
        <span class="text-xs text-gray-500">${S.alumniRows.length.toLocaleString('id-ID')} baris ditemukan</span>
      </div>
    </div>`;

  // Auto-match: kalau nama kolom Excel sama persis dengan field key / label
  _autoMatchMapping();

  document.getElementById('btn-alumni-preview').addEventListener('click', _runAlumniValidation);
}

function _mappingRow(field, grup) {
  const NONE = '— Tidak ada —';
  const opts = [NONE, ...S.alumniHeaders]
    .map(h => `<option value="${_esc(h)}">${_esc(h)}</option>`).join('');
  return `
    <div class="flex items-center gap-2">
      <label class="text-xs text-gray-300 w-32 shrink-0">
        ${_esc(field.label)}
        ${grup === 'A' ? '<span class="text-red-400 ml-0.5">*</span>' : ''}
      </label>
      <select data-field="${field.key}" data-grup="${grup}"
              class="alumni-map-select form-select text-xs flex-1 min-w-0">
        ${opts}
      </select>
    </div>
    ${field.hint
      ? `<p class="col-span-2 text-xs text-gray-600 -mt-1 ml-34">${_esc(field.hint)}</p>`
      : ''}`;
}

function _autoMatchMapping() {
  document.querySelectorAll('.alumni-map-select').forEach(sel => {
    const key   = sel.dataset.field;
    const field = [...ALUMNI_FIELDS_A, ...ALUMNI_FIELDS_B, ...ALUMNI_FIELDS_C].find(f => f.key === key);
    // Coba match berdasarkan nama kolom sama dengan key atau label (case-insensitive)
    const match = S.alumniHeaders.find(h =>
      h.toLowerCase() === key.toLowerCase() ||
      h.toLowerCase() === field?.label?.toLowerCase() ||
      h.toLowerCase().replace(/\s+/g,'_') === key.toLowerCase()
    );
    if (match) sel.value = match;
    sel.addEventListener('change', () => { S.alumniMapping[key] = sel.value; });
    S.alumniMapping[key] = sel.value;
  });
}

function _runAlumniValidation() {
  // Ambil mapping terkini
  document.querySelectorAll('.alumni-map-select').forEach(sel => {
    S.alumniMapping[sel.dataset.field] = sel.value;
  });

  const NONE = '— Tidak ada —';
  const valid    = [];
  const invalid  = [];
  const withWarn = [];  // baris valid tapi ada warning
  const enumErrs = { bidang: {}, tipe: {}, mode: {}, jenis_lokasi: {} };

  S.alumniRows.forEach((row, i) => {
    // Remap kolom Excel → field schema
    const mapped = {};
    Object.entries(S.alumniMapping).forEach(([field, col]) => {
      if (col && col !== NONE) mapped[field] = row[col] ?? '';
    });

    const { data, errors } = normalizeAlumniRow(mapped);

    if (data) {
      valid.push(data);
      if (errors.length) withWarn.push({ row: i + 2, warnings: errors });
      // Catat nilai enum yang tidak dikenal
      ['bidang','tipe','mode','jenis_lokasi'].forEach(f => {
        if (mapped[f] && !data[f]) {
          const v = String(mapped[f]).toLowerCase().trim();
          enumErrs[f][v] = (enumErrs[f][v] || 0) + 1;
        }
      });
    } else {
      invalid.push({ row: i + 2, errors }); // +2: header row
    }
  });

  _renderValidationResult(valid, invalid, withWarn, enumErrs);
}

function _renderValidationResult(valid, invalid, withWarn, enumErrs) {
  const elVal = document.getElementById('alumni-validation-section');
  const elImp = document.getElementById('alumni-import-section');
  elVal.classList.remove('hidden');

  // Preview 5 baris valid
  const previewRows = valid.slice(0, 5).map(r => `
    <tr>
      <td>${r.tahun}</td>
      <td class="max-w-[180px] truncate">${_esc(r.nama_bimtek)}</td>
      <td>${_esc(r.bidang ?? '—')}</td>
      <td class="max-w-[160px] truncate">${_esc(r.instansi)}</td>
      <td class="max-w-[120px] truncate">${_esc(r.nama_peserta)}</td>
      <td>${_esc(r.provinsi ?? '—')}</td>
    </tr>`).join('');

  // Enum errors summary
  const enumHtml = Object.entries(enumErrs)
    .filter(([, v]) => Object.keys(v).length > 0)
    .map(([field, vals]) => {
      const list = Object.entries(vals)
        .sort((a,b) => b[1]-a[1])
        .slice(0, 8)
        .map(([v, n]) => `<span class="badge badge-gray text-xs">${_esc(v)} (${n}×)</span>`)
        .join(' ');
      return `<div class="text-xs"><span class="text-yellow-400 font-medium">${field}:</span> ${list}</div>`;
    }).join('');

  elVal.innerHTML = `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <h2 class="text-sm font-semibold text-white">3. Hasil Validasi</h2>

      <!-- Summary -->
      <div class="grid grid-cols-4 gap-3">
        <div class="bg-gray-800 rounded-lg p-3 text-center">
          <p class="text-lg font-bold text-white">${valid.length.toLocaleString('id-ID')}</p>
          <p class="text-xs text-green-400">Siap import</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center">
          <p class="text-lg font-bold text-white">${withWarn.length.toLocaleString('id-ID')}</p>
          <p class="text-xs text-yellow-400">Ada field kosong</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center">
          <p class="text-lg font-bold text-white">${invalid.length.toLocaleString('id-ID')}</p>
          <p class="text-xs text-red-400">Ditolak</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center">
          <p class="text-lg font-bold text-white">${S.alumniRows.length.toLocaleString('id-ID')}</p>
          <p class="text-xs text-gray-400">Total baris</p>
        </div>
      </div>

      <!-- Enum warnings -->
      ${enumHtml ? `
        <div class="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3 space-y-1.5">
          <p class="text-xs font-semibold text-yellow-400">⚠️ Nilai enum tidak dikenal (akan di-skip field-nya):</p>
          ${enumHtml}
        </div>` : ''}

      <!-- Invalid rows -->
      ${invalid.length > 0 ? `
        <div>
          <p class="text-xs font-semibold text-red-400 mb-2">${Math.min(invalid.length, 10)} contoh baris ditolak:</p>
          <div class="space-y-1">
            ${invalid.slice(0, 10).map(r =>
              `<div class="text-xs text-gray-400">Baris ${r.row}: ${_esc(r.errors.join(' · '))}</div>`
            ).join('')}
          </div>
        </div>` : ''}

      <!-- Preview 5 baris valid -->
      ${valid.length > 0 ? `
        <div>
          <p class="text-xs font-semibold text-gray-400 mb-2">Preview 5 baris yang akan diimport:</p>
          <div class="overflow-x-auto">
            <table class="btam-table text-xs">
              <thead>
                <tr><th>Tahun</th><th>Bimtek</th><th>Bidang</th><th>Instansi</th><th>Peserta</th><th>Provinsi</th></tr>
              </thead>
              <tbody>${previewRows}</tbody>
            </table>
          </div>
        </div>` : ''}
    </div>`;

  // Tombol import
  if (valid.length > 0) {
    elImp.classList.remove('hidden');
    elImp.innerHTML = `
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white mb-3">4. Import ke Firestore</h2>
        <p class="text-xs text-gray-500 mb-4">
          ${valid.length.toLocaleString('id-ID')} baris akan diimport.
          Proses bisa memakan waktu beberapa menit untuk data besar.
          Data yang sudah ada sebelumnya akan diperbarui (tidak duplikat).
        </p>
        <button id="btn-do-import-alumni"
                class="px-5 py-2.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500
                       text-white font-medium transition-colors">
          Mulai Import ${valid.length.toLocaleString('id-ID')} Baris
        </button>
        <div id="import-progress" class="hidden mt-3">
          <div class="flex items-center gap-2 text-sm text-gray-400">
            <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            Mengimport data…
          </div>
        </div>
      </div>`;

    document.getElementById('btn-do-import-alumni').addEventListener('click', async () => {
      await _doImportAlumni(valid);
    });
  } else {
    elImp.classList.add('hidden');
  }
}

async function _doImportAlumni(valid) {
  document.getElementById('btn-do-import-alumni').disabled = true;
  document.getElementById('import-progress').classList.remove('hidden');

  const profile  = getState('auth.profile');
  const fileName = document.getElementById('alumni-filename').textContent || 'unknown';

  try {
    const { imported } = await batchImportAlumni(valid, fileName, profile?.email ?? 'admin');
    showToast(`${imported.toLocaleString('id-ID')} baris berhasil diimport.`, 'success');
    // Re-render tab untuk update counter
    await _renderAlumniTab();
  } catch (err) {
    showToast('Import gagal: ' + err.message, 'error');
    document.getElementById('btn-do-import-alumni').disabled = false;
    document.getElementById('import-progress').classList.add('hidden');
  }
}

async function _doClearAlumni() {
  const confirmed = await confirmDialog({
    title:        'Hapus Semua Data Historis?',
    message:      'Seluruh record alumni historis akan dihapus permanen dari database. Tindakan ini tidak bisa dibatalkan.',
    confirmLabel: 'Ya, Hapus Semua',
    danger:       true,
  });
  if (!confirmed) return;

  const btn = document.getElementById('btn-clear-alumni');
  if (btn) btn.disabled = true;

  try {
    const deleted = await clearAlumniHistoris();
    showToast(`${deleted.toLocaleString('id-ID')} record berhasil dihapus.`, 'success');
    await _renderAlumniTab();
  } catch (err) {
    showToast('Gagal menghapus: ' + err.message, 'error');
    if (btn) btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB KINERJA PDAM
// ═══════════════════════════════════════════════════════════════════════════════

async function _renderKinerjaTab() {
  const el = document.getElementById('tab-content');
  const existing = await listKinerjaInstansi().catch(() => []);

  el.innerHTML = `
    <div class="space-y-5">

      <!-- Status -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-white">${existing.length} BUMD tersimpan</p>
          <p class="text-xs text-gray-500 mt-0.5">
            ${existing.length > 0
              ? 'Import baru akan menghapus semua data lama terlebih dahulu'
              : 'Belum ada data kinerja — upload CSV Buku Kinerja BPPSPAM'}
          </p>
        </div>
        ${existing.length > 0
          ? `<span class="badge badge-green text-xs">Ada data</span>`
          : `<span class="badge badge-gray text-xs">Kosong</span>`}
      </div>

      <!-- Format panduan -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white mb-2">Format File — Buku Kinerja BUMD Air Minum BPPSPAM</h2>
        <p class="text-xs text-gray-400 mb-3">
          File CSV dengan kolom <code class="bg-gray-800 px-1 rounded">nama_bumd</code>,
          <code class="bg-gray-800 px-1 rounded">wilayah</code>,
          <code class="bg-gray-800 px-1 rounded">pulau</code>,
          <code class="bg-gray-800 px-1 rounded">provinsi</code>,
          dan kolom kinerja per tahun (2021–2023) seperti
          <code class="bg-gray-800 px-1 rounded">total_kinerja_2023</code>,
          <code class="bg-gray-800 px-1 rounded">kategori_2023</code>,
          <code class="bg-gray-800 px-1 rounded">bobot_keuangan_2023</code>, dst.
        </p>
        <p class="text-xs text-gray-500">
          Format angka Indonesia (koma desimal, titik ribuan, %) ditangani otomatis.
        </p>
      </div>

      <!-- Upload -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white mb-3">Upload File CSV Kinerja</h2>
        <label class="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg
                       bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Pilih File CSV
          <input id="kinerja-file-input" type="file" accept=".csv,.xlsx,.xls" class="hidden" />
        </label>
        <span id="kinerja-filename" class="ml-3 text-xs text-gray-500"></span>
      </div>

      <div id="kinerja-preview-section" class="hidden"></div>
      <div id="kinerja-import-section" class="hidden"></div>

    </div>`;

  document.getElementById('kinerja-file-input').addEventListener('change', _onKinerjaFileSelected);
}

async function _onKinerjaFileSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  document.getElementById('kinerja-filename').textContent = file.name;

  const XLSX = await _loadXLSX();
  const wb   = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  // raw: false → nilai dikembalikan sebagai string formatted, bukan angka auto-parsed,
  // sehingga _parseId() bisa deteksi format Indonesia (koma=desimal, titik=ribuan, %)
  const all  = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

  if (!all.length) { showToast('File kosong atau tidak terbaca.', 'error'); return; }

  const valid   = [];
  const invalid = [];
  all.forEach((row, i) => {
    const { data, errors } = normalizeKinerjaBPPSPAM(row);
    if (data) valid.push(data);
    else invalid.push({ row: i + 2, errors });
  });

  S.kinerjaRows = all;
  _renderKinerjaPreview(valid, invalid, file.name);
}

function _renderKinerjaPreview(valid, invalid, fileName) {
  const elPrev = document.getElementById('kinerja-preview-section');
  const elImp  = document.getElementById('kinerja-import-section');
  elPrev.classList.remove('hidden');

  const KAT_COLOR = { SEHAT: 'text-emerald-400', 'KURANG SEHAT': 'text-yellow-400', SAKIT: 'text-red-400' };

  const previewRows = valid.slice(0, 8).map(r => {
    const katCells = ['2021','2022','2023'].map(y => {
      const k = r.kinerja?.[y];
      const label = k?.kategori ?? '—';
      const cls   = KAT_COLOR[label] ?? 'text-gray-600';
      const total = k?.total != null ? ` (${k.total.toFixed(2)})` : '';
      return `<td class="text-center text-xs ${cls}">${label}${total}</td>`;
    }).join('');
    return `<tr>
      <td class="max-w-[220px] truncate font-medium text-white">${_esc(r.nama_bumd)}</td>
      <td class="text-gray-400">${_esc(r.provinsi ?? '—')}</td>
      ${katCells}
    </tr>`;
  }).join('');

  elPrev.innerHTML = `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <h2 class="text-sm font-semibold text-white">Preview & Validasi</h2>
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-gray-800 rounded-lg p-3 text-center">
          <p class="text-lg font-bold text-white">${valid.length}</p>
          <p class="text-xs text-green-400">BUMD siap import</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center">
          <p class="text-lg font-bold text-white">${invalid.length}</p>
          <p class="text-xs text-red-400">Ditolak (nama_bumd kosong)</p>
        </div>
      </div>
      ${valid.length > 0 ? `
        <div class="overflow-x-auto">
          <table class="btam-table text-xs">
            <thead>
              <tr><th>Nama BUMD</th><th>Provinsi</th><th class="text-center">2021</th><th class="text-center">2022</th><th class="text-center">2023</th></tr>
            </thead>
            <tbody>${previewRows}</tbody>
          </table>
        </div>` : ''}
    </div>`;

  if (valid.length > 0) {
    elImp.classList.remove('hidden');
    elImp.innerHTML = `
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <div class="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3">
          <p class="text-xs text-yellow-400 font-semibold">⚠️ Data kinerja lama akan dihapus semua sebelum import</p>
          <p class="text-xs text-gray-400 mt-1">Import ini tidak bisa dibatalkan. Pastikan file sudah benar.</p>
        </div>
        <button id="btn-do-import-kinerja"
                class="px-5 py-2.5 rounded-lg text-sm bg-orange-600 hover:bg-orange-500
                       text-white font-medium transition-colors">
          Hapus Data Lama &amp; Import ${valid.length} BUMD
        </button>
        <div id="kinerja-progress" class="hidden">
          <div class="flex items-center gap-2 text-sm text-gray-400">
            <div class="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <span id="kinerja-progress-text">Menghapus data lama…</span>
          </div>
        </div>
      </div>`;

    document.getElementById('btn-do-import-kinerja').addEventListener('click', async () => {
      await _doImportKinerja(valid, fileName);
    });
  }
}

async function _doImportKinerja(valid, fileName) {
  document.getElementById('btn-do-import-kinerja').disabled = true;
  const progressEl = document.getElementById('kinerja-progress');
  const progressText = document.getElementById('kinerja-progress-text');
  progressEl.classList.remove('hidden');

  const profile = getState('auth.profile');

  try {
    progressText.textContent = 'Menghapus data lama…';
    await clearKinerjaInstansi();

    progressText.textContent = 'Mengimport data baru…';
    const { imported } = await batchImportKinerja(valid, fileName, profile?.email ?? 'admin');
    showToast(`${imported} BUMD berhasil diimport.`, 'success');
    await _renderKinerjaTab();
  } catch (err) {
    showToast('Import gagal: ' + err.message, 'error');
    document.getElementById('btn-do-import-kinerja').disabled = false;
    progressEl.classList.add('hidden');
  }
}

// ─── SheetJS loader ───────────────────────────────────────────────────────────

let _XLSX = null;
async function _loadXLSX() {
  if (_XLSX) return _XLSX;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  _XLSX = window.XLSX;
  return _XLSX;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
