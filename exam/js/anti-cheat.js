// exam/js/anti-cheat.js
// Anti-cheat engine — hanya aktif saat exam runner berjalan.
// Diinisialisasi oleh exam-runner.js dan di-destroy setelah submit.

let _active           = false;
let _warnCount        = 0;
let _maxWarnings      = 3;
let _onWarn           = null;
let _onAutoSubmit     = null;
let _awayTimer        = null; // timer tunggal untuk grace period blur+visibilitychange (cegah race/double-warn)
let _awayWarned       = false;
let _softAwayCount    = 0;     // blur singkat (di bawah threshold) yang berulang — dieskalasi jadi warning resmi
let _fsWarnPending    = false; // cegah double-warn saat fullscreen

// ─── Public API ───────────────────────────────────────────────

/**
 * Aktifkan semua listener anti-cheat.
 * @param {{ maxWarnings: number, onWarn: Function, onAutoSubmit: Function }} opts
 *   onWarn(count, max, reason)    — dipanggil setiap ada pelanggaran
 *   onAutoSubmit(reason)          — dipanggil saat warn count >= max
 */
export function initAntiCheat({ maxWarnings = 3, initialWarnCount = 0, onWarn, onAutoSubmit }) {
  _active       = true;
  _warnCount    = initialWarnCount;   // restore dari session saat resume
  _maxWarnings  = maxWarnings;
  _onWarn       = onWarn;
  _onAutoSubmit = onAutoSubmit;

  document.addEventListener('visibilitychange',       _onVisibilityChange);
  window.addEventListener('blur',                     _onBlur);
  window.addEventListener('focus',                    _onFocus);
  document.addEventListener('copy',        _block, true);
  document.addEventListener('cut',         _block, true);
  document.addEventListener('paste',       _block, true);
  document.addEventListener('contextmenu', _block, true);
  document.addEventListener('keydown',     _onKeydown, true);
  document.addEventListener('fullscreenchange',        _onFullscreenChange);
  document.addEventListener('webkitfullscreenchange',  _onFullscreenChange);
}

/** Nonaktifkan semua listener. Dipanggil setelah submit. */
export function destroyAntiCheat() {
  _active = false;
  clearTimeout(_awayTimer);
  _awayTimer     = null;
  _awayWarned    = false;
  _softAwayCount = 0;

  document.removeEventListener('visibilitychange',      _onVisibilityChange);
  window.removeEventListener('blur',                    _onBlur);
  window.removeEventListener('focus',                   _onFocus);
  document.removeEventListener('copy',        _block, true);
  document.removeEventListener('cut',         _block, true);
  document.removeEventListener('paste',       _block, true);
  document.removeEventListener('contextmenu', _block, true);
  document.removeEventListener('keydown',     _onKeydown, true);
  document.removeEventListener('fullscreenchange',       _onFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', _onFullscreenChange);
}

/** Request fullscreen pada documentElement. */
export async function requestFullscreen() {
  const el = document.documentElement;
  try {
    if      (el.requestFullscreen)       await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch (e) {
    // Browser mungkin tidak support atau user menolak — tidak fatal
    console.warn('[AntiCheat] Fullscreen request gagal:', e.message);
  }
}

export function getWarnCount() { return _warnCount; }

/** Pause sementara — untuk saat confirm() dialog muncul */
export function pauseAntiCheat() { _active = false; }

/** Resume setelah confirm() dialog tutup */
export function resumeAntiCheat() { if (_warnCount < _maxWarnings) _active = true; }

// ─── Private ──────────────────────────────────────────────────

function _warn(reason) {
  if (!_active) return;
  _warnCount++;
  _onWarn?.(_warnCount, _maxWarnings, reason);
  if (_warnCount >= _maxWarnings) {
    _active = false;
    _onAutoSubmit?.(reason === 'max_warnings' ? 'max_warnings' : reason);
  }
}

// Durasi minimum menghilang (ms) sebelum dihitung pelanggaran resmi.
// Cukup untuk menoleransi notifikasi masuk/keyboard mobile yang sifatnya sekilas,
// tapi terlalu singkat untuk sempat pindah app + cari + baca jawaban.
const HIDE_THRESHOLD_MS = 1500;

// Blur singkat (di bawah HIDE_THRESHOLD_MS) tidak langsung jadi warning resmi,
// tapi diakumulasi di sini. Peserta yang berulang kali mepet-mepet ambang batas
// (mis. intip HP <1.5 detik berkali-kali) tetap dieskalasi jadi warning resmi
// setelah SOFT_AWAY_LIMIT kali, supaya threshold toleransi ini tidak jadi celah
// tak terbatas.
const SOFT_AWAY_LIMIT = 5;

// 'blur' dan 'visibilitychange' fire hampir bersamaan untuk kejadian yang sama
// (alt-tab, pindah app). Keduanya berbagi SATU timer grace-period: siapa pun
// yang fire duluan menjadwalkan pengecekan di HIDE_THRESHOLD_MS; event lawannya
// hanya membatalkan jika peserta kembali sebelum threshold. Ini mencegah race
// yang sebelumnya membuat blur (debounce pendek) menembus grace period 3 detik
// milik visibilitychange sehingga blur singkat ikut terhitung pelanggaran.
function _isAway() {
  return document.hidden || !document.hasFocus();
}

function _scheduleAwayCheck(reason) {
  if (!_active || _awayTimer) return;
  _awayTimer = setTimeout(() => {
    _awayTimer = null;
    if (_active && _isAway() && !_awayWarned) {
      _awayWarned = true;
      _warn(reason);
    }
  }, HIDE_THRESHOLD_MS);
}

function _cancelAwayCheck() {
  if (_awayTimer) {
    // Kembali sebelum threshold matang — bukan pelanggaran resmi, tapi tetap dicatat.
    _softAwayCount++;
    if (_softAwayCount >= SOFT_AWAY_LIMIT) {
      _softAwayCount = 0;
      _warn('repeated_short_away');
    }
  }
  clearTimeout(_awayTimer);
  _awayTimer  = null;
  _awayWarned = false;
}

function _onVisibilityChange() {
  if (!_active) return;
  if (document.hidden) _scheduleAwayCheck('tab_switch');
  else _cancelAwayCheck();
}

function _onFocus() {
  _cancelAwayCheck();
}

function _onBlur() {
  if (!_active) return;
  _scheduleAwayCheck('window_blur');
}

function _block(e) {
  if (!_active) return;
  e.preventDefault();
  e.stopPropagation();
}

function _onKeydown(e) {
  if (!_active) return;
  const shouldBlock =
    e.key === 'F12'                                        // DevTools
    || e.key === 'PrintScreen'                             // Screenshot
    || (e.ctrlKey && e.shiftKey && e.key === 'I')          // DevTools
    || (e.ctrlKey && e.shiftKey && e.key === 'J')          // Console
    || (e.ctrlKey && e.shiftKey && e.key === 'C')          // Inspector
    || (e.ctrlKey && e.key.toLowerCase() === 'u')          // View source
    || (e.ctrlKey && e.key.toLowerCase() === 'c')          // Copy
    || (e.ctrlKey && e.key.toLowerCase() === 'x')          // Cut
    || (e.ctrlKey && e.key.toLowerCase() === 'v')          // Paste
    || (e.ctrlKey && e.key.toLowerCase() === 'a')          // Select all
    || (e.metaKey && ['c','x','v','a'].includes(e.key.toLowerCase())); // macOS

  if (shouldBlock) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function _onFullscreenChange() {
  if (!_active || _fsWarnPending) return;
  const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (!isFullscreen) {
    _fsWarnPending = true;
    _warn('exit_fullscreen');
    // Coba minta fullscreen kembali setelah 1.5 detik
    setTimeout(async () => {
      if (_active) await requestFullscreen();
      _fsWarnPending = false;
    }, 1500);
  }
}
