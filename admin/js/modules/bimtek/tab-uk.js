// admin/js/modules/bimtek/tab-uk.js
// Tab Kompetensi di detail bimtek — manage daftar UK yang diukur.

import { updateBimtek } from './api.js';
import { listUKAktif, getUK } from '../master-uk/api.js';
import { showToast } from '../../components/toast.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';

/**
 * @param {HTMLElement} el        - container #tab-content
 * @param {string}      bimtekId
 * @param {object}      bimtek    - bimtek doc data
 * @param {function}    onUpdate  - callback(updatedEkIds) setelah save
 */
export async function renderTabUK(el, bimtekId, bimtek, onUpdate) {
  el.innerHTML = `
    <div class="flex justify-center py-8">
      <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  const canEdit = ['draft', 'planned', 'ongoing'].includes(bimtek?.status);

  try {
    // Load UK yang saat ini di-assign ke bimtek ini
    const currentEkIds = bimtek.ukIds || [];

    // Load detail UK yang ter-assign (termasuk yang mungkin sudah nonaktif)
    const assignedEKs = currentEkIds.length
      ? await Promise.all(currentEkIds.map(id => getUK(id).catch(() => ({ id, kode: null, nama: '(tidak ditemukan)', status: 'nonaktif' }))))
      : [];

    _render(el, bimtekId, bimtek, assignedEKs, canEdit, onUpdate);
  } catch (err) {
    el.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat: ${err.message}</div>`;
  }
}

function _render(el, bimtekId, bimtek, assignedEKs, canEdit, onUpdate) {
  const hasEK = assignedEKs.length > 0;

  el.innerHTML = `
    <div class="space-y-4">
      <!-- Header info -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-sm font-semibold text-white mb-1">Unit Kompetensi yang Diukur</h3>
            <p class="text-xs text-gray-500">
              Daftar UK yang menjadi target pembelajaran di bimtek ini.<br/>
              Laporan peserta Section C akan menggunakan daftar ini sebagai baseline.
            </p>
          </div>
          ${canEdit ? `
            <button id="btn-kelola-uk"
                    class="shrink-0 px-3 py-1.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">
              + Kelola UK
            </button>` : ''}
        </div>
      </div>

      <!-- Warning jika belum ada UK -->
      ${!hasEK ? `
        <div class="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 flex items-start gap-3">
          <svg class="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <div>
            <p class="text-sm font-medium text-yellow-400">UK belum didefinisikan</p>
            <p class="text-xs text-yellow-500/80 mt-0.5">
              Laporan peserta akan menggunakan UK yang auto-discovered dari soal ujian.
              Untuk laporan yang lebih akurat, definisikan UK yang ingin diukur.
            </p>
          </div>
        </div>` : ''}

      <!-- List UK yang ter-assign -->
      <div id="uk-list-container">
        ${_buildEKList(assignedEKs)}
      </div>
    </div>
  `;

  // Bind tombol kelola
  el.querySelector('#btn-kelola-uk')?.addEventListener('click', () => {
    _openEKPicker(bimtekId, bimtek, assignedEKs, async (newEkIds) => {
      // Update di Firestore
      try {
        await updateBimtek(bimtekId, { ukIds: newEkIds });
        showToast('Daftar UK disimpan.', 'success');
        onUpdate?.(newEkIds);
        // Re-render tab
        const updatedBimtek = { ...bimtek, ukIds: newEkIds };
        const updatedEKs = newEkIds.length
          ? await Promise.all(newEkIds.map(id => getUK(id).catch(() => ({ id, kode: null, nama: '(tidak ditemukan)', status: 'nonaktif' }))))
          : [];
        _render(el, bimtekId, updatedBimtek, updatedEKs, canEdit, onUpdate);
      } catch (err) {
        showToast('Gagal menyimpan: ' + err.message, 'error');
      }
    });
  });
}

function _buildEKList(assignedEKs) {
  if (!assignedEKs.length) {
    return `<p class="text-sm text-gray-600 italic text-center py-4">Belum ada UK yang didefinisikan.</p>`;
  }

  const rows = assignedEKs.map((ek, i) => `
    <tr>
      <td class="text-center text-gray-500 w-8">${i + 1}</td>
      <td>
        ${ek.kode
          ? `<span class="font-mono text-sm font-semibold text-blue-400">${_esc(ek.kode)}</span>`
          : `<span class="text-xs text-gray-500 italic">Non-SKKNI</span>`}
        ${ek.status === 'nonaktif' ? `<span class="ml-2 badge badge-gray text-xs">nonaktif</span>` : ''}
      </td>
      <td>
        <div class="text-sm text-white">${_esc(ek.nama)}</div>
        ${ek.deskripsi ? `<div class="text-xs text-gray-500 mt-0.5">${_esc(ek.deskripsi)}</div>` : ''}
      </td>
      <td>
        <div class="flex flex-wrap gap-1">
          ${_renderBidangBadges(ek.bidangIds)}
        </div>
      </td>
    </tr>`).join('');

  return `
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-800">
        <span class="text-xs text-gray-400">${assignedEKs.length} UK terdefinisi untuk bimtek ini</span>
      </div>
      <table class="btam-table">
        <thead>
          <tr>
            <th class="w-8 text-center">#</th>
            <th class="w-28">Kode</th>
            <th>Nama Unit Kompetensi</th>
            <th class="w-40">Bidang Relevan</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── UK PICKER MODAL ─────────────────────────────────────────────────────────

async function _openEKPicker(bimtekId, bimtek, currentAssigned, onSave) {
  const { openModal } = await import('../../components/modal.js');

  // Load semua UK aktif
  const allEK = await listUKAktif();
  const currentIds = new Set(currentAssigned.map(ek => ek.id));

  // State picker
  const selected = new Set(currentIds);

  const bidangBimtek = bimtek.bidangIds || [];

  // Group UK: relevan untuk bidang bimtek ini vs lainnya
  const relevant  = allEK.filter(ek => !ek.bidangIds?.length || ek.bidangIds.some(b => bidangBimtek.includes(b)));
  const others    = allEK.filter(ek => ek.bidangIds?.length && !ek.bidangIds.some(b => bidangBimtek.includes(b)));

  const { close } = openModal({
    title: 'Kelola Unit Kompetensi Bimtek',
    size:  'lg',
    body:  `
      <div class="space-y-4">
        <p class="text-xs text-gray-400">
          Centang UK yang ingin diukur di bimtek ini. UK yang dicentang akan menjadi baseline laporan peserta Section C.
        </p>

        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
               fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input id="uk-picker-search" type="search" placeholder="Cari kode atau nama UK…"
                 class="form-input pl-9 w-full text-sm" />
        </div>

        <div id="uk-picker-list" class="space-y-1 max-h-80 overflow-y-auto">
          ${_buildPickerItems(relevant, others, selected, bidangBimtek)}
        </div>

        <div class="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800">
          <span id="uk-selected-count">${selected.size} UK dipilih</span>
          <button id="btn-clear-uk" class="text-red-400 hover:text-red-300">Hapus semua pilihan</button>
        </div>
      </div>`,
    actions: [
      { label: 'Batal',       type: 'secondary', onClick: ({ close }) => close() },
      { label: 'Simpan UK',   type: 'primary',   onClick: ({ close }) => { onSave([...selected]); close(); } },
    ],
  });

  // Bind search
  let _deb;
  document.getElementById('uk-picker-search')?.addEventListener('input', e => {
    clearTimeout(_deb);
    _deb = setTimeout(() => {
      const q = e.target.value.trim().toLowerCase();
      const filtered   = allEK.filter(ek => !q || ek.kode?.toLowerCase().includes(q) || ek.nama?.toLowerCase().includes(q));
      const filtRel    = filtered.filter(ek => !ek.bidangIds?.length || ek.bidangIds.some(b => bidangBimtek.includes(b)));
      const filtOthers = filtered.filter(ek => ek.bidangIds?.length && !ek.bidangIds.some(b => bidangBimtek.includes(b)));
      document.getElementById('uk-picker-list').innerHTML = _buildPickerItems(filtRel, filtOthers, selected, bidangBimtek);
      _bindPickerCheckboxes(selected);
    }, 200);
  });

  document.getElementById('btn-clear-uk')?.addEventListener('click', () => {
    selected.clear();
    document.querySelectorAll('.uk-picker-cb').forEach(cb => { cb.checked = false; });
    _updateCount(selected);
  });

  _bindPickerCheckboxes(selected);
}

function _buildPickerItems(relevant, others, selected, bidangBimtek) {
  let html = '';

  if (relevant.length) {
    html += `<p class="text-xs font-semibold text-gray-500 px-1 pt-1 pb-0.5 uppercase tracking-wide">Relevan untuk bidang bimtek ini</p>`;
    html += relevant.map(ek => _buildPickerRow(ek, selected)).join('');
  }

  if (others.length) {
    html += `<p class="text-xs font-semibold text-gray-500 px-1 pt-3 pb-0.5 uppercase tracking-wide">UK bidang lain</p>`;
    html += others.map(ek => _buildPickerRow(ek, selected)).join('');
  }

  if (!relevant.length && !others.length) {
    html = `<p class="text-sm text-gray-500 text-center py-4">Tidak ada UK yang cocok.</p>`;
  }

  return html;
}

function _buildPickerRow(ek, selected) {
  const isChecked = selected.has(ek.id);
  return `
    <label class="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors">
      <input type="checkbox" class="uk-picker-cb w-4 h-4 rounded mt-0.5 shrink-0"
             data-id="${ek.id}" ${isChecked ? 'checked' : ''} />
      <div class="min-w-0 flex-1">
        ${ek.kode
          ? `<span class="font-mono text-sm font-semibold text-blue-400">${_esc(ek.kode)}</span>
             ${ek.isSKKNI === false ? '<span class="ml-1 badge badge-gray text-xs">Internal</span>' : ''}`
          : `<span class="text-xs text-gray-500 italic mr-2">Non-SKKNI</span>`}
        <span class="text-sm text-gray-200 ${ek.kode ? 'ml-2' : ''}">${_esc(ek.nama)}</span>
        <div class="flex gap-1 mt-0.5">
          ${_renderBidangBadges(ek.bidangIds)}
        </div>
      </div>
    </label>`;
}

function _bindPickerCheckboxes(selected) {
  document.querySelectorAll('.uk-picker-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(cb.dataset.id);
      else selected.delete(cb.dataset.id);
      _updateCount(selected);
    });
  });
}

function _updateCount(selected) {
  const el = document.getElementById('uk-selected-count');
  if (el) el.textContent = `${selected.size} UK dipilih`;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function _renderBidangBadges(bidangIds = []) {
  if (!bidangIds?.length) return `<span class="text-xs text-gray-600 italic">Semua bidang</span>`;
  return bidangIds.map(id => {
    const b = BIDANG_LIST.find(x => x.bidangId === id);
    if (!b) return `<span class="badge badge-gray text-xs">${id}</span>`;
    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white"
      style="background-color:${b.color}55;border:1px solid ${b.color}80">${b.nama}</span>`;
  }).join('');
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

