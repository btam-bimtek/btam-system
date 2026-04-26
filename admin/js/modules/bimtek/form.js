// admin/js/modules/bimtek/form.js
import {
  getBimtek, createBimtek, updateBimtek, deleteBimtek,
  DEFAULT_WEIGHTS, DEFAULT_KKM,
} from './api.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { setPageTitle } from '../../layout/navbar.js';
import { navigate } from '../../router.js';
import {
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── ENTRY POINT ────────────────────────────────────────────────────────────

export async function renderBimtekForm({ id }) {
  const app = document.getElementById('app');
  const isNew = !id;

  setPageTitle(isNew ? 'Bimtek Baru' : 'Edit Bimtek');
  app.innerHTML = `<div class="text-gray-400 py-10 text-center">Memuat...</div>`;

  let bimtek = null;
  if (!isNew) {
    try {
      bimtek = await getBimtek(id);
    } catch (err) {
      app.innerHTML = `<div class="text-red-400">Gagal memuat: ${err.message}</div>`;
      return;
    }
  }

  app.innerHTML = buildForm(isNew, bimtek);
  bindEvents(app, isNew, bimtek, id);
  updateWeightSum(app);
}

// ─── BUILD FORM ─────────────────────────────────────────────────────────────

function buildForm(isNew, b) {
  const w = b?.weights || { ...DEFAULT_WEIGHTS };
  const readonly = b && !['draft', 'planned'].includes(b.status);

  return `
    <div class="max-w-3xl mx-auto">

      <div class="flex items-center gap-3 mb-6">
        <button id="btn-back" class="text-gray-400 hover:text-white text-sm">← Kembali</button>
        <h2 class="text-xl font-semibold">${isNew ? 'Bimtek Baru' : 'Edit Bimtek'}</h2>
        ${b ? `<span class="badge-status-${b.status} text-xs px-2 py-1 rounded">${labelStatus(b.status)}</span>` : ''}
      </div>

      <form id="form-bimtek" novalidate class="space-y-5">

        <!-- Nama -->
        <div>
          <label class="form-label">Nama Bimtek <span class="text-red-400">*</span></label>
          <input type="text" id="f-nama" class="form-input w-full"
            value="${esc(b?.nama || '')}"
            placeholder="cth: Bimtek Operator IPA Lanjutan Batch 3"
            ${readonly ? 'readonly' : ''}>
        </div>

        <!-- Tipe + Mode + Kapasitas -->
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="form-label">Tipe <span class="text-red-400">*</span></label>
            <select id="f-tipe" class="form-input w-full" ${readonly ? 'disabled' : ''}>
              <option value="">-- Pilih --</option>
              <option value="reguler"    ${b?.tipe==='reguler'    ?'selected':''}>Reguler</option>
              <option value="pnbp"       ${b?.tipe==='pnbp'       ?'selected':''}>PNBP</option>
              <option value="e_learning" ${b?.tipe==='e_learning' ?'selected':''}>e-Learning</option>
              <option value="ojt"        ${b?.tipe==='ojt'        ?'selected':''}>OJT</option>
              <option value="lainnya"    ${b?.tipe==='lainnya'    ?'selected':''}>Lainnya</option>
            </select>
          </div>
          <div>
            <label class="form-label">Mode <span class="text-red-400">*</span></label>
            <select id="f-mode" class="form-input w-full" ${readonly ? 'disabled' : ''}>
              <option value="">-- Pilih --</option>
              <option value="online"  ${b?.mode==='online'  ?'selected':''}>Online (max 25)</option>
              <option value="offline" ${b?.mode==='offline' ?'selected':''}>Offline (max 17)</option>
            </select>
          </div>
          <div>
            <label class="form-label">Kapasitas</label>
            <input type="number" id="f-kapasitas" class="form-input w-full"
              min="1" max="50" value="${b?.kapasitas || ''}"
              placeholder="Auto" ${readonly ? 'readonly' : ''}>
          </div>
        </div>

        <!-- Bidang -->
        <div>
          <label class="form-label">Bidang <span class="text-red-400">*</span></label>
          <div class="flex flex-wrap gap-4 mt-1">
            ${BIDANG_LIST.filter(x => x.active).map(x => `
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="bidang-cb" value="${x.bidangId}"
                  ${b?.bidangIds?.includes(x.bidangId) ? 'checked' : ''}
                  ${readonly ? 'disabled' : ''}>
                <span class="text-sm">${x.nama}</span>
              </label>
            `).join('')}
          </div>
          <p class="text-xs text-gray-400 mt-1">Reguler: 1 bidang. PNBP: bisa multi.</p>
        </div>

        <!-- Periode -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="form-label">Tanggal Mulai <span class="text-red-400">*</span></label>
            <input type="date" id="f-mulai" class="form-input w-full"
              value="${b?.periode?.mulai ? toDateInput(b.periode.mulai) : ''}"
              ${readonly ? 'readonly' : ''}>
          </div>
          <div>
            <label class="form-label">Tanggal Selesai <span class="text-red-400">*</span></label>
            <input type="date" id="f-selesai" class="form-input w-full"
              value="${b?.periode?.selesai ? toDateInput(b.periode.selesai) : ''}"
              ${readonly ? 'readonly' : ''}>
          </div>
        </div>

        <!-- Lokasi + Kode -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="form-label">Lokasi <span class="text-red-400">*</span></label>
            <input type="text" id="f-lokasi" class="form-input w-full"
              value="${esc(b?.lokasi || '')}"
              placeholder="BTAM / link Zoom / alamat"
              ${readonly ? 'readonly' : ''}>
          </div>
          <div>
            <label class="form-label">Kode Bimtek</label>
            <input type="text" id="f-kode" class="form-input w-full"
              value="${esc(b?.kodeBimtek || '')}"
              placeholder="cth: BIM-2026-01"
              ${readonly ? 'readonly' : ''}>
          </div>
        </div>

        <hr class="border-gray-700">

        <!-- Penilaian -->
        <div>
          <h3 class="text-sm font-semibold text-gray-300 mb-3">Konfigurasi Penilaian</h3>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="form-label">KKM (Nilai Minimum Lulus)</label>
              <input type="number" id="f-kkm" class="form-input w-full"
                min="0" max="100" value="${b?.kkm ?? DEFAULT_KKM}"
                ${readonly ? 'readonly' : ''}>
            </div>
            <div class="flex items-end gap-3 pb-1">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="f-has-tugas" ${b?.hasTugas ? 'checked' : ''} ${readonly ? 'disabled' : ''}>
                <span class="text-sm">Ada Tugas</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="f-has-presentasi" ${b?.hasPresentasi ? 'checked' : ''} ${readonly ? 'disabled' : ''}>
                <span class="text-sm">Ada Presentasi</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Bobot -->
        <div>
          <label class="form-label">Bobot Komponen Penilaian (%)</label>
          <div class="grid grid-cols-4 gap-3 mt-1">
            ${buildWeightInputs(w, readonly)}
          </div>
          <div id="weight-sum-info" class="text-xs mt-2"></div>
        </div>

        <!-- Error -->
        <div id="form-error" class="hidden text-red-400 text-sm bg-red-900/30 rounded p-3"></div>

        <!-- Actions -->
        <div class="flex gap-3 pt-2">
          <button type="submit" id="btn-save" class="btn-primary" ${readonly ? 'disabled' : ''}>
            ${isNew ? 'Buat Bimtek' : 'Simpan Perubahan'}
          </button>
          <button type="button" id="btn-back2" class="btn-secondary">Batal</button>
          ${!isNew && ['draft','planned'].includes(b?.status) ? `
            <button type="button" id="btn-delete" class="btn-danger ml-auto">Hapus</button>
          ` : ''}
        </div>

      </form>
    </div>
  `;
}

function buildWeightInputs(w, readonly) {
  const items = [
    { key: 'pretest',    label: 'Pre-test' },
    { key: 'posttest',   label: 'Post-test' },
    { key: 'pengajar',   label: 'Pengajar' },
    { key: 'kehadiran',  label: 'Kehadiran' },
    { key: 'keaktifan',  label: 'Keaktifan' },
    { key: 'respek',     label: 'Respek' },
    { key: 'tugas',      label: 'Tugas' },
    { key: 'presentasi', label: 'Presentasi' },
  ];
  return items.map(k => `
    <div>
      <label class="text-xs text-gray-400">${k.label}</label>
      <input type="number" class="form-input w-full text-sm weight-input"
        data-key="${k.key}" min="0" max="100" step="1"
        value="${Math.round((w[k.key] || 0) * 100)}"
        ${readonly ? 'readonly' : ''}>
    </div>
  `).join('');
}

// ─── EVENTS ─────────────────────────────────────────────────────────────────

function bindEvents(app, isNew, bimtek, id) {
  app.querySelector('#btn-back')?.addEventListener('click', () => navigate('/bimtek'));
  app.querySelector('#btn-back2')?.addEventListener('click', () => navigate('/bimtek'));

  // Auto-kapasitas dari mode
  app.querySelector('#f-mode')?.addEventListener('change', e => {
    const kap = app.querySelector('#f-kapasitas');
    if (!kap.value) kap.value = e.target.value === 'online' ? 25 : 17;
  });

  // Live weight sum
  app.querySelectorAll('.weight-input').forEach(inp => {
    inp.addEventListener('input', () => updateWeightSum(app));
  });

  // Submit
  app.querySelector('#form-bimtek')?.addEventListener('submit', async e => {
    e.preventDefault();
    await handleSave(app, isNew, id);
  });

  // Delete
  app.querySelector('#btn-delete')?.addEventListener('click', async () => {
    const ok = await confirmDialog('Hapus Bimtek ini? Tindakan tidak bisa dibatalkan.');
    if (!ok) return;
    try {
      await deleteBimtek(id);
      showToast('Bimtek dihapus', 'success');
      navigate('/bimtek');
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
    }
  });
}

// ─── SAVE ───────────────────────────────────────────────────────────────────

async function handleSave(app, isNew, id) {
  const errEl = app.querySelector('#form-error');
  const btn   = app.querySelector('#btn-save');
  errEl.classList.add('hidden');

  const bidangIds = Array.from(app.querySelectorAll('.bidang-cb:checked')).map(cb => cb.value);
  const weights   = {};
  app.querySelectorAll('.weight-input').forEach(inp => {
    weights[inp.dataset.key] = parseFloat(inp.value || 0) / 100;
  });

  const mulai   = app.querySelector('#f-mulai').value;
  const selesai = app.querySelector('#f-selesai').value;
  const kapVal  = parseInt(app.querySelector('#f-kapasitas').value || '0', 10);
  const mode    = app.querySelector('#f-mode').value;

  const data = {
    nama:         app.querySelector('#f-nama').value.trim(),
    tipe:         app.querySelector('#f-tipe').value,
    mode,
    bidangIds,
    lokasi:       app.querySelector('#f-lokasi').value.trim(),
    kodeBimtek:   app.querySelector('#f-kode').value.trim(),
    kapasitas:    kapVal || (mode === 'online' ? 25 : 17),
    kkm:          parseInt(app.querySelector('#f-kkm').value, 10) || DEFAULT_KKM,
    hasTugas:     app.querySelector('#f-has-tugas')?.checked || false,
    hasPresentasi:app.querySelector('#f-has-presentasi')?.checked || false,
    weights,
    periode: {
      mulai:   mulai   ? Timestamp.fromDate(new Date(mulai))   : null,
      selesai: selesai ? Timestamp.fromDate(new Date(selesai)) : null,
    },
  };

  // Validasi
  const errors = [];
  if (!data.nama)                       errors.push('Nama wajib diisi');
  if (!data.tipe)                       errors.push('Tipe wajib dipilih');
  if (!data.mode)                       errors.push('Mode wajib dipilih');
  if (bidangIds.length === 0)           errors.push('Minimal 1 bidang dipilih');
  if (!mulai)                           errors.push('Tanggal mulai wajib diisi');
  if (!selesai)                         errors.push('Tanggal selesai wajib diisi');
  if (mulai && selesai && mulai > selesai) errors.push('Tanggal mulai tidak boleh setelah selesai');
  if (!data.lokasi)                     errors.push('Lokasi wajib diisi');

  const wSum = Object.values(weights).reduce((s, v) => s + v, 0);
  if (Math.abs(wSum - 1) > 0.01)       errors.push(`Total bobot harus 100% (sekarang ${Math.round(wSum * 100)}%)`);

  if (errors.length > 0) {
    errEl.textContent = errors.join(' · ');
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    if (isNew) {
      const newId = await createBimtek(data);
      showToast('Bimtek berhasil dibuat', 'success');
      navigate(`/bimtek/${newId}`);
    } else {
      await updateBimtek(id, data);
      showToast('Perubahan disimpan', 'success');
      navigate(`/bimtek/${id}`);
    }
  } catch (err) {
    errEl.textContent = 'Gagal: ' + err.message;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = isNew ? 'Buat Bimtek' : 'Simpan Perubahan';
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function updateWeightSum(app) {
  const el = app.querySelector('#weight-sum-info');
  if (!el) return;
  const total = Array.from(app.querySelectorAll('.weight-input'))
    .reduce((s, inp) => s + parseFloat(inp.value || 0), 0);
  const ok = Math.abs(total - 100) < 1;
  el.innerHTML = `Total: <span class="${ok ? 'text-green-400' : 'text-red-400'} font-semibold">${total}%</span> ${ok ? '✓' : '← harus 100%'}`;
}

function labelStatus(s) {
  return { draft:'Draft', planned:'Direncanakan', ongoing:'Berlangsung', completed:'Selesai', cancelled:'Dibatalkan' }[s] || s;
}

function toDateInput(ts) {
  const d = ts?.toDate?.() || ts;
  return d ? d.toISOString().split('T')[0] : '';
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
