/**
 * bimtek/list.js
 * Lokasi: admin/js/modules/bimtek/list.js
 */

import { setPageTitle } from '../../layout/navbar.js';
import { confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { requireWrite } from '../../auth-guard.js';
import { listBimtek, deleteBimtek } from './api.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';

let _state = {
  status: '', tipe: '', bidangId: '', data: [], loading: false
};

export async function renderBimtekList({ query = {} } = {}) {
  setPageTitle('Bimtek');

  document.getElementById('app').innerHTML = `
    <div class="max-w-full">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-white">Daftar Bimtek</h1>
          <p class="text-xs text-gray-500 mt-0.5">Kelola kegiatan Bimbingan Teknis</p>
        </div>
        <button id="btn-add" class="px-3 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Bimtek Baru
        </button>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <select id="filter-status" class="form-select w-40">
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="planned">Planned</option>
          <option value="ongoing">Berlangsung</option>
          <option value="completed">Selesai</option>
          <option value="cancelled">Dibatalkan</option>
        </select>

        <select id="filter-tipe" class="form-select w-36">
          <option value="">Semua Tipe</option>
          <option value="reguler">Reguler</option>
          <option value="pnbp">PNBP</option>
        </select>

        <select id="filter-bidang" class="form-select w-44">
          <option value="">Semua Bidang</option>
          ${BIDANG_LIST.filter(b => b.active).map(b =>
            `<option value="${b.bidangId}">${_esc(b.nama)}</option>`
          ).join('')}
        </select>

        <span id="total-badge" class="ml-auto text-xs text-gray-500"></span>
      </div>

      <!-- Table container -->
      <div id="bimtek-table-wrap"></div>
    </div>
  `;

  document.getElementById('btn-add').addEventListener('click', () => {
    window.location.hash = '#/bimtek/baru';
  });
  document.getElementById('filter-status').addEventListener('change', e => { _state.status = e.target.value; _load(); });
  document.getElementById('filter-tipe').addEventListener('change', e => { _state.tipe = e.target.value; _load(); });
  document.getElementById('filter-bidang').addEventListener('change', e => { _state.bidangId = e.target.value; _load(); });

  await _load();
}

async function _load() {
  _state.loading = true;
  _render();

  try {
    _state.data = await listBimtek({
      statusFilter: _state.status  || null,
      tipeFilter:   _state.tipe    || null,
      bidangId:     _state.bidangId || null
    });
    const badge = document.getElementById('total-badge');
    if (badge) badge.textContent = `${_state.data.length} bimtek`;
  } catch (err) {
    showToast('Gagal memuat: ' + err.message, 'error');
  }

  _state.loading = false;
  _render();
}

function _render() {
  const wrap = document.getElementById('bimtek-table-wrap');
  if (!wrap) return;

  if (_state.loading) {
    wrap.innerHTML = `
      <div class="flex items-center justify-center py-16">
        <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>`;
    return;
  }

  if (_state.data.length === 0) {
    wrap.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 text-gray-500">
        <svg class="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <p class="text-sm">Belum ada Bimtek</p>
        <p class="text-xs mt-1">Klik "Bimtek Baru" untuk membuat kegiatan pertama</p>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-800">
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Nama Bimtek</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipe</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Bidang</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Periode</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Peserta</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
            <th class="px-4 py-3 w-24"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800">
          ${_state.data.map(b => _buildRow(b)).join('')}
        </tbody>
      </table>
    </div>`;

  // Events
  wrap.querySelectorAll('.btn-detail').forEach(btn => {
    btn.addEventListener('click', () => { window.location.hash = `#/bimtek/${btn.dataset.id}`; });
  });
  wrap.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!requireWrite()) return;
      window.location.hash = `#/bimtek/${btn.dataset.id}/edit`;
    });
  });
  wrap.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireWrite()) return;
      const ok = await confirmDialog({
        title: 'Hapus Bimtek',
        message: `Hapus Bimtek "${btn.dataset.nama}"? Data yang sudah terinput tetap tersimpan.`,
        confirmLabel: 'Hapus', danger: true
      });
      if (!ok) return;
      try {
        await deleteBimtek(btn.dataset.id);
        showToast('Bimtek dihapus', 'success');
        _load();
      } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
      }
    });
  });
}

function _buildRow(b) {
  const bidangNames = (b.bidangIds ?? [])
    .map(id => BIDANG_LIST.find(bd => bd.bidangId === id)?.nama ?? id).join(', ') || '—';

  return `
    <tr class="hover:bg-gray-800/50 transition-colors">
      <td class="px-4 py-3">
        <div class="font-medium text-gray-200">${_esc(b.nama)}</div>
        <div class="text-xs text-gray-500 mt-0.5">${_esc(b.kodeBimtek ?? '')}</div>
      </td>
      <td class="px-4 py-3">
        ${b.tipe === 'reguler'
          ? '<span class="badge badge-blue">Reguler</span>'
          : '<span class="badge badge-yellow">PNBP</span>'}
      </td>
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-1">
          ${(b.bidangIds ?? []).map(id => {
            const bd = BIDANG_LIST.find(x => x.bidangId === id);
            if (!bd) return '';
            return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
              style="background-color: ${bd.color}88; border: 1px solid ${bd.color}60">
              ${_esc(bd.nama)}
            </span>`;
          }).join('')}
        </div>
      </td>
      <td class="px-4 py-3 text-xs text-gray-400">
        ${_fmtDate(b.periode?.mulai)} — ${_fmtDate(b.periode?.selesai)}
      </td>
      <td class="px-4 py-3 text-xs text-gray-400">
        ${b.pesertaIds?.length ?? 0} / ${b.kapasitas ?? '—'}
      </td>
      <td class="px-4 py-3">${_statusBadge(b.status)}</td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-1 justify-end">
          <button class="btn-detail p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" data-id="${b.id}" title="Detail">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
          <button class="btn-edit p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-blue-400 transition-colors" data-id="${b.id}" title="Edit">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button class="btn-delete p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors" data-id="${b.id}" data-nama="${_esc(b.nama)}" title="Hapus">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>`;
}

function _statusBadge(s) {
  const map = {
    draft:     'badge-gray',
    planned:   'badge-blue',
    ongoing:   'badge-green',
    completed: 'badge-purple',
    cancelled: 'badge-red'
  };
  const label = { draft:'Draft', planned:'Planned', ongoing:'Berlangsung', completed:'Selesai', cancelled:'Dibatalkan' };
  return `<span class="badge ${map[s] ?? 'badge-gray'}">${label[s] ?? s}</span>`;
}

function _fmtDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
