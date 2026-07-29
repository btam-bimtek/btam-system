// admin/js/modules/bimtek/form.js
import { setPageTitle } from '../../layout/navbar.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { navigate } from '../../router.js';
import { createBimtek, updateBimtek, getBimtek, deleteBimtek, DEFAULT_WEIGHTS, listSesi, shiftSesiPeriode, listBimtek, normalizeNama } from './api.js';
import { BIDANG_LIST, KOMPONEN_NILAI } from '../../../../shared/constants.js';

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

export async function renderBimtekForm({ id } = {}) {
  const isEdit = !!id;
  setPageTitle(isEdit ? 'Edit Bimtek' : 'Bimtek Baru');

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="flex items-center justify-center py-16">
      <div class="w-6 h-6 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  let d = null;
  if (isEdit) {
    try { d = await getBimtek(id); }
    catch (err) {
      app.innerHTML = `<div class="text-red-400 text-sm p-4">${err.message}</div>`;
      return;
    }
  }

  const weights     = d?.weights     ?? { ...DEFAULT_WEIGHTS };
  const hasTugas    = d?.hasTugas    ?? false;
  const hasPresentasi = d?.hasPresentasi ?? false;
  const tipe        = d?.tipe        ?? 'reguler';
  const activeBidang = BIDANG_LIST.filter(b => b.active);

  app.innerHTML = `
    <div class="max-w-3xl">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <button id="btn-back" class="p-1.5 rounded-lg hover:bg-[#12181c] text-gray-400 hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 class="text-lg font-bold text-white">${isEdit ? 'Edit Bimtek' : 'Bimtek Baru'}</h1>
          ${isEdit && d?.kodeBimtek ? `<p class="text-xs text-gray-500">${_esc(d.kodeBimtek)}</p>` : ''}
        </div>
        ${isEdit ? `<span class="badge badge-gray ml-auto">${_labelStatus(d?.status)}</span>` : ''}
      </div>

      <!-- Tab nav -->
      <div class="flex gap-1 mb-6 border-b border-gray-800">
        <button class="tab-btn px-4 py-2 text-sm font-medium text-[#2dd4bf] border-b-2 border-[#2dd4bf]" data-tab="info">Informasi</button>
        <button class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent" data-tab="weights">Bobot Nilai</button>
      </div>

      <!-- Tab: Informasi -->
      <div id="tab-info">
        <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
          <h2 class="text-sm font-semibold text-gray-300 mb-4">Informasi Dasar</h2>
          <div class="space-y-4">

            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Nama Bimtek <span class="text-red-400">*</span></label>
              <input type="text" id="nama" class="form-input w-full" maxlength="200"
                value="${_esc(d?.nama ?? '')}"
                placeholder="cth: Bimtek Operator IPA Lanjutan Batch 3">
              <div id="nama-similar-warning" class="hidden mt-2 p-3 rounded-lg bg-yellow-900/30 border border-yellow-700/50 text-xs text-yellow-300"></div>
            </div>

            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Deskripsi / Materi</label>
              <textarea id="deskripsi" class="form-input w-full" rows="4"
                placeholder="Ringkasan materi, tujuan pelatihan, atau kompetensi yang dicapai peserta…">${_esc(d?.deskripsi ?? '')}</textarea>
              <p class="text-xs text-gray-600 mt-1">Ditampilkan ke calon peserta di halaman pendaftaran publik.</p>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">Tipe <span class="text-red-400">*</span></label>
                <select id="tipe" class="form-select w-full">
                  <option value="reguler" ${tipe === 'reguler' ? 'selected' : ''}>Reguler</option>
                  <option value="pnbp"    ${tipe === 'pnbp'    ? 'selected' : ''}>PNBP</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">Mode <span class="text-red-400">*</span></label>
                <select id="mode" class="form-select w-full">
                  <option value="offline" ${d?.mode === 'offline' ? 'selected' : ''}>Offline (maks 17)</option>
                  <option value="online"  ${d?.mode === 'online'  ? 'selected' : ''}>Online (maks 25)</option>
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
              <p class="text-xs text-gray-500 mt-1">Reguler: 1 bidang. PNBP: bisa multi.</p>
            </div>

          </div>
        </div>

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

        <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
          <h2 class="text-sm font-semibold text-gray-300 mb-4">Konfigurasi Penilaian</h2>
          <p class="text-xs text-gray-500 mb-4">
            Kriteria kelulusan memakai kategori nilai baku: Sangat Baik (≥86), Baik (71-85),
            Cukup (61-70) dinyatakan Lulus; Kurang (51-60), Sangat Kurang (≤50) Tidak Lulus.
          </p>
          <div class="flex items-start gap-8">
            <div class="space-y-2">
              <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                <input type="checkbox" id="has-tugas" class="w-4 h-4 rounded" ${hasTugas ? 'checked' : ''}>
                Komponen Tugas aktif
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                <input type="checkbox" id="has-presentasi" class="w-4 h-4 rounded" ${hasPresentasi ? 'checked' : ''}>
                Komponen Presentasi aktif
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Bobot -->
      <div id="tab-weights" class="hidden">
        <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
          <div class="flex items-center justify-between mb-1">
            <h2 class="text-sm font-semibold text-gray-300">Bobot Penilaian</h2>
            <div class="flex items-center gap-3">
              <span id="weight-sum" class="text-xs font-mono px-2 py-1 rounded bg-gray-800 text-gray-300"></span>
              <button type="button" id="btn-reset-weights" class="text-xs text-gray-400 hover:text-white transition-colors">Reset Default</button>
            </div>
          </div>
          <p class="text-xs text-gray-500 mb-4">Total bobot komponen aktif harus = <span class="text-white font-mono">100</span>. Bobot tugas/presentasi yang tidak aktif dialihkan ke Nilai Pengajar.</p>
          <div id="weights-grid" class="grid grid-cols-4 gap-3">
            ${_buildWeightInputs(weights, hasTugas, hasPresentasi)}
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-2">
        <button id="btn-submit" class="px-4 py-2 rounded-lg text-sm bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] font-medium transition-colors">
          ${isEdit ? 'Simpan Perubahan' : 'Buat Bimtek'}
        </button>
        <button id="btn-cancel" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-[#12181c] transition-colors">Batal</button>
        ${isEdit && ['draft','planned'].includes(d?.status) ? `
          <button id="btn-delete" class="ml-auto px-4 py-2 rounded-lg text-sm bg-red-900/50 hover:bg-red-900 text-red-300 transition-colors">Hapus Bimtek</button>
        ` : ''}
      </div>
      <div id="form-error" class="hidden mt-3 text-red-400 text-sm bg-red-900/30 rounded p-3"></div>
    </div>
  `;

  _updateWeightSum();

  // ── Tab navigation ──
  app.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      app.querySelectorAll('.tab-btn').forEach(b => {
        b.className = 'tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent';
      });
      btn.className = 'tab-btn px-4 py-2 text-sm font-medium text-[#2dd4bf] border-b-2 border-[#2dd4bf]';
      app.querySelector('#tab-info').classList.toggle('hidden', btn.dataset.tab !== 'info');
      app.querySelector('#tab-weights').classList.toggle('hidden', btn.dataset.tab !== 'weights');
    });
  });

  // ── Navigasi ──
  app.querySelector('#btn-back').addEventListener('click', () => _goBack(id));
  app.querySelector('#btn-cancel').addEventListener('click', () => _goBack(id));

  // ── Tipe → update bidang field ──
  app.querySelector('#tipe').addEventListener('change', e => {
    app.querySelector('#bidang-field').innerHTML = _buildBidangField(activeBidang, e.target.value, []);
  });

  // ── Toggle tugas/presentasi → redistribute bobot ──
  let currentWeights = { ...weights };
  ['has-tugas', 'has-presentasi'].forEach(cid => {
    app.querySelector(`#${cid}`).addEventListener('change', () => {
      const ht = app.querySelector('#has-tugas').checked;
      const hp = app.querySelector('#has-presentasi').checked;
      // Baca bobot terkini kalau tab weights sedang terbuka
      if (!app.querySelector('#tab-weights').classList.contains('hidden')) {
        currentWeights = _readWeights();
      }
      app.querySelector('#weights-grid').innerHTML = _buildWeightInputs(currentWeights, ht, hp);
      _attachWeightEvents();
      _updateWeightSum();
    });
  });

  // ── Weight events ──
  _attachWeightEvents();
  app.querySelector('#btn-reset-weights').addEventListener('click', () => {
    const ht = app.querySelector('#has-tugas').checked;
    const hp = app.querySelector('#has-presentasi').checked;
    currentWeights = { ...DEFAULT_WEIGHTS };
    app.querySelector('#weights-grid').innerHTML = _buildWeightInputs(currentWeights, ht, hp);
    _attachWeightEvents();
    _updateWeightSum();
  });

  // ── Fuzzy warning nama mirip ──
  _initNamaFuzzyWarning(app, id);

  // ── Submit ──
  app.querySelector('#btn-submit').addEventListener('click', () => _handleSubmit(app, id, isEdit, d));

  // ── Delete ──
  app.querySelector('#btn-delete')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Hapus Bimtek', message: 'Hapus Bimtek ini? Tindakan tidak bisa dibatalkan.', danger: true });
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

// ─── BUILD BIDANG FIELD ───────────────────────────────────────────────────────

function _buildBidangField(activeBidang, tipe, currentIds) {
  if (tipe === 'reguler') {
    return `
      <select id="bidang-single" class="form-select w-full">
        <option value="">— Pilih bidang —</option>
        ${activeBidang.map(b =>
          `<option value="${b.bidangId}" ${currentIds[0] === b.bidangId ? 'selected' : ''}>${_esc(b.nama)}</option>`
        ).join('')}
      </select>`;
  }
  return `
    <div class="flex flex-wrap gap-4">
      ${activeBidang.map(b => `
        <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
          <input type="checkbox" class="bidang-check w-4 h-4 rounded" value="${b.bidangId}" ${currentIds.includes(b.bidangId) ? 'checked' : ''}>
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

// ─── BUILD WEIGHT INPUTS ──────────────────────────────────────────────────────

const WEIGHT_LABELS = {
  pretest: 'Pre-Test', posttest: 'Post-Test', pengajar: 'Nilai Pengajar',
  kehadiran: 'Kehadiran', keaktifan: 'Keaktifan', respek: 'Respek & Etika',
  tugas: 'Tugas', presentasi: 'Presentasi',
};

function _buildWeightInputs(weights, hasTugas, hasPresentasi) {
  const keys = ['pretest', 'posttest', 'pengajar', 'kehadiran', 'keaktifan', 'respek'];
  if (hasTugas) keys.push('tugas');
  if (hasPresentasi) keys.push('presentasi');

  // Redistribute bobot komponen tidak aktif ke pengajar
  const display = { ...weights };
  if (!hasTugas)      display.pengajar = (display.pengajar || 0) + (weights.tugas || 0);
  if (!hasPresentasi) display.pengajar = (display.pengajar || 0) + (weights.presentasi || 0);

  return keys.map(k => `
    <div>
      <label class="block text-xs text-gray-400 mb-1.5">${WEIGHT_LABELS[k]}</label>
      <div class="flex items-center gap-1">
        <input type="number" class="form-input w-full weight-input" data-key="${k}" min="0" max="100"
          value="${Math.round((display[k] ?? 0) * 100)}">
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
  const w = {};
  document.querySelectorAll('.weight-input').forEach(inp => {
    w[inp.dataset.key] = (Number(inp.value) || 0) / 100;
  });
  return w;
}

function _updateWeightSum() {
  const el = document.getElementById('weight-sum');
  if (!el) return;
  const sum = [...document.querySelectorAll('.weight-input')].reduce((a, i) => a + (Number(i.value) || 0), 0);
  const ok = Math.abs(sum - 100) < 0.01;
  el.textContent = `Total: ${sum}%`;
  el.className = `text-xs font-mono px-2 py-1 rounded ${ok ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`;
}

// ─── HANDLE SUBMIT ────────────────────────────────────────────────────────────

async function _handleSubmit(app, bimtekId, isEdit, oldData) {
  const errEl = app.querySelector('#form-error');
  const btn   = app.querySelector('#btn-submit');
  errEl.classList.add('hidden');

  const nama     = app.querySelector('#nama').value.trim();
  const deskripsi = app.querySelector('#deskripsi').value.trim();
  const tipe     = app.querySelector('#tipe').value;
  const mode     = app.querySelector('#mode').value;
  const kap      = Number(app.querySelector('#kapasitas').value) || null;
  const lokasi   = app.querySelector('#lokasi').value.trim();
  const pm       = app.querySelector('#periode-mulai').value;
  const ps       = app.querySelector('#periode-selesai').value;
  const ht       = app.querySelector('#has-tugas').checked;
  const hp       = app.querySelector('#has-presentasi').checked;
  const bidangIds = _readBidangIds();
  const weights  = _readWeights();

  // Validasi
  const errors = [];
  if (!nama)              errors.push('Nama wajib diisi');
  if (!tipe)              errors.push('Tipe wajib dipilih');
  if (!mode)              errors.push('Mode wajib dipilih');
  if (!bidangIds.length)  errors.push('Bidang wajib dipilih');
  if (!pm || !ps)         errors.push('Periode wajib diisi');
  if (pm && ps && pm > ps) errors.push('Tanggal selesai harus setelah mulai');

  const wSum = Object.values(weights).reduce((s, v) => s + v, 0);
  if (Math.abs(Math.round(wSum * 100) - 100) > 1) errors.push(`Total bobot harus 100% (sekarang ${Math.round(wSum * 100)}%)`);

  if (errors.length > 0) {
    errEl.textContent = errors.join(' · ');
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Menyimpan…';

  try {
    const payload = {
      nama, deskripsi, tipe, mode, lokasi, weights,
      hasTugas: ht, hasPresentasi: hp, bidangIds,
      kapasitas: kap || (mode === 'online' ? 25 : 17),
      periode: { mulai: pm, selesai: ps },
    };

    if (isEdit) {
      // ── Deteksi perubahan periode & shift sesi ────────────────────────────
      const oldMulai   = oldData?.periode?.mulai;   // YYYY-MM-DD string
      const oldSelesai = oldData?.periode?.selesai;

      if (oldMulai && oldMulai !== pm) {
        const selisihHari = Math.round(
          (new Date(pm) - new Date(oldMulai)) / (1000 * 60 * 60 * 24)
        );

        if (selisihHari !== 0) {
          const sesis = await listSesi(bimtekId);

          if (sesis.length > 0) {
            // Shift semua sesi
            await shiftSesiPeriode(bimtekId, sesis, selisihHari);

            // Kumpulkan warnings
            const warnings = [];

            // Cek hari Jumat dengan JP > 6 setelah shift
            const jpPerHari = {};
            for (const s of sesis) {
              if (!s.jp || s.tipe === 'break' || s.tipe === 'ishoma') continue;
              const tglLama = s.tanggal?.toDate?.() ?? new Date(s.tanggal);
              const tglBaru = new Date(tglLama);
              tglBaru.setDate(tglBaru.getDate() + selisihHari);
              const tglStr = tglBaru.toISOString().split('T')[0];
              jpPerHari[tglStr] = (jpPerHari[tglStr] || 0) + (s.jp || 0);
            }
            for (const [tgl, jp] of Object.entries(jpPerHari)) {
              if (new Date(tgl).getDay() === 5 && jp > 6) {
                warnings.push(`⚠️ ${tgl} jadi hari Jumat dengan ${jp} JP (maks 6 JP)`);
              }
            }

            // Cek periode diperpendek
            if (oldSelesai) {
              const newEnd  = new Date(ps);
              const oldEnd  = new Date(oldSelesai);
              const shiftedOldEnd = new Date(oldEnd);
              shiftedOldEnd.setDate(shiftedOldEnd.getDate() + selisihHari);
              if (newEnd < shiftedOldEnd) {
                const selisihPotong = Math.round((shiftedOldEnd - newEnd) / (1000 * 60 * 60 * 24));
                warnings.push(`⚠️ Periode diperpendek ${selisihPotong} hari — cek sesi di akhir jadwal`);
              } else if (newEnd > shiftedOldEnd) {
                const selisihTambah = Math.round((newEnd - shiftedOldEnd) / (1000 * 60 * 60 * 24));
                warnings.push(`ℹ️ Periode bertambah ${selisihTambah} hari — jangan lupa inisialisasi hari baru`);
              }
            }

            if (warnings.length > 0) {
              showToast(warnings.join('\n'), 'warning', 8000);
            }
          }
        }
      } else if (oldSelesai && oldSelesai !== ps) {
        // Tanggal mulai sama, tapi selesai berubah
        const newEnd  = new Date(ps);
        const oldEnd  = new Date(oldSelesai);
        if (newEnd < oldEnd) {
          const selisih = Math.round((oldEnd - newEnd) / (1000 * 60 * 60 * 24));
          showToast(`⚠️ Periode diperpendek ${selisih} hari — cek sesi di akhir jadwal`, 'warning', 6000);
        } else {
          const selisih = Math.round((newEnd - oldEnd) / (1000 * 60 * 60 * 24));
          showToast(`ℹ️ Periode bertambah ${selisih} hari — jangan lupa inisialisasi hari baru`, 'info', 6000);
        }
      }

      await updateBimtek(bimtekId, payload);
      showToast('Bimtek berhasil diperbarui', 'success');
      navigate(`/bimtek/${bimtekId}`);
    } else {
      const newId = await createBimtek(payload);
      showToast('Bimtek berhasil dibuat', 'success');
      navigate(`/bimtek/${newId}`);
    }
  } catch (err) {
    errEl.textContent = 'Gagal: ' + err.message;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = isEdit ? 'Simpan Perubahan' : 'Buat Bimtek';
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function _goBack(bimtekId) {
  if (bimtekId) navigate(`/bimtek/${bimtekId}`);
  else navigate('/bimtek');
}

function _labelStatus(s) {
  return { draft:'Draft', planned:'Direncanakan', ongoing:'Berlangsung', completed:'Selesai', cancelled:'Dibatalkan' }[s] || s;
}

function _toInputDate(ts) {
  const d = ts?.toDate?.() ?? new Date(ts);
  return d.toISOString().split('T')[0];
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── FUZZY NAMA WARNING ───────────────────────────────────────────────────────

function _levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = [];
  for (let i = 0; i <= m; i++) { dp[i] = [i]; }
  for (let j = 0; j <= n; j++) { dp[0][j] = j; }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function _isSimilar(a, b) {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen < 6) return false; // nama terlalu pendek, skip
  const dist = _levenshtein(a, b);
  // Mirip jika < 15% karakter berbeda
  return dist / maxLen < 0.15;
}

async function _initNamaFuzzyWarning(app, currentBimtekId) {
  // Fetch semua nama bimtek di background — tidak blocking
  let existingNames = [];
  try {
    const all = await listBimtek();
    existingNames = all
      .filter(b => b.id !== currentBimtekId) // exclude diri sendiri saat edit
      .map(b => ({ key: b.namaKey || normalizeNama(b.nama), display: b.nama }))
      .filter(b => b.key);
  } catch { return; }

  const input   = app.querySelector('#nama');
  const warnEl  = app.querySelector('#nama-similar-warning');
  if (!input || !warnEl) return;

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const typed = normalizeNama(input.value);
      if (!typed || typed.length < 6) { warnEl.classList.add('hidden'); return; }

      const matches = existingNames.filter(b => _isSimilar(typed, b.key) && typed !== b.key);
      if (matches.length === 0) { warnEl.classList.add('hidden'); return; }

      const list = matches.map(b => `"${_esc(b.display)}"`).join(', ');
      warnEl.innerHTML = `⚠ Nama ini mirip dengan bimtek yang sudah ada: ${list}. Pastikan ini bukan duplikat.`;
      warnEl.classList.remove('hidden');
    }, 400);
  });
}
