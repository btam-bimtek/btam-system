// admin/js/modules/bimtek/detail.js
import {
  getBimtek, listMapel, deleteMapel, reorderMapel,
  addPeserta, removePeserta, listSesi, createSesi, deleteSesi,
  hitungJamSelesai, validateJadwalMapel, updateStatus,
} from './api.js';
import { showMapelModal } from './form-mapel.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';
import { listPengajar } from '../pengajar-master/api.js';
import { listPeserta } from '../peserta-master/api.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { setPageTitle } from '../../layout/navbar.js';
import { navigate } from '../../router.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── STATE ──────────────────────────────────────────────────────────────────

let S = {
  id: null,
  bimtek: null,
  mapels: [],
  sesis: [],
  pengajars: [],
  tab: 'mapel',
};

// ─── ENTRY POINT ────────────────────────────────────────────────────────────

export async function renderBimtekDetail({ id } = {}) {
  const app = document.getElementById('app');
  S.id  = id;
  S.tab = 'mapel';

  setPageTitle('Detail Bimtek');
  app.innerHTML = `
    <div class="flex items-center justify-center py-16">
      <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  try {
    const [bimtek, mapels, sesis, pengajarsResult] = await Promise.all([
      getBimtek(id),
      listMapel(id),
      listSesi(id),
      listPengajar({ pageSize: 999 }),
    ]);
    S.bimtek    = bimtek;
    S.mapels    = mapels;
    S.sesis     = sesis;
    // listPengajar() return { data: [...], lastDoc } bukan array
    S.pengajars = pengajarsResult.data ?? [];
    _render(app);
  } catch (err) {
    app.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat: ${err.message}</div>`;
  }
}

// ─── RENDER SHELL ───────────────────────────────────────────────────────────

function _render(app) {
  const b = S.bimtek;
  setPageTitle(b.nama);

  const bidangNama = (b.bidangIds || [])
    .map(id => BIDANG_LIST.find(x => x.bidangId === id)?.nama || id)
    .join(', ');

  const canEdit = ['draft','planned','ongoing'].includes(b.status);

  app.innerHTML = `
    <!-- Header -->
    <div class="flex items-start justify-between mb-6 gap-4">
      <div class="flex items-start gap-3">
        <button id="btn-back" class="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors mt-0.5">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 class="text-lg font-bold text-white">${_esc(b.nama)}</h1>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span class="text-xs text-gray-500">${_esc(b.kodeBimtek || '')}</span>
            ${_badgeStatus(b.status)}
            ${_badgeTipe(b.tipe)}
          </div>
          <div class="text-xs text-gray-500 mt-1">${_esc(bidangNama)} · ${_fmtDate(b.periode?.mulai)} – ${_fmtDate(b.periode?.selesai)} · ${_esc(b.lokasi || '-')}</div>
        </div>
      </div>
      ${canEdit ? `
        <button id="btn-edit" class="shrink-0 px-3 py-1.5 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-white transition-colors">
          Edit Info
        </button>` : ''}
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 border-b border-gray-800">
      ${_buildTabBtn('mapel',   'Mata Pelajaran')}
      ${_buildTabBtn('jadwal',  'Jadwal')}
      ${_buildTabBtn('peserta', 'Peserta')}
    </div>

    <!-- Tab content -->
    <div id="tab-content"></div>
  `;

  // Bind header events
  app.querySelector('#btn-back').addEventListener('click', () => navigate('/bimtek'));
  app.querySelector('#btn-edit')?.addEventListener('click', () => navigate(`/bimtek/${S.id}/edit`));

  // Bind tab buttons
  app.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.tab = btn.dataset.tab;
      app.querySelectorAll('.tab-btn').forEach(b => _setTabActive(b, b.dataset.tab === S.tab));
      _renderTab(app);
    });
  });

  _renderTab(app);
}

function _buildTabBtn(id, label) {
  const active = S.tab === id;
  return `<button class="tab-btn px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? 'text-blue-400 border-blue-400' : 'text-gray-400 border-transparent hover:text-gray-200'}" data-tab="${id}">${label}</button>`;
}

function _setTabActive(btn, active) {
  btn.className = `tab-btn px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? 'text-blue-400 border-blue-400' : 'text-gray-400 border-transparent hover:text-gray-200'}`;
}

// ─── RENDER TAB ─────────────────────────────────────────────────────────────

function _renderTab(app) {
  const el = app.querySelector('#tab-content');
  if (S.tab === 'mapel')   { el.innerHTML = _buildTabMapel();   _bindMapelEvents(app, el); }
  if (S.tab === 'jadwal')  { el.innerHTML = _buildTabJadwal();  _bindJadwalEvents(app, el); }
  if (S.tab === 'peserta') { el.innerHTML = _buildTabPeserta(); _loadPeserta(app, el); }
}

// ─── TAB: MATA PELAJARAN ────────────────────────────────────────────────────

function _buildTabMapel() {
  const canEdit = ['draft','planned','ongoing'].includes(S.bimtek?.status);
  const totalJp = S.mapels.reduce((s, m) => s + (m.totalJp || 0), 0);

  if (S.mapels.length === 0) {
    return `
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-10 text-center">
        <p class="text-gray-500 text-sm mb-4">Belum ada mata pelajaran.</p>
        ${canEdit ? `<button id="btn-add-mapel" class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">+ Tambah Mata Pelajaran</button>` : ''}
      </div>`;
  }

  const rows = S.mapels.map(m => {
    const pengajarNama = (m.pengajarIds || []).map(pid => {
      return S.pengajars.find(x => x.id === pid)?.nama || pid;
    }).join(', ');
    const penilaiNama = S.pengajars.find(x => x.id === m.pengajarPenilaiId)?.nama || '-';
    const bidangNama  = BIDANG_LIST.find(b => b.bidangId === m.bidangId)?.nama || m.bidangId || '-';

    return `
      <tr>
        <td class="text-center text-gray-500">${m.urutan}</td>
        <td>
          <div class="font-medium text-white text-sm">${_esc(m.nama)}</div>
          <div class="text-xs text-gray-500">${_esc(bidangNama)}</div>
        </td>
        <td class="text-center">
          <span class="badge badge-blue">${m.totalJp} JP</span>
        </td>
        <td>
          <div class="text-sm text-gray-300">${_esc(pengajarNama)}</div>
          <div class="text-xs text-gray-500">Penilai: ${_esc(penilaiNama)}</div>
        </td>
        <td>
          ${canEdit ? `
            <div class="flex gap-2">
              <button class="btn-edit-mapel text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" data-id="${m.id}">Edit</button>
              <button class="btn-del-mapel text-xs px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-white transition-colors" data-id="${m.id}" data-nama="${_esc(m.nama)}">Hapus</button>
            </div>` : '-'}
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs text-gray-500">${S.mapels.length} mata pelajaran · Total ${totalJp} JP</span>
      ${canEdit ? `<button id="btn-add-mapel" class="px-3 py-1.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">+ Tambah</button>` : ''}
    </div>
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <table class="btam-table">
        <thead>
          <tr>
            <th class="text-center w-10">#</th>
            <th>Nama Mapel</th>
            <th class="text-center">JP</th>
            <th>Pengajar</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function _bindMapelEvents(app, el) {
  const canEdit = ['draft','planned','ongoing'].includes(S.bimtek?.status);
  if (!canEdit) return;

  el.querySelector('#btn-add-mapel')?.addEventListener('click', () => {
    showMapelModal(S.id, null, S.pengajars, async () => {
      S.mapels = await listMapel(S.id);
      el.innerHTML = _buildTabMapel();
      _bindMapelEvents(app, el);
    });
  });

  el.querySelectorAll('.btn-edit-mapel').forEach(btn => {
    btn.addEventListener('click', () => {
      const mapel = S.mapels.find(m => m.id === btn.dataset.id);
      if (!mapel) return;
      showMapelModal(S.id, mapel, S.pengajars, async () => {
        S.mapels = await listMapel(S.id);
        el.innerHTML = _buildTabMapel();
        _bindMapelEvents(app, el);
      });
    });
  });

  el.querySelectorAll('.btn-del-mapel').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Hapus Mapel', message: `Hapus mata pelajaran "${btn.dataset.nama}"?`, danger: true });
      if (!ok) return;
      try {
        await deleteMapel(S.id, btn.dataset.id);
        await reorderMapel(S.id);
        S.mapels = await listMapel(S.id);
        el.innerHTML = _buildTabMapel();
        _bindMapelEvents(app, el);
        showToast('Mapel dihapus', 'success');
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  });
}

// ─── TAB: JADWAL ────────────────────────────────────────────────────────────

function _buildTabJadwal() {
  const canEdit = ['draft','planned'].includes(S.bimtek?.status);

  // Group by tanggal
  const byDate = {};
  for (const s of S.sesis) {
    const tgl = s.tanggal?.toDate?.()?.toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }) || '?';
    if (!byDate[tgl]) byDate[tgl] = [];
    byDate[tgl].push(s);
  }

  const unscheduled = S.mapels.filter(m => !m.jadwal);
  let html = '';

  if (unscheduled.length > 0) {
    html += `<div class="mb-4 p-3 rounded-lg bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-sm">
      ⚠️ ${unscheduled.length} mapel belum dijadwalkan: ${unscheduled.map(m => `<strong>${_esc(m.nama)}</strong>`).join(', ')}
    </div>`;
  }

  if (S.sesis.length === 0) {
    html += `<div class="bg-gray-900 rounded-xl border border-gray-800 p-10 text-center text-gray-500 text-sm mb-4">Jadwal belum dibuat.</div>`;
  } else {
    html += Object.entries(byDate).map(([tgl, list]) => `
      <div class="mb-5">
        <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">${tgl}</div>
        <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          ${list.sort((a,b) => a.jamMulai.localeCompare(b.jamMulai)).map(s => {
            const mapel = S.mapels.find(m => m.id === s.mapelId);
            const label = s.tipe === 'mapel' ? `${mapel?.nama || 'Mapel'} (${s.jp} JP)` : (s.keterangan || s.tipe);
            const colors = { mapel:'badge-blue', break:'badge-gray', ishoma:'badge-yellow', pembukaan:'badge-green', penutupan:'badge-purple' };
            return `
              <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
                <div class="flex items-center gap-3">
                  <span class="badge ${colors[s.tipe]||'badge-gray'} shrink-0">${s.jamMulai}–${s.jamSelesai}</span>
                  <span class="text-sm text-gray-200">${_esc(label)}</span>
                </div>
                ${canEdit ? `<button class="btn-del-sesi text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-900 text-red-300 transition-colors" data-id="${s.id}">×</button>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`).join('');
  }

  if (canEdit) {
    const mapelOpts = S.mapels.map(m => `<option value="${m.id}">${_esc(m.nama)} (${m.totalJp} JP)</option>`).join('');
    html += `
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 mt-2">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Tambah Sesi</h3>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1.5">Tanggal</label>
            <input type="date" id="sesi-tgl" class="form-input w-full">
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1.5">Tipe</label>
            <select id="sesi-tipe" class="form-select w-full">
              <option value="mapel">Mata Pelajaran</option>
              <option value="break">Break</option>
              <option value="ishoma">ISHOMA</option>
              <option value="pembukaan">Pembukaan</option>
              <option value="penutupan">Penutupan</option>
            </select>
          </div>
          <div id="sesi-mapel-wrap">
            <label class="block text-xs text-gray-400 mb-1.5">Mata Pelajaran</label>
            <select id="sesi-mapel" class="form-select w-full">
              <option value="">-- Pilih --</option>
              ${mapelOpts}
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1.5">Jam Mulai</label>
            <input type="time" id="sesi-jam" class="form-input w-full">
          </div>
        </div>
        <div id="sesi-error" class="hidden text-red-400 text-xs mb-3"></div>
        <button id="btn-add-sesi" class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">
          + Tambah Sesi
        </button>
      </div>`;
  }

  return html;
}

function _bindJadwalEvents(app, el) {
  const canEdit = ['draft','planned'].includes(S.bimtek?.status);
  if (!canEdit) return;

  el.querySelector('#sesi-tipe')?.addEventListener('change', e => {
    el.querySelector('#sesi-mapel-wrap').style.display = e.target.value === 'mapel' ? '' : 'none';
  });

  el.querySelectorAll('.btn-del-sesi').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Hapus Sesi', message: 'Hapus sesi ini?' });
      if (!ok) return;
      try {
        await deleteSesi(S.id, btn.dataset.id);
        S.sesis = await listSesi(S.id);
        el.innerHTML = _buildTabJadwal();
        _bindJadwalEvents(app, el);
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  });

  el.querySelector('#btn-add-sesi')?.addEventListener('click', async () => {
    const errEl = el.querySelector('#sesi-error');
    errEl.classList.add('hidden');

    const tgl      = el.querySelector('#sesi-tgl').value;
    const tipe     = el.querySelector('#sesi-tipe').value;
    const jamMulai = el.querySelector('#sesi-jam').value;
    const mapelId  = el.querySelector('#sesi-mapel')?.value || null;

    if (!tgl || !jamMulai) { errEl.textContent = 'Tanggal dan jam mulai wajib diisi'; errEl.classList.remove('hidden'); return; }
    if (tipe === 'mapel' && !mapelId) { errEl.textContent = 'Pilih mata pelajaran'; errEl.classList.remove('hidden'); return; }

    const mapel  = tipe === 'mapel' ? S.mapels.find(m => m.id === mapelId) : null;
    const jpFinal = mapel?.totalJp || 0;
    const breaks  = [{ mulai:'10:15', selesai:'10:30' }, { mulai:'12:00', selesai:'13:00' }];
    const jamSelesai = tipe === 'mapel' && jpFinal > 0 ? hitungJamSelesai(jamMulai, jpFinal, breaks) : jamMulai;

    if (tipe === 'mapel' && mapel) {
      const tanggalTs = Timestamp.fromDate(new Date(tgl));
      const result = validateJadwalMapel(mapel, tanggalTs, jamMulai, jamSelesai, S.sesis);
      if (!result.valid) { errEl.textContent = result.errors.join('; '); errEl.classList.remove('hidden'); return; }
    }

    try {
      await createSesi(S.id, {
        tanggal: Timestamp.fromDate(new Date(tgl)),
        jamMulai, jamSelesai, tipe,
        mapelId: tipe === 'mapel' ? mapelId : null,
        jp: tipe === 'mapel' ? jpFinal : null,
        keterangan: tipe !== 'mapel' ? tipe : null,
      });
      S.sesis = await listSesi(S.id);
      el.innerHTML = _buildTabJadwal();
      _bindJadwalEvents(app, el);
      showToast('Sesi ditambahkan', 'success');
    } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
  });
}

// ─── TAB: PESERTA ───────────────────────────────────────────────────────────

function _buildTabPeserta() {
  const total    = S.bimtek?.pesertaIds?.length || 0;
  const kapasitas = S.bimtek?.kapasitas || 0;
  const canEdit  = ['draft','planned','ongoing'].includes(S.bimtek?.status);
  const penuh    = total >= kapasitas;

  return `
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs text-gray-500">${total} / ${kapasitas} peserta</span>
      <div class="flex gap-2">
        ${penuh ? `<span class="badge badge-yellow">Kapasitas penuh</span>` : ''}
        ${canEdit && !penuh ? `<button id="btn-add-peserta" class="px-3 py-1.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">+ Tambah Peserta</button>` : ''}
      </div>
    </div>
    <div id="peserta-list" class="bg-gray-900 rounded-xl border border-gray-800">
      <div class="flex items-center justify-center py-10">
        <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    </div>`;
}

async function _loadPeserta(app, el) {
  const listEl   = el.querySelector('#peserta-list');
  const pesertaIds = S.bimtek?.pesertaIds || [];
  const canEdit  = ['draft','planned','ongoing'].includes(S.bimtek?.status);

  if (pesertaIds.length === 0) {
    listEl.innerHTML = `<div class="text-center py-10 text-gray-500 text-sm">Belum ada peserta.</div>`;
  } else {
    try {
      const { data: all } = await listPeserta({ pageSize: 999 });
      const enrolled = all.filter(p => pesertaIds.includes(p.noPeserta));

      const rows = enrolled.map(p => `
        <tr>
          <td class="text-xs text-gray-400">${_esc(p.noPeserta)}</td>
          <td class="font-medium text-white text-sm">${_esc(p.nama)}</td>
          <td class="text-sm text-gray-400">${_esc(p.instansi || '-')}</td>
          <td class="text-sm text-gray-400">${_esc(p.jabatan || '-')}</td>
          <td>
            ${canEdit ? `<button class="btn-rm-peserta text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-900 text-red-300 transition-colors" data-no="${_esc(p.noPeserta)}">Keluarkan</button>` : ''}
          </td>
        </tr>`).join('');

      listEl.innerHTML = `
        <table class="btam-table">
          <thead><tr><th>No</th><th>Nama</th><th>Instansi</th><th>Jabatan</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;

      listEl.querySelectorAll('.btn-rm-peserta').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await confirmDialog({ title: 'Keluarkan Peserta', message: `Keluarkan peserta ${btn.dataset.no}?`, danger: true });
          if (!ok) return;
          try {
            await removePeserta(S.id, btn.dataset.no);
            S.bimtek = await getBimtek(S.id); // refresh pesertaIds
            // Re-render tab peserta
            el.innerHTML = _buildTabPeserta();
            await _loadPeserta(app, el);
            showToast('Peserta dikeluarkan', 'success');
          } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat: ${err.message}</div>`;
    }
  }

  // Bind tombol tambah peserta
  el.querySelector('#btn-add-peserta')?.addEventListener('click', async () => {
    await _showAddPesertaModal(app, el);
  });
}

async function _showAddPesertaModal(app, el) {
  try {
    const { data: all }  = await listPeserta({ pageSize: 999 });
    const enrolled  = S.bimtek?.pesertaIds || [];
    const available = all.filter(p => !enrolled.includes(p.noPeserta));

    if (available.length === 0) { showToast('Tidak ada peserta yang tersedia', 'info'); return; }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60';
    modal.innerHTML = `
      <div class="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md mx-4">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 class="font-semibold text-white">Tambah Peserta</h3>
          <button id="modal-close" class="text-gray-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div class="p-5">
          <label class="block text-xs text-gray-400 mb-1.5">Pilih Peserta <span class="text-gray-500">(Ctrl+klik multi-pilih)</span></label>
          <select id="peserta-select" class="form-select w-full" multiple size="8">
            ${available.map(p => `<option value="${_esc(p.noPeserta)}">${_esc(p.noPeserta)} — ${_esc(p.nama)} (${_esc(p.instansi || '-')})</option>`).join('')}
          </select>
        </div>
        <div class="flex justify-end gap-3 px-5 py-4 border-t border-gray-800">
          <button id="modal-cancel" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Batal</button>
          <button id="modal-confirm" class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">Tambahkan</button>
        </div>
      </div>`;

    document.body.appendChild(modal);
    modal.querySelector('#modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#modal-confirm').addEventListener('click', async () => {
      const selected = Array.from(modal.querySelector('#peserta-select').selectedOptions).map(o => o.value);
      if (selected.length === 0) return;
      try {
        await addPeserta(S.id, selected);
        S.bimtek = await getBimtek(S.id);
        modal.remove();
        el.innerHTML = _buildTabPeserta();
        await _loadPeserta(app, el);
        showToast(`${selected.length} peserta ditambahkan`, 'success');
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function _badgeStatus(s) {
  const map = {
    draft:     'badge-gray',
    planned:   'badge-blue',
    ongoing:   'badge-green',
    completed: 'badge-purple',
    cancelled: 'badge-red',
  };
  const labels = { draft:'Draft', planned:'Direncanakan', ongoing:'Berlangsung', completed:'Selesai', cancelled:'Dibatalkan' };
  return `<span class="badge ${map[s]||'badge-gray'}">${labels[s]||s}</span>`;
}

function _badgeTipe(t) {
  const labels = { reguler:'Reguler', pnbp:'PNBP', e_learning:'e-Learning', ojt:'OJT', lainnya:'Lainnya' };
  return `<span class="badge badge-gray">${labels[t]||t}</span>`;
}

function _fmtDate(ts) {
  if (!ts) return '-';
  const d = ts?.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
