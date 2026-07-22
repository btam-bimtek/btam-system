// admin/js/modules/alumni/sub-riwayat.js
// Sub-tab Riwayat — tabel semua keikutsertaan bimtek dengan expandable row.

import { listRiwayat } from './api.js';

const BIDANG_LABEL = {
  produksi:    'Produksi',
  trandis:     'Trandis',
  me:          'ME',
  pendukung:   'Pendukung',
  multi_bidang:'Multi Bidang',
};

export async function renderSubRiwayat(pane) {
  pane.innerHTML = _skeleton();

  let allData = [];
  try {
    allData = await listRiwayat();
  } catch (err) {
    pane.innerHTML = `<p class="text-sm text-red-400 p-6">Gagal memuat data: ${_esc(err.message)}</p>`;
    return;
  }

  if (!allData.length) {
    pane.innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-gray-500">
      <svg class="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
      <p class="text-sm">Belum ada data alumni</p>
    </div>`;
    return;
  }

  // Bangun opsi filter tahun
  const years = [...new Set(allData.map(r => r.tahun).filter(Boolean))].sort((a, b) => b - a);

  pane.innerHTML = `
    <!-- Filter bar -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <div class="flex rounded-lg border border-gray-700 overflow-hidden text-xs">
        <button id="alumni-mode-kejadian" class="px-3 py-1.5 transition-colors">Per Kejadian</button>
        <button id="alumni-mode-peserta" class="px-3 py-1.5 transition-colors">Per Peserta</button>
      </div>
      <input type="text" id="alumni-search" class="form-input text-xs py-1.5 w-52"
        placeholder="Cari nama / instansi / NIK…">
      <select id="alumni-filter-tahun-dari" class="form-select text-xs py-1.5 w-32">
        <option value="">Dari tahun</option>
        ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
      </select>
      <select id="alumni-filter-tahun-sampai" class="form-select text-xs py-1.5 w-32">
        <option value="">Sampai tahun</option>
        ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
      </select>
      <select id="alumni-filter-bidang" class="form-select text-xs py-1.5 w-36">
        <option value="">Semua Bidang</option>
        ${Object.entries(BIDANG_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
      </select>
      <select id="alumni-filter-tipe" class="form-select text-xs py-1.5 w-28">
        <option value="">Semua Tipe</option>
        <option value="reguler">Reguler</option>
        <option value="pnbp">PNBP</option>
      </select>
      <select id="alumni-filter-sumber" class="form-select text-xs py-1.5 w-28">
        <option value="">Semua Sumber</option>
        <option value="Historis">Historis</option>
        <option value="Sistem">Sistem</option>
      </select>
      <span id="alumni-count" class="text-xs text-gray-500 ml-auto"></span>
    </div>

    <!-- Tabel -->
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
      <table class="w-full text-sm min-w-[900px]">
        <thead id="alumni-thead"></thead>
        <tbody id="alumni-tbody" class="divide-y divide-gray-800/60"></tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div id="alumni-pagination" class="flex items-center justify-between mt-4 text-xs text-gray-500"></div>
  `;

  // ─── State ───────────────────────────────────────────────────
  const PAGE_SIZE = 50;
  let mode     = 'kejadian'; // 'kejadian' | 'peserta'
  let filtered = [...allData];
  let rows     = filtered;   // hasil akhir yang ditampilkan (flat atau grouped per peserta)
  let page     = 1;

  const THEAD_KEJADIAN = `
    <tr class="border-b border-gray-800">
      <th class="w-8 px-3 py-3"></th>
      <th class="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Nama</th>
      <th class="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">NIK</th>
      <th class="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Instansi</th>
      <th class="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Kab/Kota</th>
      <th class="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Provinsi</th>
      <th class="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-12">Tahun</th>
      <th class="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Nama Bimtek</th>
      <th class="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Bidang</th>
      <th class="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipe</th>
      <th class="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sumber</th>
    </tr>`;

  const PESERTA_COLUMNS = [
    { key: 'nama',        label: 'Nama' },
    { key: 'nik',         label: 'NIK' },
    { key: 'instansi',    label: 'Instansi' },
    { key: 'kabKota',     label: 'Kab/Kota' },
    { key: 'provinsi',    label: 'Provinsi' },
    { key: 'jmlBimtek',   label: 'Jml Bimtek', class: 'w-16' },
    { key: 'tahun',       label: 'Bimtek Terakhir' },
  ];

  let sortKey = null;
  let sortDir = 'asc'; // 'asc' | 'desc'

  function theadPeserta() {
    const cols = PESERTA_COLUMNS.map(c => {
      const arrow = sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      return `<th class="th-sort text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-200 ${c.class ?? ''}"
        data-key="${c.key}">${c.label}${arrow}</th>`;
    }).join('');
    return `<tr class="border-b border-gray-800"><th class="w-8 px-3 py-3"></th>${cols}</tr>`;
  }

  function applyModeStyle() {
    const kBtn = document.getElementById('alumni-mode-kejadian');
    const pBtn = document.getElementById('alumni-mode-peserta');
    const active   = 'bg-teal-700 text-white';
    const inactive = 'bg-gray-800 text-gray-400 hover:bg-gray-700';
    kBtn?.setAttribute('class', `px-3 py-1.5 transition-colors ${mode === 'kejadian' ? active : inactive}`);
    pBtn?.setAttribute('class', `px-3 py-1.5 transition-colors ${mode === 'peserta'  ? active : inactive}`);
  }

  function groupByPeserta(records) {
    const map = new Map();
    for (const r of records) {
      const nik = _norm(r.nik);
      const key = nik || `${_norm(r.nama)}__${_norm(r.instansi)}`;
      let g = map.get(key);
      if (!g) { g = { ...r, _riwayat: [] }; map.set(key, g); }
      g._riwayat.push(r);
      if ((r.tahun || 0) >= (g.tahun || 0)) {
        const riwayat = g._riwayat;
        Object.assign(g, r);
        g._riwayat = riwayat;
      }
    }
    for (const g of map.values()) g._riwayat.sort((a, b) => (b.tahun || 0) - (a.tahun || 0));
    return [...map.values()].sort((a, b) => (b.tahun || 0) - (a.tahun || 0));
  }

  function applyFilter() {
    const search  = document.getElementById('alumni-search')?.value.toLowerCase().trim() ?? '';
    const dari    = Number(document.getElementById('alumni-filter-tahun-dari')?.value)  || null;
    const sampai  = Number(document.getElementById('alumni-filter-tahun-sampai')?.value) || null;
    const bidang  = document.getElementById('alumni-filter-bidang')?.value  ?? '';
    const tipe    = document.getElementById('alumni-filter-tipe')?.value    ?? '';
    const sumber  = document.getElementById('alumni-filter-sumber')?.value  ?? '';

    filtered = allData.filter(r => {
      if (dari   && r.tahun < dari)   return false;
      if (sampai && r.tahun > sampai) return false;
      if (bidang && r.bidang !== bidang) return false;
      if (tipe   && r.tipe  !== tipe)   return false;
      if (sumber && r._sumber !== sumber) return false;
      if (search) {
        const hay = [r.nama, r.instansi, r.nik, r.namaBimtek].join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    rows = mode === 'peserta' ? groupByPeserta(filtered) : filtered;
    if (mode === 'peserta' && sortKey) sortRows();
    page = 1;
    renderPage();
  }

  function sortRows() {
    const dir = sortDir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const va = sortKey === 'jmlBimtek' ? a._riwayat.length : (a[sortKey] ?? '');
      const vb = sortKey === 'jmlBimtek' ? b._riwayat.length : (b[sortKey] ?? '');
      if (typeof va === 'number' || typeof vb === 'number') return ((va || 0) - (vb || 0)) * dir;
      return String(va).localeCompare(String(vb), 'id') * dir;
    });
  }

  function renderPage() {
    const thead  = document.getElementById('alumni-thead');
    const tbody  = document.getElementById('alumni-tbody');
    const pgEl   = document.getElementById('alumni-pagination');
    const count  = document.getElementById('alumni-count');
    if (!tbody) return;

    if (thead) {
      thead.innerHTML = mode === 'peserta' ? theadPeserta() : THEAD_KEJADIAN;
      if (mode === 'peserta') {
        thead.querySelectorAll('.th-sort').forEach(th => {
          th.addEventListener('click', () => {
            const key = th.dataset.key;
            if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            else { sortKey = key; sortDir = 'asc'; }
            sortRows();
            page = 1;
            renderPage();
          });
        });
      }
    }

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const colspan = mode === 'peserta' ? 8 : 11;

    if (count) {
      count.textContent = mode === 'peserta'
        ? `${rows.length.toLocaleString('id-ID')} peserta unik`
        : `${rows.length.toLocaleString('id-ID')} record`;
    }

    tbody.innerHTML = slice.length
      ? slice.map((r, i) => mode === 'peserta'
          ? _buildRowsPeserta(r, (page - 1) * PAGE_SIZE + i)
          : _buildRows(r, (page - 1) * PAGE_SIZE + i)).join('')
      : `<tr><td colspan="${colspan}" class="text-center py-10 text-gray-500 text-xs">Tidak ada data yang sesuai filter</td></tr>`;

    // Bind expand toggle
    tbody.querySelectorAll('.btn-expand').forEach(btn => {
      btn.addEventListener('click', () => {
        const expandRow = document.getElementById(`expand-${btn.dataset.idx}`);
        const chevron   = btn.querySelector('.chevron');
        if (!expandRow) return;
        const isOpen = expandRow.classList.toggle('hidden');
        chevron?.classList.toggle('rotate-180', !isOpen);
      });
    });

    // Pagination controls
    if (pgEl) {
      pgEl.innerHTML = totalPages <= 1 ? '' : `
        <button id="pg-prev" class="px-3 py-1.5 rounded-lg border border-gray-700 hover:bg-gray-800
          transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-400"
          ${page <= 1 ? 'disabled' : ''}>← Prev</button>
        <span class="text-gray-500">Halaman ${page} / ${totalPages}</span>
        <button id="pg-next" class="px-3 py-1.5 rounded-lg border border-gray-700 hover:bg-gray-800
          transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-400"
          ${page >= totalPages ? 'disabled' : ''}>Next →</button>`;

      pgEl.querySelector('#pg-prev')?.addEventListener('click', () => { page--; renderPage(); pane.scrollIntoView({ behavior: 'smooth' }); });
      pgEl.querySelector('#pg-next')?.addEventListener('click', () => { page++; renderPage(); pane.scrollIntoView({ behavior: 'smooth' }); });
    }
  }

  document.getElementById('alumni-mode-kejadian')?.addEventListener('click', () => {
    if (mode === 'kejadian') return;
    mode = 'kejadian';
    applyModeStyle();
    applyFilter();
  });
  document.getElementById('alumni-mode-peserta')?.addEventListener('click', () => {
    if (mode === 'peserta') return;
    mode = 'peserta';
    applyModeStyle();
    applyFilter();
  });

  // Bind filter events
  ['alumni-search','alumni-filter-tahun-dari','alumni-filter-tahun-sampai',
   'alumni-filter-bidang','alumni-filter-tipe','alumni-filter-sumber'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener(id === 'alumni-search' ? 'input' : 'change', applyFilter);
  });

  applyModeStyle();
  applyFilter();
}

// ─── Row builder ─────────────────────────────────────────────

function _buildRows(r, idx) {
  const tipeBadge = r.tipe === 'pnbp'
    ? `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-900/40 text-amber-400 border border-amber-700/30">PNBP</span>`
    : r.tipe
      ? `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/40 text-blue-400 border border-blue-700/30">Reguler</span>`
      : '—';

  const sumberBadge = r._sumber === 'Sistem'
    ? `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-900/40 text-teal-400 border border-teal-700/30">Sistem</span>`
    : `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-700/60 text-gray-400 border border-gray-600/30">Historis</span>`;

  const mainRow = `
    <tr class="hover:bg-gray-800/40 transition-colors cursor-pointer group">
      <td class="px-3 py-2.5 text-center">
        <button class="btn-expand p-1 rounded hover:bg-gray-700 text-gray-600 hover:text-gray-300 transition-colors"
          data-idx="${idx}" title="Detail">
          <svg class="chevron w-3.5 h-3.5 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </td>
      <td class="px-3 py-2.5 text-sm text-gray-200 font-medium">${_esc(r.nama) || '—'}</td>
      <td class="px-3 py-2.5 text-xs font-mono text-gray-500">${_esc(r.nik) || '—'}</td>
      <td class="px-3 py-2.5 text-xs text-gray-400">${_esc(r.instansi) || '—'}</td>
      <td class="px-3 py-2.5 text-xs text-gray-400">${_esc(r.kabKota) || '—'}</td>
      <td class="px-3 py-2.5 text-xs text-gray-400">${_esc(r.provinsi) || '—'}</td>
      <td class="px-3 py-2.5 text-xs text-gray-300 font-mono">${r.tahun ?? '—'}</td>
      <td class="px-3 py-2.5 text-xs text-gray-300">${_esc(r.namaBimtek) || '—'}</td>
      <td class="px-3 py-2.5 text-xs text-gray-400">${_esc(BIDANG_LABEL[r.bidang] ?? r.bidang) || '—'}</td>
      <td class="px-3 py-2.5">${tipeBadge}</td>
      <td class="px-3 py-2.5">${sumberBadge}</td>
    </tr>`;

  const lulusCell = r.lulus === true
    ? `<span class="text-teal-400">✓ Lulus</span>`
    : r.lulus === false
      ? `<span class="text-red-400">✗ Tidak Lulus</span>`
      : `<span class="text-gray-600">—</span>`;

  const expandRow = `
    <tr id="expand-${idx}" class="hidden bg-gray-800/30">
      <td></td>
      <td colspan="10" class="px-4 pb-4 pt-2">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-2 text-xs">
          ${_detailCell('Jabatan',       r.jabatan)}
          ${_detailCell('Pendidikan',    r.pendidikan)}
          ${_detailCell('Jenis Kelamin', r.jenisKelamin === 'L' ? 'Laki-laki' : r.jenisKelamin === 'P' ? 'Perempuan' : r.jenisKelamin)}
          ${_detailCell('Mode',          r.mode)}
          ${_detailCell('Jenis Lokasi',  r.jenisLokasi)}
          <div><p class="text-gray-600 mb-0.5">Tgl Mulai</p><p class="text-gray-300">${_fmtTgl(r.tglMulai)}</p></div>
          <div><p class="text-gray-600 mb-0.5">Tgl Selesai</p><p class="text-gray-300">${_fmtTgl(r.tglSelesai)}</p></div>
          <div><p class="text-gray-600 mb-0.5">Lulus</p><p class="text-gray-300">${lulusCell}</p></div>
          ${_detailCell('Email',         r.email)}
          ${_detailCell('No HP',         r.noHp)}
        </div>
      </td>
    </tr>`;

  return mainRow + expandRow;
}

function _buildRowsPeserta(g, idx) {
  const mainRow = `
    <tr class="hover:bg-gray-800/40 transition-colors cursor-pointer group">
      <td class="px-3 py-2.5 text-center">
        <button class="btn-expand p-1 rounded hover:bg-gray-700 text-gray-600 hover:text-gray-300 transition-colors"
          data-idx="${idx}" title="Riwayat bimtek">
          <svg class="chevron w-3.5 h-3.5 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </td>
      <td class="px-3 py-2.5 text-sm text-gray-200 font-medium">${_esc(g.nama) || '—'}</td>
      <td class="px-3 py-2.5 text-xs font-mono text-gray-500">${_esc(g.nik) || '—'}</td>
      <td class="px-3 py-2.5 text-xs text-gray-400">${_esc(g.instansi) || '—'}</td>
      <td class="px-3 py-2.5 text-xs text-gray-400">${_esc(g.kabKota) || '—'}</td>
      <td class="px-3 py-2.5 text-xs text-gray-400">${_esc(g.provinsi) || '—'}</td>
      <td class="px-3 py-2.5 text-xs text-gray-300 font-mono text-center">${g._riwayat.length}</td>
      <td class="px-3 py-2.5 text-xs text-gray-300">${_esc(g.namaBimtek) || '—'} ${g.tahun ? `<span class="text-gray-600">(${g.tahun})</span>` : ''}</td>
    </tr>`;

  const expandRow = `
    <tr id="expand-${idx}" class="hidden bg-gray-800/30">
      <td></td>
      <td colspan="7" class="px-4 pb-4 pt-2">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-600">
              <th class="text-left font-medium py-1 pr-3">Tahun</th>
              <th class="text-left font-medium py-1 pr-3">Nama Bimtek</th>
              <th class="text-left font-medium py-1 pr-3">Bidang</th>
              <th class="text-left font-medium py-1 pr-3">Tipe</th>
              <th class="text-left font-medium py-1 pr-3">Lulus</th>
              <th class="text-left font-medium py-1">Sumber</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800/40">
            ${g._riwayat.map(r => `
              <tr>
                <td class="py-1.5 pr-3 text-gray-300 font-mono">${r.tahun ?? '—'}</td>
                <td class="py-1.5 pr-3 text-gray-300">${_esc(r.namaBimtek) || '—'}</td>
                <td class="py-1.5 pr-3 text-gray-400">${_esc(BIDANG_LABEL[r.bidang] ?? r.bidang) || '—'}</td>
                <td class="py-1.5 pr-3 text-gray-400">${r.tipe === 'pnbp' ? 'PNBP' : r.tipe === 'reguler' ? 'Reguler' : '—'}</td>
                <td class="py-1.5 pr-3">${r.lulus === true ? '<span class="text-teal-400">✓ Lulus</span>' : r.lulus === false ? '<span class="text-red-400">✗ Tidak Lulus</span>' : '<span class="text-gray-600">—</span>'}</td>
                <td class="py-1.5 text-gray-400">${r._sumber === 'Sistem' ? 'Sistem' : 'Historis'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </td>
    </tr>`;

  return mainRow + expandRow;
}

function _detailCell(label, val) {
  return `<div>
    <p class="text-gray-600 mb-0.5">${label}</p>
    <p class="text-gray-300">${_esc(val) || '—'}</p>
  </div>`;
}

// ─── Skeleton ─────────────────────────────────────────────────

function _skeleton() {
  return `<div class="animate-pulse space-y-3">
    <div class="h-8 bg-gray-800 rounded-lg w-full"></div>
    <div class="h-64 bg-gray-800 rounded-xl"></div>
  </div>`;
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Normalisasi untuk kunci pengelompokan peserta: lowercase, hapus tanda baca &
// spasi berlebih, supaya beda kapitalisasi/spasi tidak dianggap orang berbeda.
function _norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[.,\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Tangani serial date Excel (number atau string angka) maupun string tanggal biasa
function _fmtTgl(val) {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (!isNaN(num) && num > 1000) {
    // Excel serial date: hari sejak 1 Jan 1900
    const ms = (num - 25569) * 86400 * 1000;
    const d  = new Date(ms);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }
  return String(val);
}
