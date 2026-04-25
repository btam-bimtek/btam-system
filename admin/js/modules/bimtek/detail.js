// admin/js/modules/bimtek/detail.js
import {
  getBimtek, createBimtek, updateBimtek, deleteBimtek,
  listMapel, deleteMapel, reorderMapel,
  addPeserta, removePeserta,
  DEFAULT_WEIGHTS, DEFAULT_KKM, generateKodeBimtek,
  hitungJamSelesai, validateJadwalMapel,
  listSesi, createSesi, deleteSesi,
} from './api.js';
import { showMapelModal } from './form-mapel.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';
import { listPengajar } from '../pengajar-master/api.js';
import { listPeserta } from '../peserta-master/api.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { setPageTitle } from '../../layout/navbar.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── STATE ──────────────────────────────────────────────────────────────────

let state = {
  bimtekId: null,     // null = mode create
  bimtek: null,
  mapels: [],
  sesis: [],
  pengajars: [],      // master pengajar
  activeTab: 'info',
  saving: false,
};

// ─── ENTRY POINT ────────────────────────────────────────────────────────────

export async function renderBimtekDetail(container, bimtekId) {
  const isNew = !bimtekId || bimtekId === 'new';
  state.bimtekId = isNew ? null : bimtekId;
  state.activeTab = 'info';

  setPageTitle(isNew ? 'Bimtek Baru' : 'Detail Bimtek');
  container.innerHTML = `<div class="text-center py-5 text-muted">Memuat...</div>`;

  try {
    // Load master data pengajar
    state.pengajars = await listPengajar();

    if (!isNew) {
      [state.bimtek, state.mapels, state.sesis] = await Promise.all([
        getBimtek(bimtekId),
        listMapel(bimtekId),
        listSesi(bimtekId),
      ]);
    } else {
      state.bimtek = null;
      state.mapels = [];
      state.sesis = [];
    }

    render(container, isNew);
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">Gagal memuat: ${err.message}</div>`;
  }
}

// ─── RENDER SHELL ───────────────────────────────────────────────────────────

function render(container, isNew) {
  const b = state.bimtek;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#bimtek" class="btn btn-sm btn-outline-secondary me-2">← Kembali</a>
        <h2 class="d-inline">${isNew ? 'Bimtek Baru' : escHtml(b.nama)}</h2>
        ${!isNew && b.kodeBimtek ? `<span class="badge bg-secondary ms-2">${b.kodeBimtek}</span>` : ''}
      </div>
      ${!isNew ? `<span class="badge badge-status-${b.status} fs-6">${labelStatus(b.status)}</span>` : ''}
    </div>

    ${!isNew ? buildTabs() : ''}

    <div id="tab-content">
      ${isNew ? buildFormInfo(null) : renderTabContent()}
    </div>
  `;

  bindEvents(container, isNew);
}

function buildTabs() {
  const tabs = [
    { id: 'info', label: 'Info & Konfigurasi' },
    { id: 'mapel', label: 'Mata Pelajaran' },
    { id: 'jadwal', label: 'Jadwal' },
    { id: 'peserta', label: 'Peserta' },
  ];
  return `
    <ul class="nav nav-tabs mb-4" id="bimtek-tabs">
      ${tabs.map(t =>
        `<li class="nav-item">
          <button class="nav-link ${state.activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>
        </li>`
      ).join('')}
    </ul>
  `;
}

function renderTabContent() {
  switch (state.activeTab) {
    case 'info':    return buildFormInfo(state.bimtek);
    case 'mapel':   return buildTabMapel();
    case 'jadwal':  return buildTabJadwal();
    case 'peserta': return buildTabPeserta();
    default:        return '';
  }
}

// ─── TAB: INFO & KONFIGURASI ────────────────────────────────────────────────

function buildFormInfo(b) {
  const w = b?.weights || { ...DEFAULT_WEIGHTS };
  const isReadonly = b && !['draft', 'planned'].includes(b.status);

  const bidangOpts = BIDANG_LIST.filter(x => x.active).map(x =>
    `<option value="${x.id}" ${b?.bidangIds?.includes(x.id) ? 'selected' : ''}>${x.nama}</option>`
  ).join('');

  return `
    <form id="form-info" novalidate>
      <div class="row g-3">

        <div class="col-12">
          <label class="form-label required">Nama Bimtek</label>
          <input type="text" id="f-nama" class="form-control"
            value="${escHtml(b?.nama || '')}"
            placeholder="cth: Bimtek Operator IPA Lanjutan Batch 3"
            ${isReadonly ? 'readonly' : ''} required>
        </div>

        <div class="col-md-4">
          <label class="form-label required">Tipe</label>
          <select id="f-tipe" class="form-select" ${isReadonly ? 'disabled' : ''} required>
            <option value="">-- Pilih --</option>
            <option value="reguler" ${b?.tipe==='reguler'?'selected':''}>Reguler</option>
            <option value="pnbp" ${b?.tipe==='pnbp'?'selected':''}>PNBP</option>
            <option value="e_learning" ${b?.tipe==='e_learning'?'selected':''}>e-Learning</option>
            <option value="ojt" ${b?.tipe==='ojt'?'selected':''}>OJT</option>
            <option value="lainnya" ${b?.tipe==='lainnya'?'selected':''}>Lainnya</option>
          </select>
        </div>

        <div class="col-md-4">
          <label class="form-label required">Mode</label>
          <select id="f-mode" class="form-select" ${isReadonly ? 'disabled' : ''} required>
            <option value="">-- Pilih --</option>
            <option value="online" ${b?.mode==='online'?'selected':''}>Online (maks 25 peserta)</option>
            <option value="offline" ${b?.mode==='offline'?'selected':''}>Offline (maks 17 peserta)</option>
          </select>
        </div>

        <div class="col-md-4">
          <label class="form-label">Kapasitas</label>
          <input type="number" id="f-kapasitas" class="form-control"
            min="1" max="50"
            value="${b?.kapasitas || ''}"
            placeholder="Auto dari mode"
            ${isReadonly ? 'readonly' : ''}>
          <small class="text-muted">Kosongkan untuk default (online=25, offline=17)</small>
        </div>

        <div class="col-12">
          <label class="form-label required">Bidang</label>
          <div id="bidang-checkboxes" class="d-flex flex-wrap gap-3">
            ${BIDANG_LIST.filter(x => x.active).map(x => `
              <div class="form-check">
                <input class="form-check-input bidang-cb" type="checkbox"
                  id="bidang-${x.id}" value="${x.id}"
                  ${b?.bidangIds?.includes(x.id) ? 'checked' : ''}
                  ${isReadonly ? 'disabled' : ''}>
                <label class="form-check-label" for="bidang-${x.id}">${x.nama}</label>
              </div>
            `).join('')}
          </div>
          <small class="text-muted">Reguler: 1 bidang. PNBP: bisa multi.</small>
        </div>

        <div class="col-md-6">
          <label class="form-label required">Tanggal Mulai</label>
          <input type="date" id="f-mulai" class="form-control"
            value="${b?.periode?.mulai ? toDateInput(b.periode.mulai) : ''}"
            ${isReadonly ? 'readonly' : ''} required>
        </div>

        <div class="col-md-6">
          <label class="form-label required">Tanggal Selesai</label>
          <input type="date" id="f-selesai" class="form-control"
            value="${b?.periode?.selesai ? toDateInput(b.periode.selesai) : ''}"
            ${isReadonly ? 'readonly' : ''} required>
        </div>

        <div class="col-md-8">
          <label class="form-label required">Lokasi</label>
          <input type="text" id="f-lokasi" class="form-control"
            value="${escHtml(b?.lokasi || '')}"
            placeholder="BTAM / link Zoom / alamat"
            ${isReadonly ? 'readonly' : ''} required>
        </div>

        <div class="col-md-4">
          <label class="form-label">Kode Bimtek</label>
          <input type="text" id="f-kode" class="form-control"
            value="${escHtml(b?.kodeBimtek || '')}"
            placeholder="Auto-generate"
            ${isReadonly ? 'readonly' : ''}>
        </div>

        <div class="col-12">
          <hr>
          <h6>Konfigurasi Penilaian</h6>
        </div>

        <div class="col-md-3">
          <label class="form-label">KKM (Nilai Minimum Lulus)</label>
          <input type="number" id="f-kkm" class="form-control"
            min="0" max="100" value="${b?.kkm ?? DEFAULT_KKM}"
            ${isReadonly ? 'readonly' : ''}>
        </div>

        <div class="col-md-3">
          <label class="form-label">Komponen Tugas</label>
          <div class="form-check form-switch mt-2">
            <input class="form-check-input" type="checkbox" id="f-has-tugas"
              ${b?.hasTugas ? 'checked' : ''}
              ${isReadonly ? 'disabled' : ''}>
            <label class="form-check-label" for="f-has-tugas">Aktifkan Tugas</label>
          </div>
        </div>

        <div class="col-md-3">
          <label class="form-label">Komponen Presentasi</label>
          <div class="form-check form-switch mt-2">
            <input class="form-check-input" type="checkbox" id="f-has-presentasi"
              ${b?.hasPresentasi ? 'checked' : ''}
              ${isReadonly ? 'disabled' : ''}>
            <label class="form-check-label" for="f-has-presentasi">Aktifkan Presentasi</label>
          </div>
        </div>

        <div class="col-12">
          <label class="form-label">Bobot Komponen Penilaian</label>
          <div class="row g-2" id="weights-grid">
            ${buildWeightInputs(w, isReadonly)}
          </div>
          <div id="weight-sum-info" class="mt-2 small"></div>
        </div>

        <div id="form-info-error" class="col-12 d-none">
          <div class="alert alert-danger" id="form-info-error-msg"></div>
        </div>

        <div class="col-12">
          <button type="submit" class="btn btn-primary" id="btn-save-info" ${isReadonly ? 'disabled' : ''}>
            ${b ? 'Simpan Perubahan' : 'Buat Bimtek'}
          </button>
          ${b && ['draft','planned'].includes(b.status) ? `
            <button type="button" id="btn-delete-bimtek" class="btn btn-outline-danger ms-2">Hapus Bimtek</button>
          ` : ''}
        </div>

      </div>
    </form>
  `;
}

function buildWeightInputs(w, readonly) {
  const komponen = [
    { key: 'pretest', label: 'Pre-test' },
    { key: 'posttest', label: 'Post-test' },
    { key: 'pengajar', label: 'Pengajar' },
    { key: 'kehadiran', label: 'Kehadiran' },
    { key: 'keaktifan', label: 'Keaktifan' },
    { key: 'respek', label: 'Respek' },
    { key: 'tugas', label: 'Tugas' },
    { key: 'presentasi', label: 'Presentasi' },
  ];
  return komponen.map(k => `
    <div class="col-md-3 col-6">
      <label class="form-label small">${k.label} (%)</label>
      <input type="number" class="form-control form-control-sm weight-input"
        data-key="${k.key}" min="0" max="100" step="1"
        value="${Math.round((w[k.key] || 0) * 100)}"
        ${readonly ? 'readonly' : ''}>
    </div>
  `).join('');
}

// ─── TAB: MATA PELAJARAN ────────────────────────────────────────────────────

function buildTabMapel() {
  const mapels = state.mapels;
  const canEdit = ['draft', 'planned', 'ongoing'].includes(state.bimtek?.status);

  if (mapels.length === 0) {
    return `
      <div class="empty-state">
        <p>Belum ada mata pelajaran.</p>
        ${canEdit ? `<button id="btn-add-mapel" class="btn btn-primary">+ Tambah Mata Pelajaran</button>` : ''}
      </div>
    `;
  }

  const rows = mapels.map(m => {
    const pengajarNama = m.pengajarIds.map(id => {
      const p = state.pengajars.find(x => x.id === id);
      return p ? p.nama : id;
    }).join(', ');
    const penilaiNama = state.pengajars.find(x => x.id === m.pengajarPenilaiId)?.nama || m.pengajarPenilaiId || '-';
    const terjadwal = m.jadwal ? `${m.jadwal.jamMulai}–${m.jadwal.jamSelesai}` : '<span class="text-warning">Belum dijadwalkan</span>';
    const bidangNama = BIDANG_LIST.find(b => b.id === m.bidangId)?.namaShort || m.bidangId;

    return `
      <tr>
        <td class="text-center">${m.urutan}</td>
        <td>
          <div class="fw-semibold">${escHtml(m.nama)}</div>
          <small class="text-muted">${bidangNama}</small>
        </td>
        <td class="text-center">${m.totalJp} JP</td>
        <td>
          <div>${escHtml(pengajarNama)}</div>
          <small class="text-muted">Penilai: ${escHtml(penilaiNama)}</small>
        </td>
        <td>${terjadwal}</td>
        <td>
          ${canEdit ? `
            <button class="btn btn-sm btn-outline-secondary btn-edit-mapel" data-id="${m.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger btn-delete-mapel" data-id="${m.id}" data-nama="${escHtml(m.nama)}">Hapus</button>
          ` : '-'}
        </td>
      </tr>
    `;
  });

  const totalJp = mapels.reduce((sum, m) => sum + (m.totalJp || 0), 0);

  return `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <span class="text-muted">${mapels.length} mata pelajaran · Total ${totalJp} JP</span>
      ${canEdit ? `<button id="btn-add-mapel" class="btn btn-primary btn-sm">+ Tambah Mata Pelajaran</button>` : ''}
    </div>

    <div class="table-responsive">
      <table class="table table-hover">
        <thead>
          <tr>
            <th style="width:50px">#</th>
            <th>Nama Mapel</th>
            <th class="text-center">JP</th>
            <th>Pengajar</th>
            <th>Jadwal</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
  `;
}

// ─── TAB: JADWAL ────────────────────────────────────────────────────────────

function buildTabJadwal() {
  const canEdit = ['draft', 'planned'].includes(state.bimtek?.status);

  // Group sesi by tanggal
  const byDate = {};
  for (const s of state.sesis) {
    const tgl = s.tanggal?.toDate?.()?.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) || 'Tanggal tidak diketahui';
    if (!byDate[tgl]) byDate[tgl] = [];
    byDate[tgl].push(s);
  }

  const mapelUnscheduled = state.mapels.filter(m => !m.jadwal);

  let html = '';

  if (mapelUnscheduled.length > 0) {
    html += `
      <div class="alert alert-warning">
        ⚠️ ${mapelUnscheduled.length} mata pelajaran belum dijadwalkan:
        ${mapelUnscheduled.map(m => `<strong>${m.nama}</strong>`).join(', ')}
      </div>
    `;
  }

  if (state.sesis.length === 0) {
    html += `<div class="empty-state">Jadwal belum dibuat.</div>`;
  } else {
    html += Object.entries(byDate).map(([tgl, sesiList]) => `
      <div class="jadwal-day mb-4">
        <h6 class="jadwal-day-header">${tgl}</h6>
        <div class="jadwal-sesi-list">
          ${sesiList.sort((a, b) => a.jamMulai.localeCompare(b.jamMulai)).map(s => buildSesiCard(s)).join('')}
        </div>
      </div>
    `).join('');
  }

  if (canEdit) {
    html += `
      <div class="mt-4 pt-3 border-top">
        <h6>Tambah Sesi Manual</h6>
        ${buildAddSesiForm()}
      </div>
    `;
  }

  return html;
}

function buildSesiCard(s) {
  const mapel = state.mapels.find(m => m.id === s.mapelId);
  const label = s.tipe === 'mapel'
    ? `${mapel?.nama || 'Mapel'} (${s.jp} JP)`
    : s.keterangan || s.tipe;

  const colorMap = {
    mapel: 'primary', break: 'secondary', ishoma: 'warning',
    pembukaan: 'success', penutupan: 'info',
  };
  const color = colorMap[s.tipe] || 'secondary';

  return `
    <div class="sesi-card border-start border-${color} border-3 ps-3 py-2 mb-2">
      <div class="d-flex justify-content-between">
        <div>
          <span class="badge bg-${color} me-2">${s.jamMulai}–${s.jamSelesai}</span>
          <span>${escHtml(label)}</span>
        </div>
        <button class="btn btn-xs btn-outline-danger btn-delete-sesi" data-id="${s.id}">×</button>
      </div>
    </div>
  `;
}

function buildAddSesiForm() {
  const mapelOptions = state.mapels.map(m =>
    `<option value="${m.id}">${escHtml(m.nama)} (${m.totalJp} JP)</option>`
  ).join('');

  return `
    <form id="form-add-sesi" class="row g-2 align-items-end">
      <div class="col-md-2">
        <label class="form-label small">Tanggal</label>
        <input type="date" id="sesi-tanggal" class="form-control form-control-sm" required>
      </div>
      <div class="col-md-2">
        <label class="form-label small">Tipe</label>
        <select id="sesi-tipe" class="form-select form-select-sm" required>
          <option value="mapel">Mata Pelajaran</option>
          <option value="break">Break</option>
          <option value="ishoma">ISHOMA</option>
          <option value="pembukaan">Pembukaan</option>
          <option value="penutupan">Penutupan</option>
        </select>
      </div>
      <div class="col-md-3" id="sesi-mapel-col">
        <label class="form-label small">Mata Pelajaran</label>
        <select id="sesi-mapel" class="form-select form-select-sm">
          <option value="">-- Pilih Mapel --</option>
          ${mapelOptions}
        </select>
      </div>
      <div class="col-md-2">
        <label class="form-label small">Jam Mulai</label>
        <input type="time" id="sesi-jam-mulai" class="form-control form-control-sm" required>
      </div>
      <div class="col-md-2">
        <label class="form-label small">JP (untuk mapel)</label>
        <input type="number" id="sesi-jp" class="form-control form-control-sm" min="1" max="9" placeholder="JP">
      </div>
      <div class="col-md-1">
        <button type="submit" class="btn btn-primary btn-sm w-100">+</button>
      </div>
      <div class="col-12">
        <div id="sesi-error" class="text-danger small d-none"></div>
        <div id="sesi-warning" class="text-warning small d-none"></div>
      </div>
    </form>
  `;
}

// ─── TAB: PESERTA ───────────────────────────────────────────────────────────

function buildTabPeserta() {
  const pesertaIds = state.bimtek?.pesertaIds || [];
  const kapasitas = state.bimtek?.kapasitas || 0;
  const canEdit = ['draft', 'planned', 'ongoing'].includes(state.bimtek?.status);

  return `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <span>${pesertaIds.length} / ${kapasitas} peserta</span>
      ${canEdit && pesertaIds.length < kapasitas ? `
        <button id="btn-add-peserta" class="btn btn-sm btn-primary">+ Tambah Peserta</button>
      ` : ''}
      ${pesertaIds.length >= kapasitas ? `<span class="badge bg-warning text-dark">Kapasitas penuh</span>` : ''}
    </div>

    <div id="peserta-list-container">
      <div class="text-muted text-center py-3">Memuat daftar peserta...</div>
    </div>
  `;
}

// ─── EVENTS ─────────────────────────────────────────────────────────────────

function bindEvents(container, isNew) {
  // Tab switching
  container.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      container.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.tab === state.activeTab));
      container.querySelector('#tab-content').innerHTML = renderTabContent();
      bindTabEvents(container);
      if (state.activeTab === 'peserta') loadPesertaList(container);
    });
  });

  bindTabEvents(container);
  if (!isNew && state.activeTab === 'peserta') loadPesertaList(container);
}

function bindTabEvents(container) {
  // ── Form Info ──
  const formInfo = container.querySelector('#form-info');
  if (formInfo) {
    // Auto-fill kapasitas dari mode
    container.querySelector('#f-mode')?.addEventListener('change', (e) => {
      const kap = container.querySelector('#f-kapasitas');
      if (!kap.value) kap.value = e.target.value === 'online' ? 25 : 17;
    });

    // Weight sum display
    container.querySelectorAll('.weight-input').forEach(inp => {
      inp.addEventListener('input', () => updateWeightSum(container));
    });
    updateWeightSum(container);

    formInfo.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveInfo(container);
    });

    container.querySelector('#btn-delete-bimtek')?.addEventListener('click', async () => {
      const ok = await confirmDialog('Hapus Bimtek ini? Tindakan tidak bisa dibatalkan.');
      if (!ok) return;
      try {
        await deleteBimtek(state.bimtekId);
        showToast('Bimtek dihapus', 'success');
        window.location.hash = '#bimtek';
      } catch (err) {
        showToast('Gagal menghapus: ' + err.message, 'error');
      }
    });
  }

  // ── Tab Mapel ──
  container.querySelector('#btn-add-mapel')?.addEventListener('click', () => {
    showMapelModal(state.bimtekId, null, state.pengajars, async () => {
      state.mapels = await listMapel(state.bimtekId);
      container.querySelector('#tab-content').innerHTML = buildTabMapel();
      bindTabEvents(container);
    });
  });

  container.querySelector('#tab-content')?.addEventListener('click', async (e) => {
    // Edit mapel
    const editBtn = e.target.closest('.btn-edit-mapel');
    if (editBtn) {
      const mapel = state.mapels.find(m => m.id === editBtn.dataset.id);
      if (mapel) {
        showMapelModal(state.bimtekId, mapel, state.pengajars, async () => {
          state.mapels = await listMapel(state.bimtekId);
          container.querySelector('#tab-content').innerHTML = buildTabMapel();
          bindTabEvents(container);
        });
      }
    }

    // Delete mapel
    const deleteBtn = e.target.closest('.btn-delete-mapel');
    if (deleteBtn) {
      const nama = deleteBtn.dataset.nama;
      const ok = await confirmDialog(`Hapus mata pelajaran "${nama}"?`);
      if (!ok) return;
      try {
        await deleteMapel(state.bimtekId, deleteBtn.dataset.id);
        await reorderMapel(state.bimtekId);
        state.mapels = await listMapel(state.bimtekId);
        container.querySelector('#tab-content').innerHTML = buildTabMapel();
        bindTabEvents(container);
        showToast('Mapel dihapus', 'success');
      } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
      }
    }

    // Delete sesi
    const deleteSesiBtn = e.target.closest('.btn-delete-sesi');
    if (deleteSesiBtn) {
      const ok = await confirmDialog('Hapus sesi ini?');
      if (!ok) return;
      try {
        await deleteSesi(state.bimtekId, deleteSesiBtn.dataset.id);
        state.sesis = await listSesi(state.bimtekId);
        container.querySelector('#tab-content').innerHTML = buildTabJadwal();
        bindTabEvents(container);
      } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
      }
    }
  });

  // ── Form tambah sesi ──
  const formSesi = container.querySelector('#form-add-sesi');
  if (formSesi) {
    container.querySelector('#sesi-tipe')?.addEventListener('change', (e) => {
      const mapelCol = container.querySelector('#sesi-mapel-col');
      if (mapelCol) mapelCol.style.display = e.target.value === 'mapel' ? '' : 'none';
    });

    formSesi.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleAddSesi(container);
    });
  }

  // ── Tab Peserta ──
  container.querySelector('#btn-add-peserta')?.addEventListener('click', async () => {
    await showAddPesertaModal(container);
  });
}

// ─── HANDLE SAVE INFO ───────────────────────────────────────────────────────

async function handleSaveInfo(container) {
  const errEl = container.querySelector('#form-info-error');
  const errMsg = container.querySelector('#form-info-error-msg');
  const btn = container.querySelector('#btn-save-info');
  errEl?.classList.add('d-none');

  const bidangIds = Array.from(container.querySelectorAll('.bidang-cb:checked')).map(cb => cb.value);
  const weights = {};
  container.querySelectorAll('.weight-input').forEach(inp => {
    weights[inp.dataset.key] = parseFloat(inp.value || 0) / 100;
  });

  const mulai = container.querySelector('#f-mulai').value;
  const selesai = container.querySelector('#f-selesai').value;

  const data = {
    nama: container.querySelector('#f-nama').value,
    tipe: container.querySelector('#f-tipe').value,
    mode: container.querySelector('#f-mode').value,
    bidangIds,
    lokasi: container.querySelector('#f-lokasi').value,
    kodeBimtek: container.querySelector('#f-kode').value,
    kapasitas: parseInt(container.querySelector('#f-kapasitas').value || 0, 10) || null,
    kkm: parseInt(container.querySelector('#f-kkm').value, 10) || DEFAULT_KKM,
    hasTugas: container.querySelector('#f-has-tugas')?.checked || false,
    hasPresentasi: container.querySelector('#f-has-presentasi')?.checked || false,
    weights,
    periode: {
      mulai: mulai ? Timestamp.fromDate(new Date(mulai)) : null,
      selesai: selesai ? Timestamp.fromDate(new Date(selesai)) : null,
    },
  };

  // Validasi
  const errors = [];
  if (!data.nama.trim()) errors.push('Nama wajib diisi');
  if (!data.tipe) errors.push('Tipe wajib dipilih');
  if (!data.mode) errors.push('Mode wajib dipilih');
  if (bidangIds.length === 0) errors.push('Minimal 1 bidang harus dipilih');
  if (!mulai) errors.push('Tanggal mulai wajib diisi');
  if (!selesai) errors.push('Tanggal selesai wajib diisi');
  if (mulai && selesai && new Date(mulai) > new Date(selesai)) errors.push('Tanggal mulai tidak boleh setelah tanggal selesai');
  if (!data.lokasi.trim()) errors.push('Lokasi wajib diisi');

  const weightSum = Object.values(weights).reduce((s, v) => s + v, 0);
  if (Math.abs(weightSum - 1) > 0.01) errors.push(`Total bobot harus 100% (saat ini ${Math.round(weightSum * 100)}%)`);

  if (errors.length > 0) {
    errMsg.textContent = errors.join('; ');
    errEl.classList.remove('d-none');
    return;
  }

  // Auto kapasitas
  if (!data.kapasitas) data.kapasitas = data.mode === 'online' ? 25 : 17;

  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    if (state.bimtekId) {
      await updateBimtek(state.bimtekId, data);
      state.bimtek = await getBimtek(state.bimtekId);
      showToast('Bimtek berhasil disimpan', 'success');
    } else {
      const id = await createBimtek(data);
      showToast('Bimtek berhasil dibuat', 'success');
      window.location.hash = `#bimtek/${id}`;
    }
  } catch (err) {
    errMsg.textContent = 'Gagal menyimpan: ' + err.message;
    errEl.classList.remove('d-none');
    btn.disabled = false;
    btn.textContent = state.bimtekId ? 'Simpan Perubahan' : 'Buat Bimtek';
  }
}

// ─── HANDLE ADD SESI ────────────────────────────────────────────────────────

async function handleAddSesi(container) {
  const errEl = container.querySelector('#sesi-error');
  const warnEl = container.querySelector('#sesi-warning');
  errEl?.classList.add('d-none');
  warnEl?.classList.add('d-none');

  const tipe = container.querySelector('#sesi-tipe').value;
  const tglStr = container.querySelector('#sesi-tanggal').value;
  const jamMulai = container.querySelector('#sesi-jam-mulai').value;
  const mapelId = container.querySelector('#sesi-mapel')?.value || null;
  const jp = parseInt(container.querySelector('#sesi-jp')?.value || 0, 10) || null;

  if (!tglStr || !jamMulai) {
    errEl.textContent = 'Tanggal dan jam mulai wajib diisi';
    errEl.classList.remove('d-none');
    return;
  }

  const tanggal = Timestamp.fromDate(new Date(tglStr));
  const mapel = tipe === 'mapel' ? state.mapels.find(m => m.id === mapelId) : null;
  const jpFinal = tipe === 'mapel' ? (jp || mapel?.totalJp || 0) : 0;

  // Hitung jam selesai otomatis
  const breaksDefault = [
    { mulai: '10:15', selesai: '10:30' },
    { mulai: '12:00', selesai: '13:00' },
  ];
  const jamSelesai = tipe === 'mapel' && jpFinal > 0
    ? hitungJamSelesai(jamMulai, jpFinal, breaksDefault)
    : jamMulai; // non-mapel: admin isi manual (simplified)

  // Validasi jadwal kalau mapel
  if (tipe === 'mapel' && mapel) {
    const result = validateJadwalMapel(mapel, tanggal, jamMulai, jamSelesai, state.sesis);
    if (!result.valid) {
      errEl.textContent = result.errors.join('; ');
      errEl.classList.remove('d-none');
      return;
    }
    if (result.warnings.length > 0) {
      warnEl.textContent = '⚠️ ' + result.warnings.join('; ');
      warnEl.classList.remove('d-none');
    }
  }

  try {
    await createSesi(state.bimtekId, {
      tanggal,
      jamMulai,
      jamSelesai,
      tipe,
      mapelId: tipe === 'mapel' ? mapelId : null,
      jp: tipe === 'mapel' ? jpFinal : null,
      keterangan: tipe !== 'mapel' ? tipe : null,
    });

    state.sesis = await listSesi(state.bimtekId);
    container.querySelector('#tab-content').innerHTML = buildTabJadwal();
    bindTabEvents(container);
    showToast('Sesi ditambahkan', 'success');
  } catch (err) {
    errEl.textContent = 'Gagal: ' + err.message;
    errEl.classList.remove('d-none');
  }
}

// ─── LOAD & RENDER PESERTA LIST ─────────────────────────────────────────────

async function loadPesertaList(container) {
  const listContainer = container.querySelector('#peserta-list-container');
  if (!listContainer) return;

  try {
    const pesertaIds = state.bimtek?.pesertaIds || [];
    if (pesertaIds.length === 0) {
      listContainer.innerHTML = `<div class="text-muted">Belum ada peserta.</div>`;
      return;
    }

    // Fetch detail peserta dari master
    const allPeserta = await listPeserta();
    const enrolled = allPeserta.filter(p => pesertaIds.includes(p.noPeserta));
    const canEdit = ['draft', 'planned', 'ongoing'].includes(state.bimtek?.status);

    const rows = enrolled.map(p => `
      <tr>
        <td>${escHtml(p.noPeserta)}</td>
        <td>${escHtml(p.nama)}</td>
        <td>${escHtml(p.instansi || '-')}</td>
        <td>${escHtml(p.jabatan || '-')}</td>
        <td>
          ${canEdit ? `<button class="btn btn-xs btn-outline-danger btn-remove-peserta" data-no="${p.noPeserta}">Keluarkan</button>` : ''}
        </td>
      </tr>
    `).join('');

    listContainer.innerHTML = `
      <div class="table-responsive">
        <table class="table table-sm table-hover">
          <thead><tr><th>No Peserta</th><th>Nama</th><th>Instansi</th><th>Jabatan</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    listContainer.querySelectorAll('.btn-remove-peserta').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog(`Keluarkan peserta ${btn.dataset.no} dari Bimtek ini?`);
        if (!ok) return;
        try {
          await removePeserta(state.bimtekId, btn.dataset.no);
          state.bimtek = await getBimtek(state.bimtekId);
          await loadPesertaList(container);
          showToast('Peserta dikeluarkan', 'success');
        } catch (err) {
          showToast('Gagal: ' + err.message, 'error');
        }
      });
    });
  } catch (err) {
    listContainer.innerHTML = `<div class="text-danger">Gagal memuat peserta: ${err.message}</div>`;
  }
}

async function showAddPesertaModal(container) {
  try {
    const allPeserta = await listPeserta();
    const enrolled = state.bimtek?.pesertaIds || [];
    const available = allPeserta.filter(p => !enrolled.includes(p.noPeserta));

    if (available.length === 0) {
      showToast('Tidak ada peserta yang tersedia untuk ditambahkan', 'info');
      return;
    }

    const opts = available.map(p =>
      `<option value="${p.noPeserta}">${escHtml(p.noPeserta)} — ${escHtml(p.nama)} (${escHtml(p.instansi || '-')})</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h5>Tambah Peserta</h5>
          <button class="btn-close" data-dismiss></button>
        </div>
        <div class="modal-body">
          <label class="form-label">Pilih Peserta <small class="text-muted">(Ctrl+klik untuk multi-pilih)</small></label>
          <select id="peserta-select" class="form-select" multiple size="8">${opts}</select>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-dismiss>Batal</button>
          <button id="btn-confirm-add-peserta" class="btn btn-primary">Tambahkan</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';

    modal.querySelectorAll('[data-dismiss]').forEach(el => el.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#btn-confirm-add-peserta').addEventListener('click', async () => {
      const selected = Array.from(modal.querySelector('#peserta-select').selectedOptions).map(o => o.value);
      if (selected.length === 0) return;
      try {
        await addPeserta(state.bimtekId, selected);
        state.bimtek = await getBimtek(state.bimtekId);
        modal.remove();
        // Re-render header peserta count
        container.querySelector('#tab-content').innerHTML = buildTabPeserta();
        bindTabEvents(container);
        await loadPesertaList(container);
        showToast(`${selected.length} peserta ditambahkan`, 'success');
      } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
      }
    });
  } catch (err) {
    showToast('Gagal memuat daftar peserta: ' + err.message, 'error');
  }
}

// ─── WEIGHT SUM DISPLAY ─────────────────────────────────────────────────────

function updateWeightSum(container) {
  const infoEl = container.querySelector('#weight-sum-info');
  if (!infoEl) return;
  const total = Array.from(container.querySelectorAll('.weight-input'))
    .reduce((sum, inp) => sum + parseFloat(inp.value || 0), 0);
  const ok = Math.abs(total - 100) < 1;
  infoEl.innerHTML = `Total bobot: <strong class="${ok ? 'text-success' : 'text-danger'}">${total}%</strong> ${ok ? '✓' : '(harus 100%)'}`;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function labelStatus(status) {
  const map = { draft: 'Draft', planned: 'Direncanakan', ongoing: 'Berlangsung', completed: 'Selesai', cancelled: 'Dibatalkan' };
  return map[status] || status;
}

function toDateInput(ts) {
  const d = ts?.toDate?.() || ts;
  if (!d) return '';
  return d.toISOString().split('T')[0];
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
