// admin/js/router.js
// Hash-based SPA router.
// Route format: #/path/to/page atau #/path/:param

const _routes   = new Map();  // pattern → handler
let   _current  = null;
let   _notFound = () => _renderNotFound();

// ─── Register route ───────────────────────────────────────────
/**
 * @param {string}   pattern  - misal '/bimtek/:id/detail'
 * @param {function} handler  - dipanggil dengan { params, query } object
 */
export function route(pattern, handler) {
  _routes.set(pattern, handler);
}

// ─── Navigate ─────────────────────────────────────────────────
export function navigate(path) {
  window.location.hash = '#' + path;
}

export function replace(path) {
  const url = window.location.href.split('#')[0] + '#' + path;
  window.history.replaceState(null, '', url);
  _dispatch(path);
}

// ─── Get current params ───────────────────────────────────────
export function currentParams() {
  return _current?.params ?? {};
}

export function currentQuery() {
  return _current?.query ?? {};
}

export function currentPath() {
  return _current?.path ?? '/';
}

// ─── Not found handler ────────────────────────────────────────
export function setNotFound(fn) {
  _notFound = fn;
}

// ─── Boot ─────────────────────────────────────────────────────
export function startRouter() {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1) || '/';
    _dispatch(hash);
  });

  // Initial dispatch
  const hash = window.location.hash.slice(1) || '/';
  _dispatch(hash);
}

// ─── Internal ─────────────────────────────────────────────────
function _dispatch(rawHash) {
  const [pathPart, queryPart] = rawHash.split('?');
  const path  = pathPart || '/';
  const query = _parseQuery(queryPart);

  for (const [pattern, handler] of _routes) {
    const params = _match(pattern, path);
    if (params !== null) {
      _current = { path, params, query };
      handler({ params, query });
      return;
    }
  }

  _current = { path, params: {}, query };
  _notFound({ path, query });
}

function _match(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts    = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function _parseQuery(queryString) {
  if (!queryString) return {};
  return Object.fromEntries(
    queryString.split('&').map(pair => {
      const [k, v] = pair.split('=');
      return [decodeURIComponent(k), decodeURIComponent(v ?? '')];
    })
  );
}

function _renderNotFound() {
  const el = document.getElementById('app');
  if (el) {
    el.innerHTML = `
      <div class="flex flex-col items-center justify-center h-64 text-gray-400">
        <p class="text-5xl mb-4">404</p>
        <p class="text-lg">Halaman tidak ditemukan</p>
        <a href="#/" class="mt-4 text-blue-400 hover:underline">Kembali ke Dashboard</a>
      </div>`;
  }
}
