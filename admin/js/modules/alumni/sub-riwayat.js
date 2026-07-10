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
        <thead>
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
          </tr>
        </thead>
        <tbody id="alumni-tbody" class="divide-y divide-gray-800/60"></tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div id="alumni-pagination" class="flex items-center justify-between mt-4 text-xs text-gray-500"></div>
  `;

  // ─── State ───────────────────────────────────────────────────
  const PAGE_SIZE = 50;
  let filtered = [...allData];
  let page     = 1;

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

    page = 1;
    renderPage();
  }

  function renderPage() {
    const tbody  = document.getElementById('alumni-tbody');
    const pgEl   = document.getElementById('alumni-pagination');
    const count  = document.getElementById('alumni-count');
    if (!tbody) return;

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (count) count.textContent = `${filtered.length.toLocaleString('id-ID')} record`;

    tbody.innerHTML = slice.length
      ? slice.map((r, i) => _buildRows(r, (page - 1) * PAGE_SIZE + i)).join('')
      : `<tr><td colspan="11" class="text-center py-10 text-gray-500 text-xs">Tidak ada data yang sesuai filter</td></tr>`;

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

  // Bind filter events
  ['alumni-search','alumni-filter-tahun-dari','alumni-filter-tahun-sampai',
   'alumni-filter-bidang','alumni-filter-tipe','alumni-filter-sumber'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener(id === 'alumni-search' ? 'input' : 'change', applyFilter);
  });

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
          ${_detailCell('Tgl Mulai',     r.tglMulai)}
          ${_detailCell('Tgl Selesai',   r.tglSelesai)}
          <div><p class="text-gray-600 mb-0.5">Lulus</p><p class="text-gray-300">${lulusCell}</p></div>
          ${_detailCell('Email',         r.email)}
          ${_detailCell('No HP',         r.noHp)}
        </div>
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
