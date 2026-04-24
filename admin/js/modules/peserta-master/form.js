// admin/js/modules/peserta-master/form.js
// Modal add/edit peserta.

import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { createPeserta, updatePeserta } from './api.js';
import { PENDIDIKAN_OPTIONS, JENIS_KELAMIN } from '../../../../shared/constants.js';

/**
 * Buka modal form add/edit peserta.
 * @param {object|null} existing  - data peserta existing (edit mode), atau null (add mode)
 * @param {function} onSaved      - callback setelah berhasil simpan
 */
export function openPesertaForm(existing = null, onSaved) {
  const isEdit = !!existing;
  const title  = isEdit ? `Edit Peserta: ${existing.nama}` : 'Tambah Peserta';

  const body = `
    <form id="peserta-form" novalidate class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <!-- Nomor Peserta -->
        <div class="${isEdit ? 'col-span-2' : ''}">
          <label class="block text-xs font-medium text-gray-400 mb-1.5">
            Nomor Peserta <span class="text-red-400">*</span>
          </label>
          <input name="noPeserta" type="text" required
            value="${_esc(existing?.noPeserta ?? '')}"
            ${isEdit ? 'readonly class="form-input opacity-60 cursor-not-allowed"' : 'class="form-input"'}
            placeholder="Contoh: 2024-001" />
          ${isEdit ? '<p class="text-xs text-gray-600 mt-1">Nomor peserta tidak bisa diubah.</p>' : ''}
        </div>

        <!-- Nama -->
        <div class="col-span-2">
          <label class="block text-xs font-medium text-gray-400 mb-1.5">
            Nama Lengkap <span class="text-red-400">*</span>
          </label>
          <input name="nama" type="text" required class="form-input"
            value="${_esc(existing?.nama ?? '')}" placeholder="Nama lengkap sesuai KTP" />
        </div>

        <!-- Jenis Kelamin -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Jenis Kelamin</label>
          <select name="jenisKelamin" class="form-select">
            <option value="">— Pilih —</option>
            ${Object.entries(JENIS_KELAMIN).map(([v,l]) =>
              `<option value="${v}" ${existing?.jenisKelamin === v ? 'selected' : ''}>${l}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Pendidikan -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Pendidikan Terakhir</label>
          <select name="pendidikan" class="form-select">
            <option value="">— Pilih —</option>
            ${PENDIDIKAN_OPTIONS.map(p =>
              `<option value="${p}" ${existing?.pendidikan === p ? 'selected' : ''}>${p}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Jabatan -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Jabatan</label>
          <input name="jabatan" type="text" class="form-input"
            value="${_esc(existing?.jabatan ?? '')}" placeholder="Jabatan / posisi" />
        </div>

        <!-- No HP -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">No. HP / WhatsApp</label>
          <input name="noHp" type="tel" class="form-input"
            value="${_esc(existing?.noHp ?? '')}" placeholder="08xxxxxxxxxx" />
        </div>

        <!-- Email -->
        <div class="col-span-2">
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
          <input name="email" type="email" class="form-input"
            value="${_esc(existing?.email ?? '')}" placeholder="email@instansi.go.id" />
        </div>

        <!-- Instansi (teks, bukan FK — FK resolve di M1.2 lanjutan) -->
        <div class="col-span-2">
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Instansi</label>
          <input name="instansi" type="text" class="form-input"
            value="${_esc(existing?.instansi ?? '')}" placeholder="Nama instansi / PDAM" />
        </div>

        <!-- Unit Kerja -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Unit Kerja</label>
          <input name="unitKerja" type="text" class="form-input"
            value="${_esc(existing?.unitKerja ?? '')}" placeholder="Bagian / divisi" />
        </div>

        <!-- Provinsi (teks bebas untuk M1.2) -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Provinsi</label>
          <input name="provinsi" type="text" class="form-input"
            value="${_esc(existing?.provinsi ?? '')}" placeholder="Provinsi" />
        </div>

        <!-- Kab/Kota -->
        <div class="col-span-2">
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Kabupaten / Kota</label>
          <input name="kabKota" type="text" class="form-input"
            value="${_esc(existing?.kabKota ?? '')}" placeholder="Kab./Kota" />
        </div>
      </div>

      <!-- Error -->
      <div id="form-error" class="hidden text-sm text-red-400 bg-red-900/20
                                   border border-red-800 rounded-lg px-3 py-2"></div>
    </form>
  `;

  const { close } = openModal({
    title,
    body,
    size: 'lg',
    actions: [
      { label: 'Batal', type: 'secondary', onClick: ({ close }) => close() },
      { label: isEdit ? 'Simpan Perubahan' : 'Tambah Peserta', type: 'primary', onClick: ({ close }) => _submit(close, existing, onSaved) }
    ]
  });
}

async function _submit(close, existing, onSaved) {
  const form    = document.getElementById('peserta-form');
  const errorEl = document.getElementById('form-error');
  const saveBtn = document.querySelector('[data-action="' + (existing ? 'Simpan Perubahan' : 'Tambah Peserta') + '"]');

  errorEl.classList.add('hidden');

  const data = Object.fromEntries(new FormData(form).entries());

  // Empty strings → null
  Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null; });

  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan…'; }

  try {
    if (existing) {
      await updatePeserta(existing.noPeserta, data);
      showToast('Peserta berhasil diperbarui.', 'success');
    } else {
      await createPeserta(data);
      showToast('Peserta berhasil ditambahkan.', 'success');
    }
    close();
    onSaved?.();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = existing ? 'Simpan Perubahan' : 'Tambah Peserta'; }
  }
}

function _esc(str) {
  return String(str ?? '').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
