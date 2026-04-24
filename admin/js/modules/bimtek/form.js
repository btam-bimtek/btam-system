/**
 * bimtek/form.js
 * Lokasi: admin/js/modules/bimtek/form.js
 */

import { setPageTitle } from '../../layout/navbar.js';
import { showToast } from '../../components/toast.js';
import { createBimtek, updateBimtek, getBimtek, DEFAULT_WEIGHTS, validateWeights } from './api.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';

export async function renderBimtekForm({ id } = {}) {
  const isEdit = !!id;
  setPageTitle(isEdit ? 'Edit Bimtek' : 'Bimtek Baru');

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="flex items-center justify-center py-16">
      <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  let d = null;
  if (isEdit) {
    try { d = await getBimtek(id); }
    catch (err) {
      app.innerHTML = `<div class="text-red-400 text-sm p-4">${err.message}</div>`;
      return;
    }
  }

  const weights     = d?.weights ?? { ...DEFAULT_WEIGHTS };
  const hasTugas    = d?.hasTugas ?? false;
  const hasPresentasi = d?.hasPresentasi ?? false;
  const tipe        = d?.tipe ?? 'reguler';
  const activeBidang = BIDANG_LIST.filter(b => b.active);

  app.innerHTML = `
    <div class="max-w-3xl">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <button id="btn-back" class="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 class="text-lg font-bold text-white">${isEdit ? 'Edit Bimtek' : 'Bimtek Baru'}</h1>
          ${isEdit ? `<p class="text-xs text-gray-500">${_esc(d.kodeBimtek)}</p>` : ''}
        </div>
      </div>

      <!-- Tab nav -->
      <div class="flex gap-1 mb-6 border-b border-gray-800">
        <button class="tab-btn px-4 py-2 text-sm font-medium text-blue-400 border-b-2 border-blue-400" data-tab="info">Informasi</button>
        <button class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent" data-tab="weights">Bobot Nilai</button>
      </div>

      <!-- Tab: Informasi -->
      <div id="tab-info">
        <!-- Informasi Dasar -->
        <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
          <h2 class="text-sm font-semibold text-gray-300 mb-4">Informasi Dasar</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Nama Bimtek <span class="text-red-400">*</span></label>
              <input type="text" id="nama" class="form-input w-full" maxlength="200"
                value="${_esc(d?.nama ?? '')}"
                placeholder="cth: Bimtek Operator IPA Lanjutan Batch 3">
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">Tipe <span class="text-red-400">*</span></label>
                <select id="tipe" class="form-select w-full">
                  <option value="reguler" ${tipe==='reguler'?'selected':''}>Reguler</option>
                  <option value="pnbp"    ${tipe==='pnbp'   ?'selected':''}>PNBP</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">Mode <span class="text-red-400">*</span></label>
                <select id="mode" class="form-select w-full">
                  <option value="offline" ${d?.mode==='offline'?'selected':''}>Offline (maks 17)</option>
                  <option value="online"  ${d?.mode==='online' ?'selected':''}>Online (maks 25)</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">Kapasitas</label>
                <input type="number" id="kapasitas" class="form-input w-full" min="1" max="100"
                  value="${d?.kapasitas ?? ''}" placeholder="Auto">
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Bidang <span class="text-red-400">*</span></label>
              <div id="bidang-field">${_buildBidangField(activeBidang, tipe, d?.bidangIds ?? [])}</div>
            </div>
          </div>
        </div>

        <!-- Jadwal & Lokasi -->
        <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
          <h2 class="text-sm font-semibold text-gray-300 mb-4">Jadwal & Lokasi</h2>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Tanggal Mulai <span class="text-red-400">*</span></label>
              <input type="date" id="periode-mulai" class="form-input w-full"
                value="${d?.periode?.mulai ? _toInputDate(d.periode.mulai) : ''}">
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Tanggal Selesai <span class="text-red-400">*</span></label>
              <input type="date" id="periode-selesai" class="form-input w-full"
                value="${d?.periode?.selesai ? _toInputDate(d.periode.selesai) : ''}">
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Lokasi</label>
              <input type="text" id="lokasi" class="form-input w-full" maxlength="200"
                value="${_esc(d?.lokasi ?? '')}" placeholder="BTAM / link Zoom / dsb">
            </div>
          </div>
        </div>

        <!-- Konfigurasi Penilaian -->
        <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
          <h2 class="text-sm font-semibold text-gray-300 mb-4">Konfigurasi Penilaian</h2>
          <div class="flex items-start gap-8">
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">KKM (Nilai Minimum Lulus)</label>
              <input type="number" id="kkm" class="form-input w-24" min="0" max="100" value="${d?.kkm ?? 60}">
            </div>
            <div class="space-y-2 pt-5">
              <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                <input type="checkbox" id="has-tugas" class="w-4 h-4 rounded" ${hasTugas?'checked':''}>
                Komponen Tugas aktif
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                <input type="checkbox" id="has-presentasi" class="w-4 h-4 rounded" ${hasPresentasi?'checked':''}>
                Komponen Presentasi aktif
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Bobot -->
      <div id="tab-weights" class="hidden">
        <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-gray-300">Bobot Penilaian</h2>
            <div class="flex items-center gap-3">
              <span id="weight-sum" class="text-xs font-mono px-2 py-1 rounded bg-gray-800 text-gray-300"></span>
              <button type="button" id="btn-reset-weights" class="text-xs text-gray-400 hover:text-white transition-colors">
                Reset Default
              </button>
            </div>
          </div>
          <p class="text-xs text-gray-500 mb-4">Total bobot komponen aktif harus = <span class="text-white font-mono">100</span>.</p>
          <div id="weights-grid" class="grid grid-cols-4 gap-3">
            ${_buildWeightInputs(weights, hasTugas, hasPresentasi)}
          </div>
        </div>
      </div>

      <!-- Action bar -->
      <div class="flex items-center gap-3 pt-2">
        <button id="btn-submit" class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
          ${isEdit ? 'Simpan Perubahan' : 'Buat Bimtek'}
        </button>
        <button id="btn-cancel" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
          Batal
        </button>
      </div>
    </div>
  `;

  _updateWeightSum();

  // Tab navigation
  app.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      app.querySelectorAll('.tab-btn').forEach(b => {
        b.className = 'tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent';
      });
      btn.className = 'tab-btn px-4 py-2 text-sm font-medium text-blue-400 border-b-2 border-blue-400';
      app.querySelector('#tab-info').classList.toggle('hidden', btn.dataset.tab !== 'info');
      app.querySelector('#tab-weights').classList.toggle('hidden', btn.dataset.tab !== 'weights');
      if (btn.dataset.tab === 'weights') _updateWeightSum();
    });
  });

  app.querySelector('#btn-back').addEventListener('click', () => _goBack(id));
  app.querySelector('#btn-cancel').addEventListener('click', () => _goBack(id));

  app.querySelector('#tipe').addEventListener('change', e => {
    app.querySelector('#bidang-field').innerHTML = _buildBidangField(activeBidang, e.target.value, []);
  });

  ['has-tugas','has-presentasi'].forEach(cid => {
    app.querySelector(`#${cid}`).addEventListener('change', () => {
      const ht = app.querySelector('#has-tugas').checked;
      const hp = app.querySelector('#has-presentasi').checked;
      app.querySelector('#weights-grid').innerHTML = _buildWeightInputs(_readWeights(), ht, hp);
      _attachWeightEvents();
      _updateWeightSum();
    });
  });

  _attachWeightEvents();

  app.querySelector('#btn-reset-weights').addEventListener('click', () => {
    const ht = app.querySelector('#has-tugas').checked;
    const hp = app.querySelector('#has-presentasi').checked;
    app.querySelector('#weights-grid').innerHTML = _buildWeightInputs(DEFAULT_WEIGHTS, ht, hp);
    _attachWeightEvents();
    _updateWeightSum();
  });

  app.querySelector('#btn-submit').addEventListener('click', async () => {
    await _handleSubmit(id, isEdit);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _buildBidangField(activeBidang, tipe, currentIds) {
  if (tipe === 'reguler') {
    return `
      <select id="bidang-single" class="form-select w-full">
        <option value="">— Pilih bidang —</option>
        ${activeBidang.map(b =>
          `<option value="${b.id}" ${currentIds[0]===b.id?'selected':''}>${_esc(b.nama)}</option>`
        ).join('')}
      </select>`;
  }
  return `<div class="flex flex-wrap gap-4">
    ${activeBidang.map(b => `
      <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
        <input type="checkbox" class="bidang-check w-4 h-4 rounded" value="${b.id}" ${currentIds.includes(b.id)?'checked':''}>
        ${_esc(b.nama)}
      </label>`).join('')}
  </div>`;
}

function _readBidangIds() {
  const app = document.getElementById('app');
  const tipe = app.querySelector('#tipe').value;
  if (tipe === 'reguler') {
    const v = app.querySelector('#bidang-single')?.value;
    return v ? [v] : [];
  }
  return [...app.querySelectorAll('.bidang-check:checked')].map(cb => cb.value);
}

const WEIGHT_LABELS = {
  pretest:'Pre-Test', posttest:'Post-Test', pengajar:'Nilai Pengajar',
  kehadiran:'Kehadiran', keaktifan:'Keaktifan', respek:'Respek & Etika',
  tugas:'Tugas', presentasi:'Presentasi'
};

function _buildWeightInputs(weights, hasTugas, hasPresentasi) {
  const keys = ['pretest','posttest','pengajar','kehadiran','keaktifan','respek'];
  if (hasTugas) keys.push('tugas');
  if (hasPresentasi) keys.push('presentasi');
  return keys.map(k => `
    <div>
      <label class="block text-xs text-gray-400 mb-1.5">${WEIGHT_LABELS[k]}</label>
      <div class="flex items-center gap-1">
        <input type="number" class="form-input w-full weight-input" data-key="${k}" min="0" max="100" value="${weights[k]??0}">
        <span class="text-xs text-gray-500 shrink-0">%</span>
      </div>
    </div>`).join('');
}

function _attachWeightEvents() {
  document.querySelectorAll('.weight-input').forEach(inp => {
    inp.addEventListener('input', _updateWeightSum);
  });
}

function _readWeights() {
  const w = { ...DEFAULT_WEIGHTS };
  document.querySelectorAll('.weight-input').forEach(inp => { w[inp.dataset.key] = Number(inp.value)||0; });
  return w;
}

function _updateWeightSum() {
  const el = document.getElementById('weight-sum');
  if (!el) return;
  const sum = [...document.querySelectorAll('.weight-input')].reduce((a,i) => a+(Number(i.value)||0), 0);
  const ok = Math.abs(sum-100) < 0.01;
  el.textContent = `Total: ${sum}%`;
  el.className = `text-xs font-mono px-2 py-1 rounded ${ok ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`;
}

async function _handleSubmit(bimtekId, isEdit) {
  const app   = document.getElementById('app');
  const btn   = app.querySelector('#btn-submit');
  const nama  = app.querySelector('#nama').value.trim();
  const tipe  = app.querySelector('#tipe').value;
  const mode  = app.querySelector('#mode').value;
  const kap   = Number(app.querySelector('#kapasitas').value) || null;
  const lokasi = app.querySelector('#lokasi').value.trim();
  const pm    = app.querySelector('#periode-mulai').value;
  const ps    = app.querySelector('#periode-selesai').value;
  const kkm   = Number(app.querySelector('#kkm').value) || 60;
  const ht    = app.querySelector('#has-tugas').checked;
  const hp    = app.querySelector('#has-presentasi').checked;
  const bidangIds = _readBidangIds();
  const weights   = _readWeights();

  if (!nama)             { showToast('Nama Bimtek wajib diisi', 'warning'); return; }
  if (!bidangIds.length) { showToast('Bidang wajib dipilih', 'warning'); return; }
  if (!pm || !ps)        { showToast('Periode wajib diisi', 'warning'); return; }
  if (new Date(ps) < new Date(pm)) { showToast('Tanggal selesai harus setelah mulai', 'warning'); return; }

  const wv = validateWeights(weights, ht, hp);
  if (!wv.valid) { showToast(wv.message, 'warning'); return; }

  btn.disabled = true;
  btn.textContent = 'Menyimpan…';

  try {
    const payload = {
      nama, tipe, mode, lokasi, kkm, weights,
      hasTugas: ht, hasPresentasi: hp, bidangIds,
      kapasitas: kap || (mode==='online'?25:17),
      clientInstansiId: null,
      periode: { mulai: pm, selesai: ps }
    };

    if (isEdit) {
      await updateBimtek(bimtekId, payload);
      showToast('Bimtek berhasil diperbarui', 'success');
      window.location.hash = `#/bimtek/${bimtekId}`;
    } else {
      const result = await createBimtek(payload);
      showToast('Bimtek berhasil dibuat', 'success');
      window.location.hash = `#/bimtek/${result.bimtekId}`;
    }
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = isEdit ? 'Simpan Perubahan' : 'Buat Bimtek';
  }
}

function _goBack(bimtekId) {
  if (bimtekId) window.location.hash = `#/bimtek/${bimtekId}`;
  else window.location.hash = '#/bimtek';
}

function _toInputDate(ts) {
  const d = ts?.toDate?.() ?? new Date(ts);
  return d.toISOString().split('T')[0];
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
