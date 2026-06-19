// admin/js/modules/rekrutmen/siklus.js
// Halaman manajemen Siklus Seleksi.

import { setPageTitle } from '../../layout/navbar.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { requireWrite } from '../../auth-guard.js';
import { getState } from '../../store.js';
import {
  listSiklus, getSiklus, createSiklus, updateSiklus,
  setSiklusStatus, togglePendaftaran, updateAdminRules, updateKuota
} from './siklus-api.js';
import { listBimtek } from '../bimtek/api.js';
import {
  SIKLUS_STATUS, SIKLUS_STATUS_LABEL,
  ADMIN_RULE_FIELDS, ADMIN_RULE_OPERATORS, BIDANG_MAP
} from '../../../../shared/constants.js';

// Cache daftar Bimtek (untuk dropdown pilihan di tab Kuota)
let _bimtekOptions = [];

// ─── Render utama ────────────────────────────────────────────

export async function renderSiklusList() {
  setPageTitle('Rekrutmen — Siklus Seleksi');

  document.getElementById('app').innerHTML = `
    <div class="max-w-4xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-white">Siklus Seleksi</h1>
          <p class="text-xs text-gray-500 mt-0.5">Kelola periode rekrutmen peserta bimtek per tahun</p>
        </div>
        <button id="btn-baru" class="px-3 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500
                                     text-white transition-colors flex items-center gap-2">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Buat Siklus Baru
        </button>
      </div>
      <div id="siklus-list" class="space-y-3">
        <div class="text-sm text-gray-500 py-8 text-center">Memuat…</div>
      </div>
    </div>
  `;

  document.getElementById('btn-baru')?.addEventListener('click', () => _openFormModal(null));
  try {
    _bimtekOptions = await listBimtek();
  } catch (err) {
    _bimtekOptions = [];
  }
  await _loadList();
}

// ─── Load & render list ──────────────────────────────────────

async function _loadList() {
  const container = document.getElementById('siklus-list');
  if (!container) return;

  try {
    const list = await listSiklus();
    if (!list.length) {
      container.innerHTML = `
        <div class="text-center py-12 text-gray-500">
          <p class="text-sm">Belum ada siklus seleksi.</p>
          <p class="text-xs mt-1">Klik "Buat Siklus Baru" untuk memulai.</p>
        </div>`;
      return;
    }
    container.innerHTML = list.map(_renderSiklusCard).join('');
    _bindCardEvents(list);
  } catch (err) {
    showToast('Gagal memuat siklus: ' + err.message, 'error');
  }
}

function _renderSiklusCard(s) {
  const statusLabel = SIKLUS_STATUS_LABEL[s.status] ?? s.status;
  const statusColor = {
    planning:     'bg-gray-700 text-gray-300',
    pendaftaran:  'bg-green-900/60 text-green-300',
    administrasi: 'bg-yellow-900/60 text-yellow-300',
    tertulis:     'bg-blue-900/60 text-blue-300',
    penentuan:    'bg-purple-900/60 text-purple-300',
    selesai:      'bg-gray-800 text-gray-400'
  }[s.status] ?? 'bg-gray-700 text-gray-300';

  const pendaftaranInfo = s.phases?.pendaftaran?.start
    ? `${_fmtDate(s.phases.pendaftaran.start)} — ${_fmtDate(s.phases.pendaftaran.end)}`
    : '—';

  const isPublished = s.phases?.pendaftaran?.published;
  const kuotaCount  = (s.bimtekPilihan || []).length;
  const rulesCount  = (s.adminRules || []).length;

  return `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5" data-id="${s.id}">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 mb-1">
            <h2 class="text-base font-semibold text-white">${_esc(s.nama)}</h2>
            <span class="text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}">${statusLabel}</span>
            ${isPublished
              ? `<span class="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800">Pendaftaran Dibuka</span>`
              : ''}
          </div>
          <div class="flex items-center gap-4 text-xs text-gray-500">
            <span>Pendaftaran: ${pendaftaranInfo}</span>
            <span>${kuotaCount} bimtek dengan kuota</span>
            <span>${rulesCount} aturan administrasi</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button class="btn-detail px-3 py-1.5 rounded-lg text-xs bg-gray-800 hover:bg-gray-700
                         text-gray-300 transition-colors" data-id="${s.id}">
            Detail
          </button>
        </div>
      </div>

      <!-- Phase timeline -->
      <div class="mt-4 grid grid-cols-4 gap-2">
        ${_renderPhaseTimeline(s)}
      </div>
    </div>`;
}

function _renderPhaseTimeline(s) {
  const phases = [
    { key: 'pendaftaran',  label: 'Pendaftaran',  start: s.phases?.pendaftaran?.start,  end: s.phases?.pendaftaran?.end },
    { key: 'administrasi', label: 'Administrasi', start: s.phases?.administrasi?.start, end: s.phases?.administrasi?.end },
    { key: 'tertulis',     label: 'Tertulis',     start: s.phases?.tertulis?.start,     end: s.phases?.tertulis?.end },
    { key: 'penentuan',    label: 'Penentuan',    start: s.phases?.penentuan?.deadline, end: null }
  ];

  const activeStatus = s.status;
  const order = ['planning','pendaftaran','administrasi','tertulis','penentuan','selesai'];
  const activeIdx = order.indexOf(activeStatus);

  return phases.map((p, i) => {
    const phaseIdx = order.indexOf(p.key);
    const isDone   = phaseIdx < activeIdx;
    const isActive = p.key === activeStatus;

    const dotColor = isDone   ? 'bg-green-500'
                   : isActive ? 'bg-blue-500'
                   : 'bg-gray-700';
    const textColor = isDone || isActive ? 'text-gray-300' : 'text-gray-600';

    const dateStr = p.start ? _fmtDate(p.start) : '—';

    return `
      <div class="text-center">
        <div class="w-2 h-2 rounded-full ${dotColor} mx-auto mb-1"></div>
        <p class="text-xs font-medium ${textColor}">${p.label}</p>
        <p class="text-xs text-gray-600">${dateStr}</p>
      </div>`;
  }).join('');
}

function _bindCardEvents(list) {
  document.querySelectorAll('.btn-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      const siklus = list.find(s => s.id === btn.dataset.id);
      if (siklus) _openDetailModal(siklus);
    });
  });
}

// ─── Modal Form Buat/Edit Siklus ─────────────────────────────

function _openFormModal(existing) {
  if (!requireWrite()) return;

  const isEdit  = !!existing;
  const d       = existing ?? {};
  const tahunNow = new Date().getFullYear();

  const body = `
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1">Tahun Siklus <span class="text-red-400">*</span></label>
        <input id="f-tahun" type="number" min="2020" max="2099" value="${d.tahun ?? tahunNow}"
               class="form-input w-full" ${isEdit ? 'readonly' : ''} />
        ${isEdit ? '<p class="text-xs text-gray-600 mt-1">Tahun tidak bisa diubah.</p>' : ''}
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1">Nama Siklus</label>
        <input id="f-nama" type="text" value="${_esc(d.nama ?? '')}"
               placeholder="Seleksi Bimtek BTAM ${tahunNow}"
               class="form-input w-full" />
      </div>
      <fieldset class="border border-gray-800 rounded-lg p-4 space-y-3">
        <legend class="text-xs font-medium text-gray-500 px-1">Periode Pendaftaran</legend>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Mulai</label>
            <input id="f-daftar-start" type="date" value="${_tsToInput(d.phases?.pendaftaran?.start)}" class="form-input w-full" />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Selesai</label>
            <input id="f-daftar-end" type="date" value="${_tsToInput(d.phases?.pendaftaran?.end)}" class="form-input w-full" />
          </div>
        </div>
      </fieldset>
      <fieldset class="border border-gray-800 rounded-lg p-4 space-y-3">
        <legend class="text-xs font-medium text-gray-500 px-1">Periode Seleksi Administrasi</legend>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Mulai</label>
            <input id="f-admin-start" type="date" value="${_tsToInput(d.phases?.administrasi?.start)}" class="form-input w-full" />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Selesai</label>
            <input id="f-admin-end" type="date" value="${_tsToInput(d.phases?.administrasi?.end)}" class="form-input w-full" />
          </div>
        </div>
      </fieldset>
      <fieldset class="border border-gray-800 rounded-lg p-4 space-y-3">
        <legend class="text-xs font-medium text-gray-500 px-1">Periode Seleksi Tertulis</legend>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Mulai</label>
            <input id="f-tulis-start" type="date" value="${_tsToInput(d.phases?.tertulis?.start)}" class="form-input w-full" />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Selesai</label>
            <input id="f-tulis-end" type="date" value="${_tsToInput(d.phases?.tertulis?.end)}" class="form-input w-full" />
          </div>
        </div>
      </fieldset>
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1">Deadline Penentuan Peserta</label>
        <input id="f-penentuan" type="date" value="${_tsToInput(d.phases?.penentuan?.deadline)}" class="form-input w-full" />
      </div>
    </div>`;

  const modal = openModal({
    title: isEdit ? `Edit Siklus ${d.tahun}` : 'Buat Siklus Baru',
    body,
    size: 'md',
    actions: [
      { label: 'Batal', type: 'secondary', onClick: () => modal.close() },
      {
        label: isEdit ? 'Simpan' : 'Buat Siklus',
        type: 'primary',
        onClick: async () => {
          const tahun = parseInt(document.getElementById('f-tahun')?.value);
          const nama  = document.getElementById('f-nama')?.value.trim();
          if (!tahun || tahun < 2020) { showToast('Tahun tidak valid', 'error'); return; }

          const data = {
            tahun,
            nama: nama || `Seleksi Bimtek BTAM ${tahun}`,
            pendaftaranStart:  document.getElementById('f-daftar-start')?.value || null,
            pendaftaranEnd:    document.getElementById('f-daftar-end')?.value || null,
            administrasiStart: document.getElementById('f-admin-start')?.value || null,
            administrasiEnd:   document.getElementById('f-admin-end')?.value || null,
            tertulisStart:     document.getElementById('f-tulis-start')?.value || null,
            tertulisEnd:       document.getElementById('f-tulis-end')?.value || null,
            penentuanDeadline: document.getElementById('f-penentuan')?.value || null,
          };

          const email = getState('auth')?.user?.email;
          try {
            if (isEdit) {
              const changes = {
                nama: data.nama,
                'phases.pendaftaran.start': data.pendaftaranStart,
                'phases.pendaftaran.end':   data.pendaftaranEnd,
                'phases.administrasi.start': data.administrasiStart,
                'phases.administrasi.end':   data.administrasiEnd,
                'phases.tertulis.start':     data.tertulisStart,
                'phases.tertulis.end':       data.tertulisEnd,
                'phases.penentuan.deadline': data.penentuanDeadline,
              };
              await updateSiklus(existing.tahun, changes, email);
              showToast('Siklus diperbarui', 'success');
            } else {
              await createSiklus(data, email);
              showToast('Siklus berhasil dibuat', 'success');
            }
            modal.close();
            await _loadList();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      }
    ]
  });
}

// ─── Modal Detail Siklus ─────────────────────────────────────

async function _openDetailModal(siklus) {
  try {
    _bimtekOptions = await listBimtek();
  } catch (err) { /* pakai cache lama bila gagal refresh */ }

  const isPublished = siklus.phases?.pendaftaran?.published;
  const email = getState('auth')?.user?.email;

  const body = `
    <div class="space-y-5">

      <!-- Status & Aksi -->
      <div class="flex items-center gap-3 flex-wrap">
        <span class="text-sm text-gray-400">Status:</span>
        <select id="sel-status" class="form-input text-sm py-1">
          ${Object.entries(SIKLUS_STATUS_LABEL).map(([v, l]) =>
            `<option value="${v}" ${siklus.status === v ? 'selected' : ''}>${l}</option>`
          ).join('')}
        </select>
        <button id="btn-save-status" class="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors">
          Simpan Status
        </button>
      </div>

      <!-- Toggle pendaftaran publik -->
      <div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
        <div>
          <p class="text-sm font-medium text-gray-200">Buka Pendaftaran Publik</p>
          <p class="text-xs text-gray-500 mt-0.5">Calon peserta bisa mengakses form pendaftaran di /pendaftar/</p>
        </div>
        <button id="btn-toggle-daftar"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                       ${isPublished
                         ? 'bg-red-900/50 hover:bg-red-900 text-red-300'
                         : 'bg-green-900/50 hover:bg-green-900 text-green-300'}">
          ${isPublished ? 'Tutup Pendaftaran' : 'Buka Pendaftaran'}
        </button>
      </div>

      <!-- Tab: Edit Periode | Rules | Kuota -->
      <div class="border-b border-gray-800">
        <div class="flex gap-1" id="detail-tabs">
          <button class="detail-tab px-3 py-2 text-xs font-medium text-blue-400 border-b-2 border-blue-500" data-tab="periode">Periode</button>
          <button class="detail-tab px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-300" data-tab="rules">Aturan Administrasi</button>
          <button class="detail-tab px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-300" data-tab="kuota">Kuota Bimtek</button>
        </div>
      </div>

      <div id="detail-tab-content">
        ${_renderTabPeriode(siklus)}
      </div>
    </div>`;

  const modal = openModal({
    title: `Detail Siklus ${siklus.tahun} — ${_esc(siklus.nama)}`,
    body,
    size: 'lg',
    actions: [{ label: 'Tutup', type: 'secondary', onClick: () => modal.close() }]
  });

  // Tab switching
  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.detail-tab').forEach(t => {
        t.classList.remove('text-blue-400', 'border-b-2', 'border-blue-500');
        t.classList.add('text-gray-500');
      });
      tab.classList.add('text-blue-400', 'border-b-2', 'border-blue-500');
      tab.classList.remove('text-gray-500');

      const content = document.getElementById('detail-tab-content');
      if (!content) return;
      if (tab.dataset.tab === 'periode') content.innerHTML = _renderTabPeriode(siklus);
      if (tab.dataset.tab === 'rules')   content.innerHTML = _renderTabRules(siklus);
      if (tab.dataset.tab === 'kuota')   content.innerHTML = _renderTabKuota(siklus);
      _bindTabEvents(siklus, modal);
    });
  });

  _bindTabEvents(siklus, modal);

  // Save status
  document.getElementById('btn-save-status')?.addEventListener('click', async () => {
    const status = document.getElementById('sel-status')?.value;
    try {
      await setSiklusStatus(siklus.tahun, status, email);
      showToast('Status diperbarui', 'success');
      modal.close();
      await _loadList();
    } catch (err) { showToast(err.message, 'error'); }
  });

  // Toggle pendaftaran
  document.getElementById('btn-toggle-daftar')?.addEventListener('click', async () => {
    const newVal = !isPublished;
    const konfirmasi = await confirmDialog({
      title: newVal ? 'Buka Pendaftaran?' : 'Tutup Pendaftaran?',
      message: newVal
        ? 'Calon peserta akan bisa mengakses form pendaftaran online.'
        : 'Form pendaftaran tidak bisa diakses oleh calon peserta.',
      confirmLabel: newVal ? 'Buka' : 'Tutup',
      danger: !newVal
    });
    if (!konfirmasi) return;
    try {
      await togglePendaftaran(siklus.tahun, newVal, email);
      showToast(newVal ? 'Pendaftaran dibuka' : 'Pendaftaran ditutup', 'success');
      modal.close();
      await _loadList();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ─── Tab: Periode ────────────────────────────────────────────

function _renderTabPeriode(s) {
  return `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">Pendaftaran Mulai</label>
          <input id="tp-daftar-start" type="date" value="${_tsToInput(s.phases?.pendaftaran?.start)}" class="form-input w-full text-sm" />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Pendaftaran Selesai</label>
          <input id="tp-daftar-end" type="date" value="${_tsToInput(s.phases?.pendaftaran?.end)}" class="form-input w-full text-sm" />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Administrasi Mulai</label>
          <input id="tp-admin-start" type="date" value="${_tsToInput(s.phases?.administrasi?.start)}" class="form-input w-full text-sm" />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Administrasi Selesai</label>
          <input id="tp-admin-end" type="date" value="${_tsToInput(s.phases?.administrasi?.end)}" class="form-input w-full text-sm" />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Tertulis Mulai</label>
          <input id="tp-tulis-start" type="date" value="${_tsToInput(s.phases?.tertulis?.start)}" class="form-input w-full text-sm" />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Tertulis Selesai</label>
          <input id="tp-tulis-end" type="date" value="${_tsToInput(s.phases?.tertulis?.end)}" class="form-input w-full text-sm" />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Deadline Penentuan</label>
          <input id="tp-penentuan" type="date" value="${_tsToInput(s.phases?.penentuan?.deadline)}" class="form-input w-full text-sm" />
        </div>
      </div>
      <button id="btn-save-periode" class="px-4 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors">
        Simpan Periode
      </button>
    </div>`;
}

// ─── Tab: Aturan Administrasi ─────────────────────────────────

function _renderTabRules(s) {
  const rules = s.adminRules || [];
  return `
    <div class="space-y-4">
      <p class="text-xs text-gray-500">
        Aturan ini diterapkan otomatis saat admin menjalankan seleksi administrasi.
        Pendaftar yang tidak memenuhi semua aturan akan di-set "Gugur Administrasi".
      </p>
      <div id="rules-list" class="space-y-2">
        ${rules.length ? rules.map((r, i) => _renderRuleRow(r, i)).join('') : '<p class="text-xs text-gray-600">Belum ada aturan.</p>'}
      </div>
      <button id="btn-add-rule" class="px-3 py-1.5 rounded-lg text-xs border border-gray-700
                                        text-gray-400 hover:bg-gray-800 transition-colors flex items-center gap-1.5">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Tambah Aturan
      </button>

      <div class="border-t border-gray-800 pt-3">
        <label class="flex items-start gap-2 cursor-pointer">
          <input id="chk-larang-repeat" type="checkbox" class="mt-0.5 w-4 h-4 accent-blue-600"
                 ${s.larangRepeatBimtek3Tahun ? 'checked' : ''} />
          <span class="text-xs text-gray-400">
            Gugurkan pendaftar yang pernah <strong>terpilih</strong> di bimtek yang sama (salah satu pilihannya)
            dalam <strong>3 tahun terakhir</strong> di sistem ini.
          </span>
        </label>
      </div>

      <button id="btn-save-rules" class="px-4 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors">
        Simpan Aturan
      </button>
    </div>`;
}

function _renderRuleRow(rule, idx) {
  const fieldOpts = ADMIN_RULE_FIELDS.map(f =>
    `<option value="${f.value}" ${rule.field === f.value ? 'selected' : ''}>${f.label}</option>`
  ).join('');

  const currentField = ADMIN_RULE_FIELDS.find(f => f.value === rule.field) || ADMIN_RULE_FIELDS[0];
  const opOpts = (currentField.operators || Object.keys(ADMIN_RULE_OPERATORS)).map(v =>
    `<option value="${v}" ${rule.operator === v ? 'selected' : ''}>${ADMIN_RULE_OPERATORS[v]}</option>`
  ).join('');

  return `
    <div class="flex items-center gap-2 rule-row" data-idx="${idx}">
      <select class="rule-field form-input text-xs py-1 flex-1">${fieldOpts}</select>
      <select class="rule-op form-input text-xs py-1 flex-1">${opOpts}</select>
      ${_renderRuleValueInput(currentField, rule.value)}
      <button class="btn-remove-rule text-gray-600 hover:text-red-400 transition-colors" data-idx="${idx}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>`;
}

// ─── Tab: Kuota Bimtek ───────────────────────────────────────

function _renderTabKuota(s) {
  const list = s.bimtekPilihan || [];
  return `
    <div class="space-y-3">
      <p class="text-xs text-gray-500">
        Daftarkan bimtek yang tersedia untuk siklus ini. Informasi ini ditampilkan ke publik di halaman pendaftaran.
      </p>
      <div id="kuota-list" class="space-y-2">
        ${list.length
          ? list.map(b => _renderKuotaRow(b)).join('')
          : '<p class="text-xs text-gray-600">Belum ada bimtek ditentukan.</p>'}
      </div>
      <button id="btn-add-kuota" class="px-3 py-1.5 rounded-lg text-xs border border-gray-700
                                         text-gray-400 hover:bg-gray-800 transition-colors flex items-center gap-1.5">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Tambah Bimtek
      </button>
      <button id="btn-save-kuota" class="px-4 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors">
        Simpan
      </button>
    </div>`;
}

function _renderKuotaRow(b = {}) {
  const opts = _bimtekOptions.length
    ? _bimtekOptions.map(o => {
        const bidangNama = (o.bidangIds || []).map(id => BIDANG_MAP[id]?.nama).filter(Boolean).join(', ');
        return `<option value="${o.id}"
                  data-nama="${_esc(o.nama ?? '')}"
                  data-bidang="${_esc(bidangNama)}"
                  data-mode="${o.mode === 'online' ? 'online' : 'tatap_muka'}"
                  ${b.bimtekId === o.id ? 'selected' : ''}>
                  ${_esc(o.nama ?? '(tanpa nama)')}${o.kodeBimtek ? ' — ' + _esc(o.kodeBimtek) : ''}
                </option>`;
      }).join('')
    : '';

  return `
    <div class="kuota-row bg-gray-800/50 rounded-lg p-3 space-y-2">
      <div class="grid grid-cols-2 gap-2">
        <div class="col-span-2">
          <label class="block text-xs text-gray-500 mb-1">Bimtek</label>
          <select class="kuota-select form-input text-xs py-1 w-full">
            <option value="">— Pilih Bimtek —</option>
            ${opts}
          </select>
          ${_bimtekOptions.length === 0 ? '<p class="text-xs text-yellow-500 mt-1">Belum ada data Bimtek. Buat Bimtek terlebih dahulu di menu Bimtek.</p>' : ''}
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Mode</label>
          <select class="kuota-mode form-input text-xs py-1 w-full" disabled>
            <option value="tatap_muka" ${b.mode === 'tatap_muka' ? 'selected' : ''}>Tatap Muka</option>
            <option value="online"     ${b.mode === 'online'     ? 'selected' : ''}>Online</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Kuota</label>
          <input class="kuota-qty form-input text-xs py-1 w-full" type="number" min="1"
                 value="${b.kuota ?? ''}" placeholder="30" />
        </div>
      </div>
      <div class="flex justify-end">
        <button class="btn-remove-kuota text-xs text-gray-600 hover:text-red-400 transition-colors flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
          Hapus
        </button>
      </div>
    </div>`;
}

// ─── Bind tab events ─────────────────────────────────────────

function _bindTabEvents(siklus, modal) {
  const email = getState('auth')?.user?.email;

  // Save periode
  document.getElementById('btn-save-periode')?.addEventListener('click', async () => {
    const changes = {
      'phases.pendaftaran.start': document.getElementById('tp-daftar-start')?.value || null,
      'phases.pendaftaran.end':   document.getElementById('tp-daftar-end')?.value || null,
      'phases.administrasi.start': document.getElementById('tp-admin-start')?.value || null,
      'phases.administrasi.end':   document.getElementById('tp-admin-end')?.value || null,
      'phases.tertulis.start':     document.getElementById('tp-tulis-start')?.value || null,
      'phases.tertulis.end':       document.getElementById('tp-tulis-end')?.value || null,
      'phases.penentuan.deadline': document.getElementById('tp-penentuan')?.value || null,
    };
    try {
      await updateSiklus(siklus.tahun, changes, email);
      showToast('Periode disimpan', 'success');
      modal.close();
      await _loadList();
    } catch (err) { showToast(err.message, 'error'); }
  });

  // Add rule row
  document.getElementById('btn-add-rule')?.addEventListener('click', () => {
    const list = document.getElementById('rules-list');
    if (!list) return;
    const existing = list.querySelectorAll('.rule-row');
    const newRow = document.createElement('div');
    newRow.innerHTML = _renderRuleRow({ field: 'pendidikan', operator: 'gte', value: '' }, existing.length);
    list.appendChild(newRow.firstElementChild);
    _bindRemoveRules();
    _bindRuleFieldChange();
  });

  // Remove rule
  _bindRemoveRules();

  // Saat field rule diganti, sesuaikan opsi operator yang relevan
  _bindRuleFieldChange();

  // Save rules
  document.getElementById('btn-save-rules')?.addEventListener('click', async () => {
    const rules = [];
    document.querySelectorAll('.rule-row').forEach(row => {
      const field    = row.querySelector('.rule-field')?.value;
      const operator = row.querySelector('.rule-op')?.value;
      const rawVal   = row.querySelector('.rule-value')?.value.trim();
      if (!field || !rawVal) return;
      const value = operator === 'in'
        ? rawVal.split(',').map(v => v.trim()).filter(Boolean)
        : rawVal;
      rules.push({ field, operator, value });
    });
    const larangRepeatBimtek3Tahun = document.getElementById('chk-larang-repeat')?.checked ?? false;
    try {
      await updateAdminRules(siklus.tahun, rules, larangRepeatBimtek3Tahun, email);
      showToast('Aturan disimpan', 'success');
      modal.close();
      await _loadList();
    } catch (err) { showToast(err.message, 'error'); }
  });

  // Add kuota row
  document.getElementById('btn-add-kuota')?.addEventListener('click', () => {
    const list = document.getElementById('kuota-list');
    if (!list) return;
    const newRow = document.createElement('div');
    newRow.innerHTML = _renderKuotaRow({});
    list.appendChild(newRow.firstElementChild);
    _bindRemoveKuota();
    _bindKuotaSelect();
  });

  // Remove kuota
  _bindRemoveKuota();

  // Auto-isi mode saat bimtek dipilih
  _bindKuotaSelect();

  // Save kuota
  document.getElementById('btn-save-kuota')?.addEventListener('click', async () => {
    const bimtekPilihan = [];
    const seen = new Set();
    let hasInvalid = false;
    document.querySelectorAll('.kuota-row').forEach(row => {
      const sel       = row.querySelector('.kuota-select');
      const bimtekId  = sel?.value;
      const opt       = sel?.selectedOptions?.[0];
      const kuota     = parseInt(row.querySelector('.kuota-qty')?.value);
      if (!bimtekId && !kuota) return; // baris kosong, lewati
      if (!bimtekId || !(kuota > 0)) { hasInvalid = true; return; }
      if (seen.has(bimtekId)) { hasInvalid = true; return; }
      seen.add(bimtekId);
      bimtekPilihan.push({
        bimtekId,
        namaBimtek: opt?.dataset.nama || '',
        bidang: opt?.dataset.bidang || null,
        mode: opt?.dataset.mode || 'tatap_muka',
        kuota
      });
    });
    if (hasInvalid) { showToast('Pastikan setiap baris punya Bimtek (tidak duplikat) dan kuota > 0', 'error'); return; }
    try {
      await updateKuota(siklus.tahun, bimtekPilihan, email);
      showToast('Bimtek pilihan disimpan', 'success');
      modal.close();
      await _loadList();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

function _bindKuotaSelect() {
  document.querySelectorAll('.kuota-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const opt  = sel.selectedOptions[0];
      const mode = sel.closest('.kuota-row')?.querySelector('.kuota-mode');
      if (mode && opt) mode.value = opt.dataset.mode || 'tatap_muka';
    });
  });
}

function _bindRemoveRules() {
  document.querySelectorAll('.btn-remove-rule').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.rule-row')?.remove());
  });
}

function _renderRuleValueInput(fieldDef, value) {
  if (fieldDef.type === 'select') {
    const opts = (fieldDef.options || []).map(o =>
      `<option value="${_esc(o)}" ${value === o ? 'selected' : ''}>${_esc(o)}</option>`
    ).join('');
    return `<select class="rule-value form-input text-xs py-1 flex-1">
              <option value="">— pilih —</option>${opts}
            </select>`;
  }
  return `<input class="rule-value form-input text-xs py-1 flex-1"
                 type="${fieldDef.type === 'number' ? 'number' : 'text'}"
                 value="${_esc(Array.isArray(value) ? value.join(', ') : String(value ?? ''))}"
                 placeholder="nilai…" />`;
}

function _bindRuleFieldChange() {
  document.querySelectorAll('.rule-field').forEach(sel => {
    sel.addEventListener('change', () => {
      const row      = sel.closest('.rule-row');
      const opSel    = row?.querySelector('.rule-op');
      const valEl    = row?.querySelector('.rule-value');
      const fieldDef = ADMIN_RULE_FIELDS.find(f => f.value === sel.value) || ADMIN_RULE_FIELDS[0];
      const ops      = fieldDef.operators || Object.keys(ADMIN_RULE_OPERATORS);
      if (opSel) {
        opSel.innerHTML = ops.map(v => `<option value="${v}">${ADMIN_RULE_OPERATORS[v]}</option>`).join('');
      }
      if (valEl) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = _renderRuleValueInput(fieldDef, '');
        valEl.replaceWith(wrapper.firstElementChild);
      }
    });
  });
}

function _bindRemoveKuota() {
  document.querySelectorAll('.btn-remove-kuota').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.kuota-row')?.remove());
  });
}

// ─── Helpers ─────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _tsToInput(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 10);
}
