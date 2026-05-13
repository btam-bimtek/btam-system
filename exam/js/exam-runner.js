// exam/js/exam-runner.js
// Mengelola UI ujian aktif: render soal, timer, auto-save, navigasi, submit.

import { autoSaveAnswers, submitExam } from './db.js';
import { initAntiCheat, destroyAntiCheat, getWarnCount, pauseAntiCheat, resumeAntiCheat } from './anti-cheat.js';
import { EXAM_DEFAULTS } from '../../shared/constants.js';

// ─── State ────────────────────────────────────────────────────
let _session     = null;
let _exam        = null;
let _soalList    = [];
let _answers     = {};        // { [soalId]: 'a'|'b'|'c'|'d' }
let _flagged     = new Set();
let _currentIdx  = 0;
let _secondsLeft = 0;
let _timerRef    = null;
let _saveRef     = null;
let _onComplete  = null;
let _submitting  = false;

// ─── Public API ───────────────────────────────────────────────

/**
 * Inisialisasi dan tampilkan exam runner.
 * Dipanggil oleh app.js setelah peserta verifikasi noPeserta.
 */
export function initExamRunner({ session, exam, soalList, onComplete }) {
  _session    = session;
  _exam       = exam;
  _soalList   = soalList;
  _onComplete = onComplete;
  _submitting = false;
  _currentIdx = 0;
  _flagged    = new Set();

  // Restore jawaban jika resume
  _answers = session.answers ? { ...session.answers } : {};

  // Hitung sisa waktu — handle resume (startedAt sudah ada)
  const durasiBiasaMenit = exam.durasi || EXAM_DEFAULTS.DURASI_MENIT;
  if (session.startedAt) {
    const startMs    = _toMs(session.startedAt);
    const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
    _secondsLeft = Math.max(0, durasiBiasaMenit * 60 - elapsedSec);
  } else {
    _secondsLeft = durasiBiasaMenit * 60;
  }

  _renderShell();
  _renderQuestion();
  _renderNavGrid();
  _startTimer();
  _startAutoSave();

  // Restore warning count dari session — penting saat resume setelah refresh
  const restoredWarnCount = session.warningCount || 0;

  initAntiCheat({
    maxWarnings:      EXAM_DEFAULTS.MAX_WARNINGS,
    initialWarnCount: restoredWarnCount,
    onWarn:           _handleWarn,
    onAutoSubmit:     _handleAutoSubmit,
  });

  // Sinkronkan badge warning di header dengan count yang di-restore
  if (restoredWarnCount > 0) _updateWarnBadge(restoredWarnCount);
}

/** Bersihkan semua interval dan listener. Dipanggil setelah submit. */
export function destroyExamRunner() {
  clearInterval(_timerRef);
  clearInterval(_saveRef);
  destroyAntiCheat();
}

// ─── Shell (struktur statis) ──────────────────────────────────

function _renderShell() {
  const total     = _soalList.length;
  const tipeLabel = _session.tipeSession === 'pretest' ? 'Pre-Test' : 'Post-Test';

  document.getElementById('app').innerHTML = `
<div id="exam-screen" class="w-full max-w-2xl mx-auto flex flex-col" style="min-height:100vh">

  <!-- Header tetap di atas -->
  <div class="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-50">
    <div class="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between gap-2">

      <div class="flex items-center gap-1.5">
        <span class="text-gray-300 text-base">⏱</span>
        <span id="timer-display" class="text-xl font-bold tabular-nums text-gray-900 leading-none">
          --:--
        </span>
      </div>

      <span class="text-xs text-gray-400 font-medium">
        ${tipeLabel} &middot; Soal <span id="q-current">${_currentIdx + 1}</span>/${total}
      </span>

      <div id="warn-badge"
        class="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
        ⚠️ 0/${EXAM_DEFAULTS.MAX_WARNINGS}
      </div>

    </div>
  </div>

  <!-- Spacer setinggi header -->
  <div class="h-14 shrink-0"></div>

  <!-- Konten utama -->
  <div class="flex-1 px-4 py-5 space-y-3">

    <!-- Kartu soal (di-render ulang tiap navigasi) -->
    <div id="question-card"
      class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
    </div>

    <!-- Navigasi soal -->
    <div class="flex gap-2">
      <button id="btn-prev"
        class="flex-1 py-2.5 px-3 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
        ← Sebelumnya
      </button>
      <button id="btn-flag"
        class="py-2.5 px-3 rounded-xl border border-amber-300 text-amber-700 font-medium text-sm hover:bg-amber-50 whitespace-nowrap">
        🚩 Tandai
      </button>
      <button id="btn-next"
        class="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
        Berikutnya →
      </button>
    </div>

    <!-- Grid navigasi cepat -->
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
        Navigasi Soal
      </p>
      <div id="q-nav-grid" class="flex flex-wrap gap-1.5 mb-3"></div>
      <div class="flex gap-4 text-xs text-gray-400">
        <span class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded bg-blue-600 inline-block"></span> Dijawab
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded bg-amber-100 border border-amber-400 inline-block"></span> Ditandai
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded bg-gray-100 border border-gray-300 inline-block"></span> Belum
        </span>
      </div>
    </div>

    <!-- Tombol kumpulkan -->
    <button id="btn-submit"
      class="w-full py-3.5 rounded-xl bg-green-600 text-white font-semibold text-base hover:bg-green-700 shadow-sm transition-colors">
      ✓ Kumpulkan Jawaban
    </button>
    <p class="text-xs text-center text-gray-400 pb-6">
      Pastikan semua soal sudah dijawab sebelum mengumpulkan.
    </p>

  </div>
</div>`;

  _bindStaticEvents();
}

// ─── Render soal ──────────────────────────────────────────────

function _renderQuestion() {
  const soal = _soalList[_currentIdx];
  if (!soal) return;

  const card      = document.getElementById('question-card');
  if (!card) return;

  const jawaban   = _answers[soal.id];
  const isFlagged = _flagged.has(soal.id);
  const opsiAcak  = _shuffleOpsi(soal.opsi || [], soal.id, _session.token);

  card.innerHTML = `
    <div class="flex items-start justify-between mb-4">
      <span class="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
        Soal ${_currentIdx + 1} dari ${_soalList.length}
      </span>
      ${isFlagged
        ? '<span class="text-xs text-amber-600 font-medium">🚩 Ditandai untuk review</span>'
        : ''}
    </div>

    <p class="text-gray-900 font-medium text-base leading-relaxed ${soal.pertanyaanImage ? 'mb-3' : 'mb-5'}">
      ${_esc(soal.pertanyaan)}
    </p>

    ${soal.pertanyaanImage ? `
    <div class="mb-5">
      <img src="${soal.pertanyaanImage}" alt="Gambar soal"
           class="max-w-full rounded-xl border border-gray-200 object-contain mx-auto block"
           style="max-height:280px;"
           loading="lazy" />
    </div>` : ''}

    <div class="space-y-2.5" id="options-list">
      ${opsiAcak.map((opsi, idx) => {
        // Label posisi (A/B/C/D) berdasarkan urutan tampil, bukan opsi.id asli
        const huruf = String.fromCharCode(65 + idx); // 0→A, 1→B, 2→C, 3→D
        return `
        <label class="option-card flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 ${jawaban === opsi.id ? 'selected' : ''}">
          <input
            type="radio"
            name="jawaban"
            value="${opsi.id}"
            ${jawaban === opsi.id ? 'checked' : ''}
            class="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
          >
          <span class="font-bold text-gray-400 text-sm w-5 shrink-0">
            ${huruf}.
          </span>
          <span class="text-gray-800 text-sm leading-relaxed">
            ${_esc(opsi.text)}
          </span>
        </label>`;
      }).join('')}
    </div>
  `;

  // Bind pilihan jawaban
  card.querySelectorAll('input[name="jawaban"]').forEach(radio => {
    radio.addEventListener('change', e => {
      _answers[soal.id] = e.target.value;
      // Update visual selected state tanpa re-render penuh
      card.querySelectorAll('.option-card').forEach(el => el.classList.remove('selected'));
      e.target.closest('.option-card').classList.add('selected');
      _renderNavGrid();
    });
  });

  // Update header progress
  const qCurrent = document.getElementById('q-current');
  if (qCurrent) qCurrent.textContent = _currentIdx + 1;

  // Update state tombol prev/next/flag
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnFlag = document.getElementById('btn-flag');

  if (btnPrev) btnPrev.disabled = _currentIdx === 0;
  if (btnNext) btnNext.disabled = _currentIdx === _soalList.length - 1;
  if (btnFlag) {
    if (isFlagged) {
      btnFlag.textContent = '✓ Hapus Tanda';
      btnFlag.className   = 'py-2.5 px-3 rounded-xl border border-gray-300 text-gray-600 font-medium text-sm hover:bg-gray-50 whitespace-nowrap';
    } else {
      btnFlag.textContent = '🚩 Tandai';
      btnFlag.className   = 'py-2.5 px-3 rounded-xl border border-amber-300 text-amber-700 font-medium text-sm hover:bg-amber-50 whitespace-nowrap';
    }
  }
}

// ─── Grid navigasi ────────────────────────────────────────────

function _renderNavGrid() {
  const grid = document.getElementById('q-nav-grid');
  if (!grid) return;

  grid.innerHTML = _soalList.map((soal, idx) => {
    const answered  = !!_answers[soal.id];
    const flagged   = _flagged.has(soal.id);
    const isCurrent = idx === _currentIdx;

    let cls = 'q-nav-btn ';
    if (flagged)       cls += 'bg-amber-100 border-amber-400 text-amber-800 ';
    else if (answered) cls += 'bg-blue-600 border-blue-500 text-white ';
    else               cls += 'bg-gray-50 border-gray-300 text-gray-500 ';
    if (isCurrent)     cls += 'outline outline-2 outline-offset-1 outline-amber-400 ';

    return `<button class="${cls}" data-idx="${idx}">${idx + 1}</button>`;
  }).join('');

  grid.querySelectorAll('[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      _currentIdx = parseInt(btn.dataset.idx);
      _renderQuestion();
      _renderNavGrid();
    });
  });
}

// ─── Event binding ────────────────────────────────────────────

function _bindStaticEvents() {
  document.getElementById('btn-prev')?.addEventListener('click', () => {
    if (_currentIdx > 0) { _currentIdx--; _renderQuestion(); _renderNavGrid(); }
  });

  document.getElementById('btn-next')?.addEventListener('click', () => {
    if (_currentIdx < _soalList.length - 1) { _currentIdx++; _renderQuestion(); _renderNavGrid(); }
  });

  document.getElementById('btn-flag')?.addEventListener('click', () => {
    const soalId = _soalList[_currentIdx]?.id;
    if (!soalId) return;
    if (_flagged.has(soalId)) _flagged.delete(soalId);
    else _flagged.add(soalId);
    _renderQuestion();
    _renderNavGrid();
  });

  document.getElementById('btn-submit')?.addEventListener('click', _handleSubmitClick);
}

// ─── Timer ────────────────────────────────────────────────────

function _startTimer() {
  _updateTimerDisplay();
  _timerRef = setInterval(() => {
    _secondsLeft = Math.max(0, _secondsLeft - 1);
    _updateTimerDisplay();
    if (_secondsLeft === 0) {
      clearInterval(_timerRef);
      _handleAutoSubmit('time_up');
    }
  }, 1000);
}

function _updateTimerDisplay() {
  const el = document.getElementById('timer-display');
  if (!el) return;
  const m = Math.floor(_secondsLeft / 60);
  const s = _secondsLeft % 60;
  el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  if (_secondsLeft <= 300) {
    el.className = 'text-xl font-bold tabular-nums leading-none text-red-600 timer-critical';
  } else if (_secondsLeft <= 600) {
    el.className = 'text-xl font-bold tabular-nums leading-none text-amber-500';
  } else {
    el.className = 'text-xl font-bold tabular-nums leading-none text-gray-900';
  }
}

// ─── Auto-save ────────────────────────────────────────────────

function _startAutoSave() {
  _saveRef = setInterval(async () => {
    try {
      await autoSaveAnswers(_session.id, _answers, getWarnCount());
    } catch (e) {
      console.warn('[AutoSave] Gagal:', e.message);
    }
  }, EXAM_DEFAULTS.AUTOSAVE_DETIK * 1000);
}

// ─── Anti-cheat callbacks ─────────────────────────────────────

function _handleWarn(count, max, reason) {
  _updateWarnBadge(count);

  const msgs = {
    tab_switch:      'Anda berpindah tab atau aplikasi lain.',
    window_blur:     'Jendela ujian kehilangan fokus.',
    exit_fullscreen: 'Anda keluar dari mode layar penuh.',
  };
  const isLast = count >= max;
  _showToast(
    `⚠️ Peringatan ${count}/${max}`,
    msgs[reason] || 'Aktivitas tidak sesuai terdeteksi.',
    isLast ? 'red' : 'amber',
    isLast ? 'Jawaban dikumpulkan otomatis!' : null,
  );
}

function _updateWarnBadge(count) {
  const badge = document.getElementById('warn-badge');
  if (!badge) return;
  badge.textContent = `⚠️ ${count}/${EXAM_DEFAULTS.MAX_WARNINGS}`;
  badge.className   = count >= EXAM_DEFAULTS.MAX_WARNINGS - 1
    ? 'text-xs font-semibold bg-red-100 text-red-600 px-2 py-1 rounded-full whitespace-nowrap'
    : count > 0
      ? 'text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-1 rounded-full whitespace-nowrap'
      : 'text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap';
}

function _showToast(title, body, color = 'amber', extra = null) {
  document.getElementById('exam-toast')?.remove();
  const bg   = color === 'red' ? 'bg-red-600' : 'bg-amber-500';
  const el   = document.createElement('div');
  el.id      = 'exam-toast';
  el.className = `fixed top-16 left-1/2 -translate-x-1/2 z-50 ${bg} text-white px-5 py-3 rounded-2xl shadow-xl text-sm text-center max-w-xs`;
  el.innerHTML = `
    <strong>${title}</strong><br>
    <span class="text-xs opacity-90">${body}</span>
    ${extra ? `<br><span class="text-xs font-bold">${extra}</span>` : ''}
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── Submit ───────────────────────────────────────────────────

async function _handleSubmitClick() {
  if (_submitting) return;
  const belum     = _soalList.filter(s => !_answers[s.id]).length;
  const konfirmasi = belum > 0
    ? `Masih ada ${belum} soal yang belum dijawab.\n\nYakin ingin mengumpulkan?`
    : 'Yakin ingin mengumpulkan jawaban?\nUjian tidak dapat dilanjutkan setelah dikumpulkan.';

  // Pause anti-cheat sementara — confirm() dialog bisa trigger blur/visibilitychange
  // yang menyebabkan false warning saat peserta belum benar-benar curang
  pauseAntiCheat();
  const ok = confirm(konfirmasi);
  resumeAntiCheat();

  if (!ok) return;
  await _doSubmit('manual');
}

async function _handleAutoSubmit(reason) {
  if (_submitting) return;
  clearInterval(_timerRef);
  clearInterval(_saveRef);

  const msgs = {
    time_up:      'Waktu ujian habis.',
    max_warnings: 'Batas peringatan terlampaui.',
  };
  _showOverlay(msgs[reason] || 'Ujian diselesaikan otomatis.');
  await _doSubmit(reason);
}

function _showOverlay(msg) {
  const el     = document.createElement('div');
  el.id        = 'submit-overlay';
  el.className = 'fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4';
  el.innerHTML = `
    <div class="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
      <div class="text-5xl mb-3">⏰</div>
      <h3 class="font-bold text-gray-900 text-lg mb-2">Ujian Selesai</h3>
      <p class="text-gray-500 text-sm mb-3">${msg}</p>
      <p class="text-gray-400 text-xs">Sedang mengumpulkan jawaban...</p>
    </div>
  `;
  document.body.appendChild(el);
}

async function _doSubmit(reason) {
  if (_submitting) return;
  _submitting = true;

  clearInterval(_timerRef);
  clearInterval(_saveRef);
  destroyAntiCheat();

  const btnSubmit = document.getElementById('btn-submit');
  if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Mengumpulkan...'; }

  try {
    await submitExam(_session.id, {
      examId:      _session.examId,
      bimtekId:    _session.bimtekId,
      noPeserta:   _session.noPeserta,
      tipeSession: _session.tipeSession,
      answers:     { ..._answers },
      flagged:     [..._flagged],
      submitReason: reason,
      warningCount: getWarnCount(),
      totalSoal:   _soalList.length,
    });
    _onComplete?.();
  } catch (err) {
    console.error('[Submit] Error:', err);
    _submitting = false;
    document.getElementById('submit-overlay')?.remove();
    if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = '✓ Kumpulkan Jawaban'; }
    alert('Gagal mengumpulkan jawaban.\nPeriksa koneksi dan coba lagi. Jika masalah berlanjut, hubungi pengawas.');
  }
}

// ─── Utils ────────────────────────────────────────────────────

/**
 * Shuffle opsi A/B/C/D secara deterministik berdasarkan soalId + token.
 * Konsisten across page refresh untuk soal yang sama di peserta yang sama.
 */
function _shuffleOpsi(opsi, soalId, token) {
  if (!opsi.length) return [];
  const arr  = [...opsi];
  const rand = _seededRng(soalId + token);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Mulberry32 seeded PRNG */
function _seededRng(seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (Math.imul(31, seed) + seedStr.charCodeAt(i)) | 0;
  }
  return function () {
    seed |= 0;
    seed  = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t     = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Escape HTML sebelum inject ke innerHTML */
function _esc(str) {
  const el = document.createElement('span');
  el.appendChild(document.createTextNode(str ?? ''));
  return el.innerHTML;
}

/** Convert Firestore Timestamp / Date / number ke milliseconds */
function _toMs(ts) {
  if (!ts) return Date.now();
  if (ts.toDate)          return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  if (ts.seconds)         return ts.seconds * 1000; // Firestore Timestamp object
  return Number(ts);
}
