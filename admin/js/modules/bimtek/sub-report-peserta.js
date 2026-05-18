// admin/js/modules/bimtek/sub-report-peserta.js
// Laporan peserta: list + preview 4-section + print.

import { getPesertaReportData } from './report-api.js';
import { mapToLabel, generateNarasi } from './report-narrative.js';
import { db, doc, getDoc } from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';
import { getAppSetting } from '../settings/api.js';
import { listBimtekScores } from './penilaian-api.js';

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
  S.pesertaList = snaps.map((snap, i) => ({
    noPeserta: ids[i],
    nama:  snap.exists() ? (snap.data().nama  ?? ids[i]) : ids[i],
    lulus: lulusMap[ids[i]] ?? false
  }));

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
      <td class="text-center text-gray-500 text-xs">${i + 1}</td>
      <td>
        <div class="text-sm text-white font-medium">${_esc(p.nama)}</div>
        <div class="text-xs text-gray-500">${_esc(p.noPeserta)}</div>
      </td>
      <td class="text-right">
        <button class="btn-preview-peserta text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors mr-1"
          data-nopeserta="${_esc(p.noPeserta)}">
          Preview
        </button>
        <button class="btn-print-peserta text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors mr-1"
          data-nopeserta="${_esc(p.noPeserta)}">
          Print
        </button>
        <button class="btn-cert-peserta text-xs px-3 py-1.5 rounded-lg transition-colors
          ${p.lulus ? 'bg-yellow-700 hover:bg-yellow-600 text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}"
          data-nopeserta="${_esc(p.noPeserta)}" ${!p.lulus ? 'disabled' : ''}>
          Sertifikat
        </button>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <div id="peserta-list-section">
      <div class="text-xs text-gray-400 mb-3">${S.pesertaList.length} peserta · Klik Preview untuk melihat, Print untuk cetak</div>
      <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table class="btam-table">
          <thead>
            <tr>
              <th class="text-center w-8">#</th>
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
  container.querySelectorAll('.btn-cert-peserta:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => _loadAndShowCert(container, btn.dataset.nopeserta));
  });
}

// ─── LOAD & SHOW PREVIEW ─────────────────────────────────────────────────────

async function _loadAndShowPreview(container, noPeserta, autoPrint) {
  const panel = container.querySelector('#report-preview-panel');
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="flex items-center gap-3 py-8 justify-center">
      <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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
        <button id="btn-do-print" class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors">
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

// ─── REPORT HTML TEMPLATE ─────────────────────────────────────────────────────

function _buildReportHTML(data) {
  const { peserta, scores, kehadiranDetail, pretestResult, posttestResult, ekComparison, thresholds } = data;
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
      ${_buildSectionC(scores, pretestResult, posttestResult, ekComparison, peserta)}

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
  const namaLembaga = ls?.nama    || 'BTAM TERPADU';
  const websiteTeks = ls?.website || 'www.btam.go.id';
  const alamatTeks  = ls?.alamat  ? ls.alamat.split('\n')[0].trim() : 'Badan Teknis Air Minum';

  const logoEl = ls?.logoUrl
    ? `<img src="${_esc(ls.logoUrl)}" alt="Logo"
           style="width:64px; height:64px; object-fit:contain; border-radius:8px; flex-shrink:0;" />`
    : `<div style="width:64px; height:64px; background:#1e40af; border-radius:8px;
                  display:flex; align-items:center; justify-content:center; flex-shrink:0;">
         <span style="color:white; font-weight:bold; font-size:18px; font-family:sans-serif;">B</span>
       </div>`;

  return `
    <!-- Kop Surat -->
    <div style="display:flex; align-items:flex-start; gap:20px; margin-bottom:20px;">
      ${logoEl}
      <div>
        <div style="font-size:16px; font-weight:bold; font-family:sans-serif; color:#1a1a1a;">${_esc(namaLembaga)}</div>
        <div style="font-size:12px; color:#444; font-family:sans-serif; margin-top:2px;">${_esc(alamatTeks)}</div>
        <div style="font-size:11px; color:#666; font-family:sans-serif; margin-top:2px;">${_esc(websiteTeks)}</div>
      </div>
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
  const kkm = b.kkm ?? 60;
  const pre  = scores?.pretest  ?? null;
  const post = scores?.posttest ?? null;
  const na   = scores?.nilaiAkhir ?? null;
  const lulus = scores?.lulus ?? false;

  // B.1 — Nilai kuantitatif
  const nilaiRows = [
    { label: 'Pre Test',    nilai: pre,  ket: 'Penilaian awal sebelum kegiatan' },
    { label: 'Post Test',   nilai: post, ket: 'Penilaian akhir setelah kegiatan' },
    { label: 'Nilai Akhir', nilai: na,   ket: `Nilai minimum kelulusan: ${kkm}`, bold: true },
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
          ${lulus ? 'LULUS' : 'BELUM MEMENUHI'}
        </span>
      </td>
      <td></td>
    </tr>`;

  // B.2 — Deskriptif
  const kehadiranPct  = scores?.kehadiran ?? null;
  const kehadiran_label = kehadiranPct != null ? mapToLabel(kehadiranPct, thresholds.kehadiran) : null;
  const kehadiranFakta = kehadiranDetail
    ? `${kehadiranDetail.hadir} dari ${kehadiranDetail.total} sesi (${kehadiranDetail.persentase}%)`
    : (kehadiranPct != null ? `${kehadiranPct}%` : null);

  const keaktifanLabel = scores?.keaktifan != null ? mapToLabel(scores.keaktifan, thresholds.keaktifan) : null;
  const respekLabel    = scores?.respek    != null ? mapToLabel(scores.respek,    thresholds.respek)    : null;

  const deskriptifItem = (icon, komponen, label, fakta) => {
    if (!label) return '';
    return `
      <div style="display:flex; align-items:flex-start; gap:12px; padding:10px 0; border-bottom:1px solid #f0f0f0;">
        <span style="font-size:18px;">${icon}</span>
        <div>
          <span style="font-size:13px; font-weight:600;">${komponen}:</span>
          <span style="font-size:13px; font-weight:600; margin-left:4px;">${_esc(label)}</span>
          ${fakta ? `<span style="font-size:12px; color:#666; margin-left:6px;">— ${_esc(fakta)}</span>` : ''}
        </div>
      </div>`;
  };

  const tidakLulusMsg = !lulus && na != null ? `
    <div style="background:#fef3c7; border-left:4px solid #f59e0b; border-radius:0 4px 4px 0; padding:12px 16px; margin-top:16px; font-size:12px; color:#78350f; line-height:1.6;">
      Nilai akhir yang diperoleh (${na}) belum mencapai nilai minimum kelulusan yang ditetapkan (${kkm}).
      Peserta dapat mengikuti kegiatan bimtek pada periode berikutnya untuk memperdalam penguasaan materi.
      Informasi jadwal dan pendaftaran dapat diperoleh dari penyelenggara.
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
      ${deskriptifItem('📅', 'Kehadiran', kehadiran_label, kehadiranFakta)}
      ${deskriptifItem('💬', 'Keaktifan', keaktifanLabel, null)}
      ${deskriptifItem('🤝', 'Sikap & Respek', respekLabel, null)}
      ${!kehadiran_label && !keaktifanLabel && !respekLabel
        ? '<div style="color:#999; font-size:12px; text-align:center; padding:8px;">Data komponen deskriptif belum tersedia.</div>'
        : ''}
    </div>`;
}

// ── Section C ─────────────────────────────────────────────────────────────────

function _buildSectionC(scores, pretestResult, posttestResult, ekComparison, peserta) {
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

  // C.2 — Grouped bar chart per-EK
  let ekChartSection = '';
  if (ekComparison && ekComparison.length > 0) {
    const chartH = Math.max(160, ekComparison.length * 36);
    ekChartSection = `
      <div style="font-size:13px; font-weight:600; color:#444; margin-bottom:10px; font-family:sans-serif;">
        C.2 Penguasaan per Elemen Kompetensi
      </div>
      <div style="position:relative; margin-bottom:20px; height:${chartH}px;">
        <canvas id="report-chart-ek" height="${chartH}"></canvas>
      </div>`;
  }

  // C.3 — Tabel per EK
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
        C.3 Rincian per Elemen Kompetensi
      </div>
      <table style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-bottom:20px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:7px 10px; text-align:left; font-size:12px; font-weight:600; color:#374151;">Elemen Kompetensi</th>
            <th style="padding:7px 10px; text-align:center; font-size:12px; font-weight:600; color:#374151;">Pre</th>
            <th style="padding:7px 10px; text-align:center; font-size:12px; font-weight:600; color:#374151;">Post</th>
            <th style="padding:7px 10px; text-align:center; font-size:12px; font-weight:600; color:#374151;">Δ</th>
          </tr>
        </thead>
        <tbody>${ekRows}</tbody>
      </table>`;
  }

  // C.4 — Narasi
  const narasi = generateNarasi(ekComparison, pre, post, peserta?.nama);
  const narasiSection = `
    <div style="font-size:13px; font-weight:600; color:#444; margin-bottom:8px; font-family:sans-serif;">
      C.4 Analisis Kompetensi
    </div>
    <div style="background:#f0f7ff; border-left:4px solid #2563eb; padding:12px 16px; border-radius:0 8px 8px 0; font-size:13px; color:#1e3a5f; line-height:1.7;">
      ${narasi}
    </div>`;

  return `
    <div style="font-size:15px; font-weight:bold; margin-bottom:16px; font-family:sans-serif;">
      C. Perubahan Kompetensi
    </div>
    ${chartSection}
    ${ekChartSection}
    ${ekTableSection}
    ${narasiSection}`;
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
  const html = _buildCertHTML(data);

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

  panel.querySelector('#btn-print-cert').addEventListener('click', () => _printCert());
  panel.querySelector('#btn-close-cert').addEventListener('click', () => {
    panel.innerHTML = '';
    panel.classList.add('hidden');
    if (listSection) listSection.classList.remove('no-print');
  });
}

function _buildCertHTML(data) {
  const { peserta, scores } = data;
  const b        = S.bimtek;
  const lembaga  = S.lembagaSettings ?? {};
  const nilaiAkhir = scores?.nilaiAkhir ?? '-';

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

  const tglCetak = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const namaLembaga = lembaga.nama || 'BTAM Terpadu';
  const logoUrl     = lembaga.logoUrl || '';

  return `
    <div style="
      width:267mm; min-height:190mm;
      padding:14mm 16mm;
      font-family:'Times New Roman',Georgia,serif;
      color:#1a1a1a;
      background:#fff;
      box-sizing:border-box;
      border:6px double #8a7a50;
      position:relative;
    ">
      <!-- Ornamen sudut -->
      <div style="position:absolute;top:10px;left:10px;width:40px;height:40px;border-top:3px solid #8a7a50;border-left:3px solid #8a7a50;"></div>
      <div style="position:absolute;top:10px;right:10px;width:40px;height:40px;border-top:3px solid #8a7a50;border-right:3px solid #8a7a50;"></div>
      <div style="position:absolute;bottom:10px;left:10px;width:40px;height:40px;border-bottom:3px solid #8a7a50;border-left:3px solid #8a7a50;"></div>
      <div style="position:absolute;bottom:10px;right:10px;width:40px;height:40px;border-bottom:3px solid #8a7a50;border-right:3px solid #8a7a50;"></div>

      <!-- Header: Logo + Nama Lembaga -->
      <div style="display:flex;align-items:center;gap:16px;border-bottom:2px solid #1a1a1a;padding-bottom:12px;margin-bottom:20px;">
        ${logoUrl ? `<img src="${logoUrl}" style="height:64px;width:auto;object-fit:contain;flex-shrink:0;">` : ''}
        <div>
          <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#666;font-family:sans-serif;">Lembaga Penyelenggara</div>
          <div style="font-size:17px;font-weight:bold;letter-spacing:1px;">${_esc(namaLembaga)}</div>
          ${lembaga.alamat ? `<div style="font-size:10px;color:#555;">${_esc(lembaga.alamat)}</div>` : ''}
        </div>
      </div>

      <!-- Judul -->
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#8a7a50;font-family:sans-serif;margin-bottom:4px;">SERTIFIKAT</div>
        <div style="font-size:28px;font-weight:bold;letter-spacing:6px;text-transform:uppercase;line-height:1.1;">KELULUSAN</div>
        <div style="width:80px;height:2px;background:#8a7a50;margin:10px auto;"></div>
      </div>

      <!-- Diberikan kepada -->
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:11px;color:#555;font-family:sans-serif;margin-bottom:6px;">Diberikan kepada</div>
        <div style="font-size:26px;font-weight:bold;font-style:italic;border-bottom:1.5px solid #1a1a1a;padding-bottom:4px;display:inline-block;min-width:260px;">
          ${_esc(peserta?.nama ?? '-')}
        </div>
        <div style="margin-top:8px;font-size:11px;color:#444;font-family:sans-serif;">
          ${peserta?.jabatan ? `${_esc(peserta.jabatan)}` : ''}
          ${peserta?.jabatan && peserta?.instansi ? ' · ' : ''}
          ${peserta?.instansi ? `${_esc(peserta.instansi)}` : ''}
        </div>
        ${peserta?.noPeserta || peserta?.id ? `<div style="font-size:10px;color:#888;font-family:sans-serif;">No. Peserta: ${_esc(peserta.noPeserta ?? peserta.id)}</div>` : ''}
      </div>

      <!-- Nama bimtek -->
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:11px;color:#555;font-family:sans-serif;">Telah dinyatakan <strong>LULUS</strong> dalam kegiatan</div>
        <div style="font-size:17px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin:6px 0;">${_esc(b.nama)}</div>
        <div style="font-size:10px;color:#666;font-family:sans-serif;">${_esc(periodeStr)}</div>
        <div style="margin-top:6px;display:inline-block;background:#f5f0e8;border:1px solid #8a7a50;border-radius:4px;padding:3px 14px;font-size:12px;font-family:sans-serif;">
          Nilai Akhir: <strong>${nilaiAkhir}</strong>
        </div>
      </div>

      <!-- TTD -->
      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <div style="text-align:center;min-width:180px;">
          <div style="font-size:10px;font-family:sans-serif;">${_esc(lembaga.kota || lembaga.lokasi || '')}, ${tglCetak}</div>
          <div style="height:56px;"></div>
          <div style="border-top:1.5px solid #1a1a1a;padding-top:4px;">
            <div style="font-size:11px;font-weight:bold;font-family:sans-serif;">${_esc(lembaga.nama || namaLembaga)}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function _printCert() {
  const style = document.createElement('style');
  style.id    = 'cert-print-style';
  style.textContent = '@page { size: A4 landscape; margin: 0; }';
  document.head.appendChild(style);
  document.body.classList.add('printing-cert');

  window.print();

  // Cleanup setelah dialog print tutup
  setTimeout(() => {
    const s = document.getElementById('cert-print-style');
    if (s) s.remove();
    document.body.classList.remove('printing-cert');
  }, 1000);
}
