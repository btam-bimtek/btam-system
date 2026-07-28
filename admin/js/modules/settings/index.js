// admin/js/modules/settings/index.js
// Halaman Pengaturan — sub-tab: Info Lembaga, Bobot Bloom, Threshold, Logo, Audit Log.

import { setPageTitle } from '../../layout/navbar.js';
import { showToast } from '../../components/toast.js';
import { loadAllSettings, saveAppSetting, getAppSetting, uploadLogo, uploadCertBg, listAuditLog } from './api.js';
import { BLOOM_LEVELS } from '../../../../shared/constants.js';
import { deleteField } from '../../../../shared/db.js';

const DEFAULT_BLOOM = { C1: 1, C2: 2, C3: 3, C4: 4, C5: 5, C6: 6 };
const DEFAULT_THRESHOLDS = { kkm: 60, kehadiranMin: 80 };

let S = {
  tab:         'lembaga',
  settings:    { lembaga: null, bloomBobot: null, thresholds: null, targetTahunan: null },
  auditLog:    [],
  auditFilter: { action: '', entityType: '' }
};

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────

export async function renderSettings() {
  setPageTitle('Pengaturan');
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="max-w-3xl">
      <h1 class="text-lg font-bold text-white mb-6">Pengaturan Sistem</h1>

      <!-- Tab bar -->
      <div class="flex gap-1 mb-6 border-b border-gray-800 flex-wrap">
        ${_tabBtn('lembaga',   'Info Lembaga')}
        ${_tabBtn('bloom',     'Bobot Bloom')}
        ${_tabBtn('threshold', 'Threshold')}
        ${_tabBtn('logo',      'Logo')}
        ${_tabBtn('auditlog',  'Audit Log')}
      </div>

      <!-- Loading -->
      <div id="settings-content">
        <div class="flex items-center gap-3 py-12 justify-center">
          <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-gray-400 text-sm">Memuat pengaturan…</span>
        </div>
      </div>
    </div>`;

  app.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.tab = btn.dataset.tab;
      app.querySelectorAll('.settings-tab-btn').forEach(b => _setTabActive(b, b.dataset.tab === S.tab));
      _renderTab(app.querySelector('#settings-content'));
    });
  });

  try {
    S.settings = await loadAllSettings();
    S.settings.targetTahunan = await getAppSetting('target_tahunan');
    _renderTab(app.querySelector('#settings-content'));
  } catch (err) {
    app.querySelector('#settings-content').innerHTML =
      `<div class="text-red-400 text-sm p-4">Gagal memuat: ${err.message}</div>`;
  }
}

function _tabBtn(id, label) {
  const active = S.tab === id;
  return `<button class="settings-tab-btn px-4 py-2 text-sm font-medium border-b-2 transition-colors
    ${active ? 'text-blue-400 border-blue-400' : 'text-gray-400 border-transparent hover:text-gray-200'}"
    data-tab="${id}">${label}</button>`;
}

function _setTabActive(btn, active) {
  btn.className = `settings-tab-btn px-4 py-2 text-sm font-medium border-b-2 transition-colors
    ${active ? 'text-blue-400 border-blue-400' : 'text-gray-400 border-transparent hover:text-gray-200'}`;
}

function _renderTab(container) {
  if (!container) return;
  if (S.tab === 'lembaga')   { _renderLembaga(container);   return; }
  if (S.tab === 'bloom')     { _renderBloom(container);     return; }
  if (S.tab === 'threshold') { _renderThreshold(container); return; }
  if (S.tab === 'logo')      { _renderLogo(container);      return; }
  if (S.tab === 'auditlog')  { _renderAuditLog(container);  return; }
}

// ─── TAB: INFO LEMBAGA ────────────────────────────────────────────────────────

function _renderLembaga(container) {
  const d = S.settings.lembaga ?? {};

  container.innerHTML = `
    <form id="form-lembaga" class="space-y-5">
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
        <h2 class="text-sm font-semibold text-white mb-2">Informasi Lembaga</h2>

        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Nama Lembaga</label>
          <input name="nama" class="form-input" placeholder="SI-SABAT"
                 value="${_esc(d.nama ?? '')}" />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Alamat</label>
          <textarea name="alamat" class="form-textarea" rows="2"
                    placeholder="Jl. ...">${_esc(d.alamat ?? '')}</textarea>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Website</label>
            <input name="website" class="form-input" placeholder="www.btam.go.id"
                   value="${_esc(d.website ?? '')}" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
            <input name="email" type="email" class="form-input" placeholder="info@btam.go.id"
                   value="${_esc(d.email ?? '')}" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Telepon</label>
          <input name="phone" class="form-input" placeholder="021-..."
                 value="${_esc(d.phone ?? '')}" />
        </div>
      </div>

      <div class="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
        <h2 class="text-sm font-semibold text-white mb-2">Penanda Tangan Sertifikat</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Kota Penandatanganan</label>
            <input name="kota" class="form-input" placeholder="Jakarta"
                   value="${_esc(d.kota ?? '')}" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Nama Penanda Tangan</label>
            <input name="penandaTangan" class="form-input" placeholder="Nama lengkap"
                   value="${_esc(d.penandaTangan ?? '')}" />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Jabatan Penanda Tangan</label>
            <input name="jabatanPenandaTangan" class="form-input"
                   placeholder="Direktur Bina Teknik Bangunan Gedung dan Penyehatan Lingkungan"
                   value="${_esc(d.jabatanPenandaTangan ?? '')}" />
          </div>
        </div>
      </div>

      <div class="flex justify-end">
        <button type="submit" class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
          Simpan
        </button>
      </div>
    </form>`;

  container.querySelector('#form-lembaga').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';
    try {
      await saveAppSetting('lembaga', {
        nama:                  data.nama.trim(),
        alamat:                data.alamat.trim(),
        website:               data.website.trim(),
        email:                 data.email.trim(),
        phone:                 data.phone.trim(),
        kota:                  data.kota.trim(),
        penandaTangan:         data.penandaTangan.trim(),
        jabatanPenandaTangan:  data.jabatanPenandaTangan.trim()
      });
      S.settings.lembaga = { ...(S.settings.lembaga ?? {}), ...data };
      showToast('Info lembaga disimpan', 'success');
    } catch (err) {
      showToast('Gagal simpan: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  });
}

// ─── TAB: BOBOT BLOOM ─────────────────────────────────────────────────────────

function _renderBloom(container) {
  const d = S.settings.bloomBobot ?? DEFAULT_BLOOM;

  const inputs = BLOOM_LEVELS.map(b => `
    <div class="flex items-center gap-4">
      <div class="w-24 shrink-0">
        <span class="badge badge-blue text-sm">${b.level}</span>
        <span class="text-xs text-gray-400 ml-2">${b.nama}</span>
      </div>
      <input name="${b.level}" type="number" min="1" max="10" step="1"
             class="form-input w-24 text-center"
             value="${d[b.level] ?? b.defaultBobot}" />
    </div>`).join('');

  container.innerHTML = `
    <form id="form-bloom" class="space-y-5">
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 class="text-sm font-semibold text-white mb-1">Bobot Taksonomi Bloom</h2>
        <p class="text-xs text-gray-500 mb-5">
          Bobot menentukan kontribusi setiap soal dalam scoring ujian.
          Berlaku untuk scoring berikutnya setelah disimpan.
        </p>
        <div class="space-y-3">${inputs}</div>
      </div>

      <div class="flex items-center justify-between">
        <button type="button" id="btn-reset-bloom"
          class="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          Reset ke default (1-6)
        </button>
        <button type="submit"
          class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
          Simpan
        </button>
      </div>
    </form>`;

  container.querySelector('#btn-reset-bloom').addEventListener('click', () => {
    BLOOM_LEVELS.forEach(b => {
      const input = container.querySelector(`[name="${b.level}"]`);
      if (input) input.value = b.defaultBobot;
    });
  });

  container.querySelector('#form-bloom').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    let valid = true;
    BLOOM_LEVELS.forEach(b => {
      const val = parseInt(fd.get(b.level), 10);
      if (isNaN(val) || val < 1 || val > 10) { valid = false; return; }
      data[b.level] = val;
    });
    if (!valid) { showToast('Bobot harus antara 1-10', 'error'); return; }

    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';
    try {
      await saveAppSetting('bloom_bobot', data);
      S.settings.bloomBobot = data;
      showToast('Bobot Bloom disimpan', 'success');
    } catch (err) {
      showToast('Gagal simpan: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  });
}

// ─── TAB: THRESHOLD DEFAULT ───────────────────────────────────────────────────

function _renderThreshold(container) {
  const d        = S.settings.thresholds ?? DEFAULT_THRESHOLDS;
  const thisYear = new Date().getFullYear();
  // getAppSetting() menyisipkan field 'id'/'updatedAt' ke doc yang sama dengan data
  // tahun — saring supaya cuma key tahun (angka) yang dipakai sebagai target map.
  const targetMap = Object.fromEntries(
    Object.entries(S.settings.targetTahunan ?? {}).filter(([k]) => /^\d+$/.test(k))
  );

  // Rentang tahun yang bisa dipilih: 1 tahun lalu s.d. 2 tahun ke depan,
  // ditambah tahun mana pun yang sudah punya target tersimpan (agar tidak hilang dari daftar).
  const yearOptions = [...new Set([
    thisYear - 1, thisYear, thisYear + 1, thisYear + 2,
    ...Object.keys(targetMap).map(Number),
  ])].sort((a, b) => a - b);

  container.innerHTML = `
    <form id="form-threshold" class="space-y-5">
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
        <h2 class="text-sm font-semibold text-white mb-2">Threshold Default</h2>
        <p class="text-xs text-gray-500 -mt-2 mb-4">
          Nilai default yang dipakai saat membuat bimtek baru.
          Bimtek yang sudah ada tidak terpengaruh.
        </p>

        <div class="grid grid-cols-2 gap-6">
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">
              KKM (Nilai Minimum Kelulusan)
            </label>
            <input name="kkm" type="number" min="0" max="100" class="form-input"
                   value="${d.kkm ?? 60}" />
            <p class="text-xs text-gray-600 mt-1">Range: 0 – 100</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">
              Kehadiran Minimum (%)
            </label>
            <input name="kehadiranMin" type="number" min="0" max="100" class="form-input"
                   value="${d.kehadiranMin ?? 80}" />
            <p class="text-xs text-gray-600 mt-1">Syarat ikut post test</p>
          </div>
        </div>
      </div>

      <div class="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
        <h2 class="text-sm font-semibold text-white mb-2">Target Peserta per Tahun</h2>
        <p class="text-xs text-gray-500 -mt-2 mb-4">
          Dipakai sebagai pembanding realisasi peserta di Dashboard. Pilih tahun untuk melihat/mengubah targetnya.
        </p>
        <div class="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Tahun</label>
            <select name="targetYear" id="sel-target-year" class="form-input">
              ${yearOptions.map(yr => `<option value="${yr}" ${yr === thisYear ? 'selected' : ''}>${yr}${yr === thisYear ? ' (berjalan)' : ''}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Target Peserta</label>
            <input name="targetValue" id="inp-target-value" type="number" min="0" class="form-input"
                   value="${targetMap[thisYear] ?? ''}" placeholder="Misal: 500">
          </div>
        </div>
        <p class="text-xs text-gray-600">Kosongkan lalu simpan untuk menghapus target tahun tersebut.</p>
      </div>

      <div class="flex justify-end">
        <button type="submit"
          class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
          Simpan
        </button>
      </div>
    </form>`;

  // Ganti tahun -> tampilkan target tahun itu tanpa render ulang seluruh form
  container.querySelector('#sel-target-year')?.addEventListener('change', e => {
    const yr = Number(e.target.value);
    container.querySelector('#inp-target-value').value = targetMap[yr] ?? '';
  });

  container.querySelector('#form-threshold').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const kkm = parseInt(fd.get('kkm'), 10);
    const kehadiranMin = parseInt(fd.get('kehadiranMin'), 10);
    const targetYear = Number(fd.get('targetYear'));
    const targetRaw  = fd.get('targetValue');
    const target = targetRaw === '' ? null : parseInt(targetRaw, 10);

    if (isNaN(kkm) || kkm < 0 || kkm > 100) { showToast('KKM harus 0-100', 'error'); return; }
    if (isNaN(kehadiranMin) || kehadiranMin < 0 || kehadiranMin > 100) { showToast('Kehadiran min harus 0-100', 'error'); return; }
    if (target !== null && (isNaN(target) || target < 0)) { showToast('Target peserta harus angka positif', 'error'); return; }

    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';
    try {
      await saveAppSetting('thresholds', { kkm, kehadiranMin });
      S.settings.thresholds = { kkm, kehadiranMin };

      // saveAppSetting pakai setDoc(..., {merge:true}) — menghapus key dari objek JS lalu
      // merge-save TIDAK menghapusnya di Firestore. Pakai deleteField() sentinel untuk itu.
      const payload = { ...targetMap };
      const localMap = { ...targetMap };
      if (target === null) { payload[targetYear] = deleteField(); delete localMap[targetYear]; }
      else { payload[targetYear] = target; localMap[targetYear] = target; }
      await saveAppSetting('target_tahunan', payload);
      S.settings.targetTahunan = localMap;

      showToast('Threshold disimpan', 'success');
    } catch (err) {
      showToast('Gagal simpan: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  });
}

// ─── TAB: LOGO ────────────────────────────────────────────────────────────────

function _renderLogo(container) {
  const currentUrl    = S.settings.lembaga?.logoUrl    ?? null;
  const currentBgUrl  = S.settings.lembaga?.certBgUrl  ?? null;

  container.innerHTML = `
    <div class="space-y-5">
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 class="text-sm font-semibold text-white mb-1">Logo Lembaga</h2>
        <p class="text-xs text-gray-500 mb-5">
          Digunakan sebagai kop surat di laporan peserta. Format: PNG/JPG/SVG. Maks 2 MB.
        </p>

        <!-- Current logo preview -->
        <div id="logo-preview" class="mb-5">
          ${currentUrl
            ? `<div class="flex items-center gap-4">
                 <img src="${_esc(currentUrl)}" alt="Logo" class="h-16 object-contain rounded-lg border border-gray-700 bg-white p-1" />
                 <span class="text-xs text-green-400">Logo aktif</span>
               </div>`
            : `<div class="text-xs text-gray-500 italic">Belum ada logo. Kop surat menggunakan inisial teks.</div>`
          }
        </div>

        <!-- Upload form -->
        <label class="block">
          <span class="text-xs font-medium text-gray-400 mb-1.5 block">Upload Logo Baru</span>
          <input id="logo-file" type="file" accept="image/png,image/jpeg,image/svg+xml"
                 class="block text-sm text-gray-400
                        file:mr-4 file:py-1.5 file:px-3
                        file:rounded-lg file:border-0
                        file:text-sm file:font-medium
                        file:bg-gray-700 file:text-white
                        hover:file:bg-gray-600 cursor-pointer" />
        </label>

        <div id="logo-upload-preview" class="hidden mt-4">
          <img id="logo-new-preview" src="" alt="Preview" class="h-16 object-contain rounded-lg border border-gray-700 bg-white p-1" />
          <p class="text-xs text-gray-500 mt-1">Preview — klik Simpan untuk mengupload</p>
        </div>

        <div class="mt-4">
          <button id="btn-upload-logo" disabled
            class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Upload & Simpan
          </button>
        </div>
      </div>

      <!-- Background Sertifikat -->
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 class="text-sm font-semibold text-white mb-1">Background Sertifikat</h2>
        <p class="text-xs text-gray-500 mb-5">
          Gambar latar sertifikat (PNG, landscape A4). Ekspor dari Canva tanpa teks agar teks dinamis bisa di-overlay.
          Format: PNG/JPG. Maks 5 MB.
        </p>

        <div id="cert-bg-preview" class="mb-5">
          ${currentBgUrl
            ? `<div class="flex items-center gap-4">
                 <img src="${_esc(currentBgUrl)}" alt="Background" class="h-24 object-contain rounded-lg border border-gray-700 bg-white p-1" />
                 <span class="text-xs text-green-400">Background aktif</span>
               </div>`
            : `<div class="text-xs text-gray-500 italic">Belum ada background. Sertifikat menggunakan desain CSS bawaan.</div>`
          }
        </div>

        <label class="block">
          <span class="text-xs font-medium text-gray-400 mb-1.5 block">Upload Background Baru</span>
          <input id="cert-bg-file" type="file" accept="image/png,image/jpeg"
                 class="block text-sm text-gray-400
                        file:mr-4 file:py-1.5 file:px-3
                        file:rounded-lg file:border-0
                        file:text-sm file:font-medium
                        file:bg-gray-700 file:text-white
                        hover:file:bg-gray-600 cursor-pointer" />
        </label>

        <div id="cert-bg-upload-preview" class="hidden mt-4">
          <img id="cert-bg-new-preview" src="" alt="Preview" class="h-24 object-contain rounded-lg border border-gray-700 bg-white p-1" />
          <p class="text-xs text-gray-500 mt-1">Preview — klik Simpan untuk mengupload</p>
        </div>

        <div class="mt-4">
          <button id="btn-upload-cert-bg" disabled
            class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Upload & Simpan
          </button>
        </div>
      </div>
    </div>`;

  const fileInput = container.querySelector('#logo-file');
  const uploadBtn = container.querySelector('#btn-upload-logo');
  const previewDiv = container.querySelector('#logo-upload-preview');
  const previewImg = container.querySelector('#logo-new-preview');

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) { uploadBtn.disabled = true; previewDiv.classList.add('hidden'); return; }
    if (file.size > 2 * 1024 * 1024) {
      showToast('File terlalu besar. Maks 2 MB.', 'error');
      fileInput.value = '';
      uploadBtn.disabled = true;
      previewDiv.classList.add('hidden');
      return;
    }
    previewImg.src = URL.createObjectURL(file);
    previewDiv.classList.remove('hidden');
    uploadBtn.disabled = false;
  });

  uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Mengupload…';
    try {
      const url = await uploadLogo(file);
      S.settings.lembaga = { ...(S.settings.lembaga ?? {}), logoUrl: url };
      showToast('Logo berhasil diupload', 'success');
      // Refresh logo preview
      container.querySelector('#logo-preview').innerHTML = `
        <div class="flex items-center gap-4">
          <img src="${_esc(url)}" alt="Logo" class="h-16 object-contain rounded-lg border border-gray-700 bg-white p-1" />
          <span class="text-xs text-green-400">Logo aktif</span>
        </div>`;
      previewDiv.classList.add('hidden');
      fileInput.value = '';
    } catch (err) {
      showToast('Gagal upload: ' + err.message, 'error');
    } finally {
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Upload & Simpan';
    }
  });

  // ── Background Sertifikat ──
  const bgFileInput = container.querySelector('#cert-bg-file');
  const bgUploadBtn = container.querySelector('#btn-upload-cert-bg');
  const bgPreviewDiv = container.querySelector('#cert-bg-upload-preview');
  const bgPreviewImg = container.querySelector('#cert-bg-new-preview');

  bgFileInput.addEventListener('change', () => {
    const file = bgFileInput.files[0];
    if (!file) { bgUploadBtn.disabled = true; bgPreviewDiv.classList.add('hidden'); return; }
    if (file.size > 5 * 1024 * 1024) {
      showToast('File terlalu besar. Maks 5 MB.', 'error');
      bgFileInput.value = '';
      bgUploadBtn.disabled = true;
      bgPreviewDiv.classList.add('hidden');
      return;
    }
    bgPreviewImg.src = URL.createObjectURL(file);
    bgPreviewDiv.classList.remove('hidden');
    bgUploadBtn.disabled = false;
  });

  bgUploadBtn.addEventListener('click', async () => {
    const file = bgFileInput.files[0];
    if (!file) return;
    bgUploadBtn.disabled = true;
    bgUploadBtn.textContent = 'Mengupload…';
    try {
      const url = await uploadCertBg(file);
      S.settings.lembaga = { ...(S.settings.lembaga ?? {}), certBgUrl: url };
      showToast('Background sertifikat berhasil diupload', 'success');
      container.querySelector('#cert-bg-preview').innerHTML = `
        <div class="flex items-center gap-4">
          <img src="${_esc(url)}" alt="Background" class="h-24 object-contain rounded-lg border border-gray-700 bg-white p-1" />
          <span class="text-xs text-green-400">Background aktif</span>
        </div>`;
      bgPreviewDiv.classList.add('hidden');
      bgFileInput.value = '';
    } catch (err) {
      showToast('Gagal upload: ' + err.message, 'error');
    } finally {
      bgUploadBtn.disabled = true;
      bgUploadBtn.textContent = 'Upload & Simpan';
    }
  });
}

// ─── TAB: AUDIT LOG ───────────────────────────────────────────────────────────

async function _renderAuditLog(container) {
  container.innerHTML = `
    <div class="flex items-center gap-3 py-12 justify-center">
      <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-gray-400 text-sm">Memuat audit log…</span>
    </div>`;

  try {
    if (!S.auditLog.length) {
      S.auditLog = await listAuditLog(150);
    }
    _renderAuditLogTable(container);
  } catch (err) {
    container.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat: ${err.message}</div>`;
  }
}

function _renderAuditLogTable(container) {
  const { action: filterAction, entityType: filterEntity } = S.auditFilter;

  const filtered = S.auditLog.filter(entry => {
    if (filterAction && !entry.action?.includes(filterAction)) return false;
    if (filterEntity && entry.entityType !== filterEntity) return false;
    return true;
  });

  // Collect unique entityTypes for filter dropdown
  const entityTypes = [...new Set(S.auditLog.map(e => e.entityType).filter(Boolean))].sort();

  const rows = filtered.map(e => {
    const ts = e.performedAt?.toDate?.() ?? null;
    const tsStr = ts ? ts.toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
    return `
      <tr>
        <td class="text-xs text-gray-300 whitespace-nowrap">${tsStr}</td>
        <td><span class="badge badge-blue text-xs">${_esc(e.action ?? '—')}</span></td>
        <td class="text-xs text-gray-400">${_esc(e.entityType ?? '—')}</td>
        <td class="text-xs text-gray-500 max-w-xs truncate">${_esc(e.entityId ?? '—')}</td>
        <td class="text-xs text-gray-400">${_esc(e.performedBy ?? '—')}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <!-- Filters -->
    <div class="flex gap-3 mb-4 flex-wrap">
      <input id="filter-action" type="text" class="form-input w-48 text-sm"
             placeholder="Filter action…" value="${_esc(filterAction)}" />
      <select id="filter-entity" class="form-select text-sm w-48">
        <option value="">Semua Entity</option>
        ${entityTypes.map(t => `<option value="${_esc(t)}" ${filterEntity === t ? 'selected' : ''}>${_esc(t)}</option>`).join('')}
      </select>
      <button id="btn-refresh-audit" class="px-3 py-1.5 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors">
        Refresh
      </button>
    </div>

    <!-- Count -->
    <div class="text-xs text-gray-500 mb-3">
      Menampilkan ${filtered.length} dari ${S.auditLog.length} entri terbaru
    </div>

    <!-- Table -->
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
      <table class="btam-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Action</th>
            <th>Entity Type</th>
            <th>Entity ID</th>
            <th>Oleh</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length > 0 ? rows
            : '<tr><td colspan="5" class="text-center text-gray-500 py-8">Tidak ada log yang sesuai filter.</td></tr>'}
        </tbody>
      </table>
    </div>`;

  container.querySelector('#filter-action').addEventListener('input', e => {
    S.auditFilter.action = e.target.value.trim();
    _renderAuditLogTable(container);
  });

  container.querySelector('#filter-entity').addEventListener('change', e => {
    S.auditFilter.entityType = e.target.value;
    _renderAuditLogTable(container);
  });

  container.querySelector('#btn-refresh-audit').addEventListener('click', async () => {
    S.auditLog = [];
    await _renderAuditLog(container);
  });
}

// ─── HELPER ───────────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
