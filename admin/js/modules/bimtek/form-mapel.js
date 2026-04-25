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
  el.className = 'modal-overlay';
  el.id = 'mapel-modal';

  const bidangOptions = BIDANG_LIST.filter(b => b.active)
    .map(b => `<option value="${b.id}" ${mapel?.bidangId === b.id ? 'selected' : ''}>${b.nama}</option>`)
    .join('');

  const pengajarOpts = pengajarOptions.map(p =>
    `<option value="${p.id}" ${mapel?.pengajarIds?.includes(p.id) ? 'selected' : ''}>${escHtml(p.nama)}</option>`
  ).join('');

  el.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h5 class="modal-title">${isEdit ? 'Edit' : 'Tambah'} Mata Pelajaran</h5>
        <button type="button" class="btn-close" data-dismiss></button>
      </div>

      <form id="mapel-form" novalidate>
        <div class="modal-body">

          <div class="form-group mb-3">
            <label class="form-label required">Nama Mata Pelajaran</label>
            <input type="text" id="mapel-nama" class="form-control"
              value="${escHtml(mapel?.nama || '')}"
              placeholder="cth: Operasi IPA, Penurunan NRW" required>
          </div>

          <div class="row">
            <div class="col-md-6 form-group mb-3">
              <label class="form-label required">Bidang</label>
              <select id="mapel-bidang" class="form-select" required>
                <option value="">-- Pilih Bidang --</option>
                ${bidangOptions}
              </select>
            </div>
            <div class="col-md-6 form-group mb-3">
              <label class="form-label required">Total JP
                <span class="text-muted small">(1 JP = 45 menit, maks 9 JP)</span>
              </label>
              <input type="number" id="mapel-jp" class="form-control"
                min="1" max="9" step="1"
                value="${mapel?.totalJp || ''}"
                placeholder="1-9" required>
            </div>
          </div>

          <div class="form-group mb-3">
            <label class="form-label required">Pengajar Pengampu
              <span class="text-muted small">(bisa lebih dari 1)</span>
            </label>
            <select id="mapel-pengajar-ids" class="form-select" multiple size="4" required>
              ${pengajarOpts}
            </select>
            <small class="text-muted">Ctrl+klik untuk pilih lebih dari 1</small>
          </div>

          <div class="form-group mb-3">
            <label class="form-label required">Pengajar Penilai
              <span class="text-muted small">(yang input nilai peserta, harus salah satu pengampu)</span>
            </label>
            <select id="mapel-pengajar-penilai" class="form-select" required>
              <option value="">-- Pilih pengajar pengampu dulu --</option>
            </select>
          </div>

          <div class="form-group mb-3">
            <label class="form-label">Keterangan <span class="text-muted small">(opsional)</span></label>
            <textarea id="mapel-keterangan" class="form-control" rows="2"
              placeholder="Catatan atau deskripsi singkat">${escHtml(mapel?.keterangan || '')}</textarea>
          </div>

          <div id="mapel-form-error" class="alert alert-danger d-none"></div>

        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-dismiss>Batal</button>
          <button type="submit" id="mapel-submit" class="btn btn-primary">
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
  errEl.classList.add('d-none');

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
    errEl.classList.remove('d-none');
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
    errEl.classList.remove('d-none');
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
