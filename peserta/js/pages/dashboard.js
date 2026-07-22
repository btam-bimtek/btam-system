// peserta/js/pages/dashboard.js

import { getPeserta, listBimtekDiikuti, getBimtekScore, sudahEvaluasi, clearSession } from '../api.js';

export async function renderDashboard(app, session) {
  app.innerHTML = `
    ${_header()}
    <main class="max-w-2xl mx-auto px-4 py-8">
      <div id="dash-content">${_skeleton()}</div>
    </main>
    ${_footer()}`;

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    clearSession();
    window.location.hash = '#/login';
  });

  const content = document.getElementById('dash-content');
  try {
    const [peserta, bimtekList] = await Promise.all([
      getPeserta(session.noPeserta),
      listBimtekDiikuti(session.noPeserta),
    ]);

    if (!peserta) {
      content.innerHTML = `<p class="text-sm text-red-600 py-8 text-center">Data peserta tidak ditemukan. Silakan login ulang.</p>`;
      return;
    }

    const rows = await Promise.all(bimtekList.map(async b => {
      const [score, evaluated] = await Promise.all([
        getBimtekScore(b.id, session.noPeserta),
        sudahEvaluasi(b.id, session.noPeserta),
      ]);
      return { bimtek: b, score, evaluated };
    }));

    content.innerHTML = `
      <div class="mb-6">
        <h1 class="text-xl font-bold text-gray-800">Halo, ${_esc(peserta.nama)}</h1>
        <p class="text-sm text-gray-500 mt-0.5">${_esc(peserta.instansi || '')}</p>
      </div>

      <h2 class="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Bimtek Diikuti</h2>
      ${rows.length === 0
        ? `<p class="text-sm text-gray-500 py-8 text-center">Belum ada riwayat bimtek.</p>`
        : `<div class="space-y-3">${rows.map(_bimtekCard).join('')}</div>`}
    `;

    content.querySelectorAll('[data-cert]').forEach(el => {
      el.addEventListener('click', () => { window.location.hash = `#/sertifikat/${el.dataset.cert}`; });
    });
    content.querySelectorAll('[data-eval]').forEach(el => {
      el.addEventListener('click', () => { window.location.hash = `#/evaluasi/${el.dataset.eval}`; });
    });
  } catch (e) {
    content.innerHTML = `<p class="text-sm text-red-600 py-8 text-center">Gagal memuat data: ${_esc(e.message)}</p>`;
  }
}

function _bimtekCard({ bimtek: b, score, evaluated }) {
  const nilai = score?.nilaiAkhir != null ? Math.round(score.nilaiAkhir) : null;
  const lulus = score?.lulus;
  // Evaluasi: terbuka selama bimtek berjalan sampai selesai diproses admin —
  // TIDAK menunggu status 'completed' karena itu baru di-set berminggu-minggu
  // kemudian bersamaan pengesahan sertifikat (lihat noSertifikat di bawah).
  const evalOpen  = ['ongoing', 'completed'].includes(b.status);
  // Sertifikat: baru terbit setelah pengesahan — bukan otomatis begitu status
  // berubah jadi 'completed'. Sinyalnya adalah noSertifikat yang diisi manual
  // oleh admin setelah pengesahan resmi selesai.
  const certReady = !!b.noSertifikat;

  return `
    <div class="bg-white rounded-xl border border-gray-200 p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-semibold text-gray-800 text-sm">${_esc(b.nama)}</p>
          <p class="text-xs text-gray-500 mt-0.5">${_fmtPeriode(b.periode)}</p>
        </div>
        ${nilai != null ? `
          <div class="text-right shrink-0">
            <p class="text-lg font-bold ${lulus ? 'text-green-600' : 'text-red-600'}">${nilai}</p>
            <p class="text-[10px] ${lulus ? 'text-green-600' : 'text-red-600'}">${lulus ? 'Lulus' : 'Tidak Lulus'}</p>
          </div>` : ''}
      </div>
      <div class="flex gap-2 mt-3">
        ${certReady ? `
          <button data-cert="${b.id}" class="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium">
            Lihat Sertifikat
          </button>` : ''}
        ${evalOpen ? `
          <button data-eval="${b.id}" class="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
            ${evaluated ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}"
            ${evaluated ? 'disabled' : ''}>
            ${evaluated ? '✓ Evaluasi Terkirim' : 'Isi Evaluasi'}
          </button>` : ''}
      </div>
    </div>`;
}

function _fmtPeriode(periode) {
  if (!periode?.mulai) return '';
  const fmt = ts => (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  return periode.selesai ? `${fmt(periode.mulai)} – ${fmt(periode.selesai)}` : fmt(periode.mulai);
}

function _skeleton() {
  return `<div class="animate-pulse space-y-3">
    <div class="h-6 bg-gray-200 rounded w-48"></div>
    <div class="h-20 bg-gray-200 rounded-xl"></div>
    <div class="h-20 bg-gray-200 rounded-xl"></div>
  </div>`;
}

function _header() {
  return `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <span class="flex items-center gap-2 text-blue-700 font-bold text-sm">
          <div class="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
          </div>
          Portal Peserta
        </span>
        <button id="btn-logout" class="text-xs text-gray-500 hover:text-red-600 transition-colors">Keluar</button>
      </div>
    </header>`;
}
function _footer() { return `<footer class="text-center py-8 text-xs text-gray-400">Balai Teknik Air Minum — Direktorat Jenderal Cipta Karya</footer>`; }
function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
