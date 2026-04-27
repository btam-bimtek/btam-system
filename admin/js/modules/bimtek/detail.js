// admin/js/modules/bimtek/detail.js
import {
  getBimtek, listMapel, deleteMapel, reorderMapel,
  addPeserta, removePeserta, listSesi, createSesi, deleteSesi, deleteSesiByMapel,
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

// Template break/ISHOMA per jenis hari — untuk inisialisasi sesi ke Firestore
const BREAKS_REGULAR = [
  { tipe: 'break',  jamMulai: '10:15', jamSelesai: '10:30', keterangan: 'Break pagi' },
  { tipe: 'ishoma', jamMulai: '12:00', jamSelesai: '13:00', keterangan: 'ISHOMA' },
  { tipe: 'break',  jamMulai: '14:30', jamSelesai: '14:45', keterangan: 'Break sore' },
];
const BREAKS_JUMAT = [
  { tipe: 'break',  jamMulai: '10:15', jamSelesai: '10:30', keterangan: 'Break pagi' },
  { tipe: 'ishoma', jamMulai: '11:15', jamSelesai: '13:45', keterangan: 'ISHOMA Jumat' },
];

// Slot statis untuk hitungJamSelesai — sesuai OPUSPLAN
const BREAK_SLOTS_REGULAR = [
  { mulai: '10:15', selesai: '10:30' }, // Break pagi
  { mulai: '12:00', selesai: '13:00' }, // ISHOMA
  { mulai: '14:30', selesai: '14:45' }, // Break sore
];
const BREAK_SLOTS_JUMAT = [
  { mulai: '10:15', selesai: '10:30' }, // Break pagi
  { mulai: '11:15', selesai: '13:45' }, // ISHOMA Jumat
];

function _isJumat(tglStr) {
  // tglStr format YYYY-MM-DD, new Date() bisa salah timezone → parse manual
  const [y, m, d] = tglStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 5;
}

function _hariSudahDiinisialisasi(tglStr) {
  // Cek apakah sudah ada sesi break/ishoma di hari itu
  const [y, m, d] = tglStr.split('-').map(Number);
  const tglDate = new Date(y, m - 1, d).toDateString();
  return S.sesis.some(s => {
    if (!['break', 'ishoma'].includes(s.tipe)) return false;
    const t = s.tanggal?.toDate?.() ?? new Date(s.tanggal);
    return t.toDateString() === tglDate;
  });
}

function _sesiHariIni(tglStr) {
  const [y, m, d] = tglStr.split('-').map(Number);
  const tglDate = new Date(y, m - 1, d).toDateString();
  return S.sesis.filter(s => {
    const t = s.tanggal?.toDate?.() ?? new Date(s.tanggal);
    return t.toDateString() === tglDate;
  });
}

// ─── BUILD TAB JADWAL ───────────────────────────────────────────────────────

function _buildTabJadwal() {
  const canEdit = ['draft','planned'].includes(S.bimtek?.status);

  // Group by tanggal — key = tglStr YYYY-MM-DD untuk sorting, display = label
  const byDate = {};
  for (const s of S.sesis) {
    const dateObj = s.tanggal?.toDate?.() ?? new Date(s.tanggal);
    // Pakai local date parts — bukan toISOString() yang UTC dan bisa mundur 1 hari di Jakarta (UTC+7)
    const tglStr  = dateObj.getFullYear() + '-'
      + String(dateObj.getMonth() + 1).padStart(2, '0') + '-'
      + String(dateObj.getDate()).padStart(2, '0');
    if (!byDate[tglStr]) byDate[tglStr] = { label: dateObj.toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }), list: [] };
    byDate[tglStr].list.push(s);
  }

  let html = '';

  if (S.sesis.length === 0) {
    html += `<div class="bg-gray-900 rounded-xl border border-gray-800 p-10 text-center text-gray-500 text-sm mb-4">Jadwal belum dibuat. Pilih tanggal dan klik "Inisialisasi Hari" untuk mulai.</div>`;
  } else {
    const colors = { mapel:'badge-blue', break:'badge-gray', ishoma:'badge-yellow', pembukaan:'badge-green', penutupan:'badge-purple' };
    // Pre-group segmen mapel per mapelId agar bisa simpan semua IDs di tombol hapus
    const segmenIds = {}; // key: mapelId → array of sesi.id
    for (const s of S.sesis) {
      if (s.tipe === 'mapel' && s.mapelId) {
        if (!segmenIds[s.mapelId]) segmenIds[s.mapelId] = [];
        segmenIds[s.mapelId].push(s.id);
      }
    }

    html += Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([tglStr, { label, list }]) => `
      <div class="mb-5">
        <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">${label}</div>
        <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          ${list.sort((a,b) => a.jamMulai.localeCompare(b.jamMulai)).map(s => {
            const mapel = S.mapels.find(m => m.id === s.mapelId);
            const segmenLabel = s.tipe === 'mapel' && s.totalSegmen > 1
              ? ` <span class="text-xs text-gray-500">Bag. ${s.segmenKe}/${s.totalSegmen}</span>` : '';
            const label = s.tipe === 'mapel'
              ? `${mapel?.nama || 'Mapel'} (${s.jp} JP)`
              : (s.keterangan || s.tipe);
            // Tombol hapus: simpan semua ID segmen langsung di data attribute
            const isFirstSegmen = !s.totalSegmen || s.totalSegmen === 1 || s.segmenKe === 1;
            const allSegIds = (segmenIds[s.mapelId] || [s.id]).join(',');
            const delBtn = canEdit ? (
              s.tipe === 'mapel' && isFirstSegmen
                ? `<button class="btn-del-sesi text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-900 text-red-300 transition-colors"
                    data-del-ids="${allSegIds}"
                    title="Hapus semua segmen mapel ini">×</button>`
              : s.tipe === 'mapel'
                ? ''
                : `<button class="btn-del-sesi text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-900 text-red-300 transition-colors"
                    data-id="${s.id}">×</button>`
            ) : '';
            return `
              <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <span class="badge ${colors[s.tipe]||'badge-gray'} shrink-0">${s.jamMulai}–${s.jamSelesai}</span>
                  <span class="text-sm text-gray-200">${_esc(label)}</span>
                  ${segmenLabel}
                </div>
                ${delBtn}
              </div>`;
          }).join('')}
        </div>
      </div>`).join('');
  }

  if (canEdit) {
    const mapelOpts = S.mapels.map(m => `<option value="${m.id}">${_esc(m.nama)} (${m.totalJp} JP)</option>`).join('');
    html += `
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 mt-2 space-y-5">

        <!-- Bagian 1: Inisialisasi hari baru -->
        <div>
          <h3 class="text-sm font-semibold text-gray-300 mb-3">Inisialisasi Hari</h3>
          <p class="text-xs text-gray-500 mb-3">Pilih tanggal → break &amp; ISHOMA otomatis dibuat sesuai hari (Jumat: ISHOMA 11:15–13:45, hari lain: Break 10:15–10:30 + ISHOMA 12:00–13:00).</p>
          <div class="flex items-end gap-3">
            <div class="flex-1">
              <label class="block text-xs text-gray-400 mb-1.5">Tanggal</label>
              <input type="date" id="init-tgl" class="form-input w-full">
            </div>
            <button id="btn-init-hari" class="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors whitespace-nowrap">
              Inisialisasi Hari
            </button>
          </div>
          <div id="init-error" class="hidden text-red-400 text-xs mt-2"></div>
        </div>

        <div class="border-t border-gray-800"></div>

        <!-- Bagian 2: Tambah mapel ke hari yang sudah ada -->
        <div>
          <h3 class="text-sm font-semibold text-gray-300 mb-3">Tambah Mata Pelajaran</h3>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Tanggal</label>
              <input type="date" id="sesi-tgl" class="form-input w-full">
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Jam Mulai</label>
              <input type="time" id="sesi-jam" class="form-input w-full" value="08:00">
            </div>
            <div class="col-span-2">
              <label class="block text-xs text-gray-400 mb-1.5">Mata Pelajaran</label>
              <select id="sesi-mapel" class="form-select w-full">
                <option value="">-- Pilih Mata Pelajaran --</option>
                ${mapelOpts}
              </select>
            </div>
          </div>
          <div id="sesi-error" class="hidden text-red-400 text-xs mb-3"></div>
          <button id="btn-add-sesi" class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">
            + Tambah ke Jadwal
          </button>
        </div>

        <div class="border-t border-gray-800"></div>

        <!-- Bagian 3: Sesi non-mapel manual (pembukaan/penutupan) -->
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

// ─── BIND JADWAL EVENTS ─────────────────────────────────────────────────────

function _bindJadwalEvents(app, el) {
  const canEdit = ['draft','planned'].includes(S.bimtek?.status);
  if (!canEdit) return;

  // Hapus sesi
  el.querySelectorAll('.btn-del-sesi').forEach(btn => {
    btn.addEventListener('click', async () => {
      // data-del-ids = comma-separated list semua ID segmen (untuk mapel)
      // data-id      = single ID (untuk break/ishoma/pembukaan/penutupan)
      const delIdsRaw = btn.dataset.delIds;
      const isMapel   = !!delIdsRaw;

      const ok = await confirmDialog({
        title: isMapel ? 'Hapus Jadwal Mapel' : 'Hapus Sesi',
        message: isMapel
          ? 'Hapus semua segmen mapel ini dari jadwal hari ini?'
          : 'Hapus sesi ini dari jadwal?',
        danger: true,
      });
      if (!ok) return;
      try {
        if (isMapel) {
          const ids = delIdsRaw.split(',').filter(Boolean);
          for (const id of ids) {
            await deleteSesi(S.id, id);
          }
        } else {
          await deleteSesi(S.id, btn.dataset.id);
        }
        S.sesis = await listSesi(S.id);
        el.innerHTML = _buildTabJadwal();
        _bindJadwalEvents(app, el);
        showToast('Jadwal dihapus', 'success');
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  });

  // ── Inisialisasi Hari ──────────────────────────────────────
  el.querySelector('#btn-init-hari')?.addEventListener('click', async () => {
    const errEl = el.querySelector('#init-error');
    errEl.classList.add('hidden');
    const tgl = el.querySelector('#init-tgl').value;

    if (!tgl) { errEl.textContent = 'Pilih tanggal dahulu'; errEl.classList.remove('hidden'); return; }
    if (_hariSudahDiinisialisasi(tgl)) { errEl.textContent = 'Hari ini sudah diinisialisasi (break/ISHOMA sudah ada)'; errEl.classList.remove('hidden'); return; }

    const jumat   = _isJumat(tgl);
    const template = jumat ? BREAKS_JUMAT : BREAKS_REGULAR;
    const tanggalTs = Timestamp.fromDate(new Date(tgl.replace(/-/g, '/')));

    const btn = el.querySelector('#btn-init-hari');
    btn.disabled = true;
    btn.textContent = 'Membuat...';

    try {
      for (const t of template) {
        await createSesi(S.id, {
          tanggal: tanggalTs,
          jamMulai: t.jamMulai,
          jamSelesai: t.jamSelesai,
          tipe: t.tipe,
          mapelId: null,
          jp: null,
          keterangan: t.keterangan,
        });
      }
      S.sesis = await listSesi(S.id);
      el.innerHTML = _buildTabJadwal();
      _bindJadwalEvents(app, el);
      showToast(`Hari ${jumat ? 'Jumat' : 'reguler'} diinisialisasi`, 'success');
    } catch (err) {
      errEl.textContent = 'Gagal: ' + err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Inisialisasi Hari';
    }
  });

  // ── Tambah Mapel ke Jadwal ────────────────────────────────
  el.querySelector('#btn-add-sesi')?.addEventListener('click', async () => {
    const errEl = el.querySelector('#sesi-error');
    errEl.classList.add('hidden');

    const tgl      = el.querySelector('#sesi-tgl').value;
    const jamMulai = el.querySelector('#sesi-jam').value;
    const mapelId  = el.querySelector('#sesi-mapel').value;

    if (!tgl)      { errEl.textContent = 'Pilih tanggal'; errEl.classList.remove('hidden'); return; }
    if (!jamMulai) { errEl.textContent = 'Isi jam mulai'; errEl.classList.remove('hidden'); return; }
    if (!mapelId)  { errEl.textContent = 'Pilih mata pelajaran'; errEl.classList.remove('hidden'); return; }

    const mapel    = S.mapels.find(m => m.id === mapelId);
    if (!mapel)    { errEl.textContent = 'Mapel tidak ditemukan'; errEl.classList.remove('hidden'); return; }

    const breakSlots = _isJumat(tgl) ? BREAK_SLOTS_JUMAT : BREAK_SLOTS_REGULAR;
    const segmen = hitungSegmenMapel(jamMulai, mapel.totalJp, breakSlots);

    // Validasi overlap — cek jam mulai segmen pertama hingga jam selesai segmen terakhir
    const tanggalTs = Timestamp.fromDate(new Date(tgl.replace(/-/g, '/')));
    const jamSelesaiFinal = segmen[segmen.length - 1].jamSelesai;
    const valid = validateJadwalMapel(mapel, tanggalTs, jamMulai, jamSelesaiFinal, S.sesis);
    if (!valid.valid) { errEl.textContent = valid.errors.join('; '); errEl.classList.remove('hidden'); return; }
    if (valid.warnings?.length) showToast('⚠ ' + valid.warnings.join('; '), 'warning');

    try {
      const totalSegmen = segmen.length;
      for (let i = 0; i < segmen.length; i++) {
        const sg = segmen[i];
        await createSesi(S.id, {
          tanggal: tanggalTs,
          jamMulai: sg.jamMulai,
          jamSelesai: sg.jamSelesai,
          tipe: 'mapel',
          mapelId,
          jp: sg.jp,
          segmenKe: i + 1,
          totalSegmen,
          keterangan: null,
        });
      }
      S.sesis = await listSesi(S.id);
      el.innerHTML = _buildTabJadwal();
      _bindJadwalEvents(app, el);
      const segLabel = totalSegmen > 1 ? ` (${totalSegmen} segmen)` : '';
      showToast(`${mapel.nama} ditambahkan ke jadwal${segLabel}`, 'success');
    } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
  });

  // ── Tambah Sesi Lain (pembukaan/penutupan) ───────────────
  el.querySelector('#btn-add-other')?.addEventListener('click', async () => {
    const errEl = el.querySelector('#other-error');
    errEl.classList.add('hidden');

    const tgl        = el.querySelector('#other-tgl').value;
    const tipe       = el.querySelector('#other-tipe').value;
    const jamMulai   = el.querySelector('#other-jam-mulai').value;
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
      await createSesi(S.id, {
        tanggal: Timestamp.fromDate(new Date(tgl.replace(/-/g, '/'))),
        jamMulai, jamSelesai,
        tipe,
        mapelId: null,
        jp: null,
        keterangan: tipe,
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
