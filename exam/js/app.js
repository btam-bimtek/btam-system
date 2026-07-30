// exam/js/app.js
// Orchestrator utama exam app.
// Mengelola alur: loading → validasi token → entry screen → instruksi → ujian → result.

import {
  getSessionByToken, getExam, getExamFromServer, getSoalList,
  startSessionWithDevice, claimDeviceForResume,
  getBimtekByAccessCode, getSessionsByBimtekAndPeserta, getExamsByBimtek,
} from './db.js';
import { initExamRunner, destroyExamRunner }                     from './exam-runner.js';
import { requestFullscreen }                                      from './anti-cheat.js';
import { EXAM_DEFAULTS }                                          from '../../shared/constants.js';
import { showErrorModal }                                         from './ui-modal.js';

// ─── State ────────────────────────────────────────────────────
let _session  = null;
let _exam     = null;
let _soalList = [];

// ─── Device Token ─────────────────────────────────────────────
// UUID unik per browser tab — dibuat sekali lalu disimpan di sessionStorage
// sehingga tetap sama saat refresh tapi berbeda di tab/device lain.

function _getOrCreateDeviceToken() {
  const KEY = 'btam_exam_device_token';
  let token = sessionStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem(KEY, token);
  }
  return token;
}

// ─── Boot ─────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', _boot);

async function _boot() {
  _renderLoading();

  // Support dua format URL (backward compat magic link lama):
  // 1. ?token=UUID
  // 2. #/session/UUID
  let token = new URLSearchParams(window.location.search).get('token');
  if (!token) {
    const hashMatch = window.location.hash.match(/^#\/session\/(.+)$/);
    if (hashMatch) token = hashMatch[1].trim();
  }

  if (token) {
    await _bootByToken(token);
  } else {
    _renderKodeUjianScreen();
  }
}

// ─── Boot via Magic Link (backward compat) ────────────────────

async function _bootByToken(token) {
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

  // ── 4. Load exam config (dari server, bukan cache — untuk cek window terbaru) ──
  try {
    _exam = await getExamFromServer(_session.examId);
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

  // ── 4b. Cek window — hanya untuk sesi yang belum dimulai ──
  if (_session.status === 'issued' && !_isWindowOpen(_exam, _session.tipeSession)) {
    return _renderExamWindowClosed(_session.tipeSession);
  }

  // ── 5a. Resume ──
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

  // ── 5b. Issued — entry screen lama (input noPeserta) ──
  _renderEntryScreen();
}

// ─── Alur Kode Ujian (4 Langkah) ─────────────────────────────

function _renderKodeUjianScreen() {
  const appEl = document.getElementById('app');

  // State lokal alur ini
  let _bimtekL   = null;
  let _examsL    = [];    // semua ujian published dalam bimtek ini
  let _sessionsL = null;  // semua sesi peserta dalam bimtek ini
  let _examIdL   = null;  // examId yang dipilih di step 3
  let _tipeL     = null;  // tipeSession yang dipilih di step 4

  appEl.innerHTML = `
    <div class="w-full max-w-md mx-auto space-y-3">

      <!-- Header -->
      <div class="text-center mb-6">
        <div class="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
          <span class="text-white text-xl font-black">B</span>
        </div>
        <h1 class="text-lg font-bold text-gray-900">Sistem Ujian BTAM</h1>
        <p class="text-sm text-gray-400">Balai Teknik Air Minum</p>
      </div>

      <!-- Langkah 1 -->
      <div id="s1" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p class="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-3">Langkah 1 — Kode Ujian</p>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">Kode ujian dari panitia</label>
        <div class="flex gap-2">
          <input id="inp-kode" type="text" maxlength="7" placeholder="Contoh: ABC-DEF"
            autocomplete="off" spellcheck="false"
            class="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-mono uppercase
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <button id="btn-cek-kode"
            class="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            Periksa
          </button>
        </div>
        <p id="s1-err" class="text-red-500 text-xs mt-1.5 hidden"></p>
        <div id="s1-info" class="hidden mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p class="text-xs font-semibold text-blue-600 mb-0.5">✓ Ujian ditemukan</p>
          <p id="s1-nama" class="text-sm font-bold text-gray-900"></p>
          <p id="s1-periode" class="text-xs text-gray-500 mt-0.5"></p>
        </div>
      </div>

      <!-- Langkah 2 (hidden) -->
      <div id="s2" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hidden">
        <p class="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-3">Langkah 2 — Nomor Peserta</p>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">Nomor peserta Anda</label>
        <div class="flex gap-2">
          <input id="inp-np" type="text" placeholder="Contoh: 26000101"
            autocomplete="off" spellcheck="false"
            class="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <button id="btn-cek-np"
            class="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            Periksa
          </button>
        </div>
        <p id="s2-err" class="text-red-500 text-xs mt-1.5 hidden"></p>
        <div id="s2-info" class="hidden mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-xs font-semibold text-blue-600 mb-1">✓ Peserta ditemukan</p>
              <p id="s2-nama" class="text-sm font-bold text-gray-900"></p>
              <p id="s2-jabatan" class="text-xs text-gray-600 mt-0.5"></p>
              <p id="s2-instansi" class="text-xs text-gray-500"></p>
            </div>
            <button id="btn-ubah-np"
              class="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition-colors">
              Ubah
            </button>
          </div>
        </div>
      </div>

      <!-- Langkah 3 — Pilih Ujian (hidden, muncul jika ada >1 exam) -->
      <div id="s3" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hidden">
        <p class="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-3">Langkah 3 — Pilih Ujian</p>
        <div id="s3-opts" class="space-y-2"></div>
      </div>

      <!-- Langkah 4 — Jenis Ujian (hidden) -->
      <div id="s4" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hidden">
        <p class="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-3">Langkah 4 — Jenis Ujian</p>
        <div id="s4-opts" class="space-y-2"></div>
      </div>

      <!-- Langkah 5 — Status Sesi (hidden) -->
      <div id="s5" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hidden">
        <p class="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-3">Langkah 5 — Status Sesi</p>
        <div id="s5-body"></div>
      </div>

    </div>`;

  const q = id => appEl.querySelector(id);

  // ── Langkah 1 ────────────────────────────────────────────────
  const inpKode = q('#inp-kode');
  inpKode.focus();
  inpKode.addEventListener('input', () => {
    inpKode.value = inpKode.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 7);
  });
  inpKode.addEventListener('keydown', e => { if (e.key === 'Enter') q('#btn-cek-kode').click(); });

  q('#btn-cek-kode').addEventListener('click', async () => {
    const raw  = inpKode.value.trim();
    const kode = raw.replace(/[^A-Z0-9]/g, '');
    const err  = q('#s1-err');
    if (!kode) { _showErr(err, 'Kode ujian wajib diisi.'); return; }

    const btn = q('#btn-cek-kode');
    btn.disabled = true; btn.textContent = 'Memeriksa...';
    err.classList.add('hidden');

    try {
      _bimtekL = await getBimtekByAccessCode(kode);
    } catch {
      _showErr(err, 'Koneksi gagal. Periksa internet dan coba lagi.');
      btn.disabled = false; btn.textContent = 'Periksa';
      return;
    }

    if (!_bimtekL) {
      _showErr(err, 'Kode ujian tidak ditemukan atau ujian belum dibuka.');
      btn.disabled = false; btn.textContent = 'Periksa';
      return;
    }

    q('#s1-nama').textContent    = _bimtekL.nama || '—';
    q('#s1-periode').textContent = _fmtPeriode(_bimtekL.periode);
    q('#s1-info').classList.remove('hidden');
    inpKode.readOnly = true;
    btn.classList.add('hidden');

    // Muat daftar ujian bimtek ini di background (tidak blocking)
    getExamsByBimtek(_bimtekL.id).then(exams => { _examsL = exams; }).catch(() => {});

    q('#s2').classList.remove('hidden');
    q('#inp-np').focus();
    q('#s2').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // ── Langkah 2 ────────────────────────────────────────────────
  const inpNp = q('#inp-np');
  inpNp.addEventListener('keydown', e => { if (e.key === 'Enter') q('#btn-cek-np').click(); });

  q('#btn-cek-np').addEventListener('click', async () => {
    const np  = inpNp.value.trim();
    const err = q('#s2-err');
    if (!np) { _showErr(err, 'Nomor peserta wajib diisi.'); return; }

    const btn = q('#btn-cek-np');
    btn.disabled = true; btn.textContent = 'Memeriksa...';
    err.classList.add('hidden');

    try {
      _sessionsL = await getSessionsByBimtekAndPeserta(_bimtekL.id, np);
      // Coba uppercase jika tidak ditemukan
      if (!_sessionsL.length && np !== np.toUpperCase()) {
        _sessionsL = await getSessionsByBimtekAndPeserta(_bimtekL.id, np.toUpperCase());
      }
    } catch {
      _showErr(err, 'Koneksi gagal. Periksa internet dan coba lagi.');
      btn.disabled = false; btn.textContent = 'Periksa';
      return;
    }

    if (!_sessionsL.length) {
      _showErr(err, 'Nomor peserta tidak ditemukan dalam ujian ini. Periksa kembali atau hubungi panitia.');
      btn.disabled = false; btn.textContent = 'Periksa';
      return;
    }

    const info = _sessionsL[0];
    q('#s2-nama').textContent     = info.namaPeserta     || np;
    q('#s2-jabatan').textContent  = info.jabatanPeserta  || '';
    q('#s2-instansi').textContent = info.instansiPeserta || '';
    q('#s2-info').classList.remove('hidden');
    inpNp.readOnly = true;
    btn.classList.add('hidden');

    // Gunakan daftar ujian dari bimtek (_examsL) sebagai acuan picker.
    // Fallback ke examIds dari sesi kalau _examsL belum selesai dimuat.
    const examIdsFromSessions = [...new Set(_sessionsL.map(s => s.examId))];
    const pickerExams = _examsL.length > 0 ? _examsL : examIdsFromSessions.map(id => {
      const s = _sessionsL.find(x => x.examId === id);
      return { id, judul: s?.examJudul || id };
    });

    if (pickerExams.length > 1) {
      _renderStep3ExamPicker(pickerExams);
    } else {
      _examIdL = pickerExams[0]?.id || examIdsFromSessions[0];
      q('#s3').classList.add('hidden');
      _renderStep4();
    }

    q('#btn-ubah-np').addEventListener('click', () => {
      _sessionsL  = null;
      _examIdL    = null;
      _tipeL      = null;

      q('#s2-info').classList.add('hidden');
      inpNp.readOnly = false;
      inpNp.value    = '';
      q('#btn-cek-np').classList.remove('hidden');
      q('#btn-cek-np').disabled    = false;
      q('#btn-cek-np').textContent = 'Periksa';
      q('#s2-err').classList.add('hidden');

      q('#s3').classList.add('hidden');
      q('#s3-opts').innerHTML = '';
      q('#s4').classList.add('hidden');
      q('#s4-opts').innerHTML = '';
      q('#s5').classList.add('hidden');
      q('#s5-body').innerHTML = '';

      inpNp.focus();
    });
  });

  // ── Langkah 3 — Pilih Ujian (hanya kalau >1 exam) ────────────
  function _renderStep3ExamPicker(exams) {
    const s3   = q('#s3');
    const opts = q('#s3-opts');
    s3.classList.remove('hidden');

    // Peserta sudah submit Pre-Test di exam manapun dalam bimtek ini — dipakai
    // untuk mengunci exam Post-Test yang dibuat berdiri sendiri (tipe 'posttest'
    // murni, bukan gabungan 'pretest_posttest'), supaya urutan pengerjaan tetap
    // Pre-Test dulu baru Post-Test walau keduanya exam terpisah.
    const pretestSubmitted = (_sessionsL || []).some(s => s.tipeSession === 'pretest' && s.status === 'submitted');

    opts.innerHTML = exams.map(exam => {
      const examSessions   = (_sessionsL || []).filter(s => s.examId === exam.id);
      const judul          = exam.judul || examSessions[0]?.examJudul || exam.id;
      const hasSesi        = examSessions.length > 0;
      const lockedByPretest = exam.tipe === 'posttest' && !pretestSubmitted;
      const locked          = !hasSesi || lockedByPretest;
      const sel             = _examIdL === exam.id;
      return `
        <label class="flex items-center gap-3 p-3 border rounded-xl transition-colors
          ${locked
            ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
            : sel ? 'border-blue-500 bg-blue-50 cursor-pointer'
                  : 'border-gray-200 hover:bg-gray-50 cursor-pointer'}">
          <input type="radio" name="exam" value="${_esc(exam.id)}" class="accent-blue-600 shrink-0"
            ${locked ? 'disabled' : ''} ${sel ? 'checked' : ''}>
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-900">${_esc(judul)}</p>
            ${!hasSesi ? '<p class="text-xs text-gray-400 mt-0.5">Sesi belum dibuat oleh panitia</p>'
              : lockedByPretest ? '<p class="text-xs text-amber-600 mt-0.5">🔒 Selesaikan Pre-Test terlebih dahulu</p>'
              : ''}
          </div>
        </label>`;
    }).join('');

    opts.querySelectorAll('input[type="radio"]').forEach(r => {
      r.addEventListener('change', () => {
        _examIdL = r.value;
        _tipeL   = null;
        q('#s4-opts').innerHTML = '';
        q('#s5').classList.add('hidden');
        q('#s5-body').innerHTML = '';
        _renderStep3ExamPicker(exams);
        _renderStep4();
      });
    });

    s3.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── Langkah 4 — Pilih Jenis Ujian ────────────────────────────
  function _renderStep4() {
    const s4   = q('#s4');
    const opts = q('#s4-opts');
    s4.classList.remove('hidden');

    const sessByExam = _sessionsL.filter(s => s.examId === _examIdL);
    const sPretest   = sessByExam.find(s => s.tipeSession === 'pretest');
    const sPosttest  = sessByExam.find(s => s.tipeSession === 'posttest');
    const pretestOK  = sPretest?.status === 'submitted';

    // Status window ujian (dari exam data yang sudah di-load di background)
    const examData     = _examsL.find(e => e.id === _examIdL);
    const pretestOpen  = _isWindowOpen(examData, 'pretest');
    const posttestOpen = _isWindowOpen(examData, 'posttest');

    // Ujian tunggal — ditentukan dari tipe EXAM (bukan bentuk sesinya), supaya
    // exam 'pretest' atau 'posttest' yang dibuat berdiri sendiri (bukan gabungan
    // 'pretest_posttest') langsung lanjut ke step 5 tanpa gerbang palsu "selesaikan
    // pre-test dulu" — sebelumnya salah dideteksi karena tipeSession-nya kebetulan
    // 'pretest'/'posttest' juga.
    if (examData && examData.tipe !== 'pretest_posttest') {
      const sessSingle = sessByExam[0];
      if (sessSingle) {
        s4.classList.add('hidden');
        _tipeL = sessSingle.tipeSession;
        _renderStep5();
        return;
      }
    }

    // lockedByPretest: post-test dikunci karena pre-test belum selesai
    // adminClosed: panitia belum membuka window ujian (hanya berlaku untuk status 'issued')
    const _buildOpt = (sess, label, lockedByPretest, adminClosed) => {
      if (!sess) return '';
      const st      = sess.status;
      const isActive = st === 'started';
      // Window tertutup hanya memblokir sesi yang belum dimulai
      const blocked  = lockedByPretest || (adminClosed && st === 'issued');
      const stTxt = adminClosed && st === 'issued' ? '⏳ Menunggu dibuka panitia'
                  : st === 'submitted'              ? '✓ Sudah dikumpulkan'
                  : isActive                        ? '⏳ Sedang dikerjakan'
                  :                                   'Belum dikerjakan';
      const stCls = st === 'submitted'              ? 'text-green-600'
                  : adminClosed && st === 'issued'  ? 'text-gray-500'
                  : lockedByPretest                 ? 'text-amber-600'
                  :                                   'text-gray-400';
      const sel   = _tipeL === sess.tipeSession;
      return `
        <label class="flex items-center gap-3 p-3 border rounded-xl transition-colors
          ${blocked
            ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
            : sel ? 'border-blue-500 bg-blue-50 cursor-pointer'
                  : 'border-gray-200 hover:bg-gray-50 cursor-pointer'}">
          <input type="radio" name="tipe" value="${sess.tipeSession}" class="accent-blue-600 shrink-0"
            ${blocked ? 'disabled' : ''} ${sel ? 'checked' : ''}>
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-900">${label}</p>
            <p class="text-xs ${stCls} mt-0.5">
              ${adminClosed && st === 'issued' ? '🕐 Belum dibuka oleh panitia'
                : lockedByPretest ? '🔒 Selesaikan Pre-Test terlebih dahulu'
                : stTxt}
            </p>
          </div>
        </label>`;
    };

    opts.innerHTML = [
      _buildOpt(sPretest,  'Pre-Test',  false,       !pretestOpen),
      _buildOpt(sPosttest, 'Post-Test', !pretestOK,  !posttestOpen),
    ].join('');

    if (!sPretest && !sPosttest) {
      opts.innerHTML = `<p class="text-sm text-gray-500">Tidak ada sesi ujian tersedia. Hubungi panitia.</p>`;
    }

    opts.querySelectorAll('input[type="radio"]').forEach(r => {
      r.addEventListener('change', () => {
        _tipeL = r.value;
        _renderStep4();
        _renderStep5();
      });
    });

    s4.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── Langkah 5 — Status Sesi ───────────────────────────────────
  function _renderStep5() {
    const s5   = q('#s5');
    const body = q('#s5-body');
    s5.classList.remove('hidden');

    const sess = _sessionsL.find(s => s.examId === _examIdL && s.tipeSession === _tipeL);
    if (!sess) { s5.classList.add('hidden'); return; }

    const label = _tipeL === 'pretest' ? 'Pre-Test'
                : _tipeL === 'posttest' ? 'Post-Test'
                : (sess.examJudul || _tipeL);

    // Sesi kedaluwarsa
    const expiredAt = _toDate(sess.expiredAt);
    if (expiredAt && Date.now() > expiredAt.getTime()) {
      body.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p class="text-2xl mb-2">⏰</p>
          <p class="text-sm font-semibold text-red-700">Sesi ${_esc(label)} sudah kedaluwarsa.</p>
          <p class="text-xs text-gray-500 mt-1">Hubungi panitia untuk memperpanjang sesi.</p>
        </div>`;
      s5.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    // Sudah submit
    if (sess.status === 'submitted') {
      body.innerHTML = `
        <div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p class="text-2xl mb-2">✅</p>
          <p class="text-sm font-semibold text-green-700">Anda sudah mengumpulkan ${_esc(label)} ini.</p>
          <p class="text-xs text-gray-500 mt-1">Hubungi panitia jika ada masalah.</p>
        </div>`;
      s5.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    // Window ujian belum dibuka (hanya untuk sesi yang belum dimulai)
    const examData = _examsL.find(e => e.id === _examIdL);
    if (sess.status === 'issued' && !_isWindowOpen(examData, sess.tipeSession)) {
      body.innerHTML = `
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p class="text-2xl mb-2">🕐</p>
          <p class="text-sm font-semibold text-amber-700">${_esc(label)} belum dibuka oleh panitia.</p>
          <p class="text-xs text-gray-500 mt-1">Tunggu instruksi pengawas. Tidak perlu menutup halaman ini.</p>
        </div>`;
      s5.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const isResume  = sess.status === 'started';
    const soalCount = sess.soalIds?.length || 0;
    const durasi    = sess.examDurasi      || '—';

    body.innerHTML = `
      <div class="${isResume ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-100'} rounded-xl p-4 mb-4">
        ${isResume
          ? `<p class="text-sm font-semibold text-amber-700">⚠ Sesi ${_esc(label)} Anda belum selesai.</p>
             <p class="text-xs text-gray-600 mt-1">Klik "Lanjutkan Ujian" untuk melanjutkan dari jawaban terakhir.</p>`
          : `<p class="text-sm font-semibold text-blue-700">✓ Sesi ${_esc(label)} siap dimulai.</p>
             <p class="text-xs text-gray-600 mt-1">Durasi: <strong>${durasi} menit</strong> · <strong>${soalCount} soal</strong></p>`
        }
      </div>
      <button id="btn-mulai"
        class="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm">
        ${isResume ? '↩ Lanjutkan Ujian' : '🚀 Mulai Ujian'}
      </button>`;

    q('#btn-mulai').addEventListener('click', async () => {
      const btn = q('#btn-mulai');
      btn.disabled = true; btn.textContent = 'Memuat...';

      _session = sess;
      try {
        // getExamFromServer: bypass SDK cache — pastikan status window terbaru dari server
        _exam = await getExamFromServer(sess.examId);
      } catch {
        showErrorModal('Gagal Memuat Konfigurasi', 'Konfigurasi ujian tidak dapat dimuat. Hubungi panitia.');
        btn.disabled = false;
        btn.textContent = isResume ? '↩ Lanjutkan Ujian' : '🚀 Mulai Ujian';
        return;
      }
      if (!_exam) {
        showErrorModal('Konfigurasi Tidak Ditemukan', 'Konfigurasi ujian tidak ditemukan. Hubungi panitia.');
        btn.disabled = false;
        return;
      }

      // Validasi window ujian — selalu dari server, blokir jika panitia belum membuka
      if (sess.status === 'issued' && !_isWindowOpen(_exam, sess.tipeSession)) {
        showErrorModal('Ujian Belum Dibuka', 'Ujian belum dibuka oleh panitia. Silakan tunggu instruksi pengawas.');
        btn.disabled    = false;
        btn.textContent = '🚀 Mulai Ujian';
        return;
      }

      try {
        _soalList = await _loadAndShuffleSoal();
      } catch {
        showErrorModal('Gagal Memuat Soal', 'Periksa koneksi dan coba lagi.');
        btn.disabled = false;
        return;
      }

      if (isResume) {
        _renderLoading('Melanjutkan ujian...');
        await requestFullscreen();
        await _startExam();
      } else {
        _renderInstructionScreen();
      }
    });

    s5.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ─── Entry Screen ─────────────────────────────────────────────

function _renderEntryScreen() {
  const tipeLabel = _session.tipeSession === 'pretest' ? 'Pre-Test'
    : _session.tipeSession === 'posttest' ? 'Post-Test'
    : 'Seleksi Tertulis';

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
          ${_session.tipeSession === 'seleksi_tertulis' ? 'Nomor Pendaftaran' : 'Nomor Peserta'}
        </label>
        <input
          id="input-nopeserta"
          type="text"
          placeholder="${_session.tipeSession === 'seleksi_tertulis' ? 'Masukkan nomor pendaftaran Anda' : 'Masukkan nomor peserta Anda'}"
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
      showErrorModal('Gagal Memuat Soal', 'Periksa koneksi dan coba lagi.');
    }
  }
}

// ─── Instruction Screen ───────────────────────────────────────

function _renderInstructionScreen() {
  document.getElementById('app').innerHTML = `
    <div class="w-full max-w-md mx-auto">
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 class="text-base font-bold text-gray-900 mb-4">📋 Petunjuk Ujian</h2>

        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Waktu &amp; Penyimpanan
        </p>
        <ul class="space-y-3 text-sm text-gray-600 mb-5">
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
        </ul>

        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Aturan Selama Ujian
        </p>
        <ul class="space-y-3 text-sm text-gray-600 mb-6">
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
  const deviceToken = _getOrCreateDeviceToken();

  if (_session.status !== 'started') {
    // Sesi baru: claim device lock + set status 'started'
    try {
      await startSessionWithDevice(_session.id, deviceToken);
      _session.status      = 'started';
      _session.startedAt   = new Date();
      _session.deviceToken = deviceToken;
    } catch (e) {
      if (_isDeviceConflict(e)) return _renderDeviceConflictError();
      // Hanya lanjutkan untuk error jaringan yang jelas (unavailable/deadline)
      if (!_isNetworkError(e)) {
        console.error('[App] startSession gagal:', e);
        return _renderError({ icon: '⚠️', title: 'Gagal Memulai Ujian', msg: 'Terjadi kesalahan saat memulai sesi. Coba lagi atau hubungi panitia.', retryable: true });
      }
      console.warn('[App] startSession gagal (jaringan) — lanjut tanpa lock:', e.code);
    }
  } else {
    // Resume: verifikasi device lock
    try {
      await claimDeviceForResume(_session.id, deviceToken);
      _session.deviceToken = deviceToken;
    } catch (e) {
      if (_isDeviceConflict(e)) return _renderDeviceConflictError();
      if (!_isNetworkError(e)) {
        console.error('[App] claimDevice gagal:', e);
        return _renderError({ icon: '⚠️', title: 'Gagal Melanjutkan Ujian', msg: 'Terjadi kesalahan saat memverifikasi perangkat. Coba lagi atau hubungi panitia.', retryable: true });
      }
      console.warn('[App] claimDevice gagal (jaringan) — lanjut tanpa lock:', e.code);
    }
  }

  // Tampilkan watermark noPeserta
  const wm = document.getElementById('watermark');
  if (wm) wm.textContent = _session.noPeserta;

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

function _renderDeviceConflictError() {
  document.getElementById('app').innerHTML = `
    <div class="w-full max-w-sm mx-auto text-center">
      <div class="text-6xl mb-4">🔒</div>
      <h2 class="text-lg font-bold text-gray-900 mb-2">Sesi Aktif di Perangkat Lain</h2>
      <p class="text-sm text-gray-500 mb-6">
        Ujian ini sedang dikerjakan di perangkat atau tab lain.<br>
        Hanya satu perangkat yang diizinkan dalam satu waktu.
      </p>
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 text-left mb-6">
        <p class="font-semibold mb-1">Cara melanjutkan ujian:</p>
        <ol class="list-decimal list-inside space-y-1 text-xs">
          <li>Tutup tab atau perangkat lain yang sedang mengerjakan ujian ini.</li>
          <li>Kembali ke halaman ini dan klik "Coba Lagi".</li>
        </ol>
      </div>
      <button onclick="window.location.reload()"
        class="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
        Coba Lagi
      </button>
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

/**
 * Cek apakah jendela ujian untuk tipe tertentu sudah dibuka admin.
 * Default: tertutup (false) jika field belum ada.
 */
function _isWindowOpen(exam, tipeSession) {
  return exam?.windowOpen?.[tipeSession] === true;
}

function _renderExamWindowClosed(tipeSession) {
  const label = tipeSession === 'pretest' ? 'Pre-Test'
              : tipeSession === 'posttest' ? 'Post-Test'
              : 'Ujian';
  document.getElementById('app').innerHTML = `
    <div class="w-full max-w-sm mx-auto text-center">
      <div class="text-6xl mb-4">🕐</div>
      <h2 class="text-lg font-bold text-gray-900 mb-2">${_esc(label)} Belum Dibuka</h2>
      <p class="text-sm text-gray-500 mb-6">
        Pengawas ujian belum membuka sesi ini.<br>
        Silakan tunggu instruksi dari pengawas.
      </p>
      <button onclick="window.location.reload()"
        class="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
        Periksa Ulang
      </button>
    </div>
  `;
}

function _isDeviceConflict(e) {
  return e?.code === 'DEVICE_CONFLICT' || e?.message === 'DEVICE_CONFLICT';
}

function _isNetworkError(e) {
  return ['unavailable', 'deadline-exceeded'].includes(e?.code);
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

function _showErr(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function _fmtPeriode(periode) {
  if (!periode) return '';
  const fmt = ts => {
    if (!ts) return '';
    return _toDate(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const mulai   = fmt(periode.mulai);
  const selesai = fmt(periode.selesai);
  if (mulai && selesai) return `${mulai} – ${selesai}`;
  return mulai || selesai || '';
}
