// admin/js/modules/rekrutmen/calon-peserta.js
// B2 — List calon peserta + seleksi administrasi.

import { setPageTitle }   from '../../layout/navbar.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { showToast }      from '../../components/toast.js';
import { requireWrite }   from '../../auth-guard.js';
import { getState }       from '../../store.js';
import { listSiklus, getSiklus } from './siklus-api.js';
import {
  listCalonPeserta, getCalonPeserta,
  setStatusAdmin, applyAdminRules, bulkSetStatusAdmin,
  deleteCalonPeserta, bulkDeleteCalonPeserta
} from './calon-api.js';
import { SIKLUS_STATUS_LABEL } from '../../../../shared/constants.js';

let _S = { tahun: null, siklus: null, data: [], lastDoc: null, filter: 'all', search: '', selected: new Set() };

// ─── Render utama ────────────────────────────────────────────

export async function renderCalonPeserta() {
  setPageTitle('Rekrutmen — Calon Peserta');

  const sikluses = await listSiklus();
  const aktif    = sikluses.find(s => s.status !== 'selesai') ?? sikluses[0];
  _S.tahun       = aktif?.tahun ?? null;
  _S.siklus      = aktif ?? null;

  document.getElementById('app').innerHTML = `
    <div class="max-w-full">
      <div class="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 class="text-lg font-bold text-white">Calon Peserta</h1>
          <p class="text-xs text-gray-500 mt-0.5">Manajemen pendaftar dan seleksi administrasi</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Pilih siklus -->
          <select id="sel-siklus" class="form-input text-sm py-1.5 w-36">
            ${sikluses.map(s => `<option value="${s.tahun}" ${s.tahun === _S.tahun ? 'selected' : ''}>${s.nama}</option>`).join('')}
          </select>
          <button id="btn-apply-rules" class="px-3 py-1.5 rounded-lg text-xs bg-yellow-600 hover:bg-yellow-500 text-white transition-colors">
            Terapkan Rules Otomatis
          </button>
          <button id="btn-bulk-lulus" class="px-3 py-1.5 rounded-lg text-xs bg-green-700 hover:bg-green-600 text-white transition-colors hidden">
            Lulus Terpilih
          </button>
          <button id="btn-bulk-gugur" class="px-3 py-1.5 rounded-lg text-xs bg-red-700 hover:bg-red-600 text-white transition-colors hidden">
            Gugur Terpilih
          </button>
          <button id="btn-bulk-delete" class="px-3 py-1.5 rounded-lg text-xs bg-red-900 hover:bg-red-800 text-red-200 border border-red-700 transition-colors hidden">
            Hapus Terpilih
          </button>
        </div>
      </div>

      <!-- Filter tabs -->
      <div class="flex items-center gap-1 mb-4 border-b border-gray-800">
        ${[['all','Semua'],['pending','Pending'],['lulus','Lulus Admin'],['gugur','Gugur Admin']].map(([v,l]) => `
          <button class="filter-tab px-3 py-2 text-xs font-medium transition-colors
                         ${_S.filter === v ? 'text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}"
                  data-val="${v}">${l}</button>`).join('')}
        <div class="flex-1"></div>
        <input id="search-input" type="search" placeholder="Cari nama / instansi…"
               class="form-input text-xs py-1.5 w-48 mb-1" value="${_esc(_S.search)}" />
      </div>

      <div id="table-container"></div>
    </div>`;

  _bindTopEvents();
  await _load();
}

// ─── Load ────────────────────────────────────────────────────

async function _load(reset = true) {
  if (reset) { _S.data = []; _S.lastDoc = null; _S.selected.clear(); }
  if (!_S.tahun) { _renderTable(); return; }

  try {
    const { data, lastDoc } = await listCalonPeserta({
      tahun: _S.tahun,
      statusAdminOverall: _S.filter !== 'all' ? _S.filter : null,
      search: _S.search,
      lastDoc: reset ? null : _S.lastDoc
    });
    _S.data    = reset ? data : [..._S.data, ...data];
    _S.lastDoc = lastDoc;
  } catch (e) { showToast('Gagal memuat: ' + e.message, 'error'); }

  _renderTable();
}

// ─── Render tabel ────────────────────────────────────────────

function _renderTable() {
  const container = document.getElementById('table-container');
  if (!container) return;

  if (!_S.data.length) {
    container.innerHTML = `<p class="text-sm text-gray-500 py-8 text-center">Tidak ada data.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="overflow-x-auto rounded-xl border border-gray-800">
      <table class="btam-table w-full text-sm">
        <thead>
          <tr>
            <th class="w-8"><input type="checkbox" id="chk-all" class="w-3.5 h-3.5" /></th>
            <th>Pendaftar</th>
            <th>Instansi</th>
            <th>Provinsi</th>
            <th>Pilihan Bimtek</th>
            <th>Status Admin</th>
            <th class="w-32">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${_S.data.map(d => _renderRow(d)).join('')}
        </tbody>
      </table>
    </div>
    ${_S.lastDoc ? `<div class="text-center mt-3">
      <button id="btn-loadmore" class="px-4 py-2 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors">
        Muat Lebih Banyak
      </button>
    </div>` : ''}`;

  _bindTableEvents();
}

function _renderRow(d) {
  const lulusCount = Object.values(d.statusAdmin || {}).filter(s => s.status === 'lulus').length;
  const statusBadge = {
    pending: '<span class="badge badge-yellow">Pending</span>',
    lulus:   `<span class="badge badge-green">Lulus (${lulusCount} bimtek)</span>`,
    gugur:   '<span class="badge badge-red">Gugur</span>'
  }[d.statusAdminOverall] ?? d.statusAdminOverall;

  const pilihan = (d.pilihanBimtekIds || []).slice(0, 2).map((id, i) => {
    const b = (_S.siklus?.bimtekPilihan || []).find(x => x.bimtekId === id);
    return `<span class="text-xs">${i+1}. ${_esc(b?.namaBimtek ?? id)}</span>`;
  }).join('<br>');

  return `
    <tr data-id="${_esc(d.id)}">
      <td><input type="checkbox" class="row-cb w-3.5 h-3.5" data-id="${_esc(d.id)}" ${_S.selected.has(d.id) ? 'checked' : ''} /></td>
      <td>
        <p class="font-medium text-white text-sm">${_esc(d.nama)}</p>
        <p class="text-xs text-gray-500">${_esc(d.pendaftarId)} · ${_esc(d.email)}</p>
      </td>
      <td class="text-xs">${_esc(d.instansi || '—')}</td>
      <td class="text-xs">${_esc(d.provinsi || '—')}</td>
      <td>${pilihan || '—'}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="flex flex-wrap gap-1">
          <button class="btn-detail text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors whitespace-nowrap"
                  data-id="${_esc(d.id)}">Detail</button>
          <button class="btn-delete-row text-xs px-2 py-1 rounded bg-gray-800 hover:bg-red-900 text-red-400 transition-colors whitespace-nowrap"
                  data-id="${_esc(d.id)}" data-nama="${_esc(d.nama)}">Hapus</button>
        </div>
      </td>
    </tr>`;
}

// ─── Events ──────────────────────────────────────────────────

function _bindTopEvents() {
  document.getElementById('sel-siklus')?.addEventListener('change', async e => {
    _S.tahun  = parseInt(e.target.value);
    _S.siklus = await getSiklus(_S.tahun);
    await _load();
  });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      _S.filter = tab.dataset.val;
      document.querySelectorAll('.filter-tab').forEach(t => {
        const active = t.dataset.val === _S.filter;
        t.classList.toggle('text-blue-400', active);
        t.classList.toggle('border-b-2', active);
        t.classList.toggle('border-blue-500', active);
        t.classList.toggle('text-gray-500', !active);
      });
      await _load();
    });
  });

  let searchTimer;
  document.getElementById('search-input')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => { _S.search = e.target.value; await _load(); }, 300);
  });

  document.getElementById('btn-apply-rules')?.addEventListener('click', _applyRules);
  document.getElementById('btn-bulk-lulus')?.addEventListener('click', () => _bulkAction('lulus'));
  document.getElementById('btn-bulk-gugur')?.addEventListener('click', () => _bulkAction('gugur'));
  document.getElementById('btn-bulk-delete')?.addEventListener('click', _bulkDelete);
}

function _bindTableEvents() {
  document.getElementById('chk-all')?.addEventListener('change', e => {
    const checked = e.target.checked;
    document.querySelectorAll('.row-cb').forEach(cb => {
      cb.checked = checked;
      const id = cb.dataset.id;
      checked ? _S.selected.add(id) : _S.selected.delete(id);
    });
    _updateBulkButtons();
  });

  document.querySelectorAll('.row-cb').forEach(cb => {
    cb.addEventListener('change', e => {
      e.target.checked ? _S.selected.add(e.target.dataset.id) : _S.selected.delete(e.target.dataset.id);
      _updateBulkButtons();
    });
  });

  document.querySelectorAll('.btn-detail').forEach(btn => {
    btn.addEventListener('click', () => _openDetailModal(btn.dataset.id));
  });

  document.querySelectorAll('.btn-delete-row').forEach(btn => {
    btn.addEventListener('click', () => _deleteOne(btn.dataset.id, btn.dataset.nama));
  });

  document.getElementById('btn-loadmore')?.addEventListener('click', () => _load(false));
}

function _updateBulkButtons() {
  const count   = _S.selected.size;
  const btnLulus  = document.getElementById('btn-bulk-lulus');
  const btnGugur  = document.getElementById('btn-bulk-gugur');
  const btnDelete = document.getElementById('btn-bulk-delete');
  btnLulus?.classList.toggle('hidden', count === 0);
  btnGugur?.classList.toggle('hidden', count === 0);
  btnDelete?.classList.toggle('hidden', count === 0);
  if (btnLulus)  btnLulus.textContent  = `Lulus (${count})`;
  if (btnGugur)  btnGugur.textContent  = `Gugur (${count})`;
  if (btnDelete) btnDelete.textContent = `Hapus (${count})`;
}

// ─── Modal Detail ─────────────────────────────────────────────

async function _openDetailModal(docId) {
  const calon = await getCalonPeserta(docId);
  if (!calon) { showToast('Data tidak ditemukan', 'error'); return; }

  const bimteks = _S.siklus?.bimtekPilihan || [];
  const email   = getState('auth')?.user?.email;

  const body = `
    <div class="space-y-4 text-sm">
      ${_sectionDetail('Data Diri', [
        ['Nama',         calon.nama],
        ['No. Pendaftaran', calon.pendaftarId],
        ['Jenis Kelamin', calon.jenisKelamin === 'L' ? 'Laki-laki' : calon.jenisKelamin === 'P' ? 'Perempuan' : '—'],
        ['Pendidikan',   calon.pendidikan || '—'],
        ['Jabatan',      calon.jabatan || '—'],
        ['Pengalaman Kerja', calon.pengalamanTahun != null ? `${calon.pengalamanTahun} tahun` : '—'],
        ['No. HP',       calon.noHp],
        ['Email',        calon.email],
      ])}
      ${_sectionDetail('Instansi', [
        ['Instansi',     calon.instansi || '—'],
        ['Unit Kerja',   calon.unitKerja || '—'],
        ['Provinsi',     calon.provinsi || '—'],
        ['Kab/Kota',     calon.kabKota || '—'],
      ])}
      <div>
        <p class="text-xs font-medium text-gray-500 mb-1">Pilihan Bimtek</p>
        <ol class="list-decimal list-inside space-y-0.5">
          ${(calon.pilihanBimtekIds || []).map(id => {
            const b = bimteks.find(x => x.bimtekId === id);
            return `<li class="text-xs text-gray-300">${_esc(b?.namaBimtek ?? id)}</li>`;
          }).join('')}
        </ol>
      </div>
      ${calon.ktpUrl ? `<div><a href="${calon.ktpUrl}" target="_blank" class="text-xs text-blue-400 underline">Lihat KTP →</a></div>` : ''}

      <!-- Seleksi admin per bimtek -->
      <div class="border-t border-gray-800 pt-4 space-y-3">
        <p class="text-xs font-medium text-gray-400 mb-2">Keputusan Administrasi per Bimtek</p>
        ${(calon.pilihanBimtekIds || []).map(bimtekId => {
          const b = bimteks.find(x => x.bimtekId === bimtekId);
          const cur = calon.statusAdmin?.[bimtekId] || { status: 'pending', reason: null };
          return `
          <div class="bg-gray-800/50 rounded-lg p-3">
            <p class="text-xs text-gray-300 font-medium mb-2">${_esc(b?.namaBimtek ?? bimtekId)}</p>
            <div class="flex gap-2 flex-wrap items-end">
              <div class="flex-1">
                <select class="sel-status-admin-bimtek form-input text-sm py-1.5" data-bimtek-id="${_esc(bimtekId)}">
                  <option value="pending" ${cur.status === 'pending' ? 'selected' : ''}>Pending</option>
                  <option value="lulus"   ${cur.status === 'lulus'   ? 'selected' : ''}>Lulus Administrasi</option>
                  <option value="gugur"   ${cur.status === 'gugur'   ? 'selected' : ''}>Gugur Administrasi</option>
                </select>
              </div>
              <div class="flex-1">
                <input type="text" class="inp-alasan-bimtek form-input text-sm py-1.5" data-bimtek-id="${_esc(bimtekId)}"
                       placeholder="Alasan (opsional)" value="${_esc(cur.reason ?? '')}" />
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  const modal = openModal({
    title: `Detail — ${calon.nama}`,
    body,
    size: 'lg',
    actions: [
      { label: 'Tutup', type: 'secondary', onClick: () => modal.close() },
      {
        label: 'Hapus', type: 'danger',
        onClick: async () => {
          modal.close();
          await _deleteOne(docId, calon.nama);
        }
      },
      {
        label: 'Simpan Keputusan', type: 'primary',
        onClick: async () => {
          try {
            const selects = document.querySelectorAll('.sel-status-admin-bimtek');
            for (const sel of selects) {
              const bimtekId = sel.dataset.bimtekId;
              const status   = sel.value;
              const alasan   = document.querySelector(`.inp-alasan-bimtek[data-bimtek-id="${bimtekId}"]`)?.value.trim();
              await setStatusAdmin(docId, bimtekId, status, alasan, email);
            }
            showToast('Status diperbarui', 'success');
            modal.close();
            await _load();
          } catch (e) { showToast(e.message, 'error'); }
        }
      }
    ]
  });
}

// ─── Apply Rules ─────────────────────────────────────────────

async function _applyRules() {
  if (!requireWrite()) return;
  const bimtekPilihan = _S.siklus?.bimtekPilihan || [];
  const totalRules    = bimtekPilihan.reduce((n, b) => n + (b.adminRules?.length || 0), 0);
  const adaLarang     = bimtekPilihan.some(b => b.larangRepeatBimtek3Tahun);
  if (!totalRules && !adaLarang) {
    showToast('Tidak ada aturan administrasi yang dikonfigurasi di siklus ini. Atur aturan per bimtek di tab Kuota & Aturan Bimtek.', 'error'); return;
  }
  const ok = await confirmDialog({
    title: 'Terapkan Rules Otomatis?',
    message: `Sistem akan mengevaluasi aturan administrasi dari ${bimtekPilihan.length} bimtek (${totalRules} total aturan${adaLarang ? ' + larangan repeat' : ''}) ke semua pendaftar berstatus "Pending". Pendaftar yang tidak lolos di semua pilihannya akan di-set "Gugur Administrasi".`,
    confirmLabel: 'Terapkan',
    danger: false
  });
  if (!ok) return;

  const email = getState('auth')?.user?.email;
  try {
    const { lulus, gugur, errors } = await applyAdminRules(_S.tahun, bimtekPilihan, email);
    showToast(`Selesai: ${lulus} lulus, ${gugur} gugur.${errors.length ? ` ${errors.length} error.` : ''}`, 'success');
    await _load();
  } catch (e) { showToast(e.message, 'error'); }
}

// ─── Bulk action ─────────────────────────────────────────────

async function _bulkAction(status) {
  if (!requireWrite()) return;
  const ids = [..._S.selected];
  const bimteks = _S.siklus?.bimtekPilihan || [];
  if (!bimteks.length) { showToast('Belum ada bimtek dikonfigurasi di siklus ini.', 'error'); return; }

  const body = `
    <div class="space-y-3">
      <p class="text-sm text-gray-400">Set status administrasi ${ids.length} pendaftar untuk bimtek yang dipilih.</p>
      <select id="sel-bulk-bimtek" class="form-input w-full">
        ${bimteks.map(b => `<option value="${_esc(b.bimtekId)}">${_esc(b.namaBimtek)}</option>`).join('')}
      </select>
    </div>`;

  const modal = openModal({
    title: `Set ${ids.length} pendaftar → ${status === 'lulus' ? 'Lulus' : 'Gugur'}`,
    body,
    size: 'sm',
    actions: [
      { label: 'Batal', type: 'secondary', onClick: () => modal.close() },
      {
        label: status === 'lulus' ? 'Lulus' : 'Gugur', type: 'primary',
        onClick: async () => {
          const bimtekId = document.getElementById('sel-bulk-bimtek')?.value;
          if (!bimtekId) return;
          const email = getState('auth')?.user?.email;
          try {
            await bulkSetStatusAdmin(ids, bimtekId, status, null, email);
            modal.close();
            showToast(`${ids.length} pendaftar di-set ${status}`, 'success');
            await _load();
          } catch (e) { showToast(e.message, 'error'); }
        }
      }
    ]
  });
}

// ─── Hapus ───────────────────────────────────────────────────

async function _deleteOne(docId, nama) {
  if (!requireWrite()) return;
  const ok = await confirmDialog({
    title: 'Hapus Pendaftar?',
    message: `Data pendaftaran <strong>${_esc(nama)}</strong> akan dihapus permanen, termasuk riwayat status seleksinya. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus',
    danger: true
  });
  if (!ok) return;

  const email = getState('auth')?.user?.email;
  try {
    await deleteCalonPeserta(docId, email);
    showToast('Pendaftar dihapus.', 'success');
    await _load();
  } catch (e) { showToast(e.message, 'error'); }
}

async function _bulkDelete() {
  if (!requireWrite()) return;
  const ids = [..._S.selected];
  const ok  = await confirmDialog({
    title: `Hapus ${ids.length} Pendaftar?`,
    message: `${ids.length} data pendaftaran yang dipilih akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus',
    danger: true
  });
  if (!ok) return;

  const email = getState('auth')?.user?.email;
  try {
    await bulkDeleteCalonPeserta(ids, email);
    showToast(`${ids.length} pendaftar dihapus.`, 'success');
    await _load();
  } catch (e) { showToast(e.message, 'error'); }
}

// ─── Helpers ─────────────────────────────────────────────────

function _sectionDetail(title, rows) {
  return `
    <div>
      <p class="text-xs font-medium text-gray-500 mb-1">${title}</p>
      <dl class="grid grid-cols-2 gap-x-4 gap-y-1">
        ${rows.map(([l,v]) => `
          <dt class="text-xs text-gray-500">${l}</dt>
          <dd class="text-xs text-gray-200">${_esc(v ?? '—')}</dd>`).join('')}
      </dl>
    </div>`;
}

function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
