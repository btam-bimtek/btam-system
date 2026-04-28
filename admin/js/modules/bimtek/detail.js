// admin/js/modules/bimtek/detail.js
import {
  getBimtek, listMapel, deleteMapel, reorderMapel,
  addPeserta, removePeserta, listSesi, createSesi, deleteSesi,
  initSesiHari, tambahJpKosong, kurangJpKosong,
  hitungSegmenMapel, validateJadwalMapel, updateStatus,
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

// ─── JADWAL CONSTANTS ───────────────────────────────────────────────────────

// Break slots statis untuk hitungSegmenMapel (saat assign mapel ke slot)
const BREAK_SLOTS_REGULAR = [
  { mulai: '10:15', selesai: '10:30' },
  { mulai: '12:00', selesai: '13:00' },
  { mulai: '14:30', selesai: '14:45' },
];
const BREAK_SLOTS_JUMAT = [
  { mulai: '10:15', selesai: '10:30' },
  { mulai: '11:15', selesai: '13:45' },
];

function _isJumat(tglStr) {
  const [y, m, d] = tglStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 5;
}

function _hariSudahDiinisialisasi(tglStr) {
  return _sesiHariIni(tglStr).length > 0;
}

function _sesiHariIni(tglStr) {
  const [y, m, d] = tglStr.split('-').map(Number);
  const tglDate = new Date(y, m - 1, d).toDateString();
  return S.sesis.filter(s => {
    const t = s.tanggal?.toDate?.() ?? new Date(s.tanggal);
    return t.toDateString() === tglDate;
  });
}

// Hitung slot kosong berurutan dari slotId (melewati break/ishoma)
function _kosongDariSlot(slotId, tglStr) {
  const sesiHari = _sesiHariIni(tglStr).sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
  const startIdx = sesiHari.findIndex(s => s.id === slotId);
  if (startIdx === -1) return { count: 0, ids: [] };
  const ids = [];
  for (let i = startIdx; i < sesiHari.length; i++) {
    const s = sesiHari[i];
    if (s.tipe === 'kosong') ids.push(s.id);
    else if (['break', 'ishoma'].includes(s.tipe)) continue; // lewati break
    else break; // ketemu mapel/pembukaan/penutupan → stop
  }
  return { count: ids.length, ids };
}

// ─── BUILD TAB JADWAL ───────────────────────────────────────────────────────

function _buildTabJadwal() {
  const canEdit = ['draft', 'planned'].includes(S.bimtek?.status);

  // Group sesi by tanggal
  const byDate = {};
  for (const s of S.sesis) {
    const dateObj = s.tanggal?.toDate?.() ?? new Date(s.tanggal);
    const tglStr  = dateObj.getFullYear() + '-'
      + String(dateObj.getMonth() + 1).padStart(2, '0') + '-'
      + String(dateObj.getDate()).padStart(2, '0');
    if (!byDate[tglStr]) byDate[tglStr] = { list: [] };
    byDate[tglStr].list.push(s);
  }

  // Semua hari dalam periode bimtek
  const allDays = [];
  if (S.bimtek?.periode?.mulai && S.bimtek?.periode?.selesai) {
    const [sy, sm, sd] = S.bimtek.periode.mulai.split('-').map(Number);
    const [ey, em, ed] = S.bimtek.periode.selesai.split('-').map(Number);
    let cur = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    while (cur <= end) {
      const k = cur.getFullYear() + '-'
        + String(cur.getMonth() + 1).padStart(2, '0') + '-'
        + String(cur.getDate()).padStart(2, '0');
      allDays.push(k);
      cur.setDate(cur.getDate() + 1);
    }
  }
  for (const k of Object.keys(byDate)) { if (!allDays.includes(k)) allDays.push(k); }
  allDays.sort();

  const colors = { mapel: 'badge-blue', break: 'badge-gray', ishoma: 'badge-yellow', pembukaan: 'badge-green', penutupan: 'badge-purple', kosong: 'badge-gray' };

  // Pre-group segmen mapel per mapelId (untuk tombol hapus semua segmen)
  const segmenIds = {};
  for (const s of S.sesis) {
    if (s.tipe === 'mapel' && s.mapelId) {
      if (!segmenIds[s.mapelId]) segmenIds[s.mapelId] = [];
      segmenIds[s.mapelId].push(s.id);
    }
  }

  let html = '';

  if (allDays.length === 0) {
    html += `<div class="bg-gray-900 rounded-xl border border-gray-800 p-10 text-center text-gray-500 text-sm mb-4">
      Periode bimtek belum diset. Isi dulu di form edit bimtek.
    </div>`;
  } else {
    html += allDays.map(tglStr => {
      const list = byDate[tglStr]?.list ?? [];
      const [dy, dm, dd] = tglStr.split('-').map(Number);
      const dayObj  = new Date(dy, dm - 1, dd);
      const label   = dayObj.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      const diinit  = list.length > 0;
      const jpKosong = list.filter(s => s.tipe === 'kosong').length;
      const jpTotal  = list.filter(s => s.tipe === 'kosong' || s.tipe === 'mapel').reduce((n, s) => n + (s.jp || 1), 0);

      const rows = diinit
        ? list.sort((a, b) => a.jamMulai.localeCompare(b.jamMulai)).map(s => {
            const mapel = S.mapels.find(m => m.id === s.mapelId);
            const isFirstSeg = !s.totalSegmen || s.totalSegmen === 1 || s.segmenKe === 1;
            const segLbl = s.tipe === 'mapel' && s.totalSegmen > 1
              ? ` <span class="text-xs text-gray-500">Bag. ${s.segmenKe}/${s.totalSegmen}</span>` : '';

            if (s.tipe === 'kosong') {
              return `
                <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 last:border-0 bg-gray-900/50">
                  <div class="flex items-center gap-3">
                    <span class="badge badge-gray shrink-0 opacity-50">${s.jamMulai}–${s.jamSelesai}</span>
                    <span class="text-sm text-gray-600 italic">Slot kosong (1 JP)</span>
                  </div>
                  ${canEdit ? `<button class="btn-assign-mapel text-xs px-2 py-1 rounded bg-blue-900/40 hover:bg-blue-800 text-blue-400 transition-colors whitespace-nowrap"
                    data-id="${s.id}" data-tgl="${tglStr}">Assign Mapel</button>` : ''}
                </div>`;
            }

            const lbl = s.tipe === 'mapel' ? `${mapel?.nama || 'Mapel'} (${s.jp} JP)` : (s.keterangan || s.tipe);
            const allSegIds = (segmenIds[s.mapelId] || [s.id]).join(',');
            const delBtn = canEdit ? (
              s.tipe === 'mapel' && isFirstSeg
                ? `<button class="btn-del-sesi text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-900 text-red-300 transition-colors"
                    data-del-ids="${allSegIds}" title="Hapus semua segmen mapel ini">×</button>`
                : s.tipe === 'mapel' ? ''
                : ['break','ishoma'].includes(s.tipe) ? '' // break tidak bisa dihapus manual
                : `<button class="btn-del-sesi text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-900 text-red-300 transition-colors"
                    data-id="${s.id}">×</button>`
            ) : '';

            return `
              <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 last:border-0">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <span class="badge ${colors[s.tipe] || 'badge-gray'} shrink-0">${s.jamMulai}–${s.jamSelesai}</span>
                  <span class="text-sm text-gray-200">${_esc(lbl)}</span>${segLbl}
                </div>
                ${delBtn}
              </div>`;
          }).join('')
        : `<div class="px-4 py-6 text-center text-gray-600 text-sm italic">Belum diinisialisasi</div>`;

      const editJpBtns = canEdit && diinit ? `
        <div class="flex items-center gap-1">
          <span class="text-xs text-gray-600">${jpKosong} kosong / ${jpTotal} JP</span>
          <button class="btn-del-jp text-xs px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 ml-2" data-tgl="${tglStr}" title="Kurangi 1 JP kosong">−</button>
          <button class="btn-add-jp text-xs px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400" data-tgl="${tglStr}" title="Tambah 1 JP kosong">+</button>
        </div>` : '';

      return `
        <div class="mb-4">
          <div class="flex items-center justify-between mb-1.5">
            <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">${label}</div>
            ${editJpBtns}
          </div>
          <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">${rows}</div>
        </div>`;
    }).join('');
  }

  // Panel bawah: inisialisasi + pembukaan/penutupan
  if (canEdit) {
    const needsInit = allDays.some(d => !_hariSudahDiinisialisasi(d));
    html += `
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 mt-2 space-y-5">

        ${needsInit ? `
        <div>
          <h3 class="text-sm font-semibold text-gray-300 mb-2">Inisialisasi Jadwal</h3>
          <p class="text-xs text-gray-500 mb-3">Buat slot kosong + break/ISHOMA untuk semua hari yang belum diinisialisasi.<br>
            Default: Senin–Kamis 9 JP, Jumat 6 JP. Sesuaikan per hari dengan tombol +/− setelah inisialisasi.</p>
          <button id="btn-init-semua" class="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            Inisialisasi Semua Hari
          </button>
          <div id="init-error" class="hidden text-red-400 text-xs mt-2"></div>
        </div>
        <div class="border-t border-gray-800"></div>` : ''}

        <div>
          <h3 class="text-sm font-semibold text-gray-300 mb-3">Tambah Sesi Lain</h3>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Tanggal</label>
              <input type="date" id="other-tgl" class="form-input w-full">
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Tipe</label>
              <select id="other-tipe" class="form-select w-full">
                <option value="pembukaan">Pembukaan</option>
                <option value="penutupan">Penutupan</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Jam Mulai</label>
              <input type="time" id="other-jam-mulai" class="form-input w-full" value="07:30">
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Jam Selesai</label>
              <input type="time" id="other-jam-selesai" class="form-input w-full" value="08:00">
            </div>
          </div>
          <div id="other-error" class="hidden text-red-400 text-xs mb-3"></div>
          <button id="btn-add-other" class="px-4 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-white transition-colors">
            + Tambah Sesi
          </button>
        </div>

      </div>`;
  }

  return html;
}

// ─── ASSIGN MODAL ────────────────────────────────────────────────────────────

function _showAssignModal(slotId, tglStr) {
  document.getElementById('assign-modal')?.remove();

  const { count: available, ids: kosongIds } = _kosongDariSlot(slotId, tglStr);
  const jamMulai = S.sesis.find(s => s.id === slotId)?.jamMulai || '?';

  const mapelOpts = S.mapels.map(m => {
    const disabled = m.totalJp > available;
    const warn = disabled ? ` (butuh ${m.totalJp} JP, tersedia ${available})` : ` — ${m.totalJp} JP`;
    return `<option value="${m.id}" ${disabled ? 'disabled' : ''}>${_esc(m.nama)}${warn}</option>`;
  }).join('');

  const el = document.createElement('div');
  el.id = 'assign-modal';
  el.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60';
  el.innerHTML = `
    <div class="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md mx-4">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <h5 class="font-semibold text-white">Assign Mata Pelajaran</h5>
        <button class="text-gray-400 hover:text-white text-xl" id="assign-close">×</button>
      </div>
      <div class="p-5 space-y-4">
        <p class="text-xs text-gray-500">Slot mulai <strong class="text-gray-300">${jamMulai}</strong> — tersedia <strong class="text-gray-300">${available} JP kosong</strong> berurutan.</p>
        <div>
          <label class="block text-xs text-gray-400 mb-1.5">Mata Pelajaran <span class="text-red-400">*</span></label>
          <select id="assign-mapel" class="form-select w-full">
            <option value="">-- Pilih Mapel --</option>
            ${mapelOpts}
          </select>
        </div>
        <div id="assign-error" class="hidden text-red-400 text-sm bg-red-900/30 rounded p-3"></div>
      </div>
      <div class="flex justify-end gap-3 px-5 py-4 border-t border-gray-800">
        <button class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors" id="assign-batal">Batal</button>
        <button id="assign-ok" class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">Assign</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  const close = () => el.remove();
  el.querySelector('#assign-close').addEventListener('click', close);
  el.querySelector('#assign-batal').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });

  el.querySelector('#assign-ok').addEventListener('click', async () => {
    const errEl  = el.querySelector('#assign-error');
    const btn    = el.querySelector('#assign-ok');
    const mapelId = el.querySelector('#assign-mapel').value;
    errEl.classList.add('hidden');

    if (!mapelId) { errEl.textContent = 'Pilih mata pelajaran'; errEl.classList.remove('hidden'); return; }

    const mapel = S.mapels.find(m => m.id === mapelId);
    if (!mapel) { errEl.textContent = 'Mapel tidak ditemukan'; errEl.classList.remove('hidden'); return; }
    if (mapel.totalJp > available) {
      errEl.textContent = `Slot tidak cukup. Butuh ${mapel.totalJp} JP, tersedia ${available} JP.`;
      errEl.classList.remove('hidden');
      return;
    }

    // Jumat: max 7 JP untuk 1 mapel (blocker OPUSPLAN)
    if (_isJumat(tglStr) && mapel.totalJp > 7) {
      errEl.textContent = 'Mapel dengan lebih dari 7 JP tidak bisa dijadwalkan di hari Jumat.';
      errEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    try {
      // Hapus slot kosong yang akan dipakai
      const toDelete = kosongIds.slice(0, mapel.totalJp);
      for (const id of toDelete) await deleteSesi(S.id, id);

      // Buat segmen mapel
      const breakSlots = _isJumat(tglStr) ? BREAK_SLOTS_JUMAT : BREAK_SLOTS_REGULAR;
      const segmen     = hitungSegmenMapel(jamMulai, mapel.totalJp, breakSlots);
      const [y, m, d]  = tglStr.split('-').map(Number);
      const tanggalTs  = Timestamp.fromDate(new Date(y, m - 1, d));

      for (let i = 0; i < segmen.length; i++) {
        await createSesi(S.id, {
          tanggal: tanggalTs,
          jamMulai: segmen[i].jamMulai, jamSelesai: segmen[i].jamSelesai,
          tipe: 'mapel', mapelId,
          jp: segmen[i].jp,
          segmenKe: i + 1, totalSegmen: segmen.length,
          keterangan: null,
        });
      }

      S.sesis = await listSesi(S.id);
      close();
      // Re-render tab jadwal
      const tabEl = document.querySelector('#tab-content');
      if (tabEl) {
        tabEl.innerHTML = _buildTabJadwal();
        _bindJadwalEvents(null, tabEl);
      }
      showToast(`${mapel.nama} berhasil di-assign`, 'success');
    } catch (err) {
      errEl.textContent = 'Gagal: ' + err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Assign';
    }
  });
}

// ─── BIND JADWAL EVENTS ─────────────────────────────────────────────────────

function _bindJadwalEvents(app, el) {
  const canEdit = ['draft', 'planned'].includes(S.bimtek?.status);
  if (!canEdit) return;

  // ── Hapus sesi (mapel atau pembukaan/penutupan) ──────────
  el.querySelectorAll('.btn-del-sesi').forEach(btn => {
    btn.addEventListener('click', async () => {
      const delIdsRaw = btn.dataset.delIds;
      const isMapel   = !!delIdsRaw;
      const ok = await confirmDialog({
        title: isMapel ? 'Hapus Jadwal Mapel' : 'Hapus Sesi',
        message: isMapel ? 'Hapus semua segmen mapel ini?' : 'Hapus sesi ini?',
        danger: true,
      });
      if (!ok) return;
      try {
        const ids = isMapel ? delIdsRaw.split(',').filter(Boolean) : [btn.dataset.id];
        for (const id of ids) await deleteSesi(S.id, id);
        S.sesis = await listSesi(S.id);
        el.innerHTML = _buildTabJadwal();
        _bindJadwalEvents(app, el);
        showToast('Jadwal dihapus', 'success');
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  });

  // ── Assign Mapel ke slot kosong ──────────────────────────
  el.querySelectorAll('.btn-assign-mapel').forEach(btn => {
    btn.addEventListener('click', () => {
      _showAssignModal(btn.dataset.id, btn.dataset.tgl);
    });
  });

  // ── Inisialisasi Semua Hari ──────────────────────────────
  el.querySelector('#btn-init-semua')?.addEventListener('click', async () => {
    const errEl = el.querySelector('#init-error');
    errEl.classList.add('hidden');

    if (!S.bimtek?.periode?.mulai || !S.bimtek?.periode?.selesai) {
      errEl.textContent = 'Periode bimtek belum diset.';
      errEl.classList.remove('hidden');
      return;
    }

    const btn = el.querySelector('#btn-init-semua');
    btn.disabled = true;
    btn.textContent = 'Membuat...';

    try {
      const [sy, sm, sd] = S.bimtek.periode.mulai.split('-').map(Number);
      const [ey, em, ed] = S.bimtek.periode.selesai.split('-').map(Number);
      let cur = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);
      let created = 0;

      while (cur <= end) {
        const tglStr = cur.getFullYear() + '-'
          + String(cur.getMonth() + 1).padStart(2, '0') + '-'
          + String(cur.getDate()).padStart(2, '0');

        if (!_hariSudahDiinisialisasi(tglStr)) {
          const defaultJp = _isJumat(tglStr) ? 6 : 9;
          await initSesiHari(S.id, tglStr, defaultJp);
          created++;
        }
        cur.setDate(cur.getDate() + 1);
      }

      S.sesis = await listSesi(S.id);
      el.innerHTML = _buildTabJadwal();
      _bindJadwalEvents(app, el);
      showToast(created > 0 ? `${created} hari diinisialisasi` : 'Semua hari sudah diinisialisasi', 'success');
    } catch (err) {
      errEl.textContent = 'Gagal: ' + err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Inisialisasi Semua Hari';
    }
  });

  // ── +JP per hari ─────────────────────────────────────────
  el.querySelectorAll('.btn-add-jp').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tglStr = btn.dataset.tgl;
      const sesiHari = _sesiHariIni(tglStr);
      try {
        await tambahJpKosong(S.id, sesiHari);
        S.sesis = await listSesi(S.id);
        el.innerHTML = _buildTabJadwal();
        _bindJadwalEvents(app, el);
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  });

  // ── −JP per hari ─────────────────────────────────────────
  el.querySelectorAll('.btn-del-jp').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tglStr = btn.dataset.tgl;
      const sesiHari = _sesiHariIni(tglStr);
      try {
        const ok = await kurangJpKosong(S.id, sesiHari);
        if (!ok) { showToast('Slot terakhir bukan kosong, tidak bisa dikurangi', 'warning'); return; }
        S.sesis = await listSesi(S.id);
        el.innerHTML = _buildTabJadwal();
        _bindJadwalEvents(app, el);
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  });

  // ── Tambah Sesi Lain (pembukaan/penutupan) ───────────────
  el.querySelector('#btn-add-other')?.addEventListener('click', async () => {
    const errEl    = el.querySelector('#other-error');
    errEl.classList.add('hidden');
    const tgl      = el.querySelector('#other-tgl').value;
    const tipe     = el.querySelector('#other-tipe').value;
    const jamMulai = el.querySelector('#other-jam-mulai').value;
    const jamSelesai = el.querySelector('#other-jam-selesai').value;

    if (!tgl || !jamMulai || !jamSelesai) {
      errEl.textContent = 'Tanggal, jam mulai, dan jam selesai wajib diisi';
      errEl.classList.remove('hidden');
      return;
    }
    if (jamSelesai <= jamMulai) {
      errEl.textContent = 'Jam selesai harus setelah jam mulai';
      errEl.classList.remove('hidden');
      return;
    }
    try {
      const [y, m, d] = tgl.split('-').map(Number);
      await createSesi(S.id, {
        tanggal: Timestamp.fromDate(new Date(y, m - 1, d)),
        jamMulai, jamSelesai, tipe,
        mapelId: null, jp: null, keterangan: tipe,
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
