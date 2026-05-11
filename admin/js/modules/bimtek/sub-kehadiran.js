// admin/js/modules/bimtek/sub-kehadiran.js
// Tab Kehadiran: matrix peserta × sesi mapel
// Baris = peserta, kolom = sesi mapel (dikelompok per hari)
// Scroll horizontal untuk hari banyak

import {
  getAttendance, updateKehadiran, bulkUpdateKehadiran, hitungKehadiran,
  listBimtekScores, updateNilai
} from './penilaian-api.js';
import { listSesi, listMapel } from './api.js';
import { showToast } from '../../components/toast.js';

// ─── ENTRY POINT ────────────────────────────────────────────────────

export async function renderSubKehadiran(container, bimtekId, bimtek, scores, sesis) {
  try {
    // Filter hanya sesi mapel (bukan break/ISHOMA/pembukaan/penutupan)
    const mapelSesis = sesis.filter(s => s.tipe === 'mapel');

    if (mapelSesis.length === 0) {
      container.innerHTML = '<div class="text-gray-400 text-sm">Belum ada jadwal sesi mapel.</div>';
      return;
    }

    // Group sesi per hari
    const sesiPerHari = _groupSesiPerHari(mapelSesis);
    const hari = Object.keys(sesiPerHari).sort();

    // Load attendance per peserta
    const attendanceMap = {};
    for (const score of scores) {
      const att = await getAttendance(bimtekId, score.noPeserta);
      attendanceMap[score.noPeserta] = att.sessions || {};
    }

    // Render
    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="btam-table">
          <thead>
            <tr>
              <th class="sticky left-0 bg-gray-900 z-10 min-w-32">Peserta</th>
              ${hari.map(d => `
                <th colspan="${sesiPerHari[d].length}" class="text-center text-xs bg-gray-800">
                  ${_fmtDate(new Date(d))}
                </th>
              `).join('')}
            </tr>
            <tr>
              <th class="sticky left-0 bg-gray-900 z-10"></th>
              ${hari.map(d => sesiPerHari[d].map(s =>
                `<th class="text-center text-xs whitespace-nowrap">${s.durasi}m</th>`
              ).join('')).join('')}
            </tr>
          </thead>
          <tbody>
            ${scores.map(score => {
              const att = attendanceMap[score.noPeserta] || {};
              return `
                <tr>
                  <td class="sticky left-0 bg-gray-950 z-10 font-medium text-sm">${_esc(score.noPeserta)}</td>
                  ${hari.map(d => sesiPerHari[d].map(s => {
                    const hadir = att[s.id]?.kehadiran ?? false;
                    return `
                      <td class="text-center p-2">
                        <input type="checkbox" class="kehadiran-check" data-peserta="${_esc(score.noPeserta)}" data-sesi="${s.id}" ${hadir ? 'checked' : ''} />
                      </td>
                    `;
                  }).join('')).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Action buttons -->
      <div class="mt-6 flex gap-2">
        <button id="btn-save-kehadiran" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
          Simpan Kehadiran
        </button>
        <button id="btn-hitung-kehadiran" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
          Hitung % Kehadiran
        </button>
      </div>

      <!-- Summary -->
      <div id="summary-kehadiran" class="mt-6 text-xs text-gray-400 space-y-1"></div>
    `;

    // Bind save button
    container.querySelector('#btn-save-kehadiran')?.addEventListener('click', async () => {
      await _saveKehadiran(bimtekId, scores, container);
    });

    // Bind hitung button
    container.querySelector('#btn-hitung-kehadiran')?.addEventListener('click', async () => {
      await _hitungKehadiran(bimtekId, scores, sesis, container);
    });
  } catch (err) {
    container.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`;
    console.error(err);
  }
}

// ─── HELPER: Group sesi per hari ───────────────────────────────────

function _groupSesiPerHari(sesis) {
  const grouped = {};
  sesis.forEach(s => {
    const tglStr = s.tanggal; // format: YYYY-MM-DD
    if (!grouped[tglStr]) grouped[tglStr] = [];
    grouped[tglStr].push(s);
  });
  // Sort per hari by jamMulai
  for (const hari of Object.keys(grouped)) {
    grouped[hari].sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
  }
  return grouped;
}

// ─── SAVE KEHADIRAN ─────────────────────────────────────────────────

async function _saveKehadiran(bimtekId, scores, container) {
  try {
    const matrixData = {};

    scores.forEach(score => {
      matrixData[score.noPeserta] = {};
      container.querySelectorAll(`input.kehadiran-check[data-peserta="${score.noPeserta}"]`).forEach(check => {
        const sesiId = check.dataset.sesi;
        matrixData[score.noPeserta][sesiId] = check.checked;
      });
    });

    // Save
    const btn = container.querySelector('#btn-save-kehadiran');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    await bulkUpdateKehadiran(bimtekId, matrixData);

    showToast(`Kehadiran ${scores.length} peserta berhasil disimpan`, 'ok');
    btn.disabled = false;
    btn.textContent = origText;
  } catch (err) {
    showToast(`Gagal simpan: ${err.message}`, 'error');
    console.error(err);
  }
}

// ─── HITUNG KEHADIRAN (update percentage) ──────────────────────────

async function _hitungKehadiran(bimtekId, scores, sesis, container) {
  try {
    const mapelSesis = sesis.filter(s => s.tipe === 'mapel');
    const total = mapelSesis.length;

    if (total === 0) {
      showToast('Tidak ada sesi mapel', 'error');
      return;
    }

    const btn = container.querySelector('#btn-hitung-kehadiran');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Menghitung...';

    const summaryDiv = container.querySelector('#summary-kehadiran');
    const updates = {};

    for (const score of scores) {
      const att = await getAttendance(bimtekId, score.noPeserta);
      const { hadir, persentase } = hitungKehadiran(att, mapelSesis);

      summaryDiv.innerHTML += `<div>${_esc(score.noPeserta)}: ${hadir}/${total} (${persentase}%)</div>`;
      updates[score.noPeserta] = persentase;
    }

    // Update bimtek_scores.kehadiran dengan persentase
    for (const [noPeserta, pct] of Object.entries(updates)) {
      await updateNilai(bimtekId, noPeserta, { kehadiran: pct });
    }

    showToast(`Kehadiran ${scores.length} peserta berhasil dihitung`, 'ok');
    btn.disabled = false;
    btn.textContent = origText;
  } catch (err) {
    showToast(`Gagal hitung: ${err.message}`, 'error');
    console.error(err);
  }
}

// ─── HELPER: Format date ───────────────────────────────────────────

function _fmtDate(date) {
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('id-ID', opts);
}

function _esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
