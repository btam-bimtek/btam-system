/**
 * bimtek/tab-peserta.js
 * Lokasi: admin/js/modules/bimtek/tab-peserta.js
 *
 * Dipanggil dari detail.js saat user klik tab "Peserta".
 * Pattern: sama dengan _refreshMapel() di detail.js
 */

import { addPesertaToBimtek, removePesertaFromBimtek, getBimtek } from './api.js';
import { db, collection, query, where, getDocs, orderBy } from '../../../../shared/db.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { requireWrite } from '../../auth-guard.js';
import { COL } from '../../../../shared/constants.js';

/**
 * Entry point — dipanggil dari detail.js:
 *   import { renderTabPeserta } from './tab-peserta.js';
 *   renderTabPeserta(pane, bimtekId, _bimtek);
 */
export async function renderTabPeserta(pane, bimtekId, bimtek) {
  await _refresh(pane, bimtekId, bimtek);
}

// ─────────────────────────────────────────────────────────────────────────────

async function _refresh(pane, bimtekId, bimtek) {
  // Re-fetch bimtek untuk pastikan pesertaIds up-to-date
  const b = await getBimtek(bimtekId).catch(() => bimtek);
  const pesertaIds = b.pesertaIds ?? [];

  // Update badge di tab nav
  const badge = document.querySelector('[data-tab="peserta"] .tab-badge');
  if (badge) badge.textContent = pesertaIds.length;

  if (pesertaIds.length === 0) {
    pane.innerHTML = _emptyState(bimtekId, b);
    _attachAddListener(pane, bimtekId, b, _refresh);
    return;
  }

  // Load detail peserta dari peserta_master
  pane.innerHTML = `
    <div class="flex items-center justify-center py-10">
      <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  const pesertaData = await _fetchPesertaDetails(pesertaIds);

  pane.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <span class="text-sm text-gray-400">${pesertaIds.length} peserta</span>
        <span class="text-gray-600 ml-2 text-xs">/ kapasitas ${b.kapasitas ?? '—'}</span>
        ${pesertaIds.length >= (b.kapasitas ?? Infinity)
          ? `<span class="ml-2 text-xs text-yellow-400">⚠ Kapasitas penuh</span>`
          : ''}
      </div>
      <div class="flex items-center gap-2">
        <input type="text" id="peserta-search" class="form-input w-48 py-1 text-xs"
          placeholder="Cari nama / no peserta…">
        <button id="btn-add-peserta"
          class="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Tambah Peserta
        </button>
      </div>
    </div>

    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <table class="w-full text-sm" id="peserta-table">
        <thead>
          <tr class="border-b border-gray-800">
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">No Peserta</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Nama</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Instansi</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Jabatan</th>
            <th class="px-4 py-3 w-16"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800" id="peserta-tbody">
          ${pesertaData.map(p => _buildRow(p)).join('')}
        </tbody>
      </table>
    </div>

    ${pesertaData.some(p => p._orphan) ? `
      <p class="text-xs text-yellow-500 mt-2">
        ⚠ Beberapa peserta tidak ditemukan di master data (ditandai <span class="text-red-400">merah</span>).
        Periksa noPeserta atau hapus dari daftar ini.
      </p>` : ''}
  `;

  // Search filter (client-side)
  pane.querySelector('#peserta-search').addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    pane.querySelectorAll('#peserta-tbody tr').forEach(row => {
      row.style.display = term === '' || row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  });

  _attachAddListener(pane, bimtekId, b, _refresh);

  // Remove listeners
  pane.querySelectorAll('.btn-remove-peserta').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireWrite()) return;
      const np   = btn.dataset.np;
      const nama = btn.dataset.nama;
      const ok = await confirmDialog({
        title: 'Hapus Peserta dari Bimtek',
        message: `Hapus ${nama} dari bimtek ini? Data peserta di master tidak terhapus.`,
        confirmLabel: 'Hapus', danger: true
      });
      if (!ok) return;
      try {
        await removePesertaFromBimtek(bimtekId, np);
        showToast(`${nama} dihapus dari bimtek`, 'success');
        await _refresh(pane, bimtekId, b);
      } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
      }
    });
  });
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function _buildRow(p) {
  const rowClass = p._orphan
    ? 'hover:bg-gray-800/50 transition-colors opacity-60'
    : 'hover:bg-gray-800/50 transition-colors';

  return `
    <tr class="${rowClass}">
      <td class="px-4 py-3 text-xs font-mono ${p._orphan ? 'text-red-400' : 'text-gray-400'}">
        ${_esc(p.noPeserta)}
      </td>
      <td class="px-4 py-3">
        <div class="text-sm font-medium ${p._orphan ? 'text-red-400' : 'text-gray-200'}">
          ${_esc(p.nama)}
        </div>
        ${p._orphan ? `<div class="text-xs text-red-500">Tidak ditemukan di master</div>` : ''}
      </td>
      <td class="px-4 py-3 text-xs text-gray-400">${_esc(p.instansi) || '—'}</td>
      <td class="px-4 py-3 text-xs text-gray-400">${_esc(p.jabatan) || '—'}</td>
      <td class="px-4 py-3">
        <button class="btn-remove-peserta p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors"
          data-np="${_esc(p.noPeserta)}" data-nama="${_esc(p.nama)}" title="Hapus dari bimtek">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"/>
          </svg>
        </button>
      </td>
    </tr>`;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function _emptyState(bimtekId, b) {
  return `
    <div class="flex items-center justify-between mb-4">
      <span class="text-sm text-gray-400">0 peserta</span>
      <button id="btn-add-peserta"
        class="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Tambah Peserta
      </button>
    </div>
    <div class="flex flex-col items-center justify-center py-16 text-gray-500">
      <svg class="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
      <p class="text-sm">Belum ada peserta terdaftar</p>
      <p class="text-xs mt-1">Klik "Tambah Peserta" untuk mendaftarkan peserta ke bimtek ini</p>
    </div>`;
}

// ─── Add peserta modal ────────────────────────────────────────────────────────

function _attachAddListener(pane, bimtekId, bimtek, refreshFn) {
  pane.querySelector('#btn-add-peserta')?.addEventListener('click', () => {
    if (!requireWrite()) return;
    _openAddModal(bimtekId, bimtek, () => refreshFn(pane, bimtekId, bimtek));
  });
}

function _openAddModal(bimtekId, bimtek, onSuccess) {
  const existing = document.getElementById('modal-add-peserta');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modal-add-peserta';
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm';
  document.body.appendChild(overlay);

  overlay.innerHTML = `
    <div class="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
        <div>
          <h2 class="text-sm font-semibold text-white">Tambah Peserta</h2>
          <p class="text-xs text-gray-500 mt-0.5">Cari dari master peserta, lalu pilih</p>
        </div>
        <button id="btn-close-add" class="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Search -->
      <div class="px-5 py-3 border-b border-gray-800 shrink-0">
        <input type="text" id="master-search"
          class="form-input w-full text-sm"
          placeholder="Ketik nama atau no peserta…">
      </div>

      <!-- Results -->
      <div id="search-results" class="flex-1 overflow-y-auto px-5 py-3">
        <p class="text-xs text-gray-500 text-center py-4">Ketik minimal 2 karakter untuk mencari</p>
      </div>

      <!-- Selected summary -->
      <div id="selected-summary" class="px-5 py-3 border-t border-gray-800 shrink-0" style="display:none">
        <p class="text-xs text-gray-400 mb-2">Dipilih: <span id="selected-count" class="text-white font-medium">0</span> peserta</p>
        <div id="selected-chips" class="flex flex-wrap gap-1.5"></div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between px-5 py-4 border-t border-gray-800 shrink-0">
        <button id="btn-cancel-add" class="text-xs text-gray-400 hover:text-white transition-colors">Batal</button>
        <button id="btn-confirm-add"
          class="px-4 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
          disabled>
          Tambahkan ke Bimtek
        </button>
      </div>
    </div>
  `;

  const close = () => overlay.remove();
  overlay.querySelector('#btn-close-add').addEventListener('click', close);
  overlay.querySelector('#btn-cancel-add').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // State
  const selected = new Map(); // noPeserta → {noPeserta, nama}
  const existingIds = new Set(bimtek.pesertaIds ?? []);

  function updateSelectedUI() {
    const summary = overlay.querySelector('#selected-summary');
    const chips   = overlay.querySelector('#selected-chips');
    const count   = overlay.querySelector('#selected-count');
    const btn     = overlay.querySelector('#btn-confirm-add');
    const n = selected.size;

    if (n === 0) {
      summary.style.display = 'none';
      btn.disabled = true;
      return;
    }
    summary.style.display = '';
    count.textContent = n;
    btn.disabled = false;
    chips.innerHTML = [...selected.values()].map(p => `
      <span class="inline-flex items-center gap-1 bg-blue-900/50 border border-blue-700/40 rounded px-2 py-0.5 text-xs text-blue-300">
        ${_esc(p.nama)}
        <button class="chip-remove hover:text-white transition-colors" data-np="${_esc(p.noPeserta)}">×</button>
      </span>`).join('');

    chips.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        selected.delete(btn.dataset.np);
        // uncheck di results kalau masih visible
        const cb = overlay.querySelector(`input[data-np="${btn.dataset.np}"]`);
        if (cb) cb.checked = false;
        updateSelectedUI();
      });
    });
  }

  function renderResults(results) {
    const el = overlay.querySelector('#search-results');
    if (!results.length) {
      el.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Tidak ada hasil</p>';
      return;
    }
    el.innerHTML = results.map(p => {
      const alreadyIn = existingIds.has(p.noPeserta);
      const isSelected = selected.has(p.noPeserta);
      return `
        <label class="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0 cursor-pointer
          ${alreadyIn ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-800/50'} rounded px-1 transition-colors">
          <input type="checkbox" class="w-4 h-4 rounded result-cb" data-np="${_esc(p.noPeserta)}"
            ${isSelected ? 'checked' : ''} ${alreadyIn ? 'disabled' : ''}>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-gray-200 font-medium">${_esc(p.nama)}</div>
            <div class="text-xs text-gray-500 mt-0.5">
              ${_esc(p.noPeserta)}
              ${p.jabatan ? `· ${_esc(p.jabatan)}` : ''}
              ${p.instansi ? `· ${_esc(p.instansi)}` : ''}
              ${alreadyIn ? '· <span class="text-yellow-500">Sudah terdaftar</span>' : ''}
            </div>
          </div>
        </label>`;
    }).join('');

    el.querySelectorAll('.result-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const np = cb.dataset.np;
        const row = results.find(p => p.noPeserta === np);
        if (!row) return;
        if (cb.checked) selected.set(np, row);
        else selected.delete(np);
        updateSelectedUI();
      });
    });
  }

  // Search
  let _timer;
  overlay.querySelector('#master-search').addEventListener('input', e => {
    clearTimeout(_timer);
    const term = e.target.value.trim();
    if (term.length < 2) {
      overlay.querySelector('#search-results').innerHTML =
        '<p class="text-xs text-gray-500 text-center py-4">Ketik minimal 2 karakter</p>';
      return;
    }
    overlay.querySelector('#search-results').innerHTML =
      '<div class="flex justify-center py-4"><div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>';
    _timer = setTimeout(async () => {
      try {
        const results = await _searchMaster(term, existingIds);
        renderResults(results);
      } catch (err) {
        overlay.querySelector('#search-results').innerHTML =
          `<p class="text-xs text-red-400 text-center py-4">Error: ${err.message}</p>`;
      }
    }, 350);
  });

  // Confirm
  overlay.querySelector('#btn-confirm-add').addEventListener('click', async () => {
    if (!selected.size) return;
    const btn = overlay.querySelector('#btn-confirm-add');
    btn.disabled = true;
    btn.textContent = 'Memeriksa…';

    try {
      // Cek aturan 3 tahun hanya jika diaktifkan di bimtek ini
      if (bimtek.larangRepeatBimtek3Tahun) {
        const warnings = await _checkEnrollmentRule(selected, bimtek);
        if (warnings.length > 0) {
          btn.disabled = false;
          btn.textContent = 'Tambahkan ke Bimtek';
          const proceed = await _showEnrollmentWarning(warnings);
          if (!proceed) return;
          btn.disabled = true;
          btn.textContent = 'Menambahkan…';
        }
      } else {
        btn.textContent = 'Menambahkan…';
      }

      await addPesertaToBimtek(bimtekId, [...selected.keys()]);
      showToast(`${selected.size} peserta berhasil ditambahkan`, 'success');
      close();
      await onSuccess();
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Tambahkan ke Bimtek';
    }
  });
}

// ─── Search helper ────────────────────────────────────────────────────────────

async function _searchMaster(term, excludeIds) {
  // Filter client-side, konsisten dengan listPeserta() di peserta-master/api.js
  const q = query(
    collection(db, 'peserta_master'),
    where('deleted', '==', false),
    orderBy('nama')
  );
  const snap = await getDocs(q);
  const lower = term.toLowerCase();
  const merged = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p =>
      p.nama?.toLowerCase().includes(lower) ||
      p.noPeserta?.toLowerCase().includes(lower) ||
      p.instansi?.toLowerCase().includes(lower)
    );

  return merged.slice(0, 25);
}

// ─── Fetch details ────────────────────────────────────────────────────────────

async function _fetchPesertaDetails(ids) {
  const results = [];
  // Firestore 'in' max 30 per query
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const q = query(
      collection(db, 'peserta_master'),
      where('noPeserta', 'in', chunk),
      where('deleted', '==', false)
    );
    const snap = await getDocs(q);
    snap.docs.forEach(d => results.push({ id: d.id, ...d.data() }));
  }

  // Orphan check: ada di bimtek tapi tidak di master
  const found = new Set(results.map(p => p.noPeserta));
  ids.filter(np => !found.has(np)).forEach(np => {
    results.push({ noPeserta: np, nama: np, instansi: null, jabatan: null, _orphan: true });
  });

  // Preserve original order dari pesertaIds
  const order = new Map(ids.map((np, i) => [np, i]));
  return results.sort((a, b) => (order.get(a.noPeserta) ?? 999) - (order.get(b.noPeserta) ?? 999));
}

// ─── Aturan Enrollment 3 Tahun ───────────────────────────────────────────────

// Jaccard word similarity — kata pendek (≤2 huruf) diabaikan
function _jaccard(a, b) {
  const words = s => new Set(s.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  const wA = words(a), wB = words(b);
  const inter = [...wA].filter(w => wB.has(w)).length;
  const union = new Set([...wA, ...wB]).size;
  return union === 0 ? 0 : inter / union;
}

/**
 * Cek apakah peserta yang akan dienroll pernah ikut bimtek serupa dalam 3 tahun terakhir.
 * @param {Map} selected  - Map noPeserta → {noPeserta, nama, instansi}
 * @param {object} bimtek - bimtek yang akan dienroll
 * @returns {Promise<Array>} warnings: [{noPeserta, namaPeserta, tahun, bimtekNama, source}]
 */
async function _checkEnrollmentRule(selected, bimtek) {
  const periodeDate = bimtek.periode?.mulai?.toDate?.() ?? (bimtek.periode?.mulai ? new Date(bimtek.periode.mulai) : new Date());
  const currentYear = periodeDate.getFullYear();
  const minYear     = currentYear - 2;
  const bimtekNama  = bimtek.nama ?? '';
  const warnings    = [];

  // ── Sumber 1: Bimtek sistem baru ──────────────────────────────────────────
  // Fetch semua bimtek (biasanya < 200), filter by tahun + nama similarity
  const snapBimtek = await getDocs(collection(db, COL.BIMTEK));
  const selectedIds = new Set(selected.keys());

  snapBimtek.docs.forEach(d => {
    if (d.id === bimtek.id) return; // skip bimtek itu sendiri
    const b    = d.data();
    const yr   = b.periode?.mulai?.toDate?.().getFullYear()
              ?? (b.periode?.mulai ? new Date(b.periode.mulai).getFullYear() : null);
    if (!yr || yr < minYear || yr > currentYear) return;
    if (_jaccard(bimtekNama, b.nama ?? '') < 0.5) return;

    (b.pesertaIds ?? []).forEach(np => {
      if (!selectedIds.has(np)) return;
      const p = selected.get(np);
      warnings.push({ noPeserta: np, namaPeserta: p.nama, tahun: yr, bimtekNama: b.nama, source: 'Sistem' });
    });
  });

  // ── Sumber 2: alumni_historis ─────────────────────────────────────────────
  const snapAlumni = await getDocs(
    query(collection(db, COL.ALUMNI_HISTORIS),
      where('tahun', '>=', minYear),
      where('tahun', '<=', currentYear))
  );

  snapAlumni.docs.forEach(d => {
    const r = d.data();
    if (_jaccard(bimtekNama, r.nama_bimtek ?? '') < 0.5) return;

    // Match peserta: cek apakah ada selected peserta dengan nama mirip dari instansi yang sama
    for (const [np, p] of selected.entries()) {
      const namaMatch = _jaccard(p.nama ?? '', r.nama ?? '') >= 0.6;
      const instMatch = !r.instansi || !p.instansi || _jaccard(p.instansi, r.instansi) >= 0.4;
      if (namaMatch && instMatch) {
        // Hindari duplikat entry yang sama
        const alreadyAdded = warnings.some(w =>
          w.noPeserta === np && w.tahun === r.tahun && w.bimtekNama === r.nama_bimtek);
        if (!alreadyAdded) {
          warnings.push({ noPeserta: np, namaPeserta: p.nama, tahun: r.tahun, bimtekNama: r.nama_bimtek, source: 'Historis' });
        }
      }
    }
  });

  return warnings;
}

/**
 * Tampilkan modal warning aturan 3 tahun.
 * Resolve true jika admin pilih "Tetap Daftarkan", false jika Batalkan.
 */
function _showEnrollmentWarning(warnings) {
  return new Promise(resolve => {
    const existing = document.getElementById('modal-enroll-warning');
    if (existing) existing.remove();

    const grouped = {};
    warnings.forEach(w => {
      if (!grouped[w.noPeserta]) grouped[w.noPeserta] = { nama: w.namaPeserta, hits: [] };
      grouped[w.noPeserta].hits.push(w);
    });

    const rows = Object.values(grouped).map(g => `
      <div class="mb-3 last:mb-0">
        <p class="text-sm font-medium text-yellow-300">${_esc(g.nama)}</p>
        <ul class="mt-1 space-y-0.5">
          ${g.hits.map(h => `
            <li class="text-xs text-gray-400 flex items-start gap-1.5">
              <span class="text-yellow-500 mt-0.5">•</span>
              <span>${_esc(h.bimtekNama)} — <span class="text-gray-300">${h.tahun}</span>
              <span class="ml-1 text-gray-600">(${h.source})</span></span>
            </li>`).join('')}
        </ul>
      </div>`).join('');

    const el = document.createElement('div');
    el.id = 'modal-enroll-warning';
    el.className = 'fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4';
    el.innerHTML = `
      <div class="bg-gray-900 border border-yellow-700/50 rounded-2xl shadow-2xl w-full max-w-md">
        <div class="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
          <svg class="w-5 h-5 text-yellow-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <h3 class="text-sm font-semibold text-white">Peringatan: Aturan 3 Tahun</h3>
        </div>
        <div class="px-5 py-4">
          <p class="text-xs text-gray-400 mb-4">
            Peserta berikut terdeteksi pernah mengikuti bimtek serupa dalam 3 tahun terakhir:
          </p>
          <div class="bg-gray-800/60 rounded-lg px-4 py-3 max-h-52 overflow-y-auto">
            ${rows}
          </div>
          <p class="text-xs text-gray-500 mt-3">Admin dapat tetap mendaftarkan peserta dengan memilih "Tetap Daftarkan".</p>
        </div>
        <div class="px-5 py-4 border-t border-gray-800 flex justify-end gap-3">
          <button id="btn-warn-cancel" class="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            Batalkan
          </button>
          <button id="btn-warn-override" class="px-4 py-2 rounded-lg text-xs bg-yellow-600 hover:bg-yellow-500 text-white font-medium transition-colors">
            Tetap Daftarkan
          </button>
        </div>
      </div>`;

    document.body.appendChild(el);
    el.querySelector('#btn-warn-cancel').addEventListener('click', () => { el.remove(); resolve(false); });
    el.querySelector('#btn-warn-override').addEventListener('click', () => { el.remove(); resolve(true); });
  });
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
