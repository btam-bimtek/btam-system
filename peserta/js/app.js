// peserta/js/app.js
// Entry point & hash router untuk Portal Peserta (publik, tanpa Firebase Auth).

import { getSession } from './api.js';
import { renderLogin }      from './pages/login.js';
import { renderDashboard }  from './pages/dashboard.js';
import { renderSertifikat } from './pages/sertifikat.js';
import { renderEvaluasi }   from './pages/evaluasi.js';

function route() {
  const hash = window.location.hash.slice(1) || '/';
  const app  = document.getElementById('app');
  if (!app) return;

  const session = getSession();
  if (!session && hash !== '/login') { window.location.hash = '#/login'; return; }
  if (session && hash === '/login')  { window.location.hash = '#/'; return; }

  if (hash === '/login')                          return renderLogin(app);
  if (hash === '/' || hash === '')                return renderDashboard(app, session);
  const certMatch = hash.match(/^\/sertifikat\/(.+)$/);
  if (certMatch)                                   return renderSertifikat(app, session, certMatch[1]);
  const evalMatch = hash.match(/^\/evaluasi\/(.+)$/);
  if (evalMatch)                                   return renderEvaluasi(app, session, evalMatch[1]);

  // Fallback
  renderDashboard(app, session);
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);
