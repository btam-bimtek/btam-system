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

    if (action === 'detail') { navigate(`/bimtek/${id}`); return; }
    if (action === 'edit')   { navigate(`/bimtek/${id}/edit`); return; }

    if (action === 'publish') {
      const ok = await confirmDialog({
        title: 'Publikasikan Bimtek',
        message: 'Publikasikan Bimtek ini? Status akan berubah menjadi "Direncanakan".',
      });
      if (!ok) return;
      try {
        await updateStatus(id, 'planned');
        showToast('Bimtek dipublikasikan', 'success');
        await _load(app);
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    }

    if (action === 'cancel') {
      const ok = await confirmDialog({
        title: 'Batalkan Bimtek',
        message: 'Batalkan Bimtek ini? Tindakan ini tidak bisa diurungkan.',
        confirmLabel: 'Batalkan',
        danger: true,
      });
      if (!ok) return;
      try {
        await updateStatus(id, 'cancelled');
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
    const bidang  = b.bidangIds
      ?.map(id => BIDANG_LIST.find(x => x.bidangId === id)?.namaShort || id)
      .join(', ') || '-';

    return `
      <tr style="border-bottom:1px solid #1f2937;">
        <td style="padding:12px 16px;">
          <div style="font-weight:500;color:#fff;font-size:14px;">${_esc(b.nama)}</div>
          <div style="font-size:11px;color:#6b7280;">${_esc(b.kodeBimtek || '')}</div>
        </td>
        <td style="padding:12px 16px;font-size:13px;color:#d1d5db;">${_esc(bidang)}</td>
        <td style="padding:12px 16px;">${_badgeTipe(b.tipe)}</td>
        <td style="padding:12px 16px;font-size:12px;color:#9ca3af;">${mulai} – ${selesai}</td>
        <td style="padding:12px 16px;">${_badgeStatus(b.status)}</td>
        <td style="padding:12px 16px;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button data-action="detail" data-id="${b.id}" style="${_btnStyle('#374151')}">Detail</button>
            <button data-action="edit"   data-id="${b.id}" style="${_btnStyle('#374151')}">Edit</button>
            ${b.status === 'draft' ? `
              <button data-action="publish" data-id="${b.id}" style="${_btnStyle('#1d4ed8')}">Publikasi</button>` : ''}
            ${['draft','planned'].includes(b.status) ? `
              <button data-action="cancel" data-id="${b.id}" style="${_btnStyle('#7f1d1d')}">Batalkan</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">${items.length} Bimtek ditemukan</div>
    <div style="background:#111827;border-radius:12px;border:1px solid #1f2937;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid #1f2937;">
            <th style="${_thStyle()}">Nama</th>
            <th style="${_thStyle()}">Bidang</th>
            <th style="${_thStyle()}">Tipe</th>
            <th style="${_thStyle()}">Periode</th>
            <th style="${_thStyle()}">Status</th>
            <th style="${_thStyle()}">Aksi</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function _badgeTipe(tipe) {
  const map = {
    reguler:    ['#1e3a5f', '#93c5fd', 'Reguler'],
    pnbp:       ['#3b1f5e', '#c4b5fd', 'PNBP'],
    e_learning: ['#1a3a2a', '#6ee7b7', 'e-Learning'],
    ojt:        ['#3b2a0a', '#fcd34d', 'OJT'],
    lainnya:    ['#1f2937', '#9ca3af', 'Lainnya'],
  };
  const [bg, color, label] = map[tipe] || map.lainnya;
  return `<span style="background:${bg};color:${color};font-size:11px;padding:2px 8px;border-radius:999px;white-space:nowrap;">${label}</span>`;
}

function _badgeStatus(status) {
  const map = {
    draft:     ['#1f2937', '#9ca3af', 'Draft'],
    planned:   ['#1e3a5f', '#93c5fd', 'Direncanakan'],
    ongoing:   ['#14532d', '#86efac', 'Berlangsung'],
    completed: ['#2e1065', '#d8b4fe', 'Selesai'],
    cancelled: ['#450a0a', '#fca5a5', 'Dibatalkan'],
  };
  const [bg, color, label] = map[status] || map.draft;
  return `<span style="background:${bg};color:${color};font-size:11px;padding:2px 8px;border-radius:999px;white-space:nowrap;">${label}</span>`;
}

function _btnStyle(bg) {
  return `background:${bg};color:#fff;font-size:12px;padding:3px 10px;border-radius:4px;border:none;cursor:pointer;`;
}

function _thStyle() {
  return `padding:10px 16px;text-align:left;font-size:11px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;`;
}

function _fmtDate(ts) {
  if (!ts) return '-';
  const d = ts?.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
