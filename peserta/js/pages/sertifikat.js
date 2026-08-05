// peserta/js/pages/sertifikat.js

import { getBimtek, getPeserta, getPesertaReportData, getLembagaSettings, listMapel } from '../api.js';
import { buildCertHTML, printCert, buildCertBackHTML } from '../../../shared/certificate.js';

export async function renderSertifikat(app, session, bimtekId) {
  // Inject print styles for page breaks
  if (!document.getElementById('cert-print-styles')) {
    const style = document.createElement('style');
    style.id = 'cert-print-styles';
    style.textContent = `
      .cert-page {
        width: 297mm;
        height: 210mm;
        page-break-after: always;
        box-sizing: border-box;
      }
      .cert-page:last-child {
        page-break-after: avoid;
      }
      @page {
        size: A4 landscape;
        margin: 0;
      }
    `;
    document.head.appendChild(style);
  }

  app.innerHTML = `
    <div class="no-print">${_header()}</div>
    <main class="max-w-4xl mx-auto px-4 py-6">
      <div class="no-print mb-4">
        <a href="#/" class="text-xs text-gray-400 hover:text-blue-600">← Kembali ke Dashboard</a>
      </div>
      <div id="cert-content" class="flex items-center gap-3 py-16 justify-center">
        <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-gray-400 text-sm">Menyiapkan sertifikat…</span>
      </div>
    </main>`;

  const content = document.getElementById('cert-content');
  try {
    const [bimtek, peserta] = await Promise.all([getBimtek(bimtekId), getPeserta(session.noPeserta)]);
    if (!peserta || !bimtek || !(bimtek.pesertaIds || []).includes(session.noPeserta)) {
      content.innerHTML = `<p class="text-sm text-red-600 py-8 text-center">Sertifikat tidak ditemukan.</p>`;
      return;
    }
    if (!bimtek.noSertifikat) {
      content.innerHTML = `<p class="text-sm text-gray-500 py-8 text-center">Sertifikat belum terbit — menunggu proses pengesahan.</p>`;
      return;
    }

    const [data, lembagaSettings, mapels] = await Promise.all([
      getPesertaReportData(bimtekId, session.noPeserta, bimtek),
      getLembagaSettings(),
      listMapel(bimtekId),
    ]);

    const html = buildCertHTML(data, bimtek, lembagaSettings);
    const backPageHtml = buildCertBackHTML(mapels, lembagaSettings, bimtek);
    content.innerHTML = `
      <div class="no-print flex justify-end mb-3">
        <button id="btn-print" class="btn-primary">Cetak Sertifikat</button>
      </div>
      <div class="cert-doc overflow-x-auto">
        <div class="cert-page">${html}</div>
        <div class="cert-page">${backPageHtml}</div>
      </div>
    `;
    document.getElementById('btn-print')?.addEventListener('click', () => printCert());
  } catch (e) {
    content.innerHTML = `<p class="text-sm text-red-600 py-8 text-center">Gagal memuat sertifikat: ${_esc(e.message)}</p>`;
  }
}

function _header() {
  return `
    <header class="bg-white border-b border-gray-200">
      <div class="max-w-4xl mx-auto px-4 h-14 flex items-center">
        <span class="text-blue-700 font-bold text-sm">Portal Peserta — Sertifikat</span>
      </div>
    </header>`;
}
function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
