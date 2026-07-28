// admin/js/modules/rekrutmen/seleksi-tertulis.js
// B3 — Monitor seleksi tertulis & link ke exam system.

import { setPageTitle }  from '../../layout/navbar.js';
import { openModal }     from '../../components/modal.js';
import { showToast }     from '../../components/toast.js';
import { getState }      from '../../store.js';
import { listSiklus, getSiklus, updateSiklus } from './siklus-api.js';
import { generateSeleksiSessions, listSeleksiSessions, scoreSeleksiSubmissions } from './seleksi-exam-api.js';
import { db }            from '../../../../shared/firebase-config.js';
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, updateDoc, Timestamp
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';

let _S = { tahun: null, siklus: null };

export async function renderSeleksiTertulis() {
  setPageTitle('Rekrutmen — Seleksi Tertulis');

  const sikluses = await listSiklus();
  const aktif    = sikluses.find(s => ['administrasi','tertulis'].includes(s.status)) ?? sikluses[0];
  _S.tahun  = aktif?.tahun ?? null;
  _S.siklus = aktif ?? null;

  document.getElementById('app').innerHTML = `
    <div class="max-w-4xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-white">Seleksi Tertulis</h1>
          <p class="text-xs text-gray-500 mt-0.5">Konfigurasi ujian dan monitoring peserta seleksi tertulis</p>
        </div>
        <select id="sel-siklus" class="form-input text-sm py-1.5 w-44">
          ${sikluses.map(s => `<option value="${s.tahun}" ${s.tahun === _S.tahun ? 'selected' : ''}>${s.nama}</option>`).join('')}
        </select>
      </div>
      <div id="content"></div>
    </div>`;

  document.getElementById('sel-siklus')?.addEventListener('change', async e => {
    _S.tahun  = parseInt(e.target.value);
    _S.siklus = await getSiklus(_S.tahun);
    _renderContent();
  });

  _renderContent();
}

async function _renderContent() {
  const content = document.getElementById('content');
  if (!content || !_S.siklus) return;

  const examId   = _S.siklus.phases?.tertulis?.examId ?? null;
  const window_s = _S.siklus.phases?.tertulis?.start;
  const window_e = _S.siklus.phases?.tertulis?.end;

  // Lulus administrasi
  let lulusAdminList = [];
  try {
    const snap = await getDocs(query(
      collection(db, COL.CALON_PESERTA),
      where('tahun', '==', _S.tahun),
      where('statusAdmin', '==', 'lulus')
    ));
    lulusAdminList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}
  const lulusAdminCount = lulusAdminList.length;

  // Exam info
  let examInfo = null;
  if (examId) {
    try {
      const snap = await getDoc(doc(db, COL.EXAMS, examId));
      if (snap.exists()) examInfo = { id: snap.id, ...snap.data() };
    } catch (e) {}
  }

  // Sesi seleksi tertulis (dipakai untuk stat + daftar link per calon)
  let sesiList = [];
  if (examId) {
    try { sesiList = await listSeleksiSessions(examId); } catch (e) {}
  }
  const sesiByNoPeserta = Object.fromEntries(sesiList.map(s => [s.noPeserta, s]));
  const statSesi = { issued: 0, started: 0, submitted: 0, expired: 0 };
  sesiList.forEach(s => { statSesi[s.status] = (statSesi[s.status] ?? 0) + 1; });

  content.innerHTML = `
    <div class="space-y-4">

      <!-- Stat cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        ${[
          ['Lulus Administrasi', lulusAdminCount, 'text-green-400'],
          ['Link Dikirim',  statSesi.issued,    'text-blue-400'],
          ['Sedang Ujian',  statSesi.started,   'text-yellow-400'],
          ['Selesai',       statSesi.submitted, 'text-gray-300'],
        ].map(([label, val, color]) => `
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p class="text-2xl font-bold ${color}">${val}</p>
            <p class="text-xs text-gray-500 mt-1">${label}</p>
          </div>`).join('')}
      </div>

      <!-- Konfigurasi Exam -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white mb-4">Ujian Seleksi Tertulis</h2>
        ${examInfo ? `
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm text-gray-200 font-medium">${_esc(examInfo.judul)}</p>
              <p class="text-xs text-gray-500 mt-0.5">
                ${examInfo.durasi} menit ·
                ${examInfo.published ? '<span class="text-green-400">Published</span>' : '<span class="text-yellow-400">Draft</span>'}
              </p>
            </div>
            <div class="flex gap-2">
              <button id="btn-change-exam" class="px-3 py-1.5 rounded-lg text-xs border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors">
                Ganti Exam
              </button>
              <button id="btn-gen-links" class="px-3 py-1.5 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
                Generate Magic Link
              </button>
            </div>
          </div>` : `
          <div class="flex items-center justify-between gap-4">
            <p class="text-sm text-gray-500">Belum ada ujian yang ditentukan untuk siklus ini.</p>
            <div class="flex gap-2">
              <button id="btn-link-exam" class="px-3 py-1.5 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
                Pilih Exam
              </button>
              <button id="btn-buat-exam" class="px-3 py-1.5 rounded-lg text-xs border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors"
                      onclick="window.location.hash='/bank-soal'">
                Ke Bank Soal →
              </button>
            </div>
          </div>`}
      </div>

      <!-- Window waktu ujian -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-white">Window Ujian</h2>
          <button id="btn-save-window" class="px-3 py-1.5 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
            Simpan
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Mulai</label>
            <input id="inp-window-start" type="datetime-local" class="form-input text-sm"
                   value="${_tsToInput(window_s)}" />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Selesai</label>
            <input id="inp-window-end" type="datetime-local" class="form-input text-sm"
                   value="${_tsToInput(window_e)}" />
          </div>
        </div>
        <p class="text-xs text-gray-600 mt-2">
          Peserta dapat mengakses ujian kapan saja dalam window ini. Timer ujian mulai berjalan saat mereka klik "Mulai".
        </p>
      </div>

      <!-- Hasil ujian -->
      ${examId ? `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-white">Monitor Ujian</h2>
            <div class="flex gap-2">
              <button id="btn-sync-nilai" class="px-3 py-1.5 rounded-lg text-xs bg-green-700 hover:bg-green-600 text-white transition-colors">
                Sinkronkan Nilai
              </button>
              <button id="btn-refresh-stat" class="text-xs text-gray-500 hover:text-gray-300 transition-colors">↻ Refresh</button>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-2 text-center text-xs">
            <div class="bg-gray-800 rounded-lg p-2">
              <p class="text-lg font-bold text-gray-300">${statSesi.issued}</p>
              <p class="text-gray-500">Belum Mulai</p>
            </div>
            <div class="bg-gray-800 rounded-lg p-2">
              <p class="text-lg font-bold text-yellow-400">${statSesi.started}</p>
              <p class="text-gray-500">Sedang Ujian</p>
            </div>
            <div class="bg-gray-800 rounded-lg p-2">
              <p class="text-lg font-bold text-green-400">${statSesi.submitted}</p>
              <p class="text-gray-500">Selesai</p>
            </div>
            <div class="bg-gray-800 rounded-lg p-2">
              <p class="text-lg font-bold text-gray-600">${statSesi.expired}</p>
              <p class="text-gray-500">Kadaluarsa</p>
            </div>
          </div>
          <p class="text-xs text-gray-600 mt-2">
            "Sinkronkan Nilai" menghitung skor dari jawaban yang sudah disubmit dan mengisi kolom Nilai Tertulis calon peserta.
          </p>
        </div>

        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 class="text-sm font-semibold text-white mb-3">Link Ujian per Calon (${lulusAdminList.length} lulus administrasi)</h2>
          ${lulusAdminList.length === 0 ? `
            <p class="text-sm text-gray-500">Belum ada calon yang lulus administrasi.</p>` : `
            <div class="max-h-80 overflow-y-auto space-y-1.5">
              ${lulusAdminList.map(c => {
                const s = sesiByNoPeserta[c.pendaftarId];
                return `
                <div class="flex items-center justify-between gap-3 bg-gray-800/60 rounded-lg px-3 py-2">
                  <div class="min-w-0">
                    <p class="text-sm text-gray-200 truncate">${_esc(c.nama)}</p>
                    <p class="text-xs text-gray-500 truncate">${_esc(c.pendaftarId)} · ${_esc(c.instansi || '—')}</p>
                  </div>
                  ${s
                    ? `<button class="btn-copy-link shrink-0 text-xs px-2.5 py-1 rounded-lg bg-blue-800 hover:bg-blue-700 text-blue-200 transition-colors" data-token="${_esc(s.token)}">Salin Link</button>`
                    : `<span class="shrink-0 text-xs text-gray-600">Belum ada sesi</span>`}
                </div>`;
              }).join('')}
            </div>`}
        </div>` : ''}

    </div>`;

  _S.examId = examId;
  _S.examInfo = examInfo;
  _S.lulusAdminList = lulusAdminList;

  _bindContentEvents();
}

function _bindContentEvents() {
  const email = getState('auth')?.user?.email;

  document.getElementById('btn-save-window')?.addEventListener('click', async () => {
    const start = document.getElementById('inp-window-start')?.value;
    const end   = document.getElementById('inp-window-end')?.value;
    try {
      await updateSiklus(_S.tahun, {
        'phases.tertulis.start': start || null,
        'phases.tertulis.end':   end   || null,
      }, email);
      showToast('Window ujian disimpan', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  document.getElementById('btn-refresh-stat')?.addEventListener('click', _renderContent);

  document.getElementById('btn-link-exam')?.addEventListener('click', _openExamPicker);
  document.getElementById('btn-change-exam')?.addEventListener('click', _openExamPicker);

  document.getElementById('btn-gen-links')?.addEventListener('click', _openGenerateLinksModal);

  document.getElementById('btn-sync-nilai')?.addEventListener('click', async () => {
    const examId = _S.examId;
    if (!examId) return;
    const btn = document.getElementById('btn-sync-nilai');
    btn.disabled = true; btn.textContent = 'Memproses...';
    try {
      const { processed, failed } = await scoreSeleksiSubmissions(examId);
      showToast(`${processed} nilai disinkronkan${failed ? `, ${failed} gagal` : ''}`, failed ? 'info' : 'success');
      _renderContent();
    } catch (e) {
      showToast('Gagal sinkronkan nilai: ' + e.message, 'error');
      btn.disabled = false; btn.textContent = 'Sinkronkan Nilai';
    }
  });

  document.querySelectorAll('.btn-copy-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const token = btn.dataset.token;
      const url = `${window.location.origin}${window.location.pathname.replace(/admin\/.*$/, '')}exam/?token=${token}`;
      navigator.clipboard.writeText(url)
        .then(() => showToast('Link disalin', 'success'))
        .catch(() => showToast('Gagal menyalin link', 'error'));
    });
  });
}

function _openGenerateLinksModal() {
  const examId = _S.examId;
  const exam   = _S.examInfo;
  if (!examId || !exam) return;

  const calonList = _S.lulusAdminList || [];
  if (calonList.length === 0) {
    showToast('Belum ada calon yang lulus administrasi.', 'info');
    return;
  }

  const body = `
    <div class="space-y-3">
      <p class="text-sm text-gray-400">Generate sesi ujian untuk ${calonList.length} calon yang lulus administrasi. Calon yang sudah punya sesi dilewati.</p>
      <div>
        <label class="block text-xs text-gray-400 mb-1">Kadaluarsa Sesi</label>
        <input id="inp-gen-expiry" type="datetime-local" class="form-input w-full"
          value="${_toDatetimeLocalValue(new Date(Date.now() + 72 * 60 * 60 * 1000))}">
      </div>
    </div>`;

  const modal = openModal({
    title: 'Generate Sesi Ujian Seleksi Tertulis',
    body,
    size: 'sm',
    actions: [
      { label: 'Batal', type: 'secondary', onClick: () => modal.close() },
      {
        label: 'Generate', type: 'primary',
        onClick: async () => {
          const val = document.getElementById('inp-gen-expiry')?.value;
          if (!val) { showToast('Isi waktu kadaluarsa', 'info'); return; }
          try {
            const { created, skipped } = await generateSeleksiSessions(exam, calonList, new Date(val));
            modal.close();
            showToast(`${created} sesi dibuat, ${skipped} sudah ada (dilewati)`, 'success');
            _renderContent();
          } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
        }
      }
    ]
  });
}

function _toDatetimeLocalValue(dt) {
  const pad = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function _openExamPicker() {
  const email = getState('auth')?.user?.email;
  const body = `
    <div class="space-y-3">
      <p class="text-sm text-gray-400">Masukkan ID exam seleksi tertulis yang sudah dibuat di modul Bimtek / Bank Soal.</p>
      <div>
        <label class="block text-xs text-gray-400 mb-1">Exam ID</label>
        <input id="inp-exam-id" type="text" class="form-input" placeholder="exam ID…" />
      </div>
      <p class="text-xs text-gray-600">
        Buat exam baru dengan tipe <code>seleksi_tertulis</code> dari menu Bimtek terlebih dahulu, lalu salin ID-nya ke sini.
      </p>
    </div>`;

  const modal = openModal({
    title: 'Pilih Exam Seleksi Tertulis',
    body,
    size: 'sm',
    actions: [
      { label: 'Batal', type: 'secondary', onClick: () => modal.close() },
      {
        label: 'Simpan', type: 'primary',
        onClick: async () => {
          const examId = document.getElementById('inp-exam-id')?.value.trim();
          if (!examId) return;
          try {
            await updateSiklus(_S.tahun, { 'phases.tertulis.examId': examId }, email);
            showToast('Exam terhubung', 'success');
            _S.siklus = await getSiklus(_S.tahun);
            modal.close();
            _renderContent();
          } catch (e) { showToast(e.message, 'error'); }
        }
      }
    ]
  });
}

function _tsToInput(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 16);
}
function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
