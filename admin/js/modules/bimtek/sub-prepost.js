// admin/js/modules/bimtek/sub-prepost.js
// Sinkronisasi Pre/Post Test: fetch exam_submissions → score → update bimtek_scores
// Trigger scoring engine

import { scoreAllSubmissions, scoreSubmission } from './scorer.js';
import { listExams } from './exam-api.js';
import { getExamResult, listExamResults } from './penilaian-api.js';
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

    // Load exam results
    const results = await listExamResults(bimtekId);

    container.innerHTML = `
      <div class="space-y-6">
        ${prePostExams.map(exam => {
          const examResults = results.filter(r => r.examId === exam.id);
          const preCount = examResults.filter(r => r.tipeSession === 'pretest').length;
          const postCount = examResults.filter(r => r.tipeSession === 'posttest').length;

          return `
            <div class="bg-gray-800 p-4 rounded-lg">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="font-medium text-white">${_esc(exam.judul)}</h3>
                  <div class="text-xs text-gray-400 mt-2">
                    <div>Tipe: ${exam.tipe === 'pretest_posttest' ? 'Pre & Post Bersamaan' : (exam.tipe === 'pretest' ? 'Pre-Test Saja' : 'Post-Test Saja')}</div>
                    <div>Status: ${exam.published ? 'Dipublikasikan' : 'Draft'}</div>
                  </div>
                  <div class="text-xs text-blue-400 mt-2">
                    Pre: ${preCount} submission · Post: ${postCount} submission
                  </div>
                </div>
                <button class="btn-sync-exam px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors" data-exam-id="${exam.id}" data-exam-judul="${_esc(exam.judul)}">
                  Sinkronisasi
                </button>
              </div>
            </div>
          `;
        }).join('')}

        <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
          <h4 class="font-medium text-sm text-white mb-2">ℹ️ Informasi</h4>
          <ul class="text-xs text-gray-400 space-y-1">
            <li>• Sinkronisasi akan fetch semua submissions → hitung skor → update bimtek_scores</li>
            <li>• Jika sudah ada exam_results, akan di-overwrite (rescoring)</li>
            <li>• Peserta yang belum submit tidak akan diproses</li>
          </ul>
        </div>
      </div>
    `;

    // Bind sync buttons
    container.querySelectorAll('.btn-sync-exam').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const examId = btn.dataset.examId;
        const examJudul = btn.dataset.examJudul;
        await _syncExam(bimtekId, examId, examJudul, btn, container);
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`;
    console.error(err);
  }
}

async function _syncExam(bimtekId, examId, examJudul, btn, container) {
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

    btn.disabled = false;
    btn.textContent = origText;

    // Reload container
    setTimeout(() => {
      location.reload(); // Simple reload untuk refresh data
    }, 1500);
  } catch (err) {
    showToast(`Gagal sinkronisasi: ${err.message}`, 'error');
    console.error(err);
    btn.disabled = false;
    btn.textContent = origText;
  }
}

function _esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
