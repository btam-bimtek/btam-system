// exam/js/app.js
// Orchestrator utama exam app.
// Mengelola alur: loading → validasi token → entry screen → instruksi → ujian → result.

import { getSessionByToken, getExam, getSoalList, startSession } from './db.js';
import { initExamRunner, destroyExamRunner }                     from './exam-runner.js';
import { requestFullscreen }                                      from './anti-cheat.js';
import { EXAM_DEFAULTS }                                          from '../../shared/constants.js';

// ─── State ────────────────────────────────────────────────────
let _session  = null;
let _exam     = null;
let _soalList = [];

// ─── Boot ─────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', _boot);

async function _boot() {
  _renderLoading();

  // Support dua format URL:
  // 1. ?token=UUID              (format baru — recommended)
  // 2. #/session/UUID           (format lama dari M1.5)
  let token = new URLSearchParams(window.location.search).get('token');
  if (!token) {
    const hashMatch = window.location.hash.match(/^#\/session\/(.+)$/);
    if (hashMatch) token = hashMatch[1].trim();
  }

  if (!token) {
    return _renderError({
      icon:  '🔗',
      title: 'Tautan Tidak Valid',
      msg:   'Tautan ujian tidak ditemukan. Pastikan Anda menggunakan tautan yang diberikan oleh panitia.',
    });
  }

  // ── 1. Fetch session ──
  try {
    _session = await getSessionByToken(token);
  } catch (e) {
    return _renderError({
      icon:      '🔌',
      title:     'Koneksi Gagal',
      msg:       'Gagal menghubungi server. Periksa koneksi internet Anda dan coba lagi.',
      retryable: true,
    });
  }

  if (!_session) {
    return _renderError({
      icon:  '❌',
      title: 'Tautan Tidak Ditemukan',
      msg:   'Tautan ujian ini tidak valid atau sudah dihapus. Hubungi panitia untuk mendapatkan tautan baru.',
    });
  }

  // ── 2. Cek expiry ──
  const expiredAt = _toDate(_session.expiredAt);
  if (Date.now() > expiredAt.getTime()) {
    return _renderError({
      icon:  '⏰',
      title: 'Tautan Kedaluwarsa',
      msg:   `Tautan ujian ini sudah tidak berlaku sejak ${expiredAt.toLocaleString('id-ID')}. Hubungi panitia.`,
    });
  }

  // ── 3. Cek status ──
  if (_session.status === 'submitted') return _renderAlreadySubmitted();
  if (_session.status === 'expired') {
    return _renderError({
      icon:  '⏰',
      title: 'Sesi Kedaluwarsa',
      msg:   'Sesi ujian ini sudah kedaluwarsa. Hubungi panitia.',
    });
  }

  // ── 4. Load exam config ──
  try {
    _exam = await getExam(_session.examId);
  } catch (e) {
    return _renderError({
      icon:      '📋',
      title:     'Konfigurasi Tidak Ditemukan',
      msg:       'Gagal memuat konfigurasi ujian. Hubungi panitia.',
      retryable: true,
    });
  }

  if (!_exam) {
    return _renderError({
      icon:  '📋',
      title: 'Ujian Tidak Ditemukan',
      msg:   'Konfigurasi ujian tidak tersedia. Hubungi panitia.',
    });
  }

  // ── 5a. Resume — sudah 'started' sebelumnya ──
  if (_session.status === 'started') {
    _renderLoading('Melanjutkan ujian...');
    try {
      _soalList = await _loadAndShuffleSoal();
    } catch (e) {
      return _renderError({
        icon:      '📚',
        title:     'Gagal Memuat Soal',
        msg:       'Gagal memuat soal ujian. Periksa koneksi dan coba lagi.',
        retryable: true,
      });
    }
    await requestFullscreen();
    await _startExam();
    return;
  }

  // ── 5b. Status 'issued' — tampilkan entry screen ──
  _renderEntryScreen();
}

// ─── Entry Screen ─────────────────────────────────────────────

function _renderEntryScreen() {
  const tipeLabel = _session.tipeSession === 'pretest' ? 'Pre-Test' : 'Post-Test';

  document.getElementById('app').innerHTML = `
    <div class="w-full max-w-md mx-auto">

      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
          <span class="text-white text-xl font-black">B</span>
        </div>
        <h1 class="text-lg font-bold text-gray-900">Sistem Ujian BTAM</h1>
        <p class="text-sm text-gray-400">Balai Teknik Air Minum</p>
      </div>

      <!-- Card verifikasi -->
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <span class="inline-block text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full mb-3">
          ${tipeLabel}
        </span>
        <h2 class="text-base font-bold text-gray-900 mb-1">${_esc(_exam.judul)}</h2>
        <p class="text-sm text-gray-400 mb-5">
          ${_exam.durasi} menit &middot; ${_session.soalIds.length} soal
        </p>

        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          Nomor Peserta
        </label>
        <input
          id="input-nopeserta"
          type="text"
          placeholder="Masukkan nomor peserta Anda"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-1"
        >
        <p id="nopeserta-err" class="text-red-500 text-xs mb-4 hidden">
          Nomor peserta tidak sesuai. Periksa kembali.
        </p>

        <button id="btn-verify"
          class="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl
                 hover:bg-blue-700 transition-colors text-sm">
          Verifikasi &amp; Lanjut
        </button>
      </div>
    </div>
  `;

  const input = document.getElementById('input-nopeserta');
  const btn   = document.getElementById('btn-verify');
  const errEl = document.getElementById('nopeserta-err');

  input.focus();
  input.addEventListener('keydown', e => { if (e.key === 'Enter') _handleVerify(); });
  btn.addEventListener('click', _handleVerify);

  async function _handleVerify() {
    const val = input.value.trim();

    if (!val) {
      errEl.textContent = 'Nomor peserta wajib diisi.';
      errEl.classList.remove('hidden');
      return;
    }

    // Case-insensitive match
    if (val.toLowerCase() !== _session.noPeserta.toLowerCase()) {
      errEl.textContent = 'Nomor peserta tidak sesuai. Periksa kembali.';
      errEl.classList.remove('hidden');
      input.select();
      return;
    }

    errEl.classList.add('hidden');
    btn.disabled    = true;
    btn.textContent = 'Memuat soal...';

    try {
      _soalList = await _loadAndShuffleSoal();
      _renderInstructionScreen();
    } catch (e) {
      btn.disabled    = false;
      btn.textContent = 'Verifikasi & Lanjut';
      alert('Gagal memuat soal. Periksa koneksi dan coba lagi.');
    }
  }
}

// ─── Instruction Screen ───────────────────────────────────────

function _renderInstructionScreen() {
  document.getElementById('app').innerHTML = `
    <div class="w-full max-w-md mx-auto">
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 class="text-base font-bold text-gray-900 mb-4">📋 Petunjuk Ujian</h2>

        <ul class="space-y-3 text-sm text-gray-600 mb-6">
          <li class="flex gap-2">
            <span class="text-blue-500 mt-0.5 shrink-0 font-bold">•</span>
            <span>
              Durasi <strong>${_exam.durasi} menit</strong> dengan
              <strong>${_soalList.length} soal</strong>.
              Timer dimulai saat Anda klik "Mulai Ujian".
            </span>
          </li>
          <li class="flex gap-2">
            <span class="text-blue-500 mt-0.5 shrink-0 font-bold">•</span>
            <span>
              Jawaban tersimpan otomatis setiap 30 detik.
              Jika ada gangguan jaringan, buka kembali tautan yang sama untuk melanjutkan.
            </span>
          </li>
          <li class="flex gap-2">
            <span class="text-red-500 mt-0.5 shrink-0 font-bold">•</span>
            <span>
              Dilarang berpindah tab, jendela, atau aplikasi selama ujian berlangsung.
              Setiap pelanggaran dicatat sebagai peringatan.
            </span>
          </li>
          <li class="flex gap-2">
            <span class="text-red-500 mt-0.5 shrink-0 font-bold">•</span>
            <span>
              Maksimal <strong>${EXAM_DEFAULTS.MAX_WARNINGS} peringatan</strong>.
              Jika terlampaui, jawaban dikumpulkan otomatis.
            </span>
          </li>
          <li class="flex gap-2">
            <span class="text-red-500 mt-0.5 shrink-0 font-bold">•</span>
            <span>
              Ujian wajib dijalankan dalam mode <strong>layar penuh</strong>.
              Keluar dari layar penuh dihitung sebagai peringatan.
            </span>
          </li>
          <li class="flex gap-2">
            <span class="text-amber-500 mt-0.5 shrink-0 font-bold">•</span>
            <span>
              Copy, paste, klik kanan, dan screenshot dinonaktifkan selama ujian.
            </span>
          </li>
        </ul>

        <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-700">
          Setelah klik <strong>Mulai Ujian</strong>, browser akan masuk ke layar penuh
          dan timer langsung berjalan. Pastikan Anda siap.
        </div>

        <button id="btn-start"
          class="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl
                 hover:bg-blue-700 transition-colors text-sm">
          🚀 Mulai Ujian
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-start').addEventListener('click', async () => {
    await requestFullscreen();
    await _startExam();
  });
}

// ─── Start / Resume Exam ──────────────────────────────────────

async function _startExam() {
  // Tampilkan watermark noPeserta
  const wm = document.getElementById('watermark');
  if (wm) wm.textContent = _session.noPeserta;

  // Update status ke 'started' hanya jika belum
  if (_session.status !== 'started') {
    try {
      await startSession(_session.id);
      _session.status    = 'started';
      _session.startedAt = new Date(); // approx — server time dipakai untuk kalkulasi akurat
    } catch (e) {
      console.error('[App] startSession gagal:', e);
      // Lanjutkan tetap — exam runner akan pakai waktu penuh
    }
  }

  initExamRunner({
    session:    _session,
    exam:       _exam,
    soalList:   _soalList,
    onComplete: _renderResultScreen,
  });
}

// ─── Result Screen ────────────────────────────────────────────

function _renderResultScreen() {
  destroyExamRunner();

  // Sembunyikan watermark
  const wm = document.getElementById('watermark');
  if (wm) wm.textContent = '';

  document.getElementById('app').innerHTML = `
    <div class="w-full max-w-md mx-auto">
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">

        <div class="text-6xl mb-4">✅</div>

        <h2 class="text-xl font-bold text-gray-900 mb-2">
          Jawaban Berhasil Dikumpulkan
        </h2>
        <p class="text-sm text-gray-500 mb-6">
          Terima kasih, <strong>${_esc(_session.noPeserta)}</strong>.<br>
          Jawaban Anda telah tersimpan dan akan diproses oleh panitia.
        </p>

        <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 text-left">
          <p class="font-semibold mb-1">Apa selanjutnya?</p>
          <p>
            Hasil ujian akan diumumkan oleh panitia setelah seluruh peserta selesai.
            Anda dapat menutup halaman ini sekarang.
          </p>
        </div>

        <!--
        ═══════════════════════════════════════════════════════════════
        UPGRADE PATH — Phase 2 (Cloud Function + Blaze Plan)
        ───────────────────────────────────────────────────────────────
        Saat Cloud Function sudah aktif dan exam_results bisa dibaca
        oleh exam app, uncomment bagian di bawah dan hapus bagian
        "Jawaban Berhasil Dikumpulkan" di atas. Ganti dengan:

        1. Firestore rule tambahan:
           match /exam_results/{doc} {
             allow read: if isAdmin() || request.auth == null;
           }

        2. Import fungsi getResultBySession di db.js:
           export async function getResultBySession(sessionId) {
             const snap = await getDocs(
               query(collection(db, 'exam_results'), where('sessionId', '==', sessionId))
             );
             if (snap.empty) return null;
             const d = snap.docs[0];
             return { id: d.id, ...d.data() };
           }

        3. Uncomment block di bawah dan panggil getResultBySession(_session.id)
           setelah submit selesai untuk menampilkan skor langsung.

        <div id="score-container" class="mt-6">
          <div class="animate-pulse text-gray-400 text-sm">Memuat nilai...</div>
        </div>
        ═══════════════════════════════════════════════════════════════
        -->

      </div>
    </div>
  `;
}

// ─── Utility Screens ──────────────────────────────────────────

function _renderLoading(msg = 'Memuat ujian...') {
  document.getElementById('app').innerHTML = `
    <div class="text-center">
      <div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-gray-400 text-sm">${_esc(msg)}</p>
    </div>
  `;
}

function _renderError({ icon = '⚠️', title, msg, retryable = false }) {
  document.getElementById('app').innerHTML = `
    <div class="w-full max-w-sm mx-auto text-center">
      <div class="text-6xl mb-4">${icon}</div>
      <h2 class="text-lg font-bold text-gray-900 mb-2">${_esc(title)}</h2>
      <p class="text-sm text-gray-500 mb-6">${_esc(msg)}</p>
      ${retryable ? `
        <button onclick="window.location.reload()"
          class="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
          Coba Lagi
        </button>
      ` : ''}
    </div>
  `;
}

function _renderAlreadySubmitted() {
  document.getElementById('app').innerHTML = `
    <div class="w-full max-w-sm mx-auto text-center">
      <div class="text-6xl mb-4">✅</div>
      <h2 class="text-lg font-bold text-gray-900 mb-2">Ujian Sudah Dikumpulkan</h2>
      <p class="text-sm text-gray-500">
        Jawaban Anda sudah tersimpan sebelumnya.<br>
        Anda dapat menutup halaman ini.
      </p>
    </div>
  `;
}

// ─── Helpers ──────────────────────────────────────────────────

/** Load soal lalu shuffle deterministik berdasarkan token */
async function _loadAndShuffleSoal() {
  const soalRaw = await getSoalList(_session.soalIds);
  return _deterministicShuffle(soalRaw, _session.token);
}

/**
 * Fisher-Yates dengan Mulberry32 seeded RNG.
 * Hasilnya selalu sama untuk token yang sama → konsisten saat resume.
 */
function _deterministicShuffle(arr, token) {
  const result = [...arr];
  let seed = 0;
  for (let i = 0; i < token.length; i++) {
    seed = (Math.imul(31, seed) + token.charCodeAt(i)) | 0;
  }
  function rng() {
    seed |= 0;
    seed  = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t     = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function _toDate(ts) {
  if (!ts)            return new Date();
  if (ts.toDate)      return ts.toDate();
  if (ts instanceof Date) return ts;
  if (ts.seconds)     return new Date(ts.seconds * 1000);
  return new Date(ts);
}

function _esc(str) {
  const el = document.createElement('span');
  el.appendChild(document.createTextNode(str ?? ''));
  return el.innerHTML;
}
