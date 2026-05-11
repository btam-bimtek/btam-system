// exam/js/anti-cheat.js
// Anti-cheat engine — hanya aktif saat exam runner berjalan.
// Diinisialisasi oleh exam-runner.js dan di-destroy setelah submit.

let _active           = false;
let _warnCount        = 0;
let _maxWarnings      = 3;
let _onWarn           = null;
let _onAutoSubmit     = null;
let _blurTimer        = null;
let _fsWarnPending    = false; // cegah double-warn saat fullscreen
let _visibilityWarned = false; // cegah double-warn antara blur dan visibilitychange

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
  clearTimeout(_blurTimer);

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

function _onVisibilityChange() {
  if (!_active) return;
  if (document.hidden) {
    _visibilityWarned = true;
    _warn('tab_switch');
  } else {
    _visibilityWarned = false;
  }
}

function _onFocus() {
  // Reset flag saat user kembali ke halaman
  _visibilityWarned = false;
}

function _onBlur() {
  if (!_active) return;
  clearTimeout(_blurTimer);
  // Debounce 600ms. Jika visibilitychange sudah handle tab switch, skip.
  // Jika tidak (alt-tab ke app lain), warn sebagai window_blur.
  _blurTimer = setTimeout(() => {
    if (_active && !_visibilityWarned) _warn('window_blur');
  }, 600);
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
