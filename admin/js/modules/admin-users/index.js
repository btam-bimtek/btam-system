// admin/js/modules/admin-users/index.js
// Manajemen admin users — superadmin only.

import { setPageTitle } from '../../layout/navbar.js';
import { renderDataTable } from '../../components/data-table.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { requireSuperAdmin } from '../../auth-guard.js';
import { getState } from '../../store.js';
import {
  db, doc, getDoc, getDocs, setDoc, updateDoc,
  collection, query, orderBy, serverTimestamp,
  snapToArray
} from '../../../../shared/db.js';
import { logAudit } from '../../../../shared/logger.js';
import { COL, ADMIN_ROLES } from '../../../../shared/constants.js';
import { validateAdminUser } from '../../../../shared/validate.js';

export async function renderAdminUsers() {
  if (!requireSuperAdmin()) return;
  setPageTitle('Admin Users');

  document.getElementById('app').innerHTML = `
    <div class="max-w-3xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-white">Admin Users</h1>
          <p class="text-xs text-gray-500 mt-0.5">Kelola akses admin sistem — superadmin only</p>
        </div>
        <button id="btn-add" class="px-3 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Tambah Admin
        </button>
      </div>

      <div class="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-4 mb-6 text-xs text-yellow-300">
        ⚠️ Perubahan role berlaku setelah user login ulang. Akun Firebase Auth harus dibuat manual di Firebase Console terlebih dahulu.
      </div>

      <div id="table-container"></div>
    </div>
  `;

  document.getElementById('btn-add')?.addEventListener('click', () => _openForm(null));
  await _load();
}

async function _load() {
  const snap = await getDocs(query(collection(db, COL.ADMIN_USERS), orderBy('nama')));
  const data = snapToArray(snap);
  const currentEmail = getState('auth.profile')?.email;

  renderDataTable(document.getElementById('table-container'), {
    data,
    columns: [
      { key: 'nama',  label: 'Nama' },
      { key: 'email', label: 'Email' },
      { key: 'role',  label: 'Role', width: '110px',
        render: v => {
          const styles = { superadmin: 'badge-purple', admin: 'badge-blue', viewer: 'badge-gray' };
          return `<span class="badge ${styles[v]??'badge-gray'}">${v}</span>`;
        }
      },
      { key: 'active', label: 'Status', width: '80px',
        render: v => v
          ? `<span class="badge badge-green">Aktif</span>`
          : `<span class="badge badge-red">Nonaktif</span>` },
      { key: 'lastLoginAt', label: 'Login Terakhir', width: '140px',
        render: v => v ? new Date(v.seconds * 1000).toLocaleDateString('id-ID') : '—' }
    ],
    rowActions: [
      { label: 'Edit', onClick: row => _openForm(row) },
      {
        label: 'Nonaktifkan',
        show: row => row.active && row.email !== currentEmail,
        onClick: async row => {
          const ok = await confirmDialog({
            title: 'Nonaktifkan Admin',
            message: `Nonaktifkan akun <strong>${_esc(row.email)}</strong>? Mereka tidak bisa login lagi.`,
            confirmLabel: 'Nonaktifkan', danger: true
          });
          if (!ok) return;
          try {
            await updateDoc(doc(db, COL.ADMIN_USERS, row._id), { active: false, updatedAt: serverTimestamp() });
            await logAudit({ action: 'deactivate_admin', entityType: 'admin_user', entityId: row._id });
            showToast('Akun dinonaktifkan.', 'success');
            _load();
          } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
        }
      },
      {
        label: 'Aktifkan',
        show: row => !row.active,
        onClick: async row => {
          try {
            await updateDoc(doc(db, COL.ADMIN_USERS, row._id), { active: true, updatedAt: serverTimestamp() });
            showToast('Akun diaktifkan.', 'success'); _load();
          } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
        }
      }
    ],
    emptyMessage: 'Tidak ada data admin.'
  });
}

function _openForm(existing = null) {
  const isEdit = !!existing;
  const { close } = openModal({
    title: isEdit ? `Edit Admin: ${existing.email}` : 'Tambah Admin',
    size: 'sm',
    body: `
      <form id="admin-form" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Email <span class="text-red-400">*</span></label>
          <input name="email" type="email" class="form-input" required
                 value="${_esc(existing?.email ?? '')}"
                 ${isEdit ? 'readonly class="form-input opacity-60"' : ''}
                 placeholder="admin@btam.go.id" />
          ${!isEdit ? '<p class="text-xs text-gray-600 mt-1">Pastikan akun Firebase Auth sudah dibuat terlebih dahulu.</p>' : ''}
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Nama <span class="text-red-400">*</span></label>
          <input name="nama" class="form-input" required value="${_esc(existing?.nama ?? '')}" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Role <span class="text-red-400">*</span></label>
          <select name="role" class="form-select">
            ${Object.values(ADMIN_ROLES).map(r =>
              `<option value="${r}" ${existing?.role===r?'selected':''}>${r}</option>`
            ).join('')}
          </select>
          <div class="mt-2 space-y-1 text-xs text-gray-600">
            <p><strong class="text-gray-500">superadmin:</strong> full access + kelola admin</p>
            <p><strong class="text-gray-500">admin:</strong> CRUD semua modul</p>
            <p><strong class="text-gray-500">viewer:</strong> read-only, hanya report</p>
          </div>
        </div>
        <div id="form-error" class="hidden text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2"></div>
      </form>`,
    actions: [
      { label: 'Batal', type: 'secondary', onClick: ({ close }) => close() },
      { label: isEdit ? 'Simpan' : 'Tambah', type: 'primary', onClick: ({ close }) => _submit(close, existing) }
    ]
  });
}

async function _submit(close, existing) {
  const form = document.getElementById('admin-form');
  const errorEl = document.getElementById('form-error');
  const btn = document.querySelector(`[data-action="${existing?'Simpan':'Tambah'}"]`);
  errorEl.classList.add('hidden');

  const fd   = new FormData(form);
  const data = {
    email: (fd.get('email') ?? '').toLowerCase().trim(),
    nama:  (fd.get('nama') ?? '').trim(),
    role:  fd.get('role')
  };

  const { valid, errors } = validateAdminUser(data);
  if (!valid) { errorEl.textContent = errors.join(' '); errorEl.classList.remove('hidden'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }
  try {
    if (existing) {
      await updateDoc(doc(db, COL.ADMIN_USERS, existing._id), { nama: data.nama, role: data.role, updatedAt: serverTimestamp() });
      await logAudit({ action: 'update_admin_user', entityType: 'admin_user', entityId: existing._id });
      showToast('Admin diperbarui.', 'success');
    } else {
      // Cek apakah email sudah ada
      const ex = await getDoc(doc(db, COL.ADMIN_USERS, data.email));
      if (ex.exists()) throw new Error(`Admin dengan email ${data.email} sudah ada.`);

      await setDoc(doc(db, COL.ADMIN_USERS, data.email), {
        ...data, active: true,
        createdAt: serverTimestamp(), createdBy: getState('auth.profile')?.email ?? null,
        lastLoginAt: null
      });
      await logAudit({ action: 'create_admin_user', entityType: 'admin_user', entityId: data.email });
      showToast('Admin ditambahkan.', 'success');
    }
    close(); _load();
  } catch (err) {
    errorEl.textContent = err.message; errorEl.classList.remove('hidden');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = existing ? 'Simpan' : 'Tambah'; }
  }
}

function _esc(s) { return String(s??'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
