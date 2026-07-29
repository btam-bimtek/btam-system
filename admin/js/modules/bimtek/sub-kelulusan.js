// admin/js/modules/bimtek/sub-kelulusan.js
// List kelulusan: peserta + nilai akhir + status lulus
// Konfigurasi threshold deskriptif per bimtek

import { updateBimtek } from './api.js';
import { hitungNilaiAkhir, cekKelulusan, kategoriNilai } from './scorer.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { db, collection, query, where, getDocs } from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';

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

const KATEGORI_BADGE = {
  'Sangat Baik':   'badge-green',
  'Baik':          'badge-green',
  'Cukup':         'badge-green',
  'Kurang':        'badge-red',
  'Sangat Kurang': 'badge-red',
};

export async function renderSubKelulusan(container, bimtekId, bimtek, scores) {
  const lulus = scores.filter(s => s.lulus);
  const tidakLulus = scores.filter(s => !s.lulus);

  // Ringkasan per kategori (Sangat Baik/Baik/Cukup/Kurang/Sangat Kurang)
  const kategoriCount = {};
  scores.forEach(s => {
    const k = kategoriNilai(s.nilaiAkhir).kategori;
    kategoriCount[k] = (kategoriCount[k] || 0) + 1;
  });

  // Fetch nama peserta
  const namaMap = {};
  const ids = scores.map(s => s.noPeserta);
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const snap = await getDocs(
      query(collection(db, COL.PESERTA_MASTER), where('noPeserta', 'in', chunk))
    );
    snap.docs.forEach(d => { namaMap[d.id] = d.data().nama ?? d.id; });
  }

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

  const _buildRow = (s) => {
    const kat = kategoriNilai(s.nilaiAkhir);
    // Kehadiran <90% membuat peserta tidak lulus walau nilai akhir cukup — tandai alasannya
    const gagalKehadiran = !s.lulus && kat.lulus;
    return `
    <tr>
      <td class="sticky left-0 bg-gray-950 z-10 whitespace-nowrap">
        <div class="font-medium text-sm text-gray-200">${_esc(namaMap[s.noPeserta] ?? s.noPeserta)}</div>
        <div class="text-xs text-gray-500 font-mono">${_esc(s.noPeserta)}</div>
      </td>
      ${komponen.map(k => `<td class="text-center text-sm">${_val(s[k.id])}</td>`).join('')}
      <td class="text-center font-bold">${s.nilaiAkhir}</td>
      <td class="text-center">
        <span class="badge ${KATEGORI_BADGE[kat.kategori]} text-xs">${kat.kategori}</span>
        ${gagalKehadiran ? '<div class="text-xs text-amber-400 mt-0.5">Kehadiran &lt;90%</div>' : ''}
      </td>
    </tr>
  `;
  };

  container.innerHTML = `
    <!-- Summary -->
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
      <div class="bg-gray-800 p-4 rounded-lg">
        <div class="text-xs text-gray-400">Total Peserta</div>
        <div class="text-2xl font-bold text-white mt-1">${scores.length}</div>
      </div>
      <div class="bg-green-900 bg-opacity-30 p-4 rounded-lg">
        <div class="text-xs text-green-300">Lulus</div>
        <div class="text-2xl font-bold text-green-400 mt-1">${lulus.length}</div>
      </div>
      <div class="bg-red-900 bg-opacity-30 p-4 rounded-lg">
        <div class="text-xs text-red-300">Tidak Lulus</div>
        <div class="text-2xl font-bold text-red-400 mt-1">${tidakLulus.length}</div>
      </div>
    </div>

    <!-- Breakdown per kategori -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      ${['Sangat Baik', 'Baik', 'Cukup', 'Kurang', 'Sangat Kurang'].map(k => `
        <div class="bg-gray-800/60 p-3 rounded-lg text-center">
          <div class="text-xs text-gray-400">${k}</div>
          <div class="text-lg font-bold ${KATEGORI_BADGE[k] === 'badge-green' ? 'text-green-400' : 'text-red-400'} mt-0.5">${kategoriCount[k] || 0}</div>
        </div>
      `).join('')}
    </div>

    <!-- Kriteria kelulusan (informasi, batas tetap) -->
    <div class="bg-gray-800 p-4 rounded-lg mb-6">
      <h3 class="font-medium text-white mb-3">Kriteria Kelulusan</h3>
      <p class="text-xs text-gray-400 mb-3">
        Nilai akhir menentukan kategori. Peserta dengan kehadiran &lt;90% otomatis
        Tidak Lulus meskipun nilai akhir mencukupi.
      </p>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs mb-4">
        <div class="bg-gray-900 rounded px-3 py-2"><span class="text-green-400 font-medium">Sangat Baik</span><br><span class="text-gray-500">≥ 86</span></div>
        <div class="bg-gray-900 rounded px-3 py-2"><span class="text-green-400 font-medium">Baik</span><br><span class="text-gray-500">71 – 85</span></div>
        <div class="bg-gray-900 rounded px-3 py-2"><span class="text-green-400 font-medium">Cukup</span><br><span class="text-gray-500">61 – 70</span></div>
        <div class="bg-gray-900 rounded px-3 py-2"><span class="text-red-400 font-medium">Kurang</span><br><span class="text-gray-500">51 – 60</span></div>
        <div class="bg-gray-900 rounded px-3 py-2"><span class="text-red-400 font-medium">Sangat Kurang</span><br><span class="text-gray-500">≤ 50</span></div>
      </div>
      <button id="btn-config-threshold" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
        Konfigurasi Threshold Deskriptif
      </button>
      <button id="btn-save-config" class="px-4 py-2 bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] text-sm rounded-lg transition-colors">
        Simpan Konfigurasi
      </button>
    </div>

    <!-- Tabel semua peserta dengan semua komponen -->
    <div class="mb-6">
      <h3 class="font-medium text-white mb-3">Rekapitulasi Nilai</h3>
      ${scores.length === 0 ? '<div class="text-xs text-gray-400">Belum ada data peserta.</div>' : `
        <div class="overflow-x-auto">
          <table class="btam-table">
            <thead>
              <tr>
                <th class="sticky left-0 bg-gray-900 z-10 whitespace-nowrap">Peserta</th>
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
