/**
 * bimtek/form-mapel.js
 * Lokasi: admin/js/modules/bimtek/form-mapel.js
 */

import { createMapel, updateMapel, getBimtek } from './api.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';
import { showToast } from '../../components/toast.js';

export async function renderFormMapel(mapel, bimtekId, onSuccess) {
  const isEdit = !!mapel;

  // Load pengajar di bimtek ini
  let pengajarList = [];
  try {
    const bimtek = await getBimtek(bimtekId);
    const { getPengajar } = await import('../pengajar-master/api.js');
    pengajarList = await Promise.all(
      (bimtek.pengajarIds ?? []).map(id => getPengajar(id).catch(() => null))
    ).then(list => list.filter(Boolean));
  } catch { /* lanjut dengan list kosong */ }

  // Buat modal overlay
  const existing = document.getElementById('modal-form-mapel');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modal-form-mapel';
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm';
  document.body.appendChild(overlay);

  const activeBidang       = BIDANG_LIST.filter(b => b.active);
  const currentPengajarIds = mapel?.pengajarIds ?? [];
  const currentPenilaiId   = mapel?.pengajarPenilaiId ?? '';

  overlay.innerHTML = `
    <div class="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header modal -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <h2 class="text-sm font-semibold text-white">${isEdit ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}</h2>
        <button id="btn-close-modal" class="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 space-y-4">
        <!-- Nama -->
        <div>
          <label class="block text-xs text-gray-400 mb-1.5">Nama Mata Pelajaran <span class="text-red-400">*</span></label>
          <input type="text" id="mapel-nama" class="form-input w-full" maxlength="200"
            value="${_esc(mapel?.nama ?? '')}"
            placeholder="cth: Operasi dan Pemeliharaan IPA">
        </div>

        <!-- Bidang + JP -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-gray-400 mb-1.5">Bidang <span class="text-red-400">*</span></label>
            <select id="mapel-bidang" class="form-select w-full">
              <option value="">— Pilih bidang —</option>
              ${activeBidang.map(b =>
                `<option value="${b.id}" ${mapel?.bidangId===b.id?'selected':''}>${_esc(b.nama)}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1.5">Total JP <span class="text-red-400">*</span> <span class="text-gray-600">(1–9)</span></label>
            <div class="flex items-center gap-2">
              <input type="number" id="mapel-jp" class="form-input w-full" min="1" max="9" step="1"
                value="${mapel?.totalJp ?? ''}">
              <span id="durasi-preview" class="text-xs text-gray-500 shrink-0 w-20"></span>
            </div>
          </div>
        </div>

        <!-- Pengajar Pengampu -->
        <div>
          <label class="block text-xs text-gray-400 mb-1.5">
            Pengajar Pengampu <span class="text-red-400">*</span>
            <span class="text-gray-600">(bisa lebih dari 1)</span>
          </label>
          ${pengajarList.length === 0 ? `
            <div class="bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2 text-xs text-yellow-400">
              Belum ada pengajar di Bimtek ini. Tambahkan dulu di tab Pengajar.
            </div>` : `
            <div class="bg-gray-800 rounded-lg p-3 space-y-2 max-h-36 overflow-y-auto">
              ${pengajarList.map(p => `
                <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-300 hover:text-white">
                  <input type="checkbox" class="pengajar-check w-4 h-4 rounded" value="${p.id}"
                    ${currentPengajarIds.includes(p.id)?'checked':''}>
                  ${_esc(p.nama)}
                </label>`).join('')}
            </div>`}
        </div>

        <!-- Pengajar Penilai -->
        <div>
          <label class="block text-xs text-gray-400 mb-1.5">
            Pengajar Penilai <span class="text-red-400">*</span>
            <span class="text-gray-600">(yang input nilai peserta)</span>
          </label>
          <select id="mapel-penilai" class="form-select w-full" ${pengajarList.length===0?'disabled':''}>
            <option value="">— Pilih dari pengampu —</option>
            ${pengajarList.filter(p => currentPengajarIds.includes(p.id)).map(p =>
              `<option value="${p.id}" ${currentPenilaiId===p.id?'selected':''}>${_esc(p.nama)}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Keterangan -->
        <div>
          <label class="block text-xs text-gray-400 mb-1.5">Keterangan <span class="text-gray-600">(opsional)</span></label>
          <textarea id="mapel-ket" class="form-input w-full resize-none" rows="2" maxlength="500"
            placeholder="Catatan tambahan">${_esc(mapel?.keterangan ?? '')}</textarea>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-800">
        <button id="btn-cancel-modal" class="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
          Batal
        </button>
        <button id="btn-save-mapel" class="px-4 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
          ${isEdit ? 'Simpan' : 'Tambah Mapel'}
        </button>
      </div>
    </div>
  `;

  // Close handlers
  const closeModal = () => overlay.remove();
  overlay.querySelector('#btn-close-modal').addEventListener('click', closeModal);
  overlay.querySelector('#btn-cancel-modal').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // JP → preview durasi
  const jpInput  = overlay.querySelector('#mapel-jp');
  const durasiEl = overlay.querySelector('#durasi-preview');
  function updateDurasi() {
    const jp = parseInt(jpInput.value) || 0;
    if (jp > 0) {
      const menit = jp * 45;
      const jam  = Math.floor(menit / 60);
      const sisa = menit % 60;
      durasiEl.textContent = jam > 0 ? `${jam}j ${sisa>0?sisa+'m':''}` : `${sisa}m`;
    } else { durasiEl.textContent = ''; }
  }
  jpInput.addEventListener('input', updateDurasi);
  updateDurasi();

  // Checkbox pengampu → sync penilai dropdown
  overlay.querySelectorAll('.pengajar-check').forEach(cb => {
    cb.addEventListener('change', () => _syncPenilai(overlay, pengajarList));
  });

  // Save
  overlay.querySelector('#btn-save-mapel').addEventListener('click', async () => {
    const nama      = overlay.querySelector('#mapel-nama').value.trim();
    const bidangId  = overlay.querySelector('#mapel-bidang').value;
    const totalJp   = parseInt(overlay.querySelector('#mapel-jp').value);
    const penilaiId = overlay.querySelector('#mapel-penilai').value;
    const ket       = overlay.querySelector('#mapel-ket').value.trim();
    const checked   = [...overlay.querySelectorAll('.pengajar-check:checked')].map(cb => cb.value);

    if (!nama)                                     { showToast('Nama mapel wajib diisi', 'warning'); return; }
    if (!bidangId)                                 { showToast('Bidang wajib dipilih', 'warning'); return; }
    if (!totalJp || totalJp < 1 || totalJp > 9)   { showToast('JP harus antara 1–9', 'warning'); return; }
    if (pengajarList.length > 0 && checked.length === 0)      { showToast('Pilih minimal 1 pengajar pengampu', 'warning'); return; }
    if (pengajarList.length > 0 && !penilaiId)                { showToast('Pengajar penilai wajib dipilih', 'warning'); return; }
    if (pengajarList.length > 0 && !checked.includes(penilaiId)) { showToast('Pengajar penilai harus ada di daftar pengampu', 'warning'); return; }

    const btn = overlay.querySelector('#btn-save-mapel');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';

    try {
      const data = {
        nama, bidangId, totalJp,
        pengajarIds:       checked.length > 0 ? checked : [],
        pengajarPenilaiId: penilaiId || checked[0] || '',
        ekIds:             mapel?.ekIds ?? null,
        keterangan:        ket || null
      };

      if (isEdit) {
        await updateMapel(bimtekId, mapel.id, data);
        showToast('Mapel berhasil diperbarui', 'success');
      } else {
        await createMapel(bimtekId, data);
        showToast('Mapel berhasil ditambahkan', 'success');
      }

      closeModal();
      if (typeof onSuccess === 'function') await onSuccess();
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = isEdit ? 'Simpan' : 'Tambah Mapel';
    }
  });
}

function _syncPenilai(overlay, pengajarList) {
  const checked = [...overlay.querySelectorAll('.pengajar-check:checked')].map(cb => cb.value);
  const sel = overlay.querySelector('#mapel-penilai');
  const prev = sel.value;
  sel.innerHTML = `<option value="">— Pilih dari pengampu —</option>`;
  pengajarList.filter(p => checked.includes(p.id)).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nama;
    if (prev === p.id) opt.selected = true;
    sel.appendChild(opt);
  });
  if (checked.length === 1) sel.value = checked[0];
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
