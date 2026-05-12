// admin/js/modules/bimtek/sub-kelulusan.js
// List kelulusan: peserta + nilai akhir + status lulus
// Konfigurasi threshold deskriptif per bimtek

import { updateBimtek } from './api.js';
import { hitungNilaiAkhir, cekKelulusan } from './scorer.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';

const DEFAULT_THRESHOLDS = {
  kehadiran: [
    { min: 95, label: 'Hadir Penuh' },
    { min: 80, label: 'Hadir Aktif' },
    { min: 60, label: 'Sebagian' },
    { min: 0, label: 'Tidak Memenuhi Syarat Kehadiran' }
  ],
  keaktifan: [
    { min: 85, label: 'Sangat Aktif' },
    { min: 70, label: 'Aktif' },
    { min: 60, label: 'Cukup Aktif' },
    { min: 0, label: 'Perlu Ditingkatkan' }
  ],
  respek: [
    { min: 85, label: 'Sangat Baik' },
    { min: 70, label: 'Baik' },
    { min: 60, label: 'Cukup Baik' },
    { min: 0, label: 'Perlu Ditingkatkan' }
  ]
};

const BLACKLIST_WORDS = ['kurang', 'buruk', 'jelek', 'gagal', 'lemah', 'tidak'];

export async function renderSubKelulusan(container, bimtekId, bimtek, scores) {
  const lulus = scores.filter(s => s.lulus);
  const tidakLulus = scores.filter(s => !s.lulus);
  const kkm = bimtek.kkm || 60;

  // Kolom komponen yang relevan
  const komponen = [
    { id: 'pretest',    label: 'Pre Test' },
    { id: 'posttest',   label: 'Post Test' },
    { id: 'pengajar',   label: 'Pengajar' },
    { id: 'kehadiran',  label: 'Kehadiran' },
    { id: 'keaktifan',  label: 'Keaktifan' },
    { id: 'respek',     label: 'Respek' },
  ];
  if (bimtek.hasTugas)      komponen.push({ id: 'tugas',      label: 'Tugas' });
  if (bimtek.hasPresentasi) komponen.push({ id: 'presentasi', label: 'Presentasi' });

  const _val = v => (v !== null && v !== undefined) ? v : '—';

  const _buildRow = (s) => `
    <tr>
      <td class="font-medium text-sm whitespace-nowrap">${_esc(s.noPeserta)}</td>
      ${komponen.map(k => `<td class="text-center text-sm">${_val(s[k.id])}</td>`).join('')}
      <td class="text-center font-bold">${s.nilaiAkhir}</td>
      <td class="text-center">
        ${s.lulus
          ? '<span class="badge badge-green text-xs">LULUS</span>'
          : `<span class="badge badge-red text-xs">BELUM</span>`}
      </td>
    </tr>
  `;

  container.innerHTML = `
    <!-- Summary -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-gray-800 p-4 rounded-lg">
        <div class="text-xs text-gray-400">Total Peserta</div>
        <div class="text-2xl font-bold text-white mt-1">${scores.length}</div>
      </div>
      <div class="bg-green-900 bg-opacity-30 p-4 rounded-lg">
        <div class="text-xs text-green-300">Lulus</div>
        <div class="text-2xl font-bold text-green-400 mt-1">${lulus.length}</div>
      </div>
      <div class="bg-red-900 bg-opacity-30 p-4 rounded-lg">
        <div class="text-xs text-red-300">Belum Memenuhi</div>
        <div class="text-2xl font-bold text-red-400 mt-1">${tidakLulus.length}</div>
      </div>
    </div>

    <!-- KKM & Threshold Config -->
    <div class="bg-gray-800 p-4 rounded-lg mb-6">
      <h3 class="font-medium text-white mb-4">⚙️ Konfigurasi Kelulusan</h3>
      <div class="space-y-4">
        <div>
          <label class="text-xs text-gray-400 block mb-1">KKM (Kriteria Ketuntasan Minimal)</label>
          <input type="number" id="kkm-input" class="form-input w-24" min="0" max="100" value="${kkm}" />
        </div>
        <button id="btn-config-threshold" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
          Konfigurasi Threshold Deskriptif
        </button>
        <button id="btn-save-config" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
          Simpan Konfigurasi
        </button>
      </div>
    </div>

    <!-- Tabel semua peserta dengan semua komponen -->
    <div class="mb-6">
      <h3 class="font-medium text-white mb-3">Rekapitulasi Nilai (KKM: ${kkm})</h3>
      ${scores.length === 0 ? '<div class="text-xs text-gray-400">Belum ada data peserta.</div>' : `
        <div class="overflow-x-auto">
          <table class="btam-table">
            <thead>
              <tr>
                <th class="whitespace-nowrap">Peserta</th>
                ${komponen.map(k => `<th class="text-center whitespace-nowrap">${k.label}</th>`).join('')}
                <th class="text-center whitespace-nowrap">Nilai Akhir</th>
                <th class="text-center whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              ${scores.map(s => _buildRow(s)).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>

    <!-- Modal Config Threshold (hidden) -->
    <div id="modal-threshold" style="display:none;" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-900 p-6 rounded-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <h2 class="font-bold text-white mb-4">Threshold Deskriptif</h2>
        <div id="threshold-config" class="space-y-6"></div>
        <div class="mt-6 flex gap-2">
          <button id="btn-close-threshold" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg">Tutup</button>
        </div>
      </div>
    </div>
  `;

  // Bind config button
  container.querySelector('#btn-config-threshold')?.addEventListener('click', () => {
    _showThresholdModal(container, bimtek);
  });

  // Bind save button
  container.querySelector('#btn-save-config')?.addEventListener('click', async () => {
    await _saveConfig(bimtekId, container, bimtek);
  });
}

function _showThresholdModal(container, bimtek) {
  const thresholds = bimtek.reportThresholds || DEFAULT_THRESHOLDS;
  const modal = container.querySelector('#modal-threshold');
  const configDiv = container.querySelector('#threshold-config');

  configDiv.innerHTML = `
    ${['kehadiran', 'keaktifan', 'respek'].map(key => {
      const items = thresholds[key] || DEFAULT_THRESHOLDS[key];
      return `
        <div class="bg-gray-800 p-4 rounded">
          <h4 class="font-medium text-white mb-3 capitalize">${key}</h4>
          <div class="space-y-2">
            ${items.map((item, idx) => `
              <div class="flex gap-2 items-center">
                <input type="number" class="form-input w-20" min="0" value="${item.min}" data-key="${key}" data-idx="${idx}" data-field="min" />
                <input type="text" class="form-input flex-1" value="${item.label}" data-key="${key}" data-idx="${idx}" data-field="label" placeholder="Label" />
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('')}
  `;

  modal.style.display = 'flex';

  container.querySelector('#btn-close-threshold')?.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

async function _saveConfig(bimtekId, container, bimtek) {
  try {
    const kkm = parseInt(container.querySelector('#kkm-input').value) || 60;

    // Collect threshold dari input
    const thresholds = {};
    ['kehadiran', 'keaktifan', 'respek'].forEach(key => {
      const inputs = container.querySelectorAll(`input[data-key="${key}"]`);
      thresholds[key] = [];

      // Group by index
      const byIdx = {};
      inputs.forEach(inp => {
        const idx = inp.dataset.idx;
        if (!byIdx[idx]) byIdx[idx] = {};
        byIdx[idx][inp.dataset.field] = inp.dataset.field === 'min' ? parseInt(inp.value) : inp.value;
      });

      for (const idx of Object.keys(byIdx).sort((a, b) => parseInt(a) - parseInt(b))) {
        const item = byIdx[idx];
        const label = item.label || '';

        // Validate blacklist
        for (const word of BLACKLIST_WORDS) {
          if (label.toLowerCase().includes(word)) {
            showToast(`Label "${label}" mengandung kata negatif "${word}" — pertimbangkan alternatif lain`, 'warning');
          }
        }

        thresholds[key].push({
          min: item.min || 0,
          label: label
        });
      }
    });

    // Save
    const btn = container.querySelector('#btn-save-config');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    await updateBimtek(bimtekId, {
      kkm,
      reportThresholds: thresholds
    });

    showToast('Konfigurasi kelulusan berhasil disimpan', 'ok');
    btn.disabled = false;
    btn.textContent = 'Simpan Konfigurasi';

    container.querySelector('#modal-threshold').style.display = 'none';

    // Reload
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    showToast(`Gagal simpan: ${err.message}`, 'error');
    console.error(err);
  }
}

function _esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
