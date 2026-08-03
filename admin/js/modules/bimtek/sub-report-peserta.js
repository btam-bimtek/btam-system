// admin/js/modules/bimtek/sub-report-peserta.js
// Laporan peserta: list + preview 4-section + print.

import { getPesertaReportData } from './report-api.js';
import { mapToLabel, generateNarasi, generateNarasiDeskriptif, generateRekomendasi } from './report-narrative.js';
import { kategoriNilai } from './scorer.js';
import { db, doc, getDoc } from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';
import { getAppSetting } from '../settings/api.js';
import { listBimtekScores } from './penilaian-api.js';
import { updateBimtek } from './api.js';
import { showToast } from '../../components/toast.js';
import { buildCertHTML, printCert } from '../../../../shared/certificate.js';

// Chart instances untuk Section C peserta
const _charts = {};

let S = {
  bimtekId:       null,
  bimtek:         null,
  pesertaList:    [],  // [{noPeserta, nama}]
  lembagaSettings: null,
};

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────

export async function renderSubReportPeserta(container, bimtekId, bimtek) {
  S.bimtekId = bimtekId;
  S.bimtek   = bimtek;

  // Load settings lembaga + peserta names + lulus status secara parallel
  const ids = bimtek.pesertaIds ?? [];
  const [snaps, lembaga, scores] = await Promise.all([
    Promise.all(ids.map(id => getDoc(doc(db, COL.PESERTA_MASTER, id)))),
    getAppSetting('lembaga').catch(() => null),
    listBimtekScores(bimtekId).catch(() => [])
  ]);

  const lulusMap = {};
  scores.forEach(s => { lulusMap[s.noPeserta] = s.lulus; });

  S.lembagaSettings = lembaga;
  S.pesertaList = snaps
    .map((snap, i) => ({
      noPeserta: ids[i],
      nama:  snap.exists() ? (snap.data().nama  ?? ids[i]) : ids[i],
      lulus: lulusMap[ids[i]] ?? false,
      _deleted: snap.exists() && !!snap.data().deleted
    }))
    .filter(p => !p._deleted);

  _renderList(container);
}

// ─── DAFTAR PESERTA ───────────────────────────────────────────────────────────

function _renderList(container) {
  if (S.pesertaList.length === 0) {
    container.innerHTML = `
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
        <p class="text-gray-400 text-sm">Belum ada peserta terdaftar di bimtek ini.</p>
      </div>`;
    return;
  }

  const rows = S.pesertaList.map((p, i) => `
    <tr>
      <td class="text-center">
        <input type="checkbox" class="chk-peserta accent-indigo-500 w-3.5 h-3.5"
          data-nopeserta="${_esc(p.noPeserta)}" data-nama="${_esc(p.nama)}">
      </td>
      <td>
        <div class="text-sm text-white font-medium">${_esc(p.nama)}</div>
        <div class="text-xs text-gray-500">${_esc(p.noPeserta)}</div>
      </td>
      <td class="text-right">
        <button class="btn-preview-peserta text-xs px-3 py-1.5 rounded-lg bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors mr-1"
          data-nopeserta="${_esc(p.noPeserta)}">
          Preview
        </button>
        <button class="btn-print-peserta text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors mr-1"
          data-nopeserta="${_esc(p.noPeserta)}">
          Print
        </button>
        <button class="btn-docx-peserta text-xs px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white transition-colors mr-1"
          data-nopeserta="${_esc(p.noPeserta)}">
          docx
        </button>
        ${p.lulus
          ? `<button class="btn-cert-peserta text-xs px-3 py-1.5 rounded-lg bg-yellow-700 hover:bg-yellow-600 text-white transition-colors"
               data-nopeserta="${_esc(p.noPeserta)}">Sertifikat</button>`
          : `<button class="btn-surat-ket-peserta text-xs px-3 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-700 text-white transition-colors"
               data-nopeserta="${_esc(p.noPeserta)}">Surat Keterangan</button>`
        }
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <div id="peserta-list-section">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div class="text-xs text-gray-400">${S.pesertaList.length} peserta · Klik Preview untuk melihat, Print untuk cetak</div>
        <button id="btn-docx-terpilih" class="text-xs px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white transition-colors flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Download Terpilih (.docx)
        </button>
      </div>
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-3 mb-3 flex items-center gap-2 flex-wrap">
        <label class="text-xs text-gray-400 shrink-0" for="input-no-sertifikat-bimtek">Nomor Sertifikat (berlaku untuk semua peserta bimtek ini)</label>
        <input id="input-no-sertifikat-bimtek" type="text" value="${_esc(S.bimtek?.noSertifikat ?? '')}"
          placeholder="Isi manual, mis. 123/BTAM/2026"
          class="form-input text-sm flex-1 min-w-40" style="max-width:260px">
        <button id="btn-save-no-sertifikat-bimtek" class="px-3 py-1.5 text-sm rounded-lg bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
          Simpan
        </button>
      </div>
      <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table class="btam-table">
          <thead>
            <tr>
              <th class="text-center w-8">
                <input type="checkbox" id="chk-all" class="accent-indigo-500 w-3.5 h-3.5">
              </th>
              <th>Peserta</th>
              <th class="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <!-- Preview panel (hidden by default) -->
    <div id="report-preview-panel" class="hidden mt-6"></div>
  `;

  // Bind nomor sertifikat (per bimtek)
  container.querySelector('#btn-save-no-sertifikat-bimtek')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-save-no-sertifikat-bimtek');
    const val = container.querySelector('#input-no-sertifikat-bimtek').value;
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    try {
      await updateBimtek(S.bimtekId, { noSertifikat: val?.trim() || null });
      S.bimtek.noSertifikat = val?.trim() || null;
      showToast('Nomor sertifikat disimpan', 'success');
    } catch (err) {
      showToast('Gagal simpan: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  });

  // Bind preview buttons
  container.querySelectorAll('.btn-preview-peserta').forEach(btn => {
    btn.addEventListener('click', () => {
      const noPeserta = btn.dataset.nopeserta;
      _loadAndShowPreview(container, noPeserta, false);
    });
  });

  // Bind print buttons
  container.querySelectorAll('.btn-print-peserta').forEach(btn => {
    btn.addEventListener('click', () => {
      const noPeserta = btn.dataset.nopeserta;
      _loadAndShowPreview(container, noPeserta, true);
    });
  });

  // Bind sertifikat buttons
  container.querySelectorAll('.btn-cert-peserta').forEach(btn => {
    btn.addEventListener('click', () => _loadAndShowCert(container, btn.dataset.nopeserta));
  });

  // Bind surat keterangan buttons
  container.querySelectorAll('.btn-surat-ket-peserta').forEach(btn => {
    btn.addEventListener('click', () => _loadAndShowSuratKeterangan(container, btn.dataset.nopeserta));
  });

  // Checkbox select-all
  container.querySelector('#chk-all')?.addEventListener('change', e => {
    container.querySelectorAll('.chk-peserta').forEach(c => { c.checked = e.target.checked; });
  });

  // Bind docx per-peserta
  container.querySelectorAll('.btn-docx-peserta').forEach(btn => {
    btn.addEventListener('click', () => _downloadDocxSingle(btn, btn.dataset.nopeserta));
  });

  // Bind download terpilih
  container.querySelector('#btn-docx-terpilih')?.addEventListener('click', () => _downloadDocxTerpilih(container));
}

// ─── LOAD & SHOW PREVIEW ─────────────────────────────────────────────────────

async function _loadAndShowPreview(container, noPeserta, autoPrint) {
  const panel = container.querySelector('#report-preview-panel');
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="flex items-center gap-3 py-8 justify-center">
      <div class="w-5 h-5 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin"></div>
      <span class="text-gray-400 text-sm">Memuat laporan…</span>
    </div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const data = await getPesertaReportData(S.bimtekId, noPeserta, S.bimtek);
    _showPreview(container, panel, data, autoPrint);
  } catch (err) {
    panel.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat laporan: ${err.message}</div>`;
    console.error(err);
  }
}

function _showPreview(container, panel, data, autoPrint) {
  _destroyAllCharts();

  const html = _buildReportHTML(data);

  panel.classList.remove('hidden');
  panel.innerHTML = `
    <!-- Controls (no-print) -->
    <div class="flex items-center justify-between mb-4 no-print">
      <h3 class="font-semibold text-white">Preview Laporan — ${_esc(data.peserta?.nama ?? '')}</h3>
      <div class="flex gap-2">
        <button id="btn-do-print" class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          Print PDF
        </button>
        <button id="btn-close-preview" class="px-3 py-1.5 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors">Tutup</button>
      </div>
    </div>

    <!-- Report content (print target) -->
    <div id="report-doc" class="report-doc bg-white text-gray-900 rounded-xl overflow-hidden shadow-xl">
      ${html}
    </div>
  `;

  // Sembunyikan list saat preview terbuka (supaya tidak ikut terprint)
  const listSection = container.querySelector('#peserta-list-section');
  if (listSection) listSection.classList.add('no-print');

  panel.querySelector('#btn-do-print').addEventListener('click', () => _doPrint());
  panel.querySelector('#btn-close-preview').addEventListener('click', () => {
    _destroyAllCharts();
    panel.innerHTML = '';
    panel.classList.add('hidden');
    if (listSection) listSection.classList.remove('no-print');
  });

  // Init Section C charts setelah DOM ready
  requestAnimationFrame(() => {
    _initSectionCChart(data);
    _initSectionCEKChart(data);
    if (autoPrint) {
      // Tunggu lebih lama karena ada 2 chart yang perlu render
      setTimeout(() => _doPrint(), 700);
    }
  });
}

function _doPrint() {
  window.print();
}

// ─── DOCX EXPORT ──────────────────────────────────────────────────────────────

function _loadHtmlDocx() {
  if (window.htmlDocx) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s   = document.createElement('script');
    s.src     = 'https://unpkg.com/html-docx-js/dist/html-docx.js';
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Gagal memuat library html-docx-js'));
    document.head.appendChild(s);
  });
}

async function _imageToBase64(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function _downloadDocxSingle(btnEl, noPeserta) {
  const orig = btnEl.textContent;
  btnEl.disabled = true; btnEl.textContent = '…';
  try {
    await _loadHtmlDocx();
    const data   = await getPesertaReportData(S.bimtekId, noPeserta, S.bimtek);
    const kopB64 = await _getKopBase64();
    const docHtml = _buildDocxFullHtml([data], kopB64);
    const blob    = window.htmlDocx.asBlob(docHtml, {
      orientation: 'portrait',
      margins: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
    });
    _triggerDownload(blob, `laporan-${noPeserta}.docx`);
  } catch (err) {
    alert('Gagal membuat docx: ' + err.message);
  } finally {
    btnEl.disabled = false; btnEl.textContent = orig;
  }
}

async function _downloadDocxTerpilih(container) {
  const checked = [...container.querySelectorAll('.chk-peserta:checked')];
  if (!checked.length) { alert('Pilih minimal satu peserta terlebih dahulu.'); return; }

  const btn  = container.querySelector('#btn-docx-terpilih');
  const orig = btn.textContent;
  btn.disabled = true;

  try {
    await _loadHtmlDocx();
    const kopB64 = await _getKopBase64();
    const allData = [];
    for (let i = 0; i < checked.length; i++) {
      btn.textContent = `Memuat ${i + 1}/${checked.length}…`;
      const data = await getPesertaReportData(S.bimtekId, checked[i].dataset.nopeserta, S.bimtek);
      allData.push(data);
    }
    btn.textContent = 'Menyiapkan docx…';
    const docHtml = _buildDocxFullHtml(allData, kopB64);
    const blob    = window.htmlDocx.asBlob(docHtml, {
      orientation: 'portrait',
      margins: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
    });
    const nama = (S.bimtek?.nama ?? 'bimtek').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    _triggerDownload(blob, `laporan-peserta-${nama}.docx`);
  } catch (err) {
    alert('Gagal membuat docx: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

let _kopBase64Cache = null;
async function _getKopBase64() {
  if (_kopBase64Cache) return _kopBase64Cache;
  const fallback = window.location.origin + '/shared/assets/kop_btam.png';
  const url = S.lembagaSettings?.logoUrl || fallback;
  _kopBase64Cache = await _imageToBase64(url);
  // Jika URL settings gagal, coba fallback lokal
  if (!_kopBase64Cache && url !== fallback) {
    _kopBase64Cache = await _imageToBase64(fallback);
  }
  return _kopBase64Cache;
}

function _triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function _buildDocxFullHtml(dataList, kopBase64) {
  const pages = dataList.map((data, idx) => {
    const isLast = idx === dataList.length - 1;
    const pageBreak = isLast ? '' : '<p style="page-break-after:always;"></p>';
    return _buildDocxPageHtml(data, kopBase64) + pageBreak;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; color: #000000; margin: 0; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { font-size: 11pt; vertical-align: top; padding: 5pt 8pt; }
  p { margin: 0 0 6pt 0; }
</style>
</head>
<body>${pages}</body>
</html>`;
}

function _buildDocxPageHtml(data, kopBase64) {
  const { peserta, scores, kehadiranDetail, ekComparison, thresholds } = data;
  const b   = S.bimtek;
  const kkm = b.kkm ?? 60;

  const TD  = 'style="padding:4pt 6pt;border:1px solid #000000;"';
  const TDC = 'style="padding:4pt 6pt;border:1px solid #000000;text-align:center;"';
  const TH  = 'style="padding:4pt 6pt;border:1px solid #000000;font-weight:bold;text-align:left;"';

  const fl = (label, val) => val
    ? `<tr>
         <td style="width:38mm;padding:2pt 0;vertical-align:top;">${label}</td>
         <td style="width:6mm;padding:2pt 3pt;vertical-align:top;">:</td>
         <td style="padding:2pt 0;">${_esc(val)}</td>
       </tr>`
    : '';

  // ── Kop Surat ──
  const kopImg = kopBase64
    ? `<img src="${kopBase64}" style="width:17cm;height:auto;display:block;" />`
    : `<div style="text-align:center;font-size:14pt;font-weight:bold;padding:8pt 0;border:1px solid #000000;">BALAI TEKNIK AIR MINUM</div>`;

  // ── Judul ──
  const judul = `
    <div style="text-align:center;margin:14pt 0 16pt;">
      <div style="font-size:14pt;font-weight:bold;text-transform:uppercase;">LAPORAN HASIL PEMBELAJARAN</div>
      <div style="font-size:11pt;margin-top:4pt;">Bimbingan Teknis ${_esc(b.tipe === 'pnbp' ? 'PNBP' : 'Reguler')}</div>
    </div>`;

  // ── Section A ──
  const sectionA = `
    <div style="font-size:12pt;font-weight:bold;margin:0 0 8pt;">A. Identitas</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:14pt;">
      <tr><th ${TH} colspan="3">Identitas Peserta</th></tr>
      ${fl('Nama',         peserta?.nama)}
      ${fl('Jabatan',      peserta?.jabatan)}
      ${fl('Instansi',     peserta?.instansi)}
      ${fl('Provinsi',     peserta?.provinsi)}
      <tr><th ${TH} colspan="3">Data Kegiatan</th></tr>
      ${fl('Nama Kegiatan', b.nama)}
      ${fl('Tanggal',       `${_fmtDate(b.periode?.mulai)} s.d. ${_fmtDate(b.periode?.selesai)}`)}
      ${fl('Lokasi',        b.lokasi)}
    </table>`;

  // ── Section B ──
  const pre   = scores?.pretest  ?? null;
  const post  = scores?.posttest ?? null;
  const na    = scores?.nilaiAkhir ?? null;
  const lulus = scores?.lulus ?? false;
  const kat   = kategoriNilai(na);

  const nilaiRows = [
    ['Pre Test',    pre,  'Penilaian awal sebelum kegiatan'],
    ['Post Test',   post, 'Penilaian akhir setelah kegiatan'],
    ['Nilai Akhir', na,   'Kategori: Sangat Baik (≥86), Baik (71-85), Cukup (61-70), Kurang (51-60), Sangat Kurang (≤50)'],
  ].map(([lbl, val, ket]) => `
    <tr>
      <td ${TD}>${lbl}</td>
      <td ${TDC}>${val != null ? val : '—'}</td>
      <td ${TD}>${ket}</td>
    </tr>`).join('');

  const kehadiranPct   = kehadiranDetail?.persentase ?? scores?.kehadiran ?? null;
  const kehadiranLabel = kehadiranPct != null ? mapToLabel(kehadiranPct, thresholds.kehadiran) : null;
  const kehadiranFakta = kehadiranDetail
    ? `${kehadiranDetail.hadir} dari ${kehadiranDetail.total} sesi (${kehadiranDetail.persentase}%)`
    : (kehadiranPct != null ? `${kehadiranPct}%` : null);
  const keaktifanLabel = scores?.keaktifan != null ? mapToLabel(scores.keaktifan, thresholds.keaktifan) : null;
  const respekLabel    = scores?.respek    != null ? mapToLabel(scores.respek,    thresholds.respek)    : null;

  const deskRows = [
    ['Kehadiran',      kehadiranLabel, kehadiranFakta],
    ['Keaktifan',      keaktifanLabel, null],
    ['Sikap & Respek', respekLabel,    null],
  ].filter(([, l]) => l).map(([k, l, f]) => `
    <tr>
      <td ${TD}>${k}</td>
      <td ${TD}>${_esc(l)}</td>
      <td ${TD}>${f ? _esc(f) : ''}</td>
    </tr>`).join('');

  const sectionB = `
    <div style="font-size:12pt;font-weight:bold;margin:14pt 0 8pt;">B. Ringkasan Hasil Pembelajaran</div>
    <div style="font-size:11pt;font-weight:bold;margin-bottom:6pt;">B.1 Nilai Kuantitatif</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12pt;">
      <thead>
        <tr>
          <th ${TH} style="width:35%;">Komponen</th>
          <th ${TH} style="width:15%;text-align:center;">Nilai</th>
          <th ${TH}>Keterangan</th>
        </tr>
      </thead>
      <tbody>
        ${nilaiRows}
        <tr>
          <td ${TD} style="padding:4pt 6pt;border:1px solid #000000;font-weight:bold;">Status</td>
          <td ${TDC} style="font-weight:bold;">${kat.kategori.toUpperCase()} (${lulus ? 'LULUS' : 'TIDAK LULUS'})</td>
          <td ${TD}></td>
        </tr>
      </tbody>
    </table>
    <div style="font-size:11pt;font-weight:bold;margin-bottom:6pt;">B.2 Komponen Deskriptif</div>
    ${deskRows
      ? `<table style="width:100%;border-collapse:collapse;margin-bottom:12pt;">
           <thead><tr>
             <th ${TH} style="width:30%;">Komponen</th>
             <th ${TH} style="width:25%;">Kategori</th>
             <th ${TH}>Fakta</th>
           </tr></thead>
           <tbody>${deskRows}</tbody>
         </table>`
      : '<p style="font-size:10pt;">Data komponen deskriptif belum tersedia.</p>'}`;

  // ── Section C ──
  let ekTable = '';
  if (ekComparison?.length) {
    const ekRows = ekComparison.map(ek => {
      const delta = ek.delta != null ? `${ek.delta >= 0 ? '+' : ''}${ek.delta}%` : '—';
      return `<tr>
        <td ${TD}>${_esc(ek.ekNama)}</td>
        <td ${TDC}>${ek.prePct  != null ? ek.prePct  + '%' : '—'}</td>
        <td ${TDC}>${ek.postPct != null ? ek.postPct + '%' : '—'}</td>
        <td ${TDC} style="font-weight:bold;">${delta}</td>
      </tr>`;
    }).join('');
    ekTable = `
      <div style="font-size:11pt;font-weight:bold;margin-bottom:6pt;">C.1 Penguasaan per Unit Kompetensi</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12pt;">
        <thead><tr>
          <th ${TH}>Unit Kompetensi</th>
          <th ${TH} style="text-align:center;">Pre (%)</th>
          <th ${TH} style="text-align:center;">Post (%)</th>
          <th ${TH} style="text-align:center;">Perubahan</th>
        </tr></thead>
        <tbody>${ekRows}</tbody>
      </table>`;
  }

  const narasi      = generateNarasi(ekComparison, pre, post, peserta?.nama, scores?.lulus ?? null, na, kkm);
  const rekomendasi = generateRekomendasi(ekComparison, scores?.lulus ?? null, na, peserta?.nama, kkm);

  const sectionC = `
    <div style="font-size:12pt;font-weight:bold;margin:14pt 0 8pt;">C. Perubahan Kompetensi</div>
    ${ekTable}
    <div style="font-size:11pt;font-weight:bold;margin-bottom:4pt;">C.2 Analisis Kompetensi</div>
    <div style="border:1pt solid #000000;padding:8pt 10pt;line-height:1.6;margin-bottom:12pt;">${narasi}</div>
    <div style="font-size:11pt;font-weight:bold;margin-bottom:4pt;">C.3 Rekomendasi Tindak Lanjut</div>
    <div style="border:1pt solid #000000;padding:8pt 10pt;line-height:1.6;margin-bottom:12pt;">${rekomendasi}</div>`;

  // ── Section D ──
  const tglStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const kota   = b.lokasi?.split(',')[0]?.trim() ?? 'Jakarta';

  const sectionD = `
    <div style="font-size:12pt;font-weight:bold;margin:14pt 0 8pt;">D. Penutup</div>
    <div style="line-height:1.8;margin-bottom:24pt;text-align:justify;">
      Dokumen ini diterbitkan sebagai laporan hasil pembelajaran peserta pada kegiatan bimbingan teknis
      tersebut di atas. Keberatan atau pertanyaan mengenai isi laporan dapat disampaikan kepada
      penyelenggara dalam waktu 7 (tujuh) hari kerja sejak tanggal penerbitan.
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:4pt 0;"></td>
        <td style="width:180pt;text-align:center;padding:4pt 0;">
          <div>${_esc(kota)}, ${tglStr}</div>
          <div style="margin-top:4pt;">Penyelenggara,</div>
          <div style="height:48pt;"></div>
          <div style="border-top:1pt solid #000000;padding-top:4pt;font-style:italic;">Penanggung Jawab Kegiatan</div>
        </td>
      </tr>
    </table>`;

  return `
    <div style="font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000000;line-height:1.5;">
      ${kopImg}
      <div style="border-top:2.5pt solid #000000;margin:8pt 0 3pt;"></div>
      <div style="border-top:1pt solid #000000;margin:0 0 10pt;"></div>
      ${judul}
      ${sectionA}
      ${sectionB}
      ${sectionC}
      ${sectionD}
    </div>`;
}

// ─── REPORT HTML TEMPLATE ─────────────────────────────────────────────────────

function _buildReportHTML(data) {
  const { peserta, scores, kehadiranDetail, pretestResult, posttestResult, ekComparison, hasIncompleteUKData, hasUKBaseline, thresholds } = data;
  const b = S.bimtek;

  return `
    <div class="report-page px-10 py-8 font-serif" style="max-width:800px; margin:0 auto; color:#1a1a1a;">

      <!-- SECTION A: KOP SURAT + IDENTITAS -->
      ${_buildSectionA(peserta, b)}

      <div style="border-top:2px solid #1a1a1a; margin:24px 0;"></div>

      <!-- SECTION B: HASIL PEMBELAJARAN -->
      ${_buildSectionB(scores, kehadiranDetail, thresholds, b)}

      <div style="border-top:1px solid #ccc; margin:24px 0;"></div>

      <!-- SECTION C: PERUBAHAN KOMPETENSI -->
      ${_buildSectionC(scores, pretestResult, posttestResult, ekComparison, peserta, hasIncompleteUKData, hasUKBaseline, b.kkm ?? 60)}

      <div style="border-top:1px solid #ccc; margin:24px 0;"></div>

      <!-- SECTION D: PENUTUP -->
      ${_buildSectionD(b)}

    </div>`;
}

// ── Section A ─────────────────────────────────────────────────────────────────

function _buildSectionA(peserta, b) {
  const fieldLine = (label, value) => value
    ? `<div style="display:flex; gap:8px; margin-bottom:4px;">
         <span style="min-width:130px; color:#555; font-size:13px;">${label}</span>
         <span style="font-size:13px;">: ${_esc(value)}</span>
       </div>`
    : '';

  const ls = S.lembagaSettings;
  const kopUrl = ls?.logoUrl || '../shared/assets/kop_btam.png';

  return `
    <!-- Kop Surat -->
    <div style="margin-bottom:20px;">
      <img src="${_esc(kopUrl)}" alt="Kop Surat" style="width:100%; height:auto; display:block;" />
    </div>

    <div style="text-align:center; margin-bottom:20px;">
      <div style="font-size:15px; font-weight:bold; text-transform:uppercase; letter-spacing:1px; font-family:sans-serif;">
        Laporan Hasil Pembelajaran
      </div>
      <div style="font-size:12px; color:#555; margin-top:4px; font-family:sans-serif;">
        Bimbingan Teknis ${_esc(b.tipe === 'pnbp' ? 'PNBP' : 'Reguler')}
      </div>
    </div>

    <!-- Identitas -->
    <div style="background:#f8f9fa; border-radius:8px; padding:16px; margin-bottom:0;">
      <div style="font-size:13px; font-weight:600; margin-bottom:12px; font-family:sans-serif;">Identitas Peserta</div>
      ${fieldLine('Nama', peserta?.nama)}
      ${peserta?.jabatan   ? fieldLine('Jabatan', peserta.jabatan)   : ''}
      ${peserta?.instansi  ? fieldLine('Instansi', peserta.instansi) : ''}
      ${peserta?.provinsi  ? fieldLine('Provinsi', peserta.provinsi) : ''}

      <div style="margin-top:12px; padding-top:12px; border-top:1px solid #ddd;">
        <div style="font-size:13px; font-weight:600; margin-bottom:8px; font-family:sans-serif;">Data Kegiatan</div>
        ${fieldLine('Nama Kegiatan', b.nama)}
        ${fieldLine('Tanggal', `${_fmtDate(b.periode?.mulai)} – ${_fmtDate(b.periode?.selesai)}`)}
        ${fieldLine('Lokasi', b.lokasi)}
      </div>
    </div>`;
}

// ── Section B ─────────────────────────────────────────────────────────────────

function _buildSectionB(scores, kehadiranDetail, thresholds, b) {
  const pre  = scores?.pretest  ?? null;
  const post = scores?.posttest ?? null;
  const na   = scores?.nilaiAkhir ?? null;
  const lulus = scores?.lulus ?? false;
  const kat  = kategoriNilai(na);

  // B.1 — Nilai kuantitatif
  const nilaiRows = [
    { label: 'Pre Test',    nilai: pre,  ket: 'Penilaian awal sebelum kegiatan' },
    { label: 'Post Test',   nilai: post, ket: 'Penilaian akhir setelah kegiatan' },
    { label: 'Nilai Akhir', nilai: na,   ket: 'Sangat Baik ≥86 · Baik 71-85 · Cukup 61-70 · Kurang 51-60 · Sangat Kurang ≤50', bold: true },
  ];

  const nilaiTableRows = nilaiRows.map(r => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:8px 12px; font-size:13px; ${r.bold ? 'font-weight:700;' : ''}">${r.label}</td>
      <td style="padding:8px 12px; font-size:13px; text-align:center; font-weight:${r.bold ? '700' : '400'};">
        ${r.nilai != null ? r.nilai : '<span style="color:#999;">—</span>'}
      </td>
      <td style="padding:8px 12px; font-size:12px; color:#666;">${r.ket}</td>
    </tr>`).join('');

  const statusRow = `
    <tr>
      <td style="padding:8px 12px; font-size:13px; font-weight:700;">Status</td>
      <td style="padding:8px 12px; text-align:center;">
        <span style="background:${lulus ? '#dcfce7' : '#fee2e2'}; color:${lulus ? '#166534' : '#991b1b'};
          padding:2px 12px; border-radius:999px; font-size:12px; font-weight:600;">
          ${kat.kategori.toUpperCase()} (${lulus ? 'LULUS' : 'TIDAK LULUS'})
        </span>
      </td>
      <td></td>
    </tr>`;

  // B.2 — Deskriptif
  const kehadiranPct  = scores?.kehadiran ?? null;
  const kehadiranAttPct = kehadiranDetail?.persentase ?? kehadiranPct;
  const kehadiran_label = kehadiranAttPct != null ? mapToLabel(kehadiranAttPct, thresholds.kehadiran) : null;
  const kehadiranFakta = kehadiranDetail
    ? `${kehadiranDetail.hadir} dari ${kehadiranDetail.total} sesi (${kehadiranDetail.persentase}%)`
    : (kehadiranPct != null ? `${kehadiranPct}%` : null);

  const keaktifanLabel = scores?.keaktifan != null ? mapToLabel(scores.keaktifan, thresholds.keaktifan) : null;
  const respekLabel    = scores?.respek    != null ? mapToLabel(scores.respek,    thresholds.respek)    : null;

  const deskriptifItem = (icon, komponenLabel, komponenKey, label, nilaiRaw, fakta) => {
    if (!label) return '';
    const narasi = generateNarasiDeskriptif(komponenKey, label, nilaiRaw, fakta);
    return `
      <div style="padding:14px 0; border-bottom:1px solid #f0f0f0;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <span style="font-size:16px;">${icon}</span>
          <span style="font-size:13px; font-weight:700; color:#1a1a1a;">${komponenLabel}</span>
          <span style="background:#e0f2fe; color:#0369a1; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:600;">${_esc(label)}</span>
        </div>
        <div style="font-size:12.5px; color:#374151; line-height:1.75; padding-left:24px;">
          ${narasi}
        </div>
      </div>`;
  };

  const tidakLulusAlasan = !lulus && na != null
    ? (kat.lulus ? 'kehadiran' : 'nilai')
    : null;
  const tidakLulusMsg = tidakLulusAlasan ? `
    <div style="background:#fef3c7; border-left:4px solid #f59e0b; border-radius:0 4px 4px 0; padding:12px 16px; margin-top:16px; font-size:12px; color:#78350f; line-height:1.6;">
      ${tidakLulusAlasan === 'kehadiran'
        ? `Nilai akhir yang diperoleh (${na}) berkategori "${kat.kategori}" dan telah memenuhi syarat nilai kelulusan, namun kehadiran peserta tidak memenuhi syarat minimum 90% yang ditetapkan.`
        : `Nilai akhir yang diperoleh (${na}) berkategori "${kat.kategori}" — belum mencapai kategori minimum kelulusan (Cukup, ≥61).`
      }
    </div>` : '';

  return `
    <div style="font-size:15px; font-weight:bold; margin-bottom:16px; font-family:sans-serif;">
      B. Ringkasan Hasil Pembelajaran
    </div>

    <!-- B.1 -->
    <div style="font-size:13px; font-weight:600; color:#444; margin-bottom:8px; font-family:sans-serif;">
      B.1 Nilai Kuantitatif
    </div>
    <table style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-bottom:20px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px; text-align:left; font-size:12px; font-weight:600; color:#374151;">Komponen</th>
          <th style="padding:8px 12px; text-align:center; font-size:12px; font-weight:600; color:#374151;">Nilai</th>
          <th style="padding:8px 12px; text-align:left; font-size:12px; font-weight:600; color:#374151;">Keterangan</th>
        </tr>
      </thead>
      <tbody>
        ${nilaiTableRows}
        ${statusRow}
      </tbody>
    </table>

    ${tidakLulusMsg}

    <!-- B.2 -->
    <div style="font-size:13px; font-weight:600; color:#444; margin-bottom:8px; margin-top:${!lulus && na != null ? '20px' : '0'}; font-family:sans-serif;">
      B.2 Komponen Deskriptif
    </div>
    <div style="background:#f8f9fa; border-radius:8px; padding:12px 16px;">
      ${deskriptifItem('📅', 'Kehadiran',     'kehadiran', kehadiran_label, kehadiranAttPct, kehadiranFakta)}
      ${deskriptifItem('💬', 'Keaktifan',     'keaktifan', keaktifanLabel,  scores?.keaktifan ?? null, null)}
      ${deskriptifItem('🤝', 'Sikap & Respek','respek',    respekLabel,     scores?.respek    ?? null, null)}
      ${!kehadiran_label && !keaktifanLabel && !respekLabel
        ? '<div style="color:#999; font-size:12px; text-align:center; padding:8px;">Data komponen deskriptif belum tersedia.</div>'
        : ''}
    </div>`;
}

// ── Section C ─────────────────────────────────────────────────────────────────

function _buildSectionC(scores, pretestResult, posttestResult, ekComparison, peserta, hasIncompleteUKData, hasUKBaseline, kkm = 60) {
  const pre  = scores?.pretest  ?? null;
  const post = scores?.posttest ?? null;

  // Edge case: tidak ada data pre/post sama sekali
  if (pre == null && post == null && (!ekComparison || ekComparison.length === 0)) {
    return `
      <div style="font-size:15px; font-weight:bold; margin-bottom:16px; font-family:sans-serif;">
        C. Perubahan Kompetensi
      </div>
      <div style="background:#f8f9fa; border-radius:8px; padding:20px; text-align:center; color:#666; font-size:13px;">
        Data tidak lengkap — Hasil pre test dan post test belum tersedia untuk peserta ini.
      </div>`;
  }

  // C.1 — Total pre/post comparison (canvas chart)
  const chartSection = (pre != null || post != null) ? `
    <div style="font-size:13px; font-weight:600; color:#444; margin-bottom:12px; font-family:sans-serif;">
      C.1 Perbandingan Pre Test vs Post Test
    </div>
    <div style="display:flex; align-items:center; gap:24px; margin-bottom:20px;">
      ${_barBlock('Pre Test', pre, '#6b7280')}
      ${_barBlock('Post Test', post, '#2563eb')}
      ${pre != null && post != null ? `
        <div style="font-size:13px; color:${post >= pre ? '#166534' : '#991b1b'}; font-weight:600; margin-left:8px;">
          ${post >= pre ? '▲' : '▼'} ${Math.abs(post - pre)} poin
        </div>` : ''}
    </div>
    <div style="position:relative; height:180px; margin-bottom:20px;">
      <canvas id="report-chart-prepost" width="400" height="180"></canvas>
    </div>` : '';

  // C.2 — Grouped bar chart per-UK
  let ekChartSection = '';
  if (ekComparison && ekComparison.length > 0) {
    const chartH = Math.max(160, ekComparison.length * 36);
    ekChartSection = `
      <div style="font-size:13px; font-weight:600; color:#444; margin-bottom:10px; font-family:sans-serif;">
        C.2 Penguasaan per Unit Kompetensi
      </div>
      <div style="position:relative; margin-bottom:20px; height:${chartH}px;">
        <canvas id="report-chart-ek" height="${chartH}"></canvas>
      </div>`;
  }

  // C.3 — Tabel per UK
  let ekTableSection = '';
  if (ekComparison && ekComparison.length > 0) {
    const ekRows = ekComparison.map(ek => {
      const deltaStr = ek.delta != null
        ? `<span style="color:${ek.delta >= 0 ? '#166534' : '#991b1b'}; font-weight:600;">${ek.delta >= 0 ? '+' : ''}${ek.delta}%</span>`
        : '—';
      return `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:7px 10px; font-size:12px;">${_esc(ek.ekNama)}</td>
          <td style="padding:7px 10px; font-size:12px; text-align:center;">${ek.prePct  != null ? ek.prePct  + '%' : '—'}</td>
          <td style="padding:7px 10px; font-size:12px; text-align:center;">${ek.postPct != null ? ek.postPct + '%' : '—'}</td>
          <td style="padding:7px 10px; font-size:12px; text-align:center;">${deltaStr}</td>
        </tr>`;
    }).join('');

    ekTableSection = `
      <div style="font-size:13px; font-weight:600; color:#444; margin-bottom:8px; font-family:sans-serif;">
        C.3 Rincian per Unit Kompetensi
      </div>
      <table style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-bottom:20px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:7px 10px; text-align:left; font-size:12px; font-weight:600; color:#374151;">Unit Kompetensi</th>
            <th style="padding:7px 10px; text-align:center; font-size:12px; font-weight:600; color:#374151;">Pre</th>
            <th style="padding:7px 10px; text-align:center; font-size:12px; font-weight:600; color:#374151;">Post</th>
            <th style="padding:7px 10px; text-align:center; font-size:12px; font-weight:600; color:#374151;">Δ</th>
          </tr>
        </thead>
        <tbody>${ekRows}</tbody>
      </table>`;
  }

  // C.4 — Analisis Kompetensi
  const narasi = generateNarasi(ekComparison, pre, post, peserta?.nama, scores?.lulus ?? null, scores?.nilaiAkhir ?? null, kkm);
  const narasiSection = `
    <div style="font-size:13px; font-weight:600; color:#444; margin-bottom:8px; font-family:sans-serif;">
      C.4 Analisis Kompetensi
    </div>
    <div style="background:#f0f7ff; border-left:4px solid #2563eb; padding:14px 16px; border-radius:0 8px 8px 0; font-size:13px; color:#1e3a5f; line-height:1.7; margin-bottom:20px;">
      ${narasi}
    </div>`;

  // C.5 — Rekomendasi Tindak Lanjut
  const rekomendasi = generateRekomendasi(ekComparison, scores?.lulus ?? null, scores?.nilaiAkhir ?? null, peserta?.nama, kkm);
  const rekomendasiSection = `
    <div style="font-size:13px; font-weight:600; color:#444; margin-bottom:8px; font-family:sans-serif;">
      C.5 Rekomendasi Tindak Lanjut
    </div>
    <div style="background:#fffbeb; border-left:4px solid #d97706; padding:14px 16px; border-radius:0 8px 8px 0; font-size:13px; color:#78350f; line-height:1.7;">
      ${rekomendasi}
    </div>`;

  // Warning: soal tanpa unitKompetensi → data per-UK mungkin tidak lengkap
  const incompleteWarning = (hasUKBaseline && hasIncompleteUKData) ? `
    <div style="background:#fffbeb; border:1px solid #fcd34d; border-radius:8px; padding:10px 14px;
                margin-bottom:16px; display:flex; align-items:flex-start; gap:10px;">
      <span style="font-size:16px; line-height:1;">⚠️</span>
      <div style="font-size:12px; color:#78350f; line-height:1.6;">
        <strong>Catatan:</strong> Sebagian soal ujian belum ditetapkan Unit Kompetensinya.
        Data per-UK pada bagian C.2 dan C.3 mungkin tidak mencakup seluruh hasil ujian.
        Untuk laporan yang lebih akurat, pastikan setiap soal di Bank Soal sudah memiliki UK yang sesuai.
      </div>
    </div>` : '';

  return `
    <div style="font-size:15px; font-weight:bold; margin-bottom:16px; font-family:sans-serif;">
      C. Perubahan Kompetensi
    </div>
    ${incompleteWarning}
    ${chartSection}
    ${ekChartSection}
    ${ekTableSection}
    ${narasiSection}
    ${rekomendasiSection}`;
}

// ── Section D ─────────────────────────────────────────────────────────────────

function _buildSectionD(b) {
  const today   = new Date();
  const tglStr  = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const kota    = b.lokasi?.split(',')[0]?.trim() ?? 'Jakarta';

  return `
    <div style="font-size:15px; font-weight:bold; margin-bottom:16px; font-family:sans-serif;">
      D. Penutup
    </div>
    <div style="font-size:13px; color:#374151; line-height:1.8; margin-bottom:24px;">
      Dokumen ini diterbitkan sebagai laporan hasil pembelajaran peserta pada kegiatan bimbingan teknis
      tersebut di atas. Keberatan atau pertanyaan mengenai isi laporan dapat disampaikan kepada
      penyelenggara dalam waktu 7 (tujuh) hari kerja sejak tanggal penerbitan.
    </div>
    <div style="display:flex; justify-content:flex-end;">
      <div style="text-align:center; min-width:200px;">
        <div style="font-size:13px; color:#374151;">${_esc(kota)}, ${tglStr}</div>
        <div style="font-size:13px; color:#374151; margin-top:4px;">Penyelenggara,</div>
        <div style="margin:40px 0 8px; border-bottom:1px solid #374151;"></div>
        <div style="font-size:12px; color:#6b7280; font-style:italic;">Penanggung Jawab Kegiatan</div>
      </div>
    </div>`;
}

// ─── CHART SECTION C ─────────────────────────────────────────────────────────

function _initSectionCChart(data) {
  const canvas = document.getElementById('report-chart-prepost');
  if (!canvas || !window.Chart) return;

  const pre  = data.scores?.pretest  ?? 0;
  const post = data.scores?.posttest ?? 0;

  if (data.scores?.pretest == null && data.scores?.posttest == null) return;

  _destroyChart('prepost-peserta');
  _charts['prepost-peserta'] = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Pre Test', 'Post Test'],
      datasets: [{
        data: [pre, post],
        backgroundColor: ['#9ca3af', '#3b82f6'],
        borderRadius: 6,
        borderWidth: 0
      }]
    },
    options: {
      responsive: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` Nilai: ${ctx.raw}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#374151', font: { size: 12 } } },
        y: {
          grid: { color: '#e5e7eb' },
          ticks: { color: '#374151', stepSize: 20 },
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}

function _initSectionCEKChart(data) {
  const canvas = document.getElementById('report-chart-ek');
  if (!canvas || !window.Chart) return;

  const ek = data.ekComparison;
  if (!ek || ek.length === 0) return;

  const chartH = Math.max(160, ek.length * 36);
  canvas.height = chartH;

  _destroyChart('ek-peserta');
  _charts['ek-peserta'] = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: ek.map(e => e.ekNama),
      datasets: [
        {
          label: 'Pre Test',
          data: ek.map(e => e.prePct),
          backgroundColor: '#9ca3af80',
          borderColor: '#9ca3af',
          borderWidth: 1,
          borderRadius: 3
        },
        {
          label: 'Post Test',
          data: ek.map(e => e.postPct),
          backgroundColor: '#3b82f680',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 3
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#374151', font: { size: 11 }, padding: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw ?? '—'}%` } }
      },
      scales: {
        x: {
          min: 0, max: 100,
          grid: { color: '#e5e7eb' },
          ticks: { color: '#374151', callback: v => v + '%' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#374151', font: { size: 11 } }
        }
      }
    }
  });
}

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

function _barBlock(label, value, color) {
  const pct = value ?? 0;
  return `
    <div style="text-align:center; min-width:80px;">
      <div style="font-size:24px; font-weight:700; color:${color};">${value != null ? value : '—'}</div>
      <div style="font-size:11px; color:#666; margin-top:2px;">${label}</div>
      <div style="height:6px; background:#e5e7eb; border-radius:3px; margin-top:6px; width:80px;">
        <div style="height:100%; width:${pct}%; background:${color}; border-radius:3px; transition:width 0.3s;"></div>
      </div>
    </div>`;
}

function _destroyChart(key) {
  if (_charts[key]) {
    _charts[key].destroy();
    delete _charts[key];
  }
}

function _destroyAllCharts() {
  Object.keys(_charts).forEach(_destroyChart);
}

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _fmtDate(ts) {
  if (!ts) return '-';
  const d = ts?.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── SERTIFIKAT ───────────────────────────────────────────────────────────────

async function _loadAndShowCert(container, noPeserta) {
  const panel = container.querySelector('#report-preview-panel');
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="flex items-center gap-3 py-8 justify-center">
      <div class="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-gray-400 text-sm">Menyiapkan sertifikat…</span>
    </div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const data = await getPesertaReportData(S.bimtekId, noPeserta, S.bimtek);
    _showCert(container, panel, data);
  } catch (err) {
    panel.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat data: ${err.message}</div>`;
  }
}

function _showCert(container, panel, data) {
  const listSection = container.querySelector('#peserta-list-section');
  const html = buildCertHTML(data, S.bimtek, S.lembagaSettings);

  panel.innerHTML = `
    <div class="flex items-center justify-between mb-4 no-print">
      <h3 class="font-semibold text-white">Sertifikat — ${_esc(data.peserta?.nama ?? '')}</h3>
      <div class="flex gap-2">
        <button id="btn-print-cert" class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-yellow-700 hover:bg-yellow-600 text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          Cetak Sertifikat
        </button>
        <button id="btn-close-cert" class="px-3 py-1.5 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors">Tutup</button>
      </div>
    </div>
    <div id="cert-doc" class="cert-doc">${html}</div>
  `;

  if (listSection) listSection.classList.add('no-print');

  panel.querySelector('#btn-print-cert').addEventListener('click', () => printCert());
  panel.querySelector('#btn-close-cert').addEventListener('click', () => {
    panel.innerHTML = '';
    panel.classList.add('hidden');
    if (listSection) listSection.classList.remove('no-print');
  });
}

// ─── SURAT KETERANGAN ────────────────────────────────────────────────────────

async function _loadAndShowSuratKeterangan(container, noPeserta) {
  const panel = container.querySelector('#report-preview-panel');
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="flex items-center gap-3 py-8 justify-center">
      <div class="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-gray-400 text-sm">Memuat surat keterangan…</span>
    </div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const data = await getPesertaReportData(S.bimtekId, noPeserta, S.bimtek);
    const html = _buildSuratKeteranganHTML(data);
    const listSection = container.querySelector('#peserta-list-section');

    panel.innerHTML = `
      <div class="flex items-center justify-between mb-4 no-print">
        <h3 class="font-semibold text-white">Surat Keterangan — ${_esc(data.peserta?.nama ?? '')}</h3>
        <div class="flex gap-2">
          <button id="btn-print-surat-ket" class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-teal-700 hover:bg-teal-600 text-white transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Cetak Surat Keterangan
          </button>
          <button id="btn-close-surat-ket" class="px-3 py-1.5 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors">Tutup</button>
        </div>
      </div>
      <div id="surat-ket-doc">${html}</div>
    `;

    if (listSection) listSection.classList.add('no-print');

    panel.querySelector('#btn-print-surat-ket').addEventListener('click', () => _printSuratKeterangan());
    panel.querySelector('#btn-close-surat-ket').addEventListener('click', () => {
      panel.innerHTML = '';
      panel.classList.add('hidden');
      if (listSection) listSection.classList.remove('no-print');
    });
  } catch (err) {
    panel.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat: ${err.message}</div>`;
  }
}

function _buildSuratKeteranganHTML(data) {
  const { peserta } = data;
  const b       = S.bimtek;
  const lembaga = S.lembagaSettings ?? {};
  const kopUrl  = lembaga.logoUrl || '../shared/assets/kop_btam.png';

  const periodeStr = (() => {
    const fmt = ts => {
      if (!ts) return '';
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    };
    const m = fmt(b.periode?.mulai);
    const s = fmt(b.periode?.selesai);
    return m && s ? `${m} s.d. ${s}` : (m || s || '-');
  })();

  const tglCetak  = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const kota      = lembaga.kota || lembaga.lokasi || 'Bekasi';
  const namaLemb  = lembaga.nama || 'Balai Teknik Air Minum';
  const lokasi    = b.lokasi || '-';

  const fieldRow = (label, value) => value ? `
    <tr>
      <td style="padding:3px 0; font-size:13px; width:160px; vertical-align:top;">${label}</td>
      <td style="padding:3px 0; font-size:13px; width:12px;">:</td>
      <td style="padding:3px 0; font-size:13px;">${_esc(value)}</td>
    </tr>` : '';

  return `
    <div style="
      width:210mm; min-height:297mm;
      padding:0 20mm 20mm 20mm;
      font-family:'Times New Roman',Georgia,serif;
      color:#1a1a1a;
      background:#fff;
      box-sizing:border-box;
    ">
      <!-- Kop Surat -->
      <div style="margin-bottom:0;">
        <img src="${_esc(kopUrl)}" alt="Kop Surat" style="width:100%;height:auto;display:block;">
      </div>
      <div style="border-top:3px solid #1a1a1a; border-bottom:1px solid #1a1a1a; margin-bottom:24px;"></div>

      <!-- Judul -->
      <div style="text-align:center; margin-bottom:24px;">
        <div style="font-size:16px; font-weight:bold; letter-spacing:3px; text-decoration:underline; text-transform:uppercase;">
          SURAT KETERANGAN
        </div>
      </div>

      <!-- Pembuka -->
      <div style="font-size:13px; line-height:1.8; margin-bottom:16px;">
        Yang bertanda tangan di bawah ini, Kepala ${_esc(namaLemb)}, dengan ini menerangkan bahwa:
      </div>

      <!-- Identitas Peserta -->
      <div style="margin: 0 0 20px 24px;">
        <table style="border-collapse:collapse;">
          ${fieldRow('Nama', peserta?.nama)}
          ${fieldRow('Jabatan', peserta?.jabatan)}
          ${fieldRow('Instansi/Unit Kerja', peserta?.instansi)}
          ${fieldRow('No. Peserta', peserta?.noPeserta ?? peserta?.id)}
        </table>
      </div>

      <!-- Isi keterangan -->
      <div style="font-size:13px; line-height:1.8; margin-bottom:16px;">
        adalah benar telah mengikuti kegiatan:
      </div>

      <!-- Detail kegiatan -->
      <div style="margin: 0 0 24px 24px;">
        <table style="border-collapse:collapse;">
          ${fieldRow('Nama Kegiatan', b.nama)}
          ${fieldRow('Tanggal Pelaksanaan', periodeStr)}
          ${fieldRow('Tempat Pelaksanaan', lokasi)}
        </table>
      </div>

      <!-- Penutup -->
      <div style="font-size:13px; line-height:1.8; margin-bottom:40px;">
        Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.
      </div>

      <!-- TTD -->
      <div style="display:flex; justify-content:flex-end;">
        <div style="text-align:center; min-width:200px;">
          <div style="font-size:13px;">${_esc(kota)}, ${tglCetak}</div>
          <div style="font-size:13px; margin-bottom:64px;">Kepala ${_esc(namaLemb)},</div>
          <div style="border-top:1.5px solid #1a1a1a; padding-top:4px;">
            <div style="font-size:13px; font-weight:bold;">(..............................)</div>
            <div style="font-size:12px; margin-top:2px;">NIP. ................................</div>
          </div>
        </div>
      </div>
    </div>`;
}

function _printSuratKeterangan() {
  const style = document.createElement('style');
  style.id    = 'surat-ket-print-style';
  style.textContent = '@page { size: A4 portrait; margin: 0; }';
  document.head.appendChild(style);
  document.body.classList.add('printing-surat-ket');

  window.print();

  setTimeout(() => {
    document.getElementById('surat-ket-print-style')?.remove();
    document.body.classList.remove('printing-surat-ket');
  }, 1000);
}

