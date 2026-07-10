// admin/js/modules/peserta-master/form.js
// Modal add/edit peserta.

import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { createPeserta, updatePeserta, uploadFotoPeserta } from './api.js';
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

      ${isEdit ? `
      <!-- Upload Foto (edit mode only) -->
      <div class="flex items-center gap-4 pb-4 border-b border-gray-800">
        <div id="foto-preview-wrap"
          class="w-20 h-24 rounded-lg border-2 border-dashed border-gray-700 bg-gray-800
                 flex items-center justify-center overflow-hidden flex-shrink-0">
          ${existing.fotoUrl
            ? `<img id="foto-preview" src="${_esc(existing.fotoUrl)}" class="w-full h-full object-cover">`
            : `<svg id="foto-preview" class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
               </svg>`}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-gray-400 mb-1.5">Foto Peserta</p>
          <p class="text-xs text-gray-600 mb-2">Format JPG/PNG, maks 2 MB. Akan tampil di sertifikat.</p>
          <label class="cursor-pointer inline-flex items-center gap-2 text-xs bg-gray-700 hover:bg-gray-600
                         text-gray-200 px-3 py-1.5 rounded-lg transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0l-3 3m3-3l3 3"/>
            </svg>
            <span id="foto-btn-label">Pilih Foto</span>
            <input id="foto-input" type="file" accept="image/jpeg,image/png,image/webp" class="hidden">
          </label>
          <p id="foto-status" class="text-xs text-gray-600 mt-1.5"></p>
        </div>
      </div>` : ''}

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

        <!-- NIK -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">NIK</label>
          <input name="nik" type="text" maxlength="16" class="form-input"
            value="${_esc(existing?.nik ?? '')}" placeholder="16 digit NIK" />
        </div>

        <!-- Kualifikasi -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Kualifikasi</label>
          <input name="kualifikasi" type="text" class="form-input"
            value="${_esc(existing?.kualifikasi ?? '')}" placeholder="Kualifikasi / golongan" />
        </div>

        <!-- Tempat Lahir -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Tempat Lahir</label>
          <input name="tempatLahir" type="text" class="form-input"
            value="${_esc(existing?.tempatLahir ?? '')}" placeholder="Kota tempat lahir" />
        </div>

        <!-- Tanggal Lahir -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Tanggal Lahir</label>
          <input name="tanggalLahir" type="date" class="form-input"
            value="${_esc(existing?.tanggalLahir ?? '')}" />
        </div>
      </div>

      <!-- Error -->
      <div id="form-error" class="hidden text-sm text-red-400 bg-red-900/20
                                   border border-red-800 rounded-lg px-3 py-2"></div>
    </form>
  `;

  openModal({
    title,
    body,
    size: 'xl',
    actions: [
      { label: 'Batal', type: 'secondary', onClick: ({ close }) => close() },
      { label: isEdit ? 'Simpan Perubahan' : 'Tambah Peserta', type: 'primary', onClick: ({ close }) => _submit(close, existing, onSaved) }
    ]
  });

  // Bind foto upload (hanya mode edit karena butuh noPeserta yang sudah ada)
  if (isEdit) {
    const input    = document.getElementById('foto-input');
    const status   = document.getElementById('foto-status');
    const preview  = document.getElementById('foto-preview');
    const wrap     = document.getElementById('foto-preview-wrap');
    const btnLabel = document.getElementById('foto-btn-label');

    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        status.textContent = 'File terlalu besar (maks 2 MB).';
        status.className = 'text-xs text-red-400 mt-1.5';
        return;
      }
      // Preview lokal dulu
      const reader = new FileReader();
      reader.onload = e => {
        wrap.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
      };
      reader.readAsDataURL(file);

      status.textContent = 'Mengunggah…';
      status.className = 'text-xs text-gray-400 mt-1.5';
      btnLabel.textContent = 'Mengunggah…';
      input.disabled = true;

      try {
        await uploadFotoPeserta(existing.noPeserta, file);
        status.textContent = 'Foto berhasil diunggah.';
        status.className = 'text-xs text-teal-400 mt-1.5';
        btnLabel.textContent = 'Ganti Foto';
        onSaved?.();
      } catch (err) {
        status.textContent = `Gagal: ${err.message}`;
        status.className = 'text-xs text-red-400 mt-1.5';
        btnLabel.textContent = 'Coba Lagi';
      } finally {
        input.disabled = false;
      }
    });
  }
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
