// pendaftar/js/pages/daftar.js
// Form pendaftaran multi-step.

import { getSiklusAktif, submitPendaftaran, uploadKtp, getInstansiByProvinsi } from '../api.js';
import { PROVINSI_LIST as PROVINSI } from '../../../shared/constants.js';

// State modul
let _S = {
  step: 1,
  siklus: null,
  ktpFile: null,
  data: {}
};

export async function renderDaftar(app) {
  _S = { step: 1, siklus: null, ktpFile: null, data: {} };

  app.innerHTML = _header() + `<main class="max-w-lg mx-auto px-4 py-6">
    <div class="animate-pulse"><div class="h-8 bg-gray-200 rounded mb-4 w-48"></div><div class="h-64 bg-gray-100 rounded-xl"></div></div>
  </main>` + _footer();

  try {
    _S.siklus = await getSiklusAktif();
  } catch (e) {}

  if (!_S.siklus) {
    app.innerHTML = _header() + `
      <main class="max-w-lg mx-auto px-4 py-12 text-center">
        <p class="text-gray-500">Pendaftaran tidak sedang dibuka.</p>
        <a href="#/" class="btn-secondary inline-block mt-4">← Kembali</a>
      </main>` + _footer();
    return;
  }

  _render(app);
}

function _render(app) {
  const totalSteps = 5;
  app.innerHTML = _header() + `
    <main class="max-w-lg mx-auto px-4 py-6">

      <!-- Breadcrumb -->
      <a href="#/" class="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 mb-4">
        ← Kembali ke Beranda
      </a>

      <!-- Step indicator -->
      <div class="flex items-center gap-1 mb-6">
        ${Array.from({ length: totalSteps }, (_, i) => {
          const n = i + 1;
          const done   = n < _S.step;
          const active = n === _S.step;
          return `
            <div class="step-dot ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}">
              ${done ? '✓' : n}
            </div>
            ${n < totalSteps ? '<div class="flex-1 h-0.5 ' + (done ? 'bg-green-400' : 'bg-gray-200') + '"></div>' : ''}`;
        }).join('')}
      </div>

      <!-- Step content -->
      <div id="step-content" class="bg-white rounded-xl border border-gray-200 p-5">
        ${_renderStep()}
      </div>

    </main>` + _footer();

  _bindStep(app);
}

// ─── Step renderers ──────────────────────────────────────────

function _renderStep() {
  switch (_S.step) {
    case 1: return _step1();
    case 2: return _step2();
    case 3: return _step3();
    case 4: return _step4();
    case 5: return _step5();
    default: return '';
  }
}

function _step1() {
  const d = _S.data;
  return `
    <h2 class="text-base font-semibold text-gray-800 mb-4">Data Diri</h2>
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Nama Lengkap (tanpa gelar) <span class="text-red-500">*</span></label>
        <input id="f-nama" class="form-input" type="text" value="${_esc(d.nama ?? '')}" placeholder="Sesuai KTP" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Jenis Kelamin</label>
          <select id="f-jk" class="form-input form-select">
            <option value="">Pilih…</option>
            <option value="L" ${d.jenisKelamin === 'L' ? 'selected' : ''}>Laki-laki</option>
            <option value="P" ${d.jenisKelamin === 'P' ? 'selected' : ''}>Perempuan</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Pendidikan Terakhir</label>
          <select id="f-pendidikan" class="form-input form-select">
            <option value="">Pilih…</option>
            ${['SMA','D3','S1','S2','S3','Lainnya'].map(p =>
              `<option value="${p}" ${d.pendidikan === p ? 'selected' : ''}>${p}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Tempat Lahir</label>
          <input id="f-tempat-lahir" class="form-input" type="text" value="${_esc(d.tempatLahir ?? '')}" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Tanggal Lahir</label>
          <input id="f-tgl-lahir" class="form-input" type="date" value="${d.tanggalLahir ?? ''}" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Jabatan</label>
          <input id="f-jabatan" class="form-input" type="text" value="${_esc(d.jabatan ?? '')}" placeholder="Jabatan di instansi" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Pengalaman Kerja di Bidang (tahun)</label>
          <input id="f-pengalaman" class="form-input" type="number" min="0" value="${_esc(d.pengalamanTahun ?? '')}" placeholder="0" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">No. HP / WhatsApp <span class="text-red-500">*</span></label>
          <input id="f-nohp" class="form-input" type="tel" value="${_esc(d.noHp ?? '')}" placeholder="08xx…" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Email <span class="text-red-500">*</span></label>
          <input id="f-email" class="form-input" type="email" value="${_esc(d.email ?? '')}" placeholder="nama@email.com" />
        </div>
      </div>
      <div id="step-error" class="hidden text-xs text-red-600 pt-1"></div>
    </div>
    ${_navButtons(false, true)}`;
}

function _step2() {
  const d = _S.data;
  return `
    <h2 class="text-base font-semibold text-gray-800 mb-4">Instansi</h2>
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Provinsi <span class="text-red-500">*</span></label>
        <select id="f-provinsi" class="form-input form-select">
          <option value="">Pilih provinsi…</option>
          ${PROVINSI.map(p => `<option value="${p}" ${d.provinsi === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Nama Instansi <span class="text-red-500">*</span></label>
        <input id="f-instansi" class="form-input" type="text" list="instansi-options" value="${_esc(d.instansi ?? '')}"
               placeholder="Pilih provinsi dulu, atau ketik manual" />
        <datalist id="instansi-options"></datalist>
        <p id="instansi-hint" class="text-xs text-gray-400 mt-1 hidden">Memuat daftar instansi…</p>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Unit / Bagian Kerja</label>
        <input id="f-unitkerja" class="form-input" type="text" value="${_esc(d.unitKerja ?? '')}"
               placeholder="Mis. Bagian Transmisi & Distribusi" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Kabupaten / Kota</label>
        <input id="f-kabkota" class="form-input" type="text" value="${_esc(d.kabKota ?? '')}"
               placeholder="Mis. Kota Bandung" />
      </div>
      <div id="step-error" class="hidden text-xs text-red-600 pt-1"></div>
    </div>
    ${_navButtons(true, true)}`;
}

function _step3() {
  const d        = _S.data;
  const bimteks  = _S.siklus?.bimtekPilihan || [];
  const selected = d.pilihanBimtekIds || [];

  return `
    <h2 class="text-base font-semibold text-gray-800 mb-1">Pilihan Bimtek</h2>
    <p class="text-xs text-gray-500 mb-4">Pilih maksimal 3 bimtek sesuai urutan prioritas.</p>
    ${bimteks.length === 0
      ? `<p class="text-sm text-gray-500 py-4 text-center">Belum ada bimtek yang tersedia.</p>`
      : `<div class="space-y-2" id="bimtek-list">
          ${bimteks.map((b, i) => {
            const rank = selected.indexOf(b.bimtekId) + 1;
            return `
              <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                            ${rank > 0 ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}">
                <input type="checkbox" class="bimtek-cb mt-0.5 w-4 h-4 accent-blue-600"
                       value="${_esc(b.bimtekId)}" ${rank > 0 ? 'checked' : ''} />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-800">${_esc(b.namaBimtek)}</p>
                  <p class="text-xs text-gray-500">${_esc(b.bidang || '')} · ${b.mode === 'online' ? 'Online' : 'Tatap Muka'} · Kuota ${b.kuota}</p>
                </div>
                ${rank > 0 ? `<span class="text-xs font-bold text-blue-600 shrink-0">Pilihan ${rank}</span>` : ''}
              </label>`;
          }).join('')}
        </div>`}
    <div id="step-error" class="hidden text-xs text-red-600 pt-2"></div>
    ${_navButtons(true, true)}`;
}

function _step4() {
  return `
    <h2 class="text-base font-semibold text-gray-800 mb-1">Upload KTP</h2>
    <p class="text-xs text-gray-500 mb-4">Upload foto/scan KTP Anda. Format: JPG, PNG, atau PDF. Maks 2 MB.</p>
    <div class="space-y-3">
      <label class="block">
        <div id="ktp-drop" class="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer
                                   hover:border-blue-400 hover:bg-blue-50 transition-colors">
          <div id="ktp-preview">
            <svg class="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <p class="text-sm text-gray-500">Klik atau drag file ke sini</p>
            <p class="text-xs text-gray-400 mt-1">JPG, PNG, PDF · maks 2 MB</p>
          </div>
        </div>
        <input id="ktp-input" type="file" class="hidden" accept=".jpg,.jpeg,.png,.pdf" />
      </label>
      <p class="text-xs text-gray-400">
        KTP digunakan untuk verifikasi identitas. Data disimpan aman dan tidak dipublikasikan.
      </p>
      <div id="step-error" class="hidden text-xs text-red-600"></div>
    </div>
    ${_navButtons(true, true, 'Lanjut ke Review')}`;
}

function _step5() {
  const d = _S.data;
  const bimteks = _S.siklus?.bimtekPilihan || [];
  const pilihanNama = (d.pilihanBimtekIds || []).map(id => {
    const b = bimteks.find(x => x.bimtekId === id);
    return b ? b.namaBimtek : id;
  });

  return `
    <h2 class="text-base font-semibold text-gray-800 mb-4">Review & Kirim</h2>
    <div class="space-y-4 text-sm">
      ${_reviewSection('Data Diri', [
        ['Nama',        d.nama],
        ['Jenis Kelamin', d.jenisKelamin === 'L' ? 'Laki-laki' : d.jenisKelamin === 'P' ? 'Perempuan' : '—'],
        ['Tempat, Tgl Lahir', [d.tempatLahir, d.tanggalLahir].filter(Boolean).join(', ') || '—'],
        ['Pendidikan',  d.pendidikan || '—'],
        ['Jabatan',     d.jabatan || '—'],
        ['Pengalaman Kerja', d.pengalamanTahun != null ? `${d.pengalamanTahun} tahun` : '—'],
        ['No. HP',      d.noHp],
        ['Email',       d.email],
      ])}
      ${_reviewSection('Instansi', [
        ['Instansi',    d.instansi || '—'],
        ['Unit Kerja',  d.unitKerja || '—'],
        ['Provinsi',    d.provinsi || '—'],
        ['Kab/Kota',    d.kabKota || '—'],
      ])}
      ${_reviewSection('Pilihan Bimtek', pilihanNama.map((n, i) => [`Pilihan ${i+1}`, n]))}
      <div class="py-2">
        <label class="flex items-start gap-2 cursor-pointer">
          <input id="chk-agree" type="checkbox" class="mt-0.5 w-4 h-4 accent-blue-600" />
          <span class="text-xs text-gray-600">
            Saya menyatakan bahwa data yang saya isi adalah benar dan saya bersedia mengikuti proses seleksi sesuai ketentuan yang berlaku.
          </span>
        </label>
      </div>
      <div id="step-error" class="hidden text-xs text-red-600"></div>
    </div>
    ${_navButtons(true, true, 'Kirim Pendaftaran', 'btn-submit')}`;
}

function _reviewSection(title, rows) {
  return `
    <div class="bg-gray-50 rounded-lg p-3">
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">${title}</p>
      <dl class="space-y-1">
        ${rows.map(([label, val]) => `
          <div class="flex gap-2">
            <dt class="text-xs text-gray-500 w-28 shrink-0">${label}</dt>
            <dd class="text-xs text-gray-800 font-medium">${_esc(val ?? '—')}</dd>
          </div>`).join('')}
      </dl>
    </div>`;
}

function _navButtons(showBack, showNext, nextLabel = 'Lanjut', nextId = 'btn-next') {
  return `
    <div class="flex gap-3 mt-5 pt-4 border-t border-gray-100">
      ${showBack ? `<button id="btn-back" class="btn-secondary flex-1">← Kembali</button>` : ''}
      ${showNext ? `<button id="${nextId}" class="btn-primary flex-1">${nextLabel} →</button>` : ''}
    </div>`;
}

// ─── Event binding per step ───────────────────────────────────

function _bindStep(app) {
  const content = () => document.getElementById('step-content');

  document.getElementById('btn-back')?.addEventListener('click', () => {
    _S.step--;
    content().innerHTML = _renderStep();
    _bindStep(app);
  });

  if (_S.step === 1) _bindStep1(app);
  if (_S.step === 2) _bindStep2(app);
  if (_S.step === 3) _bindStep3(app);
  if (_S.step === 4) _bindStep4(app);
  if (_S.step === 5) _bindStep5(app);
}

function _bindStep1(app) {
  document.getElementById('btn-next')?.addEventListener('click', () => {
    const nama  = document.getElementById('f-nama')?.value.trim();
    const noHp  = document.getElementById('f-nohp')?.value.trim();
    const email = document.getElementById('f-email')?.value.trim();
    const err   = document.getElementById('step-error');

    if (!nama)  { _showErr(err, 'Nama wajib diisi.'); return; }
    if (!noHp)  { _showErr(err, 'No. HP wajib diisi.'); return; }
    if (!email || !email.includes('@')) { _showErr(err, 'Email tidak valid.'); return; }

    Object.assign(_S.data, {
      nama,
      jenisKelamin: document.getElementById('f-jk')?.value || null,
      pendidikan:   document.getElementById('f-pendidikan')?.value || null,
      tempatLahir:  document.getElementById('f-tempat-lahir')?.value.trim() || null,
      tanggalLahir: document.getElementById('f-tgl-lahir')?.value || null,
      jabatan:      document.getElementById('f-jabatan')?.value.trim() || null,
      pengalamanTahun: document.getElementById('f-pengalaman')?.value !== ''
        ? parseInt(document.getElementById('f-pengalaman').value) : null,
      noHp, email
    });
    _S.step++;
    document.getElementById('step-content').innerHTML = _renderStep();
    _bindStep(app);
  });
}

function _bindStep2(app) {
  const provSel = document.getElementById('f-provinsi');
  const hint    = document.getElementById('instansi-hint');
  const datalist = document.getElementById('instansi-options');

  const loadInstansi = async () => {
    const provinsi = provSel?.value;
    if (!provinsi || !datalist) return;
    hint.textContent = 'Memuat daftar instansi…';
    hint.classList.remove('hidden');
    try {
      const list = await getInstansiByProvinsi(provinsi);
      datalist.innerHTML = list.map(i => `<option value="${_esc(i.nama)}"></option>`).join('');
      hint.textContent = list.length
        ? `${list.length} instansi ditemukan di provinsi ini. Tidak ada? Ketik nama instansi Anda secara manual.`
        : 'Belum ada instansi terdaftar di provinsi ini. Ketik nama instansi Anda secara manual.';
    } catch (e) {
      hint.textContent = 'Gagal memuat daftar instansi. Ketik nama instansi secara manual.';
    }
  };

  provSel?.addEventListener('change', loadInstansi);
  if (provSel?.value) loadInstansi();

  document.getElementById('btn-next')?.addEventListener('click', () => {
    const instansi = document.getElementById('f-instansi')?.value.trim();
    const provinsi = document.getElementById('f-provinsi')?.value;
    const err      = document.getElementById('step-error');

    if (!instansi) { _showErr(err, 'Nama instansi wajib diisi.'); return; }
    if (!provinsi) { _showErr(err, 'Provinsi wajib dipilih.'); return; }

    Object.assign(_S.data, {
      instansi,
      provinsi,
      unitKerja: document.getElementById('f-unitkerja')?.value.trim() || null,
      kabKota:   document.getElementById('f-kabkota')?.value.trim() || null,
    });
    _S.step++;
    document.getElementById('step-content').innerHTML = _renderStep();
    _bindStep(app);
  });
}

function _bindStep3(app) {
  // Update pilihan labels on checkbox change
  const updateLabels = () => {
    const checked = [...document.querySelectorAll('.bimtek-cb:checked')].map(c => c.value);
    document.querySelectorAll('.bimtek-cb').forEach(cb => {
      const label = cb.closest('label');
      const rank  = checked.indexOf(cb.value) + 1;
      const span  = label.querySelector('span.text-blue-600');
      if (rank > 0) {
        label.classList.add('border-blue-400','bg-blue-50');
        label.classList.remove('border-gray-200');
        if (span) span.textContent = `Pilihan ${rank}`;
        else label.insertAdjacentHTML('beforeend', `<span class="text-xs font-bold text-blue-600 shrink-0">Pilihan ${rank}</span>`);
      } else {
        label.classList.remove('border-blue-400','bg-blue-50');
        label.classList.add('border-gray-200');
        span?.remove();
      }
    });
  };

  document.querySelectorAll('.bimtek-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = [...document.querySelectorAll('.bimtek-cb:checked')];
      if (checked.length > 3) { cb.checked = false; return; }
      updateLabels();
    });
  });

  document.getElementById('btn-next')?.addEventListener('click', () => {
    const selected = [...document.querySelectorAll('.bimtek-cb:checked')].map(c => c.value);
    const err = document.getElementById('step-error');
    if (!selected.length) { _showErr(err, 'Pilih minimal 1 bimtek.'); return; }
    _S.data.pilihanBimtekIds = selected;
    _S.step++;
    document.getElementById('step-content').innerHTML = _renderStep();
    _bindStep(app);
  });
}

function _bindStep4(app) {
  const input   = document.getElementById('ktp-input');
  const drop    = document.getElementById('ktp-drop');
  const preview = document.getElementById('ktp-preview');

  const showFile = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      _showErr(document.getElementById('step-error'), 'Ukuran file maks 2 MB.');
      return;
    }
    _S.ktpFile = file;
    preview.innerHTML = `
      <svg class="w-6 h-6 text-green-500 mx-auto mb-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
      </svg>
      <p class="text-sm font-medium text-green-700">${_esc(file.name)}</p>
      <p class="text-xs text-gray-500 mt-0.5">${(file.size / 1024).toFixed(0)} KB</p>`;
  };

  drop?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', () => showFile(input.files?.[0]));
  drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('border-blue-400'); });
  drop?.addEventListener('dragleave', () => drop.classList.remove('border-blue-400'));
  drop?.addEventListener('drop', e => { e.preventDefault(); showFile(e.dataTransfer.files?.[0]); });

  document.getElementById('btn-next')?.addEventListener('click', () => {
    const err = document.getElementById('step-error');
    if (!_S.ktpFile) { _showErr(err, 'KTP wajib diupload.'); return; }
    _S.step++;
    document.getElementById('step-content').innerHTML = _renderStep();
    _bindStep(app);
  });
}

function _bindStep5(app) {
  document.getElementById('btn-submit')?.addEventListener('click', async () => {
    const agreed = document.getElementById('chk-agree')?.checked;
    const err    = document.getElementById('step-error');
    const btn    = document.getElementById('btn-submit');
    if (!agreed) { _showErr(err, 'Anda harus menyetujui pernyataan di atas.'); return; }

    btn.disabled    = true;
    btn.textContent = 'Mengirim…';

    try {
      const tahun  = _S.siklus.tahun;
      const tempId = `TEMP-${Date.now()}`;

      // Upload KTP dulu
      let ktpUrl = null;
      if (_S.ktpFile) {
        ktpUrl = await uploadKtp(_S.ktpFile, tahun, tempId);
      }

      const pendaftarId = await submitPendaftaran({
        ..._S.data,
        tahun,
        ktpUrl
      });

      // Redirect ke konfirmasi
      window.location.hash = `/konfirmasi?id=${pendaftarId}&tahun=${tahun}`;
    } catch (e) {
      btn.disabled    = false;
      btn.textContent = 'Kirim Pendaftaran →';
      _showErr(err, 'Gagal mengirim: ' + e.message);
    }
  });
}

// ─── Helpers ─────────────────────────────────────────────────

function _showErr(el, msg) { if (!el) return; el.textContent = msg; el.classList.remove('hidden'); }
function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function _header() {
  return `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-lg mx-auto px-4 h-14 flex items-center">
        <a href="#/" class="flex items-center gap-2 text-blue-700 font-bold text-sm">
          <div class="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
          </div>
          SI-SABAT
        </a>
      </div>
    </header>`;
}

function _footer() {
  return `<footer class="text-center py-8 text-xs text-gray-400">Balai Teknik Air Minum — Direktorat Jenderal Cipta Karya</footer>`;
}
