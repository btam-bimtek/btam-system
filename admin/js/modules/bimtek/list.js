// admin/js/modules/bimtek/list.js
import { listBimtek, updateStatus } from './api.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { setPageTitle } from '../../layout/navbar.js';

// ─── STATE ──────────────────────────────────────────────────────────────────

let state = {
  data: [],
  filter: { tipe: '', status: '', bidangId: '' },
  loading: false,
};

// ─── RENDER ─────────────────────────────────────────────────────────────────

export async function renderBimtekList(container) {
  setPageTitle('Daftar Bimtek');
  container.innerHTML = buildShell();
  bindEvents(container);
  await load(container);
}

function buildShell() {
  return `
    <div class="page-header">
      <h2>Daftar Bimtek</h2>
      <button id="btn-create-bimtek" class="btn btn-primary">+ Bimtek Baru</button>
    </div>

    <div class="filter-bar" id="filter-bar">
      <select id="filter-tipe" class="form-select form-select-sm">
        <option value="">Semua Tipe</option>
        <option value="reguler">Reguler</option>
        <option value="pnbp">PNBP</option>
        <option value="e_learning">e-Learning</option>
        <option value="ojt">OJT</option>
        <option value="lainnya">Lainnya</option>
      </select>

      <select id="filter-status" class="form-select form-select-sm">
        <option value="">Semua Status</option>
        <option value="draft">Draft</option>
        <option value="planned">Direncanakan</option>
        <option value="ongoing">Berlangsung</option>
        <option value="completed">Selesai</option>
        <option value="cancelled">Dibatalkan</option>
      </select>

      <select id="filter-bidang" class="form-select form-select-sm">
        <option value="">Semua Bidang</option>
        ${BIDANG_LIST.filter(b => b.active).map(b =>
          `<option value="${b.id}">${b.nama}</option>`
        ).join('')}
      </select>

      <button id="btn-reset-filter" class="btn btn-sm btn-outline-secondary">Reset</button>
    </div>

    <div id="bimtek-list-content">
      <div class="text-center py-5 text-muted">Memuat data...</div>
    </div>
  `;
}

function buildTable(items) {
  if (items.length === 0) {
    return `<div class="empty-state">Belum ada Bimtek yang sesuai filter.</div>`;
  }

  const rows = items.map(b => {
    const mulai = b.periode?.mulai?.toDate?.()?.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) || '-';
    const selesai = b.periode?.selesai?.toDate?.()?.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) || '-';
    const bidangNama = b.bidangIds?.map(id => BIDANG_LIST.find(b => b.id === id)?.namaShort || id).join(', ') || '-';

    return `
      <tr>
        <td>
          <div class="fw-semibold">${escHtml(b.nama)}</div>
          <small class="text-muted">${b.kodeBimtek || ''}</small>
        </td>
        <td><span class="badge badge-tipe-${b.tipe}">${labelTipe(b.tipe)}</span></td>
        <td><span class="badge badge-mode-${b.mode}">${b.mode}</span></td>
        <td>${escHtml(bidangNama)}</td>
        <td>${mulai} – ${selesai}</td>
        <td>${b.pesertaIds?.length ?? 0} / ${b.kapasitas}</td>
        <td><span class="badge badge-status-${b.status}">${labelStatus(b.status)}</span></td>
        <td>
          <div class="action-btns">
            <a href="#bimtek/${b.id}" class="btn btn-sm btn-outline-primary">Detail</a>
            ${b.status === 'draft' ? `<button class="btn btn-sm btn-outline-secondary btn-publish" data-id="${b.id}">Publikasi</button>` : ''}
            ${['draft','planned'].includes(b.status) ? `<button class="btn btn-sm btn-outline-danger btn-cancel" data-id="${b.id}">Batalkan</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  });

  return `
    <div class="table-responsive">
      <table class="table table-hover">
        <thead>
          <tr>
            <th>Nama Bimtek</th>
            <th>Tipe</th>
            <th>Mode</th>
            <th>Bidang</th>
            <th>Periode</th>
            <th>Peserta</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
    <div class="text-muted small mt-2">${items.length} Bimtek ditemukan</div>
  `;
}

// ─── EVENTS ─────────────────────────────────────────────────────────────────

function bindEvents(container) {
  // Buat bimtek baru
  container.querySelector('#btn-create-bimtek')?.addEventListener('click', () => {
    window.location.hash = '#bimtek/new';
  });

  // Filter
  const applyFilter = () => {
    state.filter.tipe = container.querySelector('#filter-tipe').value;
    state.filter.status = container.querySelector('#filter-status').value;
    state.filter.bidangId = container.querySelector('#filter-bidang').value;
    renderContent(container);
  };

  container.querySelector('#filter-tipe')?.addEventListener('change', applyFilter);
  container.querySelector('#filter-status')?.addEventListener('change', applyFilter);
  container.querySelector('#filter-bidang')?.addEventListener('change', applyFilter);

  container.querySelector('#btn-reset-filter')?.addEventListener('click', () => {
    container.querySelector('#filter-tipe').value = '';
    container.querySelector('#filter-status').value = '';
    container.querySelector('#filter-bidang').value = '';
    state.filter = { tipe: '', status: '', bidangId: '' };
    renderContent(container);
  });

  // Action buttons (event delegation)
  container.querySelector('#bimtek-list-content')?.addEventListener('click', async (e) => {
    const publishBtn = e.target.closest('.btn-publish');
    const cancelBtn = e.target.closest('.btn-cancel');

    if (publishBtn) {
      const id = publishBtn.dataset.id;
      const ok = await confirmDialog('Publikasikan Bimtek ini? Status akan berubah menjadi "Direncanakan".');
      if (!ok) return;
      try {
        await updateStatus(id, 'planned');
        showToast('Bimtek berhasil dipublikasikan', 'success');
        await load(container);
      } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
      }
    }

    if (cancelBtn) {
      const id = cancelBtn.dataset.id;
      const alasan = prompt('Alasan pembatalan (opsional):');
      if (alasan === null) return; // user tekan Cancel
      try {
        await updateStatus(id, 'cancelled', alasan || null);
        showToast('Bimtek dibatalkan', 'success');
        await load(container);
      } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
      }
    }
  });
}

// ─── LOAD & RENDER ──────────────────────────────────────────────────────────

async function load(container) {
  const content = container.querySelector('#bimtek-list-content');
  content.innerHTML = `<div class="text-center py-5 text-muted">Memuat...</div>`;

  try {
    state.data = await listBimtek();
    renderContent(container);
  } catch (err) {
    content.innerHTML = `<div class="alert alert-danger">Gagal memuat data: ${err.message}</div>`;
  }
}

function renderContent(container) {
  const { tipe, status, bidangId } = state.filter;
  let filtered = state.data;
  if (tipe) filtered = filtered.filter(b => b.tipe === tipe);
  if (status) filtered = filtered.filter(b => b.status === status);
  if (bidangId) filtered = filtered.filter(b => b.bidangIds?.includes(bidangId));

  container.querySelector('#bimtek-list-content').innerHTML = buildTable(filtered);
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function labelTipe(tipe) {
  const map = { reguler: 'Reguler', pnbp: 'PNBP', e_learning: 'e-Learning', ojt: 'OJT', lainnya: 'Lainnya' };
  return map[tipe] || tipe;
}

function labelStatus(status) {
  const map = {
    draft: 'Draft',
    planned: 'Direncanakan',
    ongoing: 'Berlangsung',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
  };
  return map[status] || status;
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
