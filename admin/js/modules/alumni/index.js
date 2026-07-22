// admin/js/modules/alumni/index.js
// Entry point Tab Alumni — riwayat keikutsertaan bimtek, dengan toggle tampilan per-kejadian / per-peserta.

import { setPageTitle } from '../../layout/navbar.js';
import { renderSubRiwayat } from './sub-riwayat.js';

export function renderAlumni() {
  setPageTitle('Alumni');

  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="px-6 pt-6 pb-2">
      <h1 class="text-lg font-semibold text-white mb-1">Alumni</h1>
      <p class="text-xs text-gray-500">Riwayat keikutsertaan bimtek dari seluruh sumber data.</p>
    </div>
    <div id="alumni-pane" class="px-6 pb-8"></div>
  `;

  renderSubRiwayat(document.getElementById('alumni-pane'));
}
