// admin/js/modules/bimtek/list.js
import { listBimtek, updateStatus } from './api.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { setPageTitle } from '../../layout/navbar.js';
import { navigate } from '../../router.js';

let _state = { data: [], filter: { tipe: '', status: '', bidangId: '' } };

export async function renderBimtekList({ query } = {}) {
  const app = document.getElementById('app');
  setPageTitle('Daftar Bimtek');

  app.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-lg font-bold text-white">Daftar Bimtek</h1>
      <button id="btn-baru" class="px-3 py-1.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
        + Bimtek Baru
      </button>
    </div>

    <!-- Filter -->
    <div class="flex flex-wrap gap-3 mb-5">
      <select id="filter-tipe" class="form-select text-sm">
        <option value="">Semua Tipe</option>
        <option value="reguler">Reguler</option>
        <option value="pnbp">PNBP</option>
        <option value="e_learning">e-Learning</option>
        <option value="ojt">OJT</option>
        <option value="lainnya">Lainnya</option>
      </select>
      <select id="filter-status" class="form-select text-sm">
        <option value="">Semua Status</option>
        <option value="draft">Draft</option>
        <option value="planned">Direncanakan</option>
        <option value="ongoing">Berlangsung</option>
        <option value="completed">Selesai</option>
        <option value="cancelled">Dibatalkan</option>
      </select>
      <select id="filter-bidang" class="form-select text-sm">
        <option value="">Semua Bidang</option>
        ${BIDANG_LIST.filter(b => b.active).map(b =>
          `<option value="${b.bidangId}">${b.nama}</option>`
        ).join('')}
      </select>
      <button id="btn-reset" class="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
        Reset
      </button>
    </div>

    <!-- Content -->
    <div id="list-content">
      <div class="text-gray-400 text-center py-16">Memuat...</div>
    </div>
  `;

  app.querySelector('#btn-baru').addEventListener('click', () => navigate('/bimtek/baru'));

  ['filter-tipe', 'filter-status', 'filter-bidang'].forEach(id => {
    app.querySelector(`#${id}`).addEventListener('change', () => _applyFilter(app));
  });

  app.querySelector('#btn-reset').addEventListener('click', () => {
    app.querySelector('#filter-tipe').value = '';
    app.querySelector('#filter-status').value = '';
    app.querySelector('#filter-bidang').value = '';
    _state.filter = { tipe: '', status: '', bidangId: '' };
    _renderContent(app);
  });

  app.querySelector('#list-content').addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'publish') {
      const ok = await confirmDialog('Publikasikan Bimtek ini? Status jadi "Direncanakan".');
      if (!ok) return;
      try {
        await updateStatus(id, 'planned');
        showToast('Bimtek dipublikasikan', 'success');
        await _load(app);
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    }

    if (action === 'cancel') {
      const alasan = prompt('Alasan pembatalan (opsional):');
      if (alasan === null) return;
      try {
        await updateStatus(id, 'cancelled', alasan || null);
        showToast('Bimtek dibatalkan', 'success');
        await _load(app);
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    }
  });

  await _load(app);
}

async function _load(app) {
  const el = app.querySelector('#list-content');
  el.innerHTML = `<div class="text-gray-400 text-center py-16">Memuat...</div>`;
  try {
    _state.data = await listBimtek();
    _renderContent(app);
  } catch (err) {
    el.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat: ${err.message}</div>`;
  }
}

function _applyFilter(app) {
  _state.filter.tipe     = app.querySelector('#filter-tipe').value;
  _state.filter.status   = app.querySelector('#filter-status').value;
  _state.filter.bidangId = app.querySelector('#filter-bidang').value;
  _renderContent(app);
}

function _renderContent(app) {
  const { tipe, status, bidangId } = _state.filter;
  let items = _state.data;
  if (tipe)     items = items.filter(b => b.tipe === tipe);
  if (status)   items = items.filter(b => b.status === status);
  if (bidangId) items = items.filter(b => b.bidangIds?.includes(bidangId));

  app.querySelector('#list-content').innerHTML = items.length === 0
    ? `<div class="text-gray-500 text-center py-16">Belum ada Bimtek.</div>`
    : _buildTable(items);
}

function _buildTable(items) {
  const rows = items.map(b => {
    const mulai   = _fmtDate(b.periode?.mulai);
    const selesai = _fmtDate(b.periode?.selesai);
    const bidang  = b.bidangIds?.map(id => BIDANG_LIST.find(x => x.bidangId === id)?.namaShort || id).join(', ') || '-';

    return `
      <tr class="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
        <td class="py-3 px-4">
          <div class="font-medium text-white text-sm">${_esc(b.nama)}</div>
          <div class="text-xs text-gray-500">${_esc(b.kodeBimtek || '')}</div>
        </td>
        <td class="py-3 px-4 text-sm text-gray-300">${_esc(bidang)}</td>
        <td class="py-3 px-4">
          <span class="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">${b.tipe}</span>
        </td>
        <td class="py-3 px-4 text-xs text-gray-400">${mulai} – ${selesai}</td>
        <td class="py-3 px-4">
          <span class="text-xs px-2 py-0.5 rounded-full ${_statusColor(b.status)}">${_labelStatus(b.status)}</span>
        </td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-2">
            <button onclick="location.hash='#/bimtek/${b.id}'"
              class="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors">
              Detail
            </button>
            <button onclick="location.hash='#/bimtek/${b.id}/edit'"
              class="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors">
              Edit
            </button>
            ${b.status === 'draft' ? `
              <button data-action="publish" data-id="${b.id}"
                class="text-xs px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors">
                Publikasi
              </button>` : ''}
            ${['draft','planned'].includes(b.status) ? `
              <button data-action="cancel" data-id="${b.id}"
                class="text-xs px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-white transition-colors">
                Batalkan
              </button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="text-xs text-gray-500 mb-3">${items.length} Bimtek ditemukan</div>
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
            <th class="py-3 px-4 text-left font-medium">Nama</th>
            <th class="py-3 px-4 text-left font-medium">Bidang</th>
            <th class="py-3 px-4 text-left font-medium">Tipe</th>
            <th class="py-3 px-4 text-left font-medium">Periode</th>
            <th class="py-3 px-4 text-left font-medium">Status</th>
            <th class="py-3 px-4 text-left font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function _fmtDate(ts) {
  if (!ts) return '-';
  const d = ts?.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _labelStatus(s) {
  return { draft:'Draft', planned:'Direncanakan', ongoing:'Berlangsung', completed:'Selesai', cancelled:'Dibatalkan' }[s] || s;
}

function _statusColor(s) {
  return {
    draft:     'bg-gray-700 text-gray-300',
    planned:   'bg-blue-900/60 text-blue-300',
    ongoing:   'bg-green-900/60 text-green-300',
    completed: 'bg-purple-900/60 text-purple-300',
    cancelled: 'bg-red-900/60 text-red-300',
  }[s] || 'bg-gray-700 text-gray-300';
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
