// admin/js/modules/bimtek/sub-nilai-manual.js
// Input nilai manual: pengajar, keaktifan, respek, tugas, presentasi
// Baris = peserta, kolom = komponen nilai

import { updateNilai, bulkUpdateNilaiPengajar } from './penilaian-api.js';
import { showToast } from '../../components/toast.js';

export async function renderSubNilaiManual(container, bimtekId, bimtek, scores) {
  const komponen = [
    { id: 'pengajar', nama: 'Nilai Pengajar' },
    { id: 'keaktifan', nama: 'Keaktifan' },
    { id: 'respek', nama: 'Sikap & Respek' }
  ];

  if (bimtek.hasTugas) komponen.push({ id: 'tugas', nama: 'Tugas' });
  if (bimtek.hasPresentasi) komponen.push({ id: 'presentasi', nama: 'Presentasi' });

  container.innerHTML = `
    <table class="btam-table">
      <thead>
        <tr>
          <th class="min-w-32">Peserta</th>
          ${komponen.map(k => `<th class="text-center">${k.nama}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${scores.map(score => `
          <tr>
            <td class="font-medium">${_esc(score.noPeserta)}</td>
            ${komponen.map(k => `
              <td>
                <input
                  type="number"
                  class="nilai-input form-input w-20 text-left"
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

    <div class="mt-6 flex gap-2">
      <button id="btn-save-nilai-manual" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
        Simpan Nilai Manual
      </button>
    </div>
  `;

  container.querySelector('#btn-save-nilai-manual')?.addEventListener('click', async () => {
    try {
      const btn = container.querySelector('#btn-save-nilai-manual');
      btn.disabled = true;
      btn.textContent = 'Menyimpan...';

      const inputs = container.querySelectorAll('input.nilai-input');
      let count = 0;

      for (const input of inputs) {
        const peserta = input.dataset.peserta;
        const komponen = input.dataset.komponen;
        const nilai = input.value === '' ? null : parseInt(input.value);

        if (nilai !== null && (nilai < 0 || nilai > 100)) {
          showToast(`${komponen} harus 0-100`, 'error');
          btn.disabled = false;
          btn.textContent = 'Simpan Nilai Manual';
          return;
        }

        if (nilai !== null) {
          await updateNilai(bimtekId, peserta, { [komponen]: nilai });
          count++;
        }
      }

      showToast(`${count} nilai berhasil disimpan`, 'ok');
      btn.disabled = false;
      btn.textContent = 'Simpan Nilai Manual';
    } catch (err) {
      showToast(`Gagal simpan: ${err.message}`, 'error');
      console.error(err);
    }
  });
}

function _esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
