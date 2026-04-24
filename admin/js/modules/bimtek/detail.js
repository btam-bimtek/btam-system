/**
 * bimtek/detail.js
 * Lokasi: admin/js/modules/bimtek/detail.js
 */

import { setPageTitle } from '../../layout/navbar.js';
import { confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { requireWrite } from '../../auth-guard.js';
import { getBimtek, listMapel, deleteBimtek, cancelBimtek, deleteMapel, reorderMapel } from './api.js';
import { renderFormMapel } from './form-mapel.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';

let _bimtek    = null;
let _mapelList = [];
let _activeTab = 'info';

export async function renderBimtekDetail({ id } = {}) {
  if (!id) return;
  setPageTitle('Detail Bimtek');

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="flex items-center justify-center py-16">
      <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  try {
    _bimtek    = await getBimtek(id);
    _mapelList = await listMapel(id);
  } catch (err) {
    app.innerHTML = `<div class="text-red-400 text-sm p-4">${err.message}</div>`;
    return;
  }

  _renderShell(id);
}

function _renderShell(bimtekId) {
  const b = _bimtek;
  const app = document.getElementById('app');
  const bidangNames = (b.bidangIds ?? [])
    .map(id => BIDANG_LIST.find(bd => bd.id === id)?.nama ?? id).join(', ') || '—';

  app.innerHTML = `
    <div class="max-w-full">
      <!-- Header -->
      <div class="flex items-start gap-3 mb-6">
        <button id="btn-back" class="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors mt-0.5">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-lg font-bold text-white">${_esc(b.nama)}</h1>
            ${_statusBadge(b.status)}
          </div>
          <p class="text-xs text-gray-500 mt-0.5">
            ${_esc(b.kodeBimtek)} &middot; ${_tipeName(b.tipe)} &middot;
            ${_esc(bidangNames)} &middot;
            ${_fmtDate(b.periode?.mulai)} — ${_fmtDate(b.periode?.selesai)}
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button id="btn-edit" class="px-3 py-1.5 rounded-lg text-xs border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors">
            Edit
          </button>
          <div class="relative" id="dropdown-wrap">
            <button id="btn-more" class="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
            <div id="dropdown-menu" class="hidden absolute right-0 top-8 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1">
              ${b.status !== 'cancelled' ? `
              <button id="btn-cancel-bimtek" class="w-full text-left px-3 py-2 text-xs text-yellow-400 hover:bg-gray-700 transition-colors">
                Batalkan Bimtek
              </button>` : ''}
              <button id="btn-delete" class="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-gray-700 transition-colors">
                Hapus Bimtek
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 border-b border-gray-800 mb-6">
        <button class="tab-btn px-4 py-2 text-sm font-medium text-blue-400 border-b-2 border-blue-400" data-tab="info">Info</button>
        <button class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent" data-tab="mapel">
          Mata Pelajaran <span class="ml-1 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full" id="mapel-count">${_mapelList.length}</span>
        </button>
        <button class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent" data-tab="jadwal">Jadwal</button>
        <button class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent" data-tab="peserta">
          Peserta <span class="ml-1 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">${b.pesertaIds?.length??0}</span>
        </button>
        <button class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent" data-tab="pengajar">Pengajar</button>
        <button class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent" data-tab="penilaian">Penilaian</button>
        <button class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent" data-tab="report">Report</button>
      </div>

      <!-- Tab panes -->
      <div id="pane-info"></div>
      <div id="pane-mapel"     class="hidden"></div>
      <div id="pane-jadwal"    class="hidden"></div>
      <div id="pane-peserta"   class="hidden"></div>
      <div id="pane-pengajar"  class="hidden"></div>
      <div id="pane-penilaian" class="hidden"></div>
      <div id="pane-report"    class="hidden"></div>
    </div>
  `;

  // Header events
  app.querySelector('#btn-back').addEventListener('click', () => { window.location.hash = '#/bimtek'; });
  app.querySelector('#btn-edit').addEventListener('click', () => {
    if (!requireWrite()) return;
    window.location.hash = `#/bimtek/${bimtekId}/edit`;
  });

  // Dropdown
  const btnMore = app.querySelector('#btn-more');
  const dropMenu = app.querySelector('#dropdown-menu');
  btnMore.addEventListener('click', (e) => { e.stopPropagation(); dropMenu.classList.toggle('hidden'); });
  document.addEventListener('click', () => dropMenu.classList.add('hidden'), { once: false });

  app.querySelector('#btn-delete')?.addEventListener('click', async () => {
    dropMenu.classList.add('hidden');
    if (!requireWrite()) return;
    const ok = await confirmDialog({ title:'Hapus Bimtek', message:`Hapus "${b.nama}"?`, confirmLabel:'Hapus', danger:true });
    if (!ok) return;
    await deleteBimtek(bimtekId);
    showToast('Bimtek dihapus', 'success');
    window.location.hash = '#/bimtek';
  });

  app.querySelector('#btn-cancel-bimtek')?.addEventListener('click', async () => {
    dropMenu.classList.add('hidden');
    if (!requireWrite()) return;
    const reason = prompt('Alasan pembatalan (opsional):');
    if (reason === null) return;
    await cancelBimtek(bimtekId, reason);
    showToast('Bimtek dibatalkan', 'warning');
    window.location.hash = '#/bimtek';
  });

  // Tab navigation
  app.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => _switchTab(btn.dataset.tab, bimtekId));
  });

  // Render tab awal
  _renderTabInfo(app.querySelector('#pane-info'));
  _renderTabMapel(app.querySelector('#pane-mapel'), bimtekId);
}

// ─── Tab Info ─────────────────────────────────────────────────────────────────

function _renderTabInfo(pane) {
  const b = _bimtek;
  const weightRows = Object.entries(b.weights ?? {})
    .filter(([k]) => !(k==='tugas'&&!b.hasTugas) && !(k==='presentasi'&&!b.hasPresentasi))
    .map(([k,v]) => `
      <div class="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
        <span class="text-xs text-gray-400">${_weightLabel(k)}</span>
        <span class="text-xs font-mono text-gray-200">${v}%</span>
      </div>`).join('');

  const infoRows = [
    ['Kode', b.kodeBimtek],
    ['Tipe', _tipeName(b.tipe)],
    ['Mode', b.mode==='online'?'Online':'Offline'],
    ['Bidang', (b.bidangIds??[]).map(id=>BIDANG_LIST.find(bd=>bd.id===id)?.nama??id).join(', ')||'—'],
    ['Periode', `${_fmtDate(b.periode?.mulai)} — ${_fmtDate(b.periode?.selesai)}`],
    ['Lokasi', b.lokasi||'—'],
    ['Kapasitas', `${b.kapasitas??'—'} peserta`],
    ['Status', _statusBadge(b.status)],
    ...(b.cancelReason ? [['Alasan batal', `<span class="text-red-400">${_esc(b.cancelReason)}</span>`]] : [])
  ].map(([label, val]) => `
    <div class="flex items-start justify-between py-2 border-b border-gray-800 last:border-0">
      <span class="text-xs text-gray-500 w-28 shrink-0">${label}</span>
      <span class="text-xs text-gray-200 text-right">${val}</span>
    </div>`).join('');

  pane.innerHTML = `
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Informasi Dasar</h2>
        ${infoRows}
      </div>
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-gray-300">Konfigurasi Penilaian</h2>
          <span class="text-xs text-gray-500">KKM: <span class="text-white font-mono">${b.kkm??60}</span></span>
        </div>
        ${weightRows}
      </div>
    </div>`;
}

// ─── Tab Mapel ────────────────────────────────────────────────────────────────

async function _renderTabMapel(pane, bimtekId) {
  await _refreshMapel(pane, bimtekId);
}

async function _refreshMapel(pane, bimtekId) {
  _mapelList = await listMapel(bimtekId).catch(() => []);
  const countEl = document.getElementById('mapel-count');
  if (countEl) countEl.textContent = _mapelList.length;

  const totalJp = _mapelList.reduce((s,m) => s+(m.totalJp??0), 0);

  if (_mapelList.length === 0) {
    pane.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-gray-400">0 mata pelajaran</span>
        <button id="btn-add-mapel" class="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          Tambah Mapel
        </button>
      </div>
      <div class="flex flex-col items-center justify-center py-16 text-gray-500">
        <svg class="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
        </svg>
        <p class="text-sm">Belum ada mata pelajaran</p>
      </div>`;
  } else {
    pane.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-gray-400">
          ${_mapelList.length} mata pelajaran
          <span class="text-gray-600 ml-2">— Total ${totalJp} JP</span>
        </span>
        <button id="btn-add-mapel" class="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          Tambah Mapel
        </button>
      </div>
      <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-800">
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400 w-8">#</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400">Nama Mapel</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400">Bidang</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400">JP</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400">Pengajar</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-400">Jadwal</th>
              <th class="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            ${_mapelList.map(m => _buildMapelRow(m)).join('')}
          </tbody>
        </table>
      </div>`;
  }

  pane.querySelector('#btn-add-mapel').addEventListener('click', () => {
    if (!requireWrite()) return;
    renderFormMapel(null, bimtekId, () => _refreshMapel(pane, bimtekId));
  });

  pane.querySelectorAll('.btn-edit-mapel').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!requireWrite()) return;
      const mapel = _mapelList.find(m => m.id === btn.dataset.id);
      renderFormMapel(mapel, bimtekId, () => _refreshMapel(pane, bimtekId));
    });
  });

  pane.querySelectorAll('.btn-delete-mapel').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireWrite()) return;
      const mapel = _mapelList.find(m => m.id === btn.dataset.id);
      const ok = await confirmDialog({ title:'Hapus Mapel', message:`Hapus mapel "${mapel?.nama}"? Tindakan ini permanen.`, confirmLabel:'Hapus', danger:true });
      if (!ok) return;
      await deleteMapel(bimtekId, btn.dataset.id);
      showToast('Mapel dihapus', 'success');
      await _refreshMapel(pane, bimtekId);
    });
  });

  pane.querySelectorAll('.btn-up,.btn-down').forEach(btn => {
    btn.addEventListener('click', async () => {
      const dir = btn.classList.contains('btn-up') ? 'up' : 'down';
      await reorderMapel(bimtekId, btn.dataset.id, dir);
      await _refreshMapel(pane, bimtekId);
    });
  });
}

function _buildMapelRow(m) {
  const bidangNama = BIDANG_LIST.find(b => b.bidangId === m.bidangId)?.nama ?? '—';
  const jadwal = m.jadwal
    ? `<span class="text-gray-300">${_fmtDateShort(m.jadwal.tanggal)} ${m.jadwal.jamMulai}–${m.jadwal.jamSelesai}</span>`
    : `<span class="text-yellow-500">Belum dijadwalkan</span>`;

  return `
    <tr class="hover:bg-gray-800/50 transition-colors">
      <td class="px-4 py-3 text-xs text-gray-500">${m.urutan}</td>
      <td class="px-4 py-3">
        <div class="font-medium text-gray-200">${_esc(m.nama)}</div>
        ${m.keterangan ? `<div class="text-xs text-gray-500 mt-0.5">${_esc(m.keterangan)}</div>` : ''}
      </td>
      <td class="px-4 py-3 text-xs text-gray-400">${_esc(bidangNama)}</td>
      <td class="px-4 py-3">
        <span class="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-0.5 rounded">${m.totalJp} JP</span>
      </td>
      <td class="px-4 py-3 text-xs text-gray-400">${m.pengajarIds?.length??0} orang</td>
      <td class="px-4 py-3 text-xs">${jadwal}</td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-1 justify-end">
          <button class="btn-up p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white transition-colors" data-id="${m.id}" title="Naik">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
          </button>
          <button class="btn-down p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white transition-colors" data-id="${m.id}" title="Turun">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <button class="btn-edit-mapel p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-blue-400 transition-colors" data-id="${m.id}" title="Edit">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="btn-delete-mapel p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors" data-id="${m.id}" title="Hapus">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

// ─── Tab switch ───────────────────────────────────────────────────────────────

function _switchTab(targetTab, bimtekId) {
  _activeTab = targetTab;
  const app = document.getElementById('app');

  app.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === targetTab;
    btn.className = active
      ? 'tab-btn px-4 py-2 text-sm font-medium text-blue-400 border-b-2 border-blue-400'
      : 'tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent';
  });

  const paneIds = ['info','mapel','jadwal','peserta','pengajar','penilaian','report'];
  paneIds.forEach(id => {
    app.querySelector(`#pane-${id}`)?.classList.toggle('hidden', id !== targetTab);
  });

  // Lazy placeholder untuk tab yang belum diimplementasi
  const pane = app.querySelector(`#pane-${targetTab}`);
  if (!pane || pane.dataset.rendered) return;
  const placeholders = ['jadwal','peserta','pengajar','penilaian','report'];
  if (placeholders.includes(targetTab)) {
    const label = { jadwal:'Jadwal', peserta:'Peserta', pengajar:'Pengajar', penilaian:'Penilaian', report:'Report' }[targetTab];
    pane.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 text-gray-500">
        <svg class="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
        <p class="text-sm">Tab <span class="text-white font-medium">${label}</span> akan diimplementasi di milestone berikutnya</p>
      </div>`;
    pane.dataset.rendered = '1';
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function _statusBadge(s) {
  const map = { draft:'badge-gray', planned:'badge-blue', ongoing:'badge-green', completed:'badge-purple', cancelled:'badge-red' };
  const label = { draft:'Draft', planned:'Planned', ongoing:'Berlangsung', completed:'Selesai', cancelled:'Dibatalkan' };
  return `<span class="badge ${map[s]??'badge-gray'}">${label[s]??s}</span>`;
}

function _tipeName(t) {
  return { reguler:'Reguler', pnbp:'PNBP', e_learning:'E-Learning', ojt:'OJT', lainnya:'Lainnya' }[t] ?? t;
}

const WL = { pretest:'Pre-Test', posttest:'Post-Test', pengajar:'Nilai Pengajar', kehadiran:'Kehadiran', keaktifan:'Keaktifan', respek:'Respek & Etika', tugas:'Tugas', presentasi:'Presentasi' };
function _weightLabel(k) { return WL[k] ?? k; }

function _fmtDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}

function _fmtDateShort(ts) {
  if (!ts) return '—';
  const d = ts?.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
