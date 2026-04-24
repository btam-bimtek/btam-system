/**
 * bimtek/tab-pengajar.js
 * Lokasi: admin/js/modules/bimtek/tab-pengajar.js
 *
 * Tab Pengajar di detail Bimtek.
 * List pengajar yang assign ke bimtek + tambah/hapus.
 */

import { addPengajarToBimtek, getBimtek, updateBimtek } from './api.js';
import { db, collection, doc, getDoc, query, where, getDocs } from '../../../../shared/db.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { requireWrite } from '../../auth-guard.js';

export async function renderTabPengajar(pane, bimtekId, bimtek) {
  await _refresh(pane, bimtekId, bimtek);
}

// ─────────────────────────────────────────────────────────────────────────────

async function _refresh(pane, bimtekId, bimtek) {
  const b = await getBimtek(bimtekId).catch(() => bimtek);
  const pengajarIds = b.pengajarIds ?? [];

  if (pengajarIds.length === 0) {
    pane.innerHTML = _emptyState();
    _attachAddListener(pane, bimtekId, b, _refresh);
    return;
  }

  pane.innerHTML = `
    <div class="flex items-center justify-center py-10">
      <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  const pengajarData = await _fetchPengajarDetails(pengajarIds);

  pane.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <span class="text-sm text-gray-400">${pengajarIds.length} pengajar</span>
      <button id="btn-add-pengajar"
        class="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Tambah Pengajar
      </button>
    </div>

    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-800">
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Nama</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Bidang Keahlian</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Mapel Diampu</th>
            <th class="px-4 py-3 w-16"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800">
          ${pengajarData.map(p => _buildRow(p, bimtek)).join('')}
        </tbody>
      </table>
    </div>
  `;

  _attachAddListener(pane, bimtekId, b, _refresh);

  pane.querySelectorAll('.btn-remove-pengajar').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireWrite()) return;
      const pid  = btn.dataset.id;
      const nama = btn.dataset.nama;
      const ok = await confirmDialog({
        title: 'Hapus Pengajar dari Bimtek',
        message: `Hapus ${nama} dari bimtek ini? Pengajar yang sudah di-assign ke mapel tidak akan otomatis dilepas.`,
        confirmLabel: 'Hapus', danger: true
      });
      if (!ok) return;
      try {
        const newIds = (b.pengajarIds ?? []).filter(id => id !== pid);
        await updateBimtek(bimtekId, { pengajarIds: newIds });
        showToast(`${nama} dihapus dari bimtek`, 'success');
        await _refresh(pane, bimtekId, { ...b, pengajarIds: newIds });
      } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
      }
    });
  });
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function _buildRow(p, bimtek) {
  // Hitung berapa mapel yang diampu pengajar ini (dari data mapel jika tersedia)
  // Untuk sekarang kita tampilkan placeholder, mapel count di-load terpisah
  return `
    <tr class="hover:bg-gray-800/50 transition-colors">
      <td class="px-4 py-3">
        <div class="text-sm font-medium text-gray-200">${_esc(p.nama)}</div>
        ${p.nip ? `<div class="text-xs text-gray-500 mt-0.5">NIP: ${_esc(p.nip)}</div>` : ''}
      </td>
      <td class="px-4 py-3 text-xs text-gray-400">
        ${(p.bidangKeahlian ?? []).join(', ') || '—'}
      </td>
      <td class="px-4 py-3 text-xs text-gray-500">
        <span class="mapel-count-${_esc(p.id)}">—</span>
      </td>
      <td class="px-4 py-3">
        <button class="btn-remove-pengajar p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors"
          data-id="${_esc(p.id)}" data-nama="${_esc(p.nama)}" title="Hapus dari bimtek">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </td>
    </tr>`;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function _emptyState() {
  return `
    <div class="flex items-center justify-between mb-4">
      <span class="text-sm text-gray-400">0 pengajar</span>
      <button id="btn-add-pengajar"
        class="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Tambah Pengajar
      </button>
    </div>
    <div class="flex flex-col items-center justify-center py-16 text-gray-500">
      <svg class="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
      <p class="text-sm">Belum ada pengajar</p>
      <p class="text-xs mt-1">Pengajar akan otomatis ditambah saat di-assign ke mata pelajaran</p>
    </div>`;
}

// ─── Add modal ────────────────────────────────────────────────────────────────

function _attachAddListener(pane, bimtekId, bimtek, refreshFn) {
  pane.querySelector('#btn-add-pengajar')?.addEventListener('click', () => {
    if (!requireWrite()) return;
    _openAddModal(bimtekId, bimtek, () => refreshFn(pane, bimtekId, bimtek));
  });
}

function _openAddModal(bimtekId, bimtek, onSuccess) {
  const existing = document.getElementById('modal-add-pengajar');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modal-add-pengajar';
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm';
  document.body.appendChild(overlay);

  overlay.innerHTML = `
    <div class="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
        <div>
          <h2 class="text-sm font-semibold text-white">Tambah Pengajar</h2>
          <p class="text-xs text-gray-500 mt-0.5">Cari dari master pengajar</p>
        </div>
        <button id="btn-close-pengajar" class="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="px-5 py-3 border-b border-gray-800 shrink-0">
        <input type="text" id="pengajar-search"
          class="form-input w-full text-sm" placeholder="Ketik nama pengajar…">
      </div>

      <div id="pengajar-results" class="flex-1 overflow-y-auto px-5 py-3">
        <p class="text-xs text-gray-500 text-center py-4">Ketik untuk mencari</p>
      </div>

      <div id="pengajar-selected-summary" class="px-5 py-3 border-t border-gray-800 shrink-0" style="display:none">
        <p class="text-xs text-gray-400">Dipilih: <span id="pengajar-selected-count" class="text-white font-medium">0</span></p>
      </div>

      <div class="flex items-center justify-between px-5 py-4 border-t border-gray-800 shrink-0">
        <button id="btn-cancel-pengajar" class="text-xs text-gray-400 hover:text-white transition-colors">Batal</button>
        <button id="btn-confirm-pengajar"
          class="px-4 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
          disabled>
          Tambahkan ke Bimtek
        </button>
      </div>
    </div>
  `;

  const close = () => overlay.remove();
  overlay.querySelector('#btn-close-pengajar').addEventListener('click', close);
  overlay.querySelector('#btn-cancel-pengajar').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const existingIds = new Set(bimtek.pengajarIds ?? []);
  const selected = new Map();

  function updateUI() {
    const summary = overlay.querySelector('#pengajar-selected-summary');
    const count   = overlay.querySelector('#pengajar-selected-count');
    const btn     = overlay.querySelector('#btn-confirm-pengajar');
    summary.style.display = selected.size ? '' : 'none';
    if (count) count.textContent = selected.size;
    btn.disabled = selected.size === 0;
  }

  function renderResults(results) {
    const el = overlay.querySelector('#pengajar-results');
    if (!results.length) {
      el.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Tidak ada hasil</p>';
      return;
    }
    el.innerHTML = results.map(p => {
      const alreadyIn  = existingIds.has(p.id);
      const isSelected = selected.has(p.id);
      return `
        <label class="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0 cursor-pointer
          ${alreadyIn ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-800/50'} rounded px-1 transition-colors">
          <input type="checkbox" class="w-4 h-4 rounded result-cb" data-id="${_esc(p.id)}"
            ${isSelected ? 'checked' : ''} ${alreadyIn ? 'disabled' : ''}>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-gray-200 font-medium">${_esc(p.nama)}</div>
            <div class="text-xs text-gray-500 mt-0.5">
              ${p.nip ? `NIP: ${_esc(p.nip)} · ` : ''}
              ${(p.bidangKeahlian ?? []).join(', ') || ''}
              ${alreadyIn ? ' · <span class="text-yellow-500">Sudah terdaftar</span>' : ''}
            </div>
          </div>
        </label>`;
    }).join('');

    el.querySelectorAll('.result-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const id  = cb.dataset.id;
        const row = results.find(p => p.id === id);
        if (!row) return;
        if (cb.checked) selected.set(id, row);
        else selected.delete(id);
        updateUI();
      });
    });
  }

  let _timer;
  overlay.querySelector('#pengajar-search').addEventListener('input', e => {
    clearTimeout(_timer);
    const term = e.target.value.trim();
    if (term.length < 2) {
      overlay.querySelector('#pengajar-results').innerHTML =
        '<p class="text-xs text-gray-500 text-center py-4">Ketik minimal 2 karakter</p>';
      return;
    }
    overlay.querySelector('#pengajar-results').innerHTML =
      '<div class="flex justify-center py-4"><div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>';
    _timer = setTimeout(async () => {
      try {
        const results = await _searchPengajarMaster(term);
        renderResults(results);
      } catch (err) {
        overlay.querySelector('#pengajar-results').innerHTML =
          `<p class="text-xs text-red-400 text-center py-4">Error: ${err.message}</p>`;
      }
    }, 350);
  });

  overlay.querySelector('#btn-confirm-pengajar').addEventListener('click', async () => {
    if (!selected.size) return;
    const btn = overlay.querySelector('#btn-confirm-pengajar');
    btn.disabled = true;
    btn.textContent = 'Menambahkan…';
    try {
      await addPengajarToBimtek(bimtekId, [...selected.keys()]);
      showToast(`${selected.size} pengajar berhasil ditambahkan`, 'success');
      close();
      await onSuccess();
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Tambahkan ke Bimtek';
    }
  });
}

// ─── Search & fetch ───────────────────────────────────────────────────────────

async function _searchPengajarMaster(term) {
  const upper = term.toUpperCase();
  const q = query(
    collection(db, 'pengajar_master'),
    where('deleted', '==', false),
    where('namaUpper', '>=', upper),
    where('namaUpper', '<=', upper + '\uf8ff')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 25);
}

async function _fetchPengajarDetails(ids) {
  const results = [];
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const snaps = await Promise.all(
      chunk.map(id => getDoc(doc(db, 'pengajar_master', id)).catch(() => null))
    );
    snaps.forEach((d, idx) => {
      if (d?.exists()) results.push({ id: d.id, ...d.data() });
      else results.push({ id: chunk[idx], nama: chunk[idx], _orphan: true });
    });
  }
  return results;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
