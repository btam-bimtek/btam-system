// admin/js/modules/master-uk/index.js
// List + form (modal) untuk Master Unit Kompetensi.

import { setPageTitle } from '../../layout/navbar.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { requireWrite } from '../../auth-guard.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';
import {
  listUK, countUK, createUK, updateUK, deleteUK, bulkImportUK
} from './api.js';
import { openImportUK } from './import.js';

const PER_PAGE = 50;

let _state = {
  data: [], total: 0, page: 1, search: '', filterStatus: 'aktif',
  loading: false, lastDocs: [null],
};

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────

export async function renderMasterUK({ query = {} } = {}) {
  setPageTitle('Master Unit Kompetensi');

  document.getElementById('app').innerHTML = `
    <div class="max-w-full">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-white">Unit Kompetensi</h1>
          <p class="text-xs text-gray-500 mt-0.5">Master UK global — digunakan di bimtek, bank soal, dan laporan</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-import" class="px-3 py-2 rounded-lg text-xs text-gray-400 border border-gray-700 hover:bg-gray-800 transition-colors">
            Import Excel
          </button>
          <button id="btn-add" class="px-3 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Tambah UK
          </button>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
               fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input id="search-input" type="search" placeholder="Cari kode atau nama UK…"
                 class="form-input pl-9 w-64" />
        </div>
        <select id="filter-status" class="form-input w-36 text-sm">
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
          <option value="">Semua</option>
        </select>
        <span id="total-badge" class="text-xs text-gray-500"></span>
      </div>

      <div id="table-container"></div>
    </div>
  `;

  _bindEvents();
  await _load();
}

// ─── LOAD DATA ────────────────────────────────────────────────────────────────

async function _load() {
  _state.loading = true;
  _renderTable();
  try {
    const [{ data, lastDoc }, total] = await Promise.all([
      listUK({
        search:   _state.search,
        status:   _state.filterStatus,
        pageSize: PER_PAGE,
        lastDoc:  _state.lastDocs[_state.page - 1],
      }),
      countUK(),
    ]);
    _state.data  = data;
    _state.total = total;
    if (lastDoc) _state.lastDocs[_state.page] = lastDoc;
  } catch (err) {
    showToast('Gagal memuat: ' + err.message, 'error');
    _state.data = [];
  }
  _state.loading = false;
  _renderTable();

  const badge = document.getElementById('total-badge');
  if (badge) badge.textContent = `${_state.total} total UK`;
}

// ─── RENDER TABLE ─────────────────────────────────────────────────────────────

function _renderTable() {
  const container = document.getElementById('table-container');
  if (!container) return;

  if (_state.loading) {
    container.innerHTML = `
      <div class="flex justify-center py-12">
        <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>`;
    return;
  }

  if (!_state.data.length) {
    container.innerHTML = `
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
        <p class="text-gray-500 text-sm mb-3">
          ${_state.search || _state.filterStatus ? 'Tidak ada UK yang cocok dengan filter.' : 'Belum ada Unit Kompetensi.'}
        </p>
        ${!_state.search && !_state.filterStatus
          ? `<button id="btn-add-empty" class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">+ Tambah UK</button>`
          : ''}
      </div>`;
    container.querySelector('#btn-add-empty')?.addEventListener('click', () => {
      if (!requireWrite()) return; _openForm(null);
    });
    return;
  }

  const rows = _state.data.map(ek => `
    <tr>
      <td>
        ${ek.kode
          ? `<span class="font-mono text-sm font-semibold text-blue-400">${_esc(ek.kode)}</span>
             ${ek.isSKKNI ? '' : '<span class="ml-1 badge badge-gray text-xs">Internal</span>'}`
          : `<span class="text-xs text-gray-600 italic">Non-SKKNI</span>`}
      </td>
      <td>
        <div class="font-medium text-white text-sm">${_esc(ek.nama)}</div>
        ${ek.deskripsi ? `<div class="text-xs text-gray-500 mt-0.5 truncate max-w-xs">${_esc(ek.deskripsi)}</div>` : ''}
      </td>
      <td>
        <div class="flex flex-wrap gap-1">
          ${_renderBidangBadges(ek.bidangIds)}
        </div>
      </td>
      <td>
        ${ek.status === 'aktif'
          ? `<span class="badge badge-green">Aktif</span>`
          : `<span class="badge badge-gray">Nonaktif</span>`}
      </td>
      <td>
        <div class="flex gap-2">
          <button class="btn-edit text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                  data-id="${ek.id}">Edit</button>
          <button class="btn-del text-xs px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-white transition-colors"
                  data-id="${ek.id}" data-kode="${_esc(ek.kode ?? '—')}" data-nama="${_esc(ek.nama)}">Hapus</button>
        </div>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <table class="btam-table">
        <thead>
          <tr>
            <th class="w-36">Kode / Sumber</th>
            <th>Nama UK</th>
            <th class="w-48">Bidang Relevan</th>
            <th class="w-24">Status</th>
            <th class="w-24">Aksi</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${_renderPagination()}
  `;

  // Bind row actions
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const ek = _state.data.find(x => x.id === btn.dataset.id);
      if (ek) _openForm(ek);
    });
  });

  container.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireWrite()) return;
      const ok = await confirmDialog({
        title:        'Hapus Unit Kompetensi',
        message:      `Hapus <strong>${btn.dataset.kode}</strong> — ${btn.dataset.nama}?<br><span class="text-xs text-gray-400">UK yang sudah terpakai di bimtek/soal tidak ikut terhapus, hanya tidak muncul di picker.</span>`,
        confirmLabel: 'Hapus',
        danger:       true,
      });
      if (!ok) return;
      try {
        await deleteUK(btn.dataset.id);
        showToast('UK dihapus.', 'success');
        _reload();
      } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
      }
    });
  });

  // Bind pagination
  container.querySelector('#btn-prev')?.addEventListener('click', () => {
    if (_state.page > 1) { _state.page--; _load(); }
  });
  container.querySelector('#btn-next')?.addEventListener('click', () => {
    if (_state.page * PER_PAGE < _state.total) { _state.page++; _load(); }
  });
}

function _renderPagination() {
  if (_state.total <= PER_PAGE) return '';
  const from  = (_state.page - 1) * PER_PAGE + 1;
  const to    = Math.min(_state.page * PER_PAGE, _state.total);
  const hasPrev = _state.page > 1;
  const hasNext = to < _state.total;
  return `
    <div class="flex items-center justify-between mt-4 text-sm text-gray-400">
      <span>${from}–${to} dari ${_state.total}</span>
      <div class="flex gap-2">
        <button id="btn-prev" ${hasPrev ? '' : 'disabled'}
                class="px-3 py-1.5 rounded-lg border border-gray-700 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          ‹ Prev
        </button>
        <button id="btn-next" ${hasNext ? '' : 'disabled'}
                class="px-3 py-1.5 rounded-lg border border-gray-700 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          Next ›
        </button>
      </div>
    </div>`;
}

function _renderBidangBadges(bidangIds = []) {
  if (!bidangIds?.length) return `<span class="text-xs text-gray-600 italic">Semua bidang</span>`;
  return bidangIds.map(id => {
    const b = BIDANG_LIST.find(x => x.bidangId === id);
    if (!b) return `<span class="badge badge-gray">${id}</span>`;
    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white"
      style="background-color:${b.color}55;border:1px solid ${b.color}80">${b.nama}</span>`;
  }).join('');
}

// ─── FORM MODAL ───────────────────────────────────────────────────────────────

function _openForm(existing = null) {
  const isEdit = !!existing;

  const bidangCheckboxes = BIDANG_LIST.map(b => `
    <label class="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" name="bidangIds" value="${b.bidangId}"
             ${existing?.bidangIds?.includes(b.bidangId) ? 'checked' : ''}
             class="w-4 h-4 rounded" />
      <span class="text-sm text-gray-300">${b.nama}</span>
    </label>`).join('');

  // Nilai awal isSKKNI: untuk UK baru default true; untuk edit, ikuti data existing
  const initIsSKKNI = existing ? (existing.isSKKNI !== false) : true;

  openModal({
    title: isEdit ? `Edit: ${existing.kode ?? existing.nama}` : 'Tambah Unit Kompetensi',
    size:  'md',
    body: `
      <form id="uk-form" class="space-y-4">

        <!-- Toggle SKKNI -->
        ${isEdit ? '' : `
        <div class="flex gap-3 p-1 bg-gray-800 rounded-lg">
          <label class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md cursor-pointer transition-colors
                        ${initIsSKKNI ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}" id="lbl-skkni">
            <input type="radio" name="isSKKNI" value="true" class="sr-only" ${initIsSKKNI ? 'checked' : ''} />
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
            </svg>
            <span class="text-sm font-medium">SKKNI</span>
          </label>
          <label class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md cursor-pointer transition-colors
                        ${!initIsSKKNI ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}" id="lbl-nonskkni">
            <input type="radio" name="isSKKNI" value="false" class="sr-only" ${!initIsSKKNI ? 'checked' : ''} />
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            <span class="text-sm font-medium">Non-SKKNI</span>
          </label>
        </div>`}

        <!-- Field kode (SKKNI: required; non-SKKNI: opsional; edit: readonly) -->
        <div id="kode-field-wrapper">
          <label class="block text-xs font-medium text-gray-400 mb-1.5">
            <span id="kode-label">${initIsSKKNI ? 'Kode Unit SKKNI' : 'Kode Internal'}</span>
            <span id="kode-required" class="${initIsSKKNI ? '' : 'hidden'} text-red-400 ml-1">*</span>
            <span id="kode-optional" class="${initIsSKKNI ? 'hidden' : ''} text-gray-600 font-normal ml-1">(opsional)</span>
            ${isEdit ? '<span class="text-gray-600 font-normal ml-1">(tidak bisa diubah)</span>' : ''}
          </label>
          <input name="kode" id="ek-kode-input"
                 class="form-input font-mono ${isEdit ? 'bg-gray-800 opacity-60' : ''}"
                 value="${_esc(existing?.kode ?? '')}"
                 ${isEdit ? 'readonly' : ''}
                 placeholder="${initIsSKKNI ? 'Misal: PAR.AK01.001.01 atau UK-PROD-01' : 'Misal: UK-INTERNAL-01 (boleh kosong)'}" />
          <p id="kode-hint" class="text-xs text-gray-600 mt-1">
            ${initIsSKKNI
              ? 'Kode unit SKKNI resmi. Hanya huruf kapital, angka, tanda hubung (-), titik (.), underscore (_).'
              : 'Opsional. Jika diisi, akan digunakan sebagai referensi internal. Format: huruf kapital, angka, tanda hubung, titik, underscore.'}
          </p>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Nama UK <span class="text-red-400">*</span></label>
          <input name="nama" class="form-input" value="${_esc(existing?.nama ?? '')}"
                 placeholder="Misal: Menyusun Rencana Pengembangan Sistem Distribusi Air Minum" />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Deskripsi <span class="text-gray-600 font-normal">(opsional)</span></label>
          <textarea name="deskripsi" class="form-textarea h-20"
                    placeholder="Penjelasan lebih detail tentang UK ini…">${_esc(existing?.deskripsi ?? '')}</textarea>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">
            Bidang yang Relevan
            <span class="text-gray-600 font-normal ml-1">(kosongkan = semua bidang)</span>
          </label>
          <div class="flex flex-wrap gap-3">${bidangCheckboxes}</div>
        </div>

        <div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="status" value="aktif"
                   ${existing?.status !== 'nonaktif' ? 'checked' : ''}
                   class="w-4 h-4 rounded" />
            <span class="text-sm text-gray-300">UK aktif (muncul di picker bimtek & bank soal)</span>
          </label>
        </div>

        <div id="uk-form-error" class="hidden text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2"></div>
      </form>`,
    actions: [
      { label: 'Batal',                                type: 'secondary', onClick: ({ close }) => close() },
      { label: isEdit ? 'Simpan Perubahan' : 'Tambah', type: 'primary',   onClick: ({ close }) => _submitForm(close, existing) },
    ],
  });

  // Bind toggle SKKNI ↔ non-SKKNI (hanya saat tambah baru)
  if (!isEdit) {
    document.querySelectorAll('input[name="isSKKNI"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const isSKKNI = document.querySelector('input[name="isSKKNI"]:checked')?.value === 'true';
        const lblSKKNI    = document.getElementById('lbl-skkni');
        const lblNonSKKNI = document.getElementById('lbl-nonskkni');
        const kodeInput   = document.getElementById('ek-kode-input');
        const kodeLabel   = document.getElementById('kode-label');
        const kodeReq     = document.getElementById('kode-required');
        const kodeOpt     = document.getElementById('kode-optional');
        const kodeHint    = document.getElementById('kode-hint');

        lblSKKNI.className    = lblSKKNI.className.replace(/bg-gray-700 text-white|text-gray-400 hover:text-gray-200/g, '');
        lblNonSKKNI.className = lblNonSKKNI.className.replace(/bg-gray-700 text-white|text-gray-400 hover:text-gray-200/g, '');
        lblSKKNI.className    += isSKKNI ? ' bg-gray-700 text-white' : ' text-gray-400 hover:text-gray-200';
        lblNonSKKNI.className += isSKKNI ? ' text-gray-400 hover:text-gray-200' : ' bg-gray-700 text-white';

        kodeLabel.textContent = isSKKNI ? 'Kode Unit SKKNI' : 'Kode Internal';
        kodeReq.classList.toggle('hidden', !isSKKNI);
        kodeOpt.classList.toggle('hidden',  isSKKNI);
        kodeInput.placeholder = isSKKNI
          ? 'Misal: PAR.AK01.001.01 atau UK-PROD-01'
          : 'Misal: UK-INTERNAL-01 (boleh kosong)';
        kodeHint.textContent = isSKKNI
          ? 'Kode unit SKKNI resmi. Hanya huruf kapital, angka, tanda hubung (-), titik (.), underscore (_).'
          : 'Opsional. Jika diisi, akan digunakan sebagai referensi internal. Format: huruf kapital, angka, tanda hubung, titik, underscore.';
      });
    });
  }
}

async function _submitForm(close, existing) {
  const form    = document.getElementById('uk-form');
  const errorEl = document.getElementById('uk-form-error');
  errorEl.classList.add('hidden');

  const fd = new FormData(form);
  const data = {
    isSKKNI:   fd.get('isSKKNI') !== 'false', // default true jika field tidak ada (mode edit)
    kode:      fd.get('kode') || null,
    nama:      fd.get('nama'),
    deskripsi: fd.get('deskripsi') || null,
    bidangIds: fd.getAll('bidangIds'),
    status:    fd.get('status') === 'aktif' ? 'aktif' : 'nonaktif',
  };

  const btnLabel = existing ? 'Simpan Perubahan' : 'Tambah';
  const btn = document.querySelector(`[data-action="${btnLabel}"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }

  try {
    if (existing) {
      await updateUK(existing.id, data);
      showToast('Unit Kompetensi diperbarui.', 'success');
    } else {
      await createUK(data);
      showToast('Unit Kompetensi ditambahkan.', 'success');
    }
    close();
    _reload();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
  }
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────

function _bindEvents() {
  let _deb;
  document.getElementById('search-input')?.addEventListener('input', e => {
    clearTimeout(_deb);
    _deb = setTimeout(() => {
      _state.search = e.target.value.trim();
      _state.page = 1; _state.lastDocs = [null]; _load();
    }, 350);
  });

  document.getElementById('filter-status')?.addEventListener('change', e => {
    _state.filterStatus = e.target.value;
    _state.page = 1; _state.lastDocs = [null]; _load();
  });

  document.getElementById('btn-add')?.addEventListener('click', () => {
    if (!requireWrite()) return; _openForm(null);
  });

  document.getElementById('btn-import')?.addEventListener('click', () => {
    if (!requireWrite()) return;
    openImportUK(result => {
      showToast(`Import selesai: ${result.imported} UK diproses, ${result.errors.length} error.`,
        result.errors.length ? 'warning' : 'success');
      _reload();
    });
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function _reload() { _state.page = 1; _state.lastDocs = [null]; _load(); }
function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

