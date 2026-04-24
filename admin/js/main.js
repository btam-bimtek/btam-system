// admin/js/main.js
// Entry point admin app.

import { onAuthChange } from '../../shared/auth.js';
import { setState, getState } from './store.js';
import { route, startRouter, navigate } from './router.js';
import { installAuthGuard } from './auth-guard.js';
import { renderLogin } from './modules/auth/login.js';
import { renderDashboard } from './modules/dashboard/index.js';
import { renderSidebar, updateSidebarAuth } from './layout/sidebar.js';
import { renderNavbar, setPageTitle } from './layout/navbar.js';

// ─── Bootstrap ───────────────────────────────────────────────
async function boot() {
  // 1. Pasang layout shell
  _renderShell();

  // 2. Pasang auth guard SEBELUM router start
  installAuthGuard();

  // 3. Watch auth state
  onAuthChange((authResult) => {
    if (authResult) {
      setState('auth', { user: authResult.user, profile: authResult.profile, loading: false });
      updateSidebarAuth(authResult.profile);
    } else {
      setState('auth', { user: null, profile: null, loading: false });
      updateSidebarAuth(null);
    }
  });

  // 4. Register semua routes
  _registerRoutes();

  // 5. Start router
  startRouter();
}

// ─── Shell layout ────────────────────────────────────────────
function _renderShell() {
  document.body.innerHTML = `
    <div id="auth-loading-overlay" class="hidden"></div>
    <div id="toast-container" class="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none"></div>

    <div id="shell" class="hidden min-h-screen flex bg-gray-950 text-gray-100">
      <aside id="sidebar" class="w-64 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      </aside>
      <div class="flex-1 flex flex-col min-w-0">
        <header id="navbar" class="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-6 shrink-0">
        </header>
        <main id="app" class="flex-1 p-6 overflow-auto">
        </main>
      </div>
    </div>

    <div id="login-root">
    </div>
  `;

  renderSidebar();
  renderNavbar();
}

// ─── Routes ──────────────────────────────────────────────────
function _registerRoutes() {
  // ── Auth ──
  route('/login', () => {
    _setLoginMode(true);
    renderLogin();
  });

  // ── Dashboard ──
  route('/', ({ params, query }) => {
    _setLoginMode(false);
    if (!_guardRoute()) return;
    renderDashboard({ params, query });
  });

  // ── Peserta Master ──
  route('/peserta', ({ params, query }) => {
    _setLoginMode(false);
    if (!_guardRoute()) return;
    import('./modules/peserta-master/index.js').then(m => m.renderPesertaList({ query }));
  });

  route('/peserta/import', () => {
    _setLoginMode(false);
    if (!_guardRoute()) return;
    import('./modules/peserta-master/import.js').then(m => m.renderImport());
  });

  // ── Pengajar Master ──
  route('/pengajar', ({ query }) => {
    _setLoginMode(false);
    if (!_guardRoute()) return;
    import('./modules/pengajar-master/index.js').then(m => m.renderPengajarList({ query }));
  });

  // ── Instansi Master ──
  route('/instansi', ({ query }) => {
    _setLoginMode(false);
    if (!_guardRoute()) return;
    import('./modules/instansi-master/index.js').then(m => m.renderInstansiList({ query }));
  });

  // ── Bank Soal ──
  route('/bank-soal', ({ query }) => {
    _setLoginMode(false);
    if (!_guardRoute()) return;
    import('./modules/bank-soal/index.js').then(m => m.renderBankSoalList({ query }));
  });

  // ── Bimtek ──
  route('/bimtek', ({ query }) => {
    _setLoginMode(false);
    if (!_guardRoute()) return;
    import('./modules/bimtek/list.js').then(m => m.renderBimtekList({ query }));
  });

  route('/bimtek/baru', () => {
    _setLoginMode(false);
    if (!_guardRoute()) return;
    import('./modules/bimtek/form.js').then(m => m.renderBimtekForm({ id: null }));
  });

  route('/bimtek/:id/edit', ({ params }) => {
    _setLoginMode(false);
    if (!_guardRoute()) return;
    import('./modules/bimtek/form.js').then(m => m.renderBimtekForm({ id: params.id }));
  });

  route('/bimtek/:id', ({ params }) => {
    _setLoginMode(false);
    if (!_guardRoute()) return;
    import('./modules/bimtek/detail.js').then(m => m.renderBimtekDetail({ id: params.id }));
  });

  // ── Settings ──
  route('/settings', () => {
    _setLoginMode(false);
    if (!_guardRoute()) return;
    import('./modules/settings/index.js').then(m => m.renderSettings());
  });

  // ── Admin Users (superadmin only) ──
  route('/admin-users', () => {
    _setLoginMode(false);
    if (!_guardRoute()) return;
    import('./modules/admin-users/index.js').then(m => m.renderAdminUsers());
  });
}

// ─── Helpers ─────────────────────────────────────────────────
function _guardRoute() {
  const auth = getState('auth');
  if (auth.loading) return false;
  if (!auth.user) { navigate('/login'); return false; }
  return true;
}

function _setLoginMode(isLogin) {
  const shell     = document.getElementById('shell');
  const loginRoot = document.getElementById('login-root');

  if (isLogin) {
    shell?.classList.add('hidden');
    loginRoot?.classList.remove('hidden');
    const app = document.getElementById('app');
    if (app && !loginRoot.contains(app)) loginRoot.appendChild(app);
  } else {
    shell?.classList.remove('hidden');
    loginRoot?.classList.add('hidden');
    const app  = document.getElementById('app');
    const main = document.querySelector('#shell main');
    if (app && main && !main.contains(app)) main.appendChild(app);
  }
}

// ─── Kick off ────────────────────────────────────────────────
boot();
