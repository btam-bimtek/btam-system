// pendaftar/js/app.js
// Entry point & hash router untuk app pendaftar (publik, tanpa auth).

import { renderBeranda }     from './pages/beranda.js';
import { renderDaftar }      from './pages/daftar.js';
import { renderKonfirmasi }  from './pages/konfirmasi.js';
import { renderStatus }      from './pages/status.js';

function route() {
  const hash = window.location.hash.slice(1) || '/';
  const app  = document.getElementById('app');
  if (!app) return;

  if (hash === '/' || hash === '')            return renderBeranda(app);
  if (hash === '/daftar')                     return renderDaftar(app);
  if (hash.startsWith('/konfirmasi'))         return renderKonfirmasi(app, hash);
  if (hash === '/status')                     return renderStatus(app);

  // Fallback
  renderBeranda(app);
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);
