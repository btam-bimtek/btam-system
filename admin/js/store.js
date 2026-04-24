// admin/js/store.js
// Simple pub-sub state store.
// Tidak pakai library — ~150 baris, cukup untuk scale kita.

// ─── Initial state ────────────────────────────────────────────
const _state = {
  auth: {
    user:    null,   // Firebase User
    profile: null,   // admin_users dokumen
    loading: true    // true saat initial auth check belum selesai
  },
  settings: {
    bloomWeights:     null,  // dari app_settings/global
    defaultThresholds: null,
    logoUrl:          null,
    namaLembaga:      'BTAM'
  },
  ui: {
    sidebarOpen: true,
    toasts:      []
  }
};

// ─── Subscribers ─────────────────────────────────────────────
const _subscribers = {};   // key → Set<function>

// ─── Get ──────────────────────────────────────────────────────
/**
 * Baca sebagian state dengan dot-notation key.
 * @param {string} key  - misal 'auth.profile' atau 'ui.toasts'
 * @returns {*}
 */
export function getState(key) {
  return key.split('.').reduce((obj, k) => obj?.[k], _state);
}

// ─── Set ──────────────────────────────────────────────────────
/**
 * Update sebagian state dan notify subscriber.
 * @param {string} key    - dot-notation key
 * @param {*}      value  - value baru (shallow replace di key tersebut)
 */
export function setState(key, value) {
  const parts  = key.split('.');
  const last   = parts.pop();
  const parent = parts.reduce((obj, k) => {
    if (obj[k] === undefined || obj[k] === null) obj[k] = {};
    return obj[k];
  }, _state);

  parent[last] = value;
  _notify(key, value);

  // Notify parent keys juga (supaya subscriber 'auth' ter-notify saat 'auth.user' berubah)
  parts.reduce((chain, k) => {
    const parentKey = chain ? `${chain}.${k}` : k;
    _notify(parentKey, getState(parentKey));
    return parentKey;
  }, '');
}

// ─── Subscribe ────────────────────────────────────────────────
/**
 * Dengarkan perubahan pada key tertentu.
 * @param {string}   key      - dot-notation key
 * @param {function} callback - dipanggil dengan (newValue, key)
 * @returns {function}          unsubscribe function
 */
export function subscribe(key, callback) {
  if (!_subscribers[key]) _subscribers[key] = new Set();
  _subscribers[key].add(callback);
  return () => _subscribers[key].delete(callback);
}

// ─── Internal ─────────────────────────────────────────────────
function _notify(key, value) {
  _subscribers[key]?.forEach(fn => {
    try { fn(value, key); }
    catch (err) { console.error(`[store] Subscriber error pada "${key}":`, err); }
  });
}
