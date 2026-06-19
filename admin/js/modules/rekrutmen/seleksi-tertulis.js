// admin/js/modules/rekrutmen/seleksi-tertulis.js
// B3 — Monitor seleksi tertulis & link ke exam system.

import { setPageTitle }  from '../../layout/navbar.js';
import { openModal }     from '../../components/modal.js';
import { showToast }     from '../../components/toast.js';
import { navigate }      from '../../router.js';
import { getState }      from '../../store.js';
import { listSiklus, getSiklus, updateSiklus } from './siklus-api.js';
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

  // Hitung lulus administrasi
  let lulusAdminCount = 0;
  try {
    const snap = await getDocs(query(
      collection(db, COL.CALON_PESERTA),
      where('tahun', '==', _S.tahun),
      where('statusAdmin', '==', 'lulus')
    ));
    lulusAdminCount = snap.size;
  } catch (e) {}

  // Exam info
  let examInfo = null;
  if (examId) {
    try {
      const snap = await getDoc(doc(db, COL.EXAMS, examId));
      if (snap.exists()) examInfo = { id: snap.id, ...snap.data() };
    } catch (e) {}
  }

  // Stat sesi
  let statSesi = { issued: 0, started: 0, submitted: 0, expired: 0 };
  if (examId) {
    try {
      const snap = await getDocs(query(collection(db, COL.EXAM_SESSIONS), where('examId', '==', examId)));
      snap.docs.forEach(d => { const s = d.data().status; statSesi[s] = (statSesi[s] ?? 0) + 1; });
    } catch (e) {}
  }

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
              <p class="text-sm text-gray-200 font-medium">${_esc(examInfo.nama)}</p>
              <p class="text-xs text-gray-500 mt-0.5">
                ${examInfo.durasiMenit} menit ·
                ${examInfo.published ? '<span class="text-green-400">Published</span>' : '<span class="text-yellow-400">Draft</span>'}
              </p>
            </div>
            <div class="flex gap-2">
              <button id="btn-change-exam" class="px-3 py-1.5 rounded-lg text-xs border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors">
                Ganti Exam
              </button>
              <button id="btn-gen-links" class="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                Generate Magic Link
              </button>
            </div>
          </div>` : `
          <div class="flex items-center justify-between gap-4">
            <p class="text-sm text-gray-500">Belum ada ujian yang ditentukan untuk siklus ini.</p>
            <div class="flex gap-2">
              <button id="btn-link-exam" class="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors">
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
          <button id="btn-save-window" class="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors">
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
            <button id="btn-refresh-stat" class="text-xs text-gray-500 hover:text-gray-300 transition-colors">↻ Refresh</button>
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
          <div class="mt-3 flex gap-2">
            <a href="#/bimtek" class="text-xs text-blue-400 hover:underline">
              → Lihat hasil lengkap di modul Bimtek
            </a>
          </div>
        </div>` : ''}

    </div>`;

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

  document.getElementById('btn-gen-links')?.addEventListener('click', () => {
    const examId = _S.siklus?.phases?.tertulis?.examId;
    if (examId) navigate(`/bimtek`); // Link ke exam system yang sudah ada
  });
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
