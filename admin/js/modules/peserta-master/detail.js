// admin/js/modules/peserta-master/detail.js
// Halaman detail peserta: Info, Riwayat Bimtek, Kompetensi (tracing UK).

import { setPageTitle }           from '../../layout/navbar.js';
import { openPesertaForm }        from './form.js';
import { requireWrite }           from '../../auth-guard.js';
import { getPeserta }             from './api.js';
import { getPesertaBimtekHistory, getPesertaEKHistory } from './tracing-api.js';
import { JENIS_KELAMIN }          from '../../../../shared/constants.js';

// ─── STATE ────────────────────────────────────────────────────────────────────

let S = {
  noPeserta: null,
  peserta:   null,
  tab:       'info',
};

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────

export async function renderPesertaDetail({ noPeserta } = {}) {
  const app = document.getElementById('app');
  S.noPeserta = noPeserta;
  S.tab       = 'info';

  setPageTitle('Detail Peserta');
  app.innerHTML = `
    <div class="flex items-center justify-center py-16">
      <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  try {
    S.peserta = await getPeserta(noPeserta);
    if (!S.peserta) throw new Error('Peserta tidak ditemukan.');
    _render(app);
  } catch (err) {
    app.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 gap-3">
        <p class="text-red-400 text-sm">${_esc(err.message)}</p>
        <a href="#/peserta" class="text-xs text-blue-400 hover:underline">← Kembali ke daftar peserta</a>
      </div>`;
  }
}

// ─── RENDER SHELL ─────────────────────────────────────────────────────────────

function _render(app) {
  const p = S.peserta;
  setPageTitle(p.nama);

  const jk = JENIS_KELAMIN[p.jenisKelamin] ?? p.jenisKelamin ?? '';

  app.innerHTML = `
    <!-- Breadcrumb + Header -->
    <div class="mb-6">
      <div class="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <a href="#/peserta" class="hover:text-gray-300 transition-colors">Peserta Master</a>
        <span>›</span>
        <span class="text-gray-300">${_esc(p.noPeserta)}</span>
      </div>

      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <!-- Avatar placeholder -->
          <div class="w-12 h-12 rounded-full bg-blue-900/40 border border-blue-800/60 flex items-center justify-center shrink-0">
            <span class="text-lg font-bold text-blue-300">${_esc(p.nama?.charAt(0)?.toUpperCase() ?? '?')}</span>
          </div>
          <div>
            <h1 class="text-xl font-bold text-white">${_esc(p.nama)}</h1>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <span class="text-xs text-gray-400 font-mono">${_esc(p.noPeserta)}</span>
              ${jk ? `<span class="badge ${p.jenisKelamin === 'L' ? 'badge-blue' : 'badge-purple'} text-xs">${jk}</span>` : ''}
              ${p.instansi ? `<span class="text-xs text-gray-400">· ${_esc(p.instansi)}</span>` : ''}
            </div>
          </div>
        </div>
        <button id="btn-edit-peserta"
                class="shrink-0 px-3 py-1.5 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 text-white transition-colors">
          Edit Profil
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 border-b border-gray-800">
      ${_tabBtn('info',       'Informasi')}
      ${_tabBtn('riwayat',    'Riwayat Bimtek')}
      ${_tabBtn('kompetensi', 'Kompetensi')}
    </div>

    <!-- Tab content -->
    <div id="tab-content"></div>
  `;

  // Bind edit
  app.querySelector('#btn-edit-peserta')?.addEventListener('click', () => {
    if (!requireWrite()) return;
    openPesertaForm(S.peserta, async () => {
      // Refresh peserta data
      S.peserta = await getPeserta(S.noPeserta);
      _render(app);
    });
  });

  // Bind tab buttons
  app.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => _switchTab(btn.dataset.tab, app));
  });

  // Render active tab
  _renderTab(app.querySelector('#tab-content'));
}

function _tabBtn(tab, label) {
  const active   = 'tab-btn px-4 py-2 text-sm font-medium border-b-2 text-blue-400 border-blue-400 transition-colors';
  const inactive = 'tab-btn px-4 py-2 text-sm font-medium border-b-2 text-gray-400 border-transparent hover:text-gray-200 transition-colors';
  return `<button class="${S.tab === tab ? active : inactive}" data-tab="${tab}">${label}</button>`;
}

// ─── TAB SWITCHING ────────────────────────────────────────────────────────────

function _switchTab(tab, app) {
  if (S.tab === tab) return;
  S.tab = tab;

  // Update button styles
  app.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.className = isActive
      ? 'tab-btn px-4 py-2 text-sm font-medium border-b-2 text-blue-400 border-blue-400 transition-colors'
      : 'tab-btn px-4 py-2 text-sm font-medium border-b-2 text-gray-400 border-transparent hover:text-gray-200 transition-colors';
  });

  _renderTab(app.querySelector('#tab-content'));
}

function _renderTab(el) {
  if (!el) return;
  el.innerHTML = `
    <div class="flex items-center justify-center py-12">
      <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  if      (S.tab === 'info')       _renderInfo(el);
  else if (S.tab === 'riwayat')    _renderRiwayat(el);
  else if (S.tab === 'kompetensi') _renderKompetensi(el);
}

// ─── TAB INFO ─────────────────────────────────────────────────────────────────

function _renderInfo(el) {
  const p = S.peserta;

  const row = (label, val) => val
    ? `<div class="flex gap-4 py-2.5 border-b border-gray-800 last:border-0">
         <span class="w-36 shrink-0 text-xs text-gray-500">${label}</span>
         <span class="text-sm text-gray-200">${val}</span>
       </div>`
    : '';

  el.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Data Pribadi -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Data Pribadi</h3>
        <div>
          ${row('No. Peserta',  `<span class="font-mono text-blue-400">${_esc(p.noPeserta)}</span>`)}
          ${row('Nama Lengkap', _esc(p.nama))}
          ${row('Jenis Kelamin', p.jenisKelamin
            ? `<span class="badge ${p.jenisKelamin==='L'?'badge-blue':'badge-purple'}">${JENIS_KELAMIN[p.jenisKelamin]??p.jenisKelamin}</span>`
            : '')}
          ${row('Pendidikan',   p.pendidikan ? `<span class="badge badge-gray">${_esc(p.pendidikan)}</span>` : '')}
          ${row('Email',        p.email   ? `<a href="mailto:${_esc(p.email)}" class="text-blue-400 hover:underline">${_esc(p.email)}</a>` : '')}
          ${row('No. HP',       p.noHp)}
        </div>
      </div>

      <!-- Data Pekerjaan -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Data Pekerjaan</h3>
        <div>
          ${row('Jabatan',    _esc(p.jabatan))}
          ${row('Instansi',   _esc(p.instansi))}
          ${row('Unit Kerja', _esc(p.unitKerja))}
          ${row('Provinsi',   _esc(p.provinsi))}
          ${row('Kab/Kota',   _esc(p.kabKota))}
        </div>
      </div>
    </div>
  `;
}

// ─── TAB RIWAYAT BIMTEK ───────────────────────────────────────────────────────

async function _renderRiwayat(el) {
  try {
    const history = await getPesertaBimtekHistory(S.noPeserta);

    if (!history.length) {
      el.innerHTML = `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p class="text-gray-500 text-sm">Peserta ini belum pernah mengikuti bimtek.</p>
        </div>`;
      return;
    }

    const lulus      = history.filter(h => h.lulus).length;
    const avgNilai   = _avg(history.map(h => h.nilaiAkhir).filter(v => v != null && v > 0));

    const rows = history.map((h, i) => {
      const bimtek = h.bimtek;
      const tgl    = _fmtDate(bimtek.tanggalMulai);
      const s      = h.score;

      return `
        <tr>
          <td class="text-center text-gray-500 w-8">${i + 1}</td>
          <td>
            <a href="#/bimtek/${h.bimtekId}"
               class="font-medium text-white hover:text-blue-400 transition-colors text-sm">
              ${_esc(bimtek.nama)}
            </a>
            <div class="text-xs text-gray-500 mt-0.5">${tgl}</div>
          </td>
          <td class="text-center text-sm">
            ${s.pretest  != null ? `<span class="text-gray-300">${s.pretest}</span>`  : '<span class="text-gray-600">—</span>'}
          </td>
          <td class="text-center text-sm">
            ${s.posttest != null ? `<span class="text-gray-300">${s.posttest}</span>` : '<span class="text-gray-600">—</span>'}
          </td>
          <td class="text-center">
            ${h.nilaiAkhir != null
              ? `<span class="font-semibold text-sm ${_nilaiColor(h.nilaiAkhir)}">${h.nilaiAkhir}</span>`
              : '<span class="text-gray-600 text-sm">—</span>'}
          </td>
          <td class="text-center">
            ${h.lulus
              ? `<span class="badge badge-green">Lulus</span>`
              : `<span class="badge badge-red">Tidak Lulus</span>`}
          </td>
          <td>
            ${s.kehadiran != null
              ? `<div class="w-full bg-gray-800 rounded-full h-1.5">
                   <div class="h-1.5 rounded-full ${s.kehadiran >= 80 ? 'bg-green-500' : 'bg-yellow-500'}"
                        style="width:${Math.min(s.kehadiran,100)}%"></div>
                 </div>
                 <span class="text-xs text-gray-400">${s.kehadiran}%</span>`
              : '<span class="text-gray-600 text-xs">—</span>'}
          </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <!-- Summary chips -->
      <div class="flex gap-3 mb-5 flex-wrap">
        ${_chip(`${history.length} Bimtek`, 'text-gray-300 border-gray-700')}
        ${_chip(`${lulus} Lulus`, 'text-green-400 border-green-800/60')}
        ${history.length - lulus > 0 ? _chip(`${history.length - lulus} Tidak Lulus`, 'text-red-400 border-red-800/60') : ''}
        ${avgNilai != null ? _chip(`Rata-rata ${avgNilai}`, 'text-blue-400 border-blue-800/60') : ''}
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table class="btam-table">
          <thead>
            <tr>
              <th class="w-8 text-center">#</th>
              <th>Nama Bimtek</th>
              <th class="w-16 text-center">Pre</th>
              <th class="w-16 text-center">Post</th>
              <th class="w-24 text-center">Nilai Akhir</th>
              <th class="w-24 text-center">Status</th>
              <th class="w-28">Kehadiran</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat riwayat: ${_esc(err.message)}</div>`;
    console.error(err);
  }
}

// ─── TAB KOMPETENSI ───────────────────────────────────────────────────────────

async function _renderKompetensi(el) {
  try {
    const { byEK, bimtekList } = await getPesertaEKHistory(S.noPeserta);

    if (!byEK.length) {
      el.innerHTML = `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center space-y-2">
          <p class="text-gray-400 text-sm font-medium">Belum ada data kompetensi</p>
          <p class="text-gray-600 text-xs">
            Data kompetensi muncul setelah peserta mengikuti ujian (pre/post-test) di bimtek.
          </p>
        </div>`;
      return;
    }

    const measured    = byEK.length;
    const avgLatest   = _avg(byEK.map(e => e.latestPct).filter(v => v != null));
    const improving   = byEK.filter(e => {
      const first = e.entries.find(x => x.postPct != null);
      const last  = [...e.entries].reverse().find(x => x.postPct != null);
      return first && last && last !== first && last.postPct > first.postPct;
    }).length;

    // UK cards
    const ekCards = byEK.map(ek => {
      const pct     = ek.latestPct;
      const barCls  = _pctBarCls(pct);

      const bimtekRows = ek.entries.map(entry => {
        const tgl = _fmtDate(entry.tanggal);
        const deltaBadge = entry.delta != null
          ? `<span class="text-xs font-medium ${entry.delta >= 0 ? 'text-green-400' : 'text-red-400'}">
               ${entry.delta >= 0 ? '+' : ''}${entry.delta}
             </span>`
          : '';

        return `
          <div class="flex items-center gap-3 py-1.5 border-b border-gray-800/60 last:border-0">
            <div class="w-36 shrink-0">
              <div class="text-xs text-gray-300 font-medium truncate">${_esc(entry.bimtekNama)}</div>
              <div class="text-xs text-gray-600">${tgl}</div>
            </div>
            <div class="flex items-center gap-2 flex-1 min-w-0">
              ${entry.prePct  != null ? `<span class="text-xs text-gray-500">Pre <span class="text-gray-300">${entry.prePct}%</span></span>` : '<span class="text-xs text-gray-700">Pre —</span>'}
              <span class="text-gray-700">→</span>
              ${entry.postPct != null ? `<span class="text-xs text-gray-400">Post <span class="font-semibold ${_pctTextCls(entry.postPct)}">${entry.postPct}%</span></span>` : '<span class="text-xs text-gray-700">Post —</span>'}
              ${deltaBadge}
            </div>
          </div>`;
      }).join('');

      return `
        <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <!-- UK header -->
          <div class="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                ${ek.ekKey && ek.ekKey !== ek.ekNama
                  ? `<span class="font-mono text-sm font-semibold text-blue-400 shrink-0">${_esc(ek.ekKey)}</span>`
                  : `<span class="text-xs text-gray-500 italic shrink-0">Non-SKKNI</span>`}
                <span class="text-sm text-white truncate">${_esc(ek.ekNama)}</span>
              </div>
              <div class="text-xs text-gray-500 mt-0.5">${ek.entries.length} bimtek</div>
            </div>
            <!-- Latest score -->
            <div class="shrink-0 text-right">
              ${pct != null ? `
                <div class="text-lg font-bold ${_pctTextCls(pct)}">${pct}%</div>
                <div class="text-xs text-gray-600">terkini</div>
                <div class="w-20 bg-gray-800 rounded-full h-1.5 mt-1">
                  <div class="h-1.5 rounded-full ${barCls}" style="width:${pct}%"></div>
                </div>` : `
                <div class="text-sm text-gray-600">—</div>`}
            </div>
          </div>

          <!-- Per-bimtek rows -->
          <div class="px-4 py-1">
            ${bimtekRows}
          </div>
        </div>`;
    }).join('');

    el.innerHTML = `
      <!-- Summary -->
      <div class="flex gap-3 mb-5 flex-wrap">
        ${_chip(`${measured} UK Diukur`, 'text-gray-300 border-gray-700')}
        ${_chip(`${bimtekList.length} Bimtek`, 'text-gray-400 border-gray-800')}
        ${avgLatest != null ? _chip(`Rata-rata Terkini ${avgLatest}%`, 'text-blue-400 border-blue-800/60') : ''}
        ${improving > 0 ? _chip(`${improving} UK Meningkat`, 'text-green-400 border-green-800/60') : ''}
      </div>

      <!-- Keterangan level -->
      <div class="flex items-center gap-4 mb-4 text-xs text-gray-500 flex-wrap">
        <span>Level penguasaan:</span>
        <span><span class="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>≥80 Baik</span>
        <span><span class="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1"></span>60-79 Cukup</span>
        <span><span class="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span>&lt;60 Perlu Ditingkatkan</span>
      </div>

      <!-- UK cards -->
      <div class="space-y-3">
        ${ekCards}
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat kompetensi: ${_esc(err.message)}</div>`;
    console.error(err);
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function _chip(text, cls) {
  return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs border ${cls}">${text}</span>`;
}

function _nilaiColor(v) {
  if (v >= 80) return 'text-green-400';
  if (v >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function _pctTextCls(pct) {
  if (pct == null) return 'text-gray-500';
  if (pct >= 80)   return 'text-green-400';
  if (pct >= 60)   return 'text-yellow-400';
  return 'text-red-400';
}

function _pctBarCls(pct) {
  if (pct == null) return 'bg-gray-700';
  if (pct >= 80)   return 'bg-green-500';
  if (pct >= 60)   return 'bg-yellow-500';
  return 'bg-red-500';
}

function _avg(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

function _fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

