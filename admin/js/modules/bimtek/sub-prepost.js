// admin/js/modules/bimtek/sub-prepost.js
// Sinkronisasi Pre/Post Test: fetch exam_submissions → score → update bimtek_scores
// Trigger scoring engine

import { scoreAllSubmissions } from './scorer.js';
import { listExams } from './exam-api.js';
import { listExamResults } from './penilaian-api.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';

export async function renderSubPrePost(container, bimtekId, bimtek, scores) {
  try {
    const exams = await listExams(bimtekId);
    const prePostExams = exams.filter(e => ['pretest', 'posttest', 'pretest_posttest'].includes(e.tipe));

    if (prePostExams.length === 0) {
      container.innerHTML = '<div class="text-gray-400 text-sm">Belum ada exam pre/post test yang terkait.</div>';
      return;
    }

    // Load exam results (sudah di-score)
    const results = await listExamResults(bimtekId);

    container.innerHTML = `
      <div class="space-y-6">
        ${prePostExams.map(exam => {
          const examResults = results.filter(r => r.examId === exam.id);

          // Group by noPeserta
          const byPeserta = {};
          examResults.forEach(r => {
            if (!byPeserta[r.noPeserta]) byPeserta[r.noPeserta] = {};
            byPeserta[r.noPeserta][r.tipeSession] = r.skor;
          });

          const tipe = exam.tipe;
          const showPre  = tipe === 'pretest' || tipe === 'pretest_posttest';
          const showPost = tipe === 'posttest' || tipe === 'pretest_posttest';
          const preCount  = examResults.filter(r => r.tipeSession === 'pretest').length;
          const postCount = examResults.filter(r => r.tipeSession === 'posttest').length;

          const hasSkor = Object.keys(byPeserta).length > 0;

          return `
            <div class="bg-gray-800 p-4 rounded-lg">
              <div class="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 class="font-medium text-white">${_esc(exam.judul)}</h3>
                  <div class="text-xs text-gray-400 mt-1">
                    Tipe: ${tipe === 'pretest_posttest' ? 'Pre & Post' : tipe === 'pretest' ? 'Pre-Test' : 'Post-Test'}
                    · ${exam.published ? 'Dipublikasikan' : 'Draft'}
                  </div>
                  <div class="text-xs text-blue-400 mt-1">
                    Pre: ${preCount} · Post: ${postCount} submission terscore
                  </div>
                </div>
                <button class="btn-sync-exam shrink-0 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors"
                  data-exam-id="${exam.id}" data-exam-judul="${_esc(exam.judul)}">
                  Sinkronisasi
                </button>
              </div>

              ${hasSkor ? `
                <div class="overflow-x-auto">
                  <table class="btam-table">
                    <thead>
                      <tr>
                        <th>Peserta</th>
                        ${showPre  ? '<th class="text-center">Pre Test</th>' : ''}
                        ${showPost ? '<th class="text-center">Post Test</th>' : ''}
                        ${showPre && showPost ? '<th class="text-center">Peningkatan</th>' : ''}
                      </tr>
                    </thead>
                    <tbody>
                      ${Object.entries(byPeserta).sort(([a],[b]) => a.localeCompare(b)).map(([noPeserta, skor]) => {
                        const pre  = skor.pretest  ?? null;
                        const post = skor.posttest ?? null;
                        const delta = (pre !== null && post !== null) ? post - pre : null;
                        const deltaClass = delta === null ? '' : delta >= 0 ? 'text-green-400' : 'text-red-400';
                        return `
                          <tr>
                            <td class="font-medium text-sm">${_esc(noPeserta)}</td>
                            ${showPre  ? `<td class="text-center">${pre  !== null ? pre  : '—'}</td>` : ''}
                            ${showPost ? `<td class="text-center">${post !== null ? post : '—'}</td>` : ''}
                            ${showPre && showPost ? `<td class="text-center ${deltaClass}">${delta !== null ? (delta >= 0 ? '+' : '') + delta : '—'}</td>` : ''}
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `<div class="text-xs text-gray-500 mt-2">Belum ada data skor — klik Sinkronisasi untuk memproses submissions.</div>`}
            </div>
          `;
        }).join('')}

        <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
          <h4 class="font-medium text-sm text-white mb-2">ℹ️ Informasi</h4>
          <ul class="text-xs text-gray-400 space-y-1">
            <li>• Sinkronisasi fetch semua submissions → hitung skor → update bimtek_scores</li>
            <li>• Jika sudah ada hasil sebelumnya, akan di-overwrite (rescoring)</li>
            <li>• Peserta yang belum submit tidak akan diproses</li>
          </ul>
        </div>
      </div>
    `;

    // Bind sync buttons
    container.querySelectorAll('.btn-sync-exam').forEach(btn => {
      btn.addEventListener('click', async () => {
        const examId    = btn.dataset.examId;
        const examJudul = btn.dataset.examJudul;
        await _syncExam(bimtekId, examId, examJudul, btn, container, bimtek, scores);
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`;
    console.error(err);
  }
}

async function _syncExam(bimtekId, examId, examJudul, btn, container, bimtek, scores) {
  try {
    const ok = await confirmDialog({
      title: 'Sinkronisasi Pre/Post Test',
      message: `Sinkronisasi exam "${examJudul}"? Ini akan score semua submissions dan update bimtek_scores.`
    });

    if (!ok) return;

    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = 'Menyinkronisasi...';

    const { processed, failed, errors } = await scoreAllSubmissions(bimtekId, examId);

    if (errors.length > 0) {
      showToast(`Sinkronisasi ${examJudul}: ${processed} berhasil, ${failed} gagal`, 'warning');
      console.warn('Errors:', errors);
    } else {
      showToast(`${processed} submissions ${examJudul} berhasil di-score`, 'ok');
    }

    // Re-render sub-tab ini (bukan location.reload agar tetap di sub-tab prepost)
    await renderSubPrePost(container, bimtekId, bimtek, scores);
  } catch (err) {
    showToast(`Gagal sinkronisasi: ${err.message}`, 'error');
    console.error(err);
  }
}

function _esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
