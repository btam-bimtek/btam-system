// admin/js/modules/bimtek/form-mapel.js
import { createMapel, updateMapel, validateMapel } from './api.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';
import { showToast } from '../../components/toast.js';

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

/**
 * Tampilkan modal add/edit mapel.
 * @param {string} bimtekId
 * @param {object|null} mapel - null = mode create, ada isinya = mode edit
 * @param {string[]} pengajarOptions - list { id, nama } pengajar yang tersedia
 * @param {function} onSuccess - callback setelah save berhasil
 */
export function showMapelModal(bimtekId, mapel, pengajarOptions, onSuccess) {
  removeExistingModal();

  const isEdit = !!mapel;
  const modal = buildModal(isEdit, mapel, pengajarOptions);
  document.body.appendChild(modal);

  // Bind pengajar penilai dropdown ke pengajar pengampu yang dipilih
  const pengampu = modal.querySelector('#mapel-pengajar-ids');
  const penilai = modal.querySelector('#mapel-pengajar-penilai');
  pengampu.addEventListener('change', () => syncPenilaiOptions(pengampu, penilai));
  if (isEdit) syncPenilaiOptions(pengampu, penilai, mapel.pengajarPenilaiId);

  // Submit
  modal.querySelector('#mapel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSubmit(modal, bimtekId, mapel?.id, onSuccess);
  });

  // Tutup modal
  modal.querySelectorAll('[data-dismiss]').forEach(el => {
    el.addEventListener('click', () => removeExistingModal());
  });

  // Klik backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal) removeExistingModal();
  });

  modal.style.display = 'flex';
  modal.querySelector('#mapel-nama').focus();
}

// ─── BUILD MODAL HTML ───────────────────────────────────────────────────────

function buildModal(isEdit, mapel, pengajarOptions) {
  const el = document.createElement('div');
  el.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60';
  el.id = 'mapel-modal';

  const bidangOptions = BIDANG_LIST.filter(b => b.active)
    .map(b => `<option value="${b.bidangId}" ${mapel?.bidangId === b.bidangId ? 'selected' : ''}>${b.nama}</option>`)
    .join('');

  const pengajarOpts = pengajarOptions.map(p =>
    `<option value="${p.id}" ${mapel?.pengajarIds?.includes(p.id) ? 'selected' : ''}>${escHtml(p.nama)}</option>`
  ).join('');

  el.innerHTML = `
    <div class="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <h5 class="font-semibold text-white">${isEdit ? 'Edit' : 'Tambah'} Mata Pelajaran</h5>
        <button type="button" class="text-gray-400 hover:text-white text-xl leading-none" data-dismiss>×</button>
      </div>

      <form id="mapel-form" novalidate>
        <div class="p-5 space-y-4">

          <div>
            <label class="block text-xs text-gray-400 mb-1.5">Nama Mata Pelajaran <span class="text-red-400">*</span></label>
            <input type="text" id="mapel-nama" class="form-input w-full"
              value="${escHtml(mapel?.nama || '')}"
              placeholder="cth: Operasi IPA, Penurunan NRW">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Bidang <span class="text-red-400">*</span></label>
              <select id="mapel-bidang" class="form-select w-full">
                <option value="">-- Pilih Bidang --</option>
                ${bidangOptions}
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Total JP <span class="text-red-400">*</span> <span class="text-gray-500">(maks 9)</span></label>
              <input type="number" id="mapel-jp" class="form-input w-full"
                min="1" max="9" step="1"
                value="${mapel?.totalJp || ''}"
                placeholder="1-9">
            </div>
          </div>

          <div>
            <label class="block text-xs text-gray-400 mb-1.5">Pengajar Pengampu <span class="text-red-400">*</span> <span class="text-gray-500">(Ctrl+klik multi)</span></label>
            <select id="mapel-pengajar-ids" class="form-select w-full" multiple size="4">
              ${pengajarOpts}
            </select>
          </div>

          <div>
            <label class="block text-xs text-gray-400 mb-1.5">Pengajar Penilai <span class="text-red-400">*</span></label>
            <select id="mapel-pengajar-penilai" class="form-select w-full">
              <option value="">-- Pilih pengajar pengampu dulu --</option>
            </select>
          </div>

          <div>
            <label class="block text-xs text-gray-400 mb-1.5">Keterangan <span class="text-gray-500">(opsional)</span></label>
            <textarea id="mapel-keterangan" class="form-input w-full" rows="2"
              placeholder="Catatan atau deskripsi singkat">${escHtml(mapel?.keterangan || '')}</textarea>
          </div>

          <div id="mapel-form-error" class="hidden text-red-400 text-sm bg-red-900/30 rounded p-3"></div>

        </div>

        <div class="flex justify-end gap-3 px-5 py-4 border-t border-gray-800">
          <button type="button" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors" data-dismiss>Batal</button>
          <button type="submit" id="mapel-submit" class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">
            ${isEdit ? 'Simpan Perubahan' : 'Tambah Mapel'}
          </button>
        </div>
      </form>
    </div>
  `;

  return el;
}

// ─── SYNC PENILAI OPTIONS ───────────────────────────────────────────────────

function syncPenilaiOptions(pengampuSelect, penilaiSelect, selectedId = null) {
  const selected = Array.from(pengampuSelect.selectedOptions).map(o => ({
    id: o.value,
    nama: o.text,
  }));

  penilaiSelect.innerHTML = selected.length === 0
    ? `<option value="">-- Pilih pengajar pengampu dulu --</option>`
    : `<option value="">-- Pilih Pengajar Penilai --</option>` +
      selected.map(p =>
        `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escHtml(p.nama)}</option>`
      ).join('');
}

// ─── HANDLE SUBMIT ──────────────────────────────────────────────────────────

async function handleSubmit(modal, bimtekId, mapelId, onSuccess) {
  const errEl = modal.querySelector('#mapel-form-error');
  const submitBtn = modal.querySelector('#mapel-submit');
  errEl.classList.add('hidden');

  const pengajarIds = Array.from(modal.querySelector('#mapel-pengajar-ids').selectedOptions)
    .map(o => o.value);

  const data = {
    nama: modal.querySelector('#mapel-nama').value,
    bidangId: modal.querySelector('#mapel-bidang').value,
    totalJp: parseInt(modal.querySelector('#mapel-jp').value, 10),
    pengajarIds,
    pengajarPenilaiId: modal.querySelector('#mapel-pengajar-penilai').value,
    keterangan: modal.querySelector('#mapel-keterangan').value,
  };

  try {
    validateMapel(data);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Menyimpan...';

  try {
    if (mapelId) {
      await updateMapel(bimtekId, mapelId, data);
      showToast('Mapel berhasil diperbarui', 'success');
    } else {
      await createMapel(bimtekId, data);
      showToast('Mapel berhasil ditambahkan', 'success');
    }
    removeExistingModal();
    if (onSuccess) onSuccess();
  } catch (err) {
    errEl.textContent = 'Gagal menyimpan: ' + err.message;
    errEl.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = mapelId ? 'Simpan Perubahan' : 'Tambah Mapel';
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function removeExistingModal() {
  document.getElementById('mapel-modal')?.remove();
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
