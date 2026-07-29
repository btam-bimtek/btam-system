// admin/js/modules/bimtek/sub-nilai-manual.js
// Input nilai manual: pengajar, keaktifan, respek, tugas, presentasi
// Baris = peserta, kolom = komponen nilai + pretest/posttest (read-only)

import { updateNilai } from './penilaian-api.js';
import { showToast } from '../../components/toast.js';
import {
  db, collection, query, where, getDocs
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';

export async function renderSubNilaiManual(container, bimtekId, bimtek, scores) {
  const komponen = [
    { id: 'pengajar',   nama: 'Nilai Pengajar' },
    { id: 'keaktifan',  nama: 'Keaktifan' },
    { id: 'respek',     nama: 'Sikap & Respek' }
  ];
  if (bimtek.hasTugas)      komponen.push({ id: 'tugas',      nama: 'Tugas' });
  if (bimtek.hasPresentasi) komponen.push({ id: 'presentasi', nama: 'Presentasi' });

  // Fetch nama peserta dari peserta_master
  const namaMap = {};
  const ids = scores.map(s => s.noPeserta);
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const snap = await getDocs(
      query(collection(db, COL.PESERTA_MASTER), where('noPeserta', 'in', chunk))
    );
    snap.docs.forEach(d => { namaMap[d.id] = d.data().nama ?? d.id; });
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="btam-table">
        <thead>
          <tr>
            <th class="sticky left-0 bg-gray-900 z-10 min-w-40">Peserta</th>
            ${komponen.map(k => `<th class="text-center min-w-24">${k.nama}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${scores.map(score => `
            <tr>
              <td class="sticky left-0 bg-gray-950 z-10">
                <div class="font-medium text-sm text-gray-200">${_esc(namaMap[score.noPeserta] ?? score.noPeserta)}</div>
                <div class="text-xs text-gray-500 font-mono">${_esc(score.noPeserta)}</div>
              </td>
              ${komponen.map(k => `
                <td>
                  <input
                    type="number"
                    class="nilai-input form-input w-20 text-center"
                    min="0" max="100"
                    data-peserta="${_esc(score.noPeserta)}"
                    data-komponen="${k.id}"
                    value="${score[k.id] ?? ''}"
                    placeholder="—"
                  />
                </td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="mt-6 flex gap-2">
      <button id="btn-save-nilai-manual" class="px-4 py-2 bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] text-sm rounded-lg transition-colors">
        Simpan Nilai Manual
      </button>
    </div>
  `;

  container.querySelector('#btn-save-nilai-manual')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-save-nilai-manual');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    try {
      const inputs = container.querySelectorAll('input.nilai-input');
      let count = 0;

      for (const input of inputs) {
        const peserta  = input.dataset.peserta;
        const komp     = input.dataset.komponen;
        const nilai    = input.value === '' ? null : parseInt(input.value);

        if (nilai !== null && (nilai < 0 || nilai > 100)) {
          showToast(`${komp} harus 0–100`, 'error');
          btn.disabled = false;
          btn.textContent = 'Simpan Nilai Manual';
          return;
        }

        if (nilai !== null) {
          await updateNilai(bimtekId, peserta, { [komp]: nilai });
          count++;
        }
      }

      showToast(`${count} nilai berhasil disimpan`, 'ok');
    } catch (err) {
      showToast(`Gagal simpan: ${err.message}`, 'error');
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan Nilai Manual';
    }
  });
}

function _esc(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}
