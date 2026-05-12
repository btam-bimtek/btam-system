// admin/js/modules/bimtek/sub-kehadiran.js
// Tab Kehadiran: matrix peserta × mapel per hari
// Baris = peserta, kolom = mapel (dikelompok per hari), checkbox per mapel

import {
  getAttendance, updateKehadiran, bulkUpdateKehadiran, hitungKehadiran,
  listBimtekScores, updateNilai
} from './penilaian-api.js';
import { listSesi, listMapel } from './api.js';
import { showToast } from '../../components/toast.js';

// ─── ENTRY POINT ────────────────────────────────────────────────────

export async function renderSubKehadiran(container, bimtekId, bimtek, scores, sesis) {
  try {
    const mapelSesis = sesis.filter(s => s.tipe === 'mapel');

    if (mapelSesis.length === 0) {
      container.innerHTML = '<div class="text-gray-400 text-sm">Belum ada jadwal sesi mapel.</div>';
      return;
    }

    // Load nama mapel untuk header kolom
    const mapels = await listMapel(bimtekId);
    const mapelMap = Object.fromEntries(mapels.map(m => [m.id, m]));

    // Group sesi per hari per mapel
    const sesiPerHariPerMapel = _groupSesiPerHariPerMapel(mapelSesis);
    // Filter valid hari >= bimtek start date, sort by date
    const bimtekStartDate = _normalizeTanggal(bimtek.tanggalMulai);
    const hari = Object.keys(sesiPerHariPerMapel)
      .filter(d => d !== 'tanpa-tanggal' && (!bimtekStartDate || d >= bimtekStartDate))
      .sort();
    // Add 'tanpa-tanggal' at the end jika ada
    if (sesiPerHariPerMapel['tanpa-tanggal']) {
      hari.push('tanpa-tanggal');
    }

    // Load attendance per peserta
    const attendanceMap = {};
    for (const score of scores) {
      const att = await getAttendance(bimtekId, score.noPeserta);
      attendanceMap[score.noPeserta] = att.sessions || {};
    }

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="btam-table">
          <thead>
            <tr>
              <th class="sticky left-0 bg-gray-900 z-10 min-w-32">Peserta</th>
              ${hari.map(d => `
                <th colspan="${Object.keys(sesiPerHariPerMapel[d]).length}" class="text-center text-xs bg-gray-800">
                  ${_fmtDate(d)}
                </th>
              `).join('')}
            </tr>
            <tr>
              <th class="sticky left-0 bg-gray-900 z-10"></th>
              ${hari.map(d => Object.entries(sesiPerHariPerMapel[d]).map(([mapelId, sesiList]) => {
                const mapel = mapelMap[mapelId];
                const totalJp = sesiList.reduce((sum, s) => sum + (s.jp || 0), 0);
                const mapelName = mapel?.nama || mapelId || 'Unknown';
                return `<th class="text-center text-xs whitespace-nowrap" style="min-width:6rem">
                  <div>${_esc(mapelName)}</div>
                  ${totalJp > 0 ? `<div class="text-gray-500 font-normal">${totalJp} JP</div>` : ''}
                </th>`;
              }).join('')).join('')}
            </tr>
          </thead>
          <tbody>
            ${scores.map(score => {
              const att = attendanceMap[score.noPeserta] || {};
              return `
                <tr>
                  <td class="sticky left-0 bg-gray-950 z-10 font-medium text-sm">${_esc(score.noPeserta)}</td>
                  ${hari.map(d => Object.entries(sesiPerHariPerMapel[d]).map(([mapelId, sesiList]) => {
                    // Hadir jika semua segmen sesi mapel ini hadir
                    const allHadir = sesiList.every(s => att[s.id]?.kehadiran ?? false);
                    return `
                      <td class="text-center p-2">
                        <input type="checkbox" class="kehadiran-check"
                          data-peserta="${_esc(score.noPeserta)}"
                          data-mapel="${_esc(mapelId)}"
                          data-hari="${_esc(d)}"
                          ${allHadir ? 'checked' : ''} />
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

    container.querySelector('#btn-save-kehadiran')?.addEventListener('click', async () => {
      await _saveKehadiran(bimtekId, scores, container, sesiPerHariPerMapel);
    });

    container.querySelector('#btn-hitung-kehadiran')?.addEventListener('click', async () => {
      await _hitungKehadiran(bimtekId, scores, sesis, container);
    });
  } catch (err) {
    container.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`;
    console.error(err);
  }
}

// ─── HELPER: Group sesi per hari per mapel ─────────────────────────

function _normalizeTanggal(tanggal) {
  if (!tanggal) return null;
  if (typeof tanggal === 'string') {
    if (tanggal === 'Invalid Date' || !tanggal.trim()) return null;
    return tanggal;
  }
  try {
    if (tanggal.toDate) return tanggal.toDate().toISOString().split('T')[0];
    if (tanggal.seconds) return new Date(tanggal.seconds * 1000).toISOString().split('T')[0];
  } catch (err) {
    console.warn('Failed to parse tanggal:', tanggal, err);
  }
  return null;
}

function _groupSesiPerHariPerMapel(sesis) {
  const grouped = {};

  sesis.forEach(s => {
    const tglStr = _normalizeTanggal(s.tanggal) || 'tanpa-tanggal';
    const mapelId = s.mapelId || 'unknown';
    if (!grouped[tglStr]) grouped[tglStr] = {};
    if (!grouped[tglStr][mapelId]) grouped[tglStr][mapelId] = [];
    grouped[tglStr][mapelId].push(s);
  });

  // Sort sesi dalam tiap mapel by jamMulai, lalu sort mapel dalam tiap hari by earliest jamMulai
  for (const tgl of Object.keys(grouped)) {
    for (const mapelId of Object.keys(grouped[tgl])) {
      grouped[tgl][mapelId].sort((a, b) => (a.jamMulai || '').localeCompare(b.jamMulai || ''));
    }
    const sortedMapelIds = Object.keys(grouped[tgl]).sort((a, b) => {
      const aFirst = grouped[tgl][a][0]?.jamMulai || '';
      const bFirst = grouped[tgl][b][0]?.jamMulai || '';
      return aFirst.localeCompare(bFirst);
    });
    const sortedObj = {};
    sortedMapelIds.forEach(id => { sortedObj[id] = grouped[tgl][id]; });
    grouped[tgl] = sortedObj;
  }

  return grouped;
}

// ─── SAVE KEHADIRAN ─────────────────────────────────────────────────

async function _saveKehadiran(bimtekId, scores, container, sesiPerHariPerMapel) {
  try {
    const matrixData = {};

    scores.forEach(score => {
      matrixData[score.noPeserta] = {};
      container.querySelectorAll(`input.kehadiran-check[data-peserta="${score.noPeserta}"]`).forEach(check => {
        const mapelId = check.dataset.mapel;
        const hari = check.dataset.hari;
        const sesiList = sesiPerHariPerMapel[hari]?.[mapelId] || [];
        // Satu checkbox mapel → apply ke semua segmen sesi mapel tersebut
        sesiList.forEach(s => {
          matrixData[score.noPeserta][s.id] = check.checked;
        });
      });
    });

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

function _fmtDate(dateStr) {
  if (!dateStr || dateStr === 'tanpa-tanggal') return 'Tanpa Tanggal';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return dateStr || 'Invalid Date';
    return date.toLocaleDateString('id-ID', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch (err) {
    console.warn('Failed to format date:', dateStr, err);
    return 'Invalid Date';
  }
}

function _esc(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}
