// admin/js/modules/bimtek/sub-prepost.js
// Sinkronisasi Pre/Post Test: fetch exam_submissions → score → update bimtek_scores
// Tabel menggabungkan dua sumber: exam_results (ujian online) + bimtek_scores (import CSV)

import { scoreAllSubmissions } from './scorer.js';
import { listExams } from './exam-api.js';
import { listExamResults, listBimtekScores } from './penilaian-api.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import {
  db, collection, query, where, getDocs
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';

export async function renderSubPrePost(container, bimtekId, bimtek, scores, onSyncComplete) {
  try {
    const exams = await listExams(bimtekId);
    const prePostExams = exams.filter(e =>
      ['pretest', 'posttest', 'pretest_posttest', 'seleksi_tertulis'].includes(e.tipe)
    );

    // Selalu fetch scores terbaru (jangan andalkan parameter yang mungkin kosong)
    const freshScores = await listBimtekScores(bimtekId);
    const scoresMap = Object.fromEntries(freshScores.map(s => [s.noPeserta, s]));

    // Fetch nama peserta
    const namaMap = {};
    const ids = freshScores.map(s => s.noPeserta);
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      const snap = await getDocs(
        query(collection(db, COL.PESERTA_MASTER), where('noPeserta', 'in', chunk))
      );
      snap.docs.forEach(d => { namaMap[d.id] = d.data().nama ?? d.id; });
    }

    // Fetch exam results (dari ujian online)
    const results = await listExamResults(bimtekId);

    // Cek apakah ada nilai CSV (pretest/posttest di bimtek_scores)
    const hasCsvScores = freshScores.some(s => s.pretest !== null || s.posttest !== null);

    if (prePostExams.length === 0 && !hasCsvScores) {
      container.innerHTML = '<div class="text-gray-400 text-sm">Belum ada nilai pre/post test. Buat exam atau import via CSV.</div>';
      return;
    }

    // Kalau tidak ada exam tapi ada CSV, tampilkan tabel CSV saja
    if (prePostExams.length === 0 && hasCsvScores) {
      container.innerHTML = `
        <div class="space-y-6">
          ${_buildCsvOnlyTable(freshScores, namaMap)}
          ${_infoBox()}
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="space-y-6">
        ${prePostExams.map(exam => {
          const examResults = results.filter(r => r.examId === exam.id);

          // Nilai dari ujian online (exam_results)
          const byPesertaOnline = {};
          examResults.forEach(r => {
            if (!byPesertaOnline[r.noPeserta]) byPesertaOnline[r.noPeserta] = {};
            byPesertaOnline[r.noPeserta][r.tipeSession] = r.skor;
          });

          const tipe      = exam.tipe;
          const isSeleksi = tipe === 'seleksi_tertulis';
          const showPre   = !isSeleksi && (tipe === 'pretest'  || tipe === 'pretest_posttest');
          const showPost  = !isSeleksi && (tipe === 'posttest' || tipe === 'pretest_posttest');

          const preCount     = examResults.filter(r => r.tipeSession === 'pretest').length;
          const postCount    = examResults.filter(r => r.tipeSession === 'posttest').length;
          const seleksiCount = examResults.filter(r => r.tipeSession === 'seleksi_tertulis').length;

          // Gabungkan semua noPeserta dari dua sumber
          const allNoPeserta = [...new Set([
            ...Object.keys(byPesertaOnline),
            ...freshScores.map(s => s.noPeserta)
          ])].sort();

          const hasData = allNoPeserta.length > 0;

          return `
            <div class="bg-gray-800 p-4 rounded-lg">
              <div class="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 class="font-medium text-white">${_esc(exam.judul)}</h3>
                  <div class="text-xs text-gray-400 mt-1">
                    Tipe: ${tipe === 'pretest_posttest' ? 'Pre & Post' : tipe === 'pretest' ? 'Pre-Test' : tipe === 'posttest' ? 'Post-Test' : 'Seleksi Tertulis'}
                    · ${exam.published ? 'Dipublikasikan' : 'Draft'}
                  </div>
                  <div class="text-xs text-[#2dd4bf] mt-1">
                    ${isSeleksi
                      ? `${seleksiCount} submission terscore`
                      : `Pre: ${preCount} · Post: ${postCount} submission terscore`}
                  </div>
                </div>
                <button class="btn-sync-exam shrink-0 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors"
                  data-exam-id="${exam.id}" data-exam-judul="${_esc(exam.judul)}">
                  Sinkronisasi
                </button>
              </div>

              ${hasData ? `
                <div class="overflow-x-auto">
                  <table class="btam-table">
                    <thead>
                      <tr>
                        <th class="sticky left-0 bg-gray-900 z-10 min-w-40">Peserta</th>
                        ${isSeleksi ? '<th class="text-left">Nilai</th>' : ''}
                        ${showPre  ? '<th class="text-left">Pre Test</th>'  : ''}
                        ${showPost ? '<th class="text-left">Post Test</th>' : ''}
                        ${showPre && showPost ? '<th class="text-left">Peningkatan</th>' : ''}
                        <th class="text-left text-gray-500 text-xs">Sumber</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${allNoPeserta.map(noPeserta => {
                        const online  = byPesertaOnline[noPeserta] ?? {};
                        const csvScore = scoresMap[noPeserta];

                        // Prioritas: ujian online > import CSV
                        const pre  = online['pretest']           ?? csvScore?.pretest  ?? null;
                        const post = online['posttest']          ?? csvScore?.posttest ?? null;
                        const sel  = online['seleksi_tertulis']  ?? null;

                        const hasOnline = Object.keys(online).length > 0;
                        const hasCSV    = !hasOnline && csvScore &&
                          (csvScore.pretest !== null || csvScore.posttest !== null);
                        const sumber = hasOnline ? 'Ujian' : hasCSV ? 'CSV' : '—';
                        const sumberClass = hasOnline
                          ? 'text-teal-400'
                          : hasCSV ? 'text-yellow-400' : 'text-gray-600';

                        const delta = (pre !== null && post !== null) ? post - pre : null;
                        const deltaClass = delta === null ? '' : delta >= 0 ? 'text-green-400' : 'text-red-400';

                        return `
                          <tr>
                            <td class="sticky left-0 bg-gray-950 z-10">
                              <div class="font-medium text-sm text-gray-200">${_esc(namaMap[noPeserta] ?? noPeserta)}</div>
                              <div class="text-xs text-gray-500 font-mono">${_esc(noPeserta)}</div>
                            </td>
                            ${isSeleksi ? `<td class="text-left">${sel !== null ? sel : '—'}</td>` : ''}
                            ${showPre  ? `<td class="text-left">${pre  !== null ? pre  : '—'}</td>` : ''}
                            ${showPost ? `<td class="text-left">${post !== null ? post : '—'}</td>` : ''}
                            ${showPre && showPost ? `<td class="text-left ${deltaClass}">${delta !== null ? (delta >= 0 ? '+' : '') + delta : '—'}</td>` : ''}
                            <td class="text-xs ${sumberClass}">${sumber}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `<div class="text-xs text-gray-500 mt-2">Belum ada data skor — klik Sinkronisasi untuk memproses submissions, atau import via CSV.</div>`}
            </div>
          `;
        }).join('')}

        ${_infoBox()}
      </div>
    `;

    // Bind sync buttons
    container.querySelectorAll('.btn-sync-exam').forEach(btn => {
      btn.addEventListener('click', async () => {
        const examId    = btn.dataset.examId;
        const examJudul = btn.dataset.examJudul;
        await _syncExam(bimtekId, examId, examJudul, btn, container, bimtek, onSyncComplete);
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`;
    console.error(err);
  }
}

async function _syncExam(bimtekId, examId, examJudul, btn, container, bimtek, onSyncComplete) {
  const origText = btn.textContent;
  try {
    const ok = await confirmDialog({
      title: 'Sinkronisasi Pre/Post Test',
      message: `Sinkronisasi exam "${examJudul}"? Ini akan score semua submissions dan update bimtek_scores.`
    });

    if (!ok) return;

    btn.disabled = true;
    btn.textContent = 'Menyinkronisasi...';

    const { processed, failed, errors } = await scoreAllSubmissions(bimtekId, examId);

    if (errors.length > 0) {
      showToast(`Sinkronisasi ${examJudul}: ${processed} berhasil, ${failed} gagal`, 'warning');
      console.warn('Errors:', errors);
    } else {
      showToast(`${processed} submissions ${examJudul} berhasil di-score`, 'ok');
    }

    // Re-render dengan scores terbaru
    await renderSubPrePost(container, bimtekId, bimtek, [], onSyncComplete);

    if (onSyncComplete) {
      try {
        await onSyncComplete();
      } catch (err) {
        showToast(`Error refreshing kelulusan: ${err.message}`, 'error');
        console.error('onSyncComplete error:', err);
      }
    }
  } catch (err) {
    showToast(`Gagal sinkronisasi: ${err.message}`, 'error');
    console.error(err);
    btn.disabled = false;
    btn.textContent = origText;
  }
}

function _buildCsvOnlyTable(scores, namaMap) {
  const rows = scores.filter(s => s.pretest !== null || s.posttest !== null);
  return `
    <div class="bg-gray-800 p-4 rounded-lg">
      <h3 class="font-medium text-white mb-1">Nilai Pre/Post Test (Import CSV)</h3>
      <div class="text-xs text-yellow-400 mb-4">Tidak ada exam ujian online — menampilkan nilai dari import CSV.</div>
      <div class="overflow-x-auto">
        <table class="btam-table">
          <thead>
            <tr>
              <th class="sticky left-0 bg-gray-900 z-10 min-w-40">Peserta</th>
              <th class="text-left">Pre Test</th>
              <th class="text-left">Post Test</th>
              <th class="text-left">Peningkatan</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(s => {
              const pre   = s.pretest  ?? null;
              const post  = s.posttest ?? null;
              const delta = pre !== null && post !== null ? post - pre : null;
              const deltaClass = delta === null ? '' : delta >= 0 ? 'text-green-400' : 'text-red-400';
              return `
                <tr>
                  <td class="sticky left-0 bg-gray-950 z-10">
                    <div class="font-medium text-sm text-gray-200">${_esc(namaMap[s.noPeserta] ?? s.noPeserta)}</div>
                    <div class="text-xs text-gray-500 font-mono">${_esc(s.noPeserta)}</div>
                  </td>
                  <td class="text-left">${pre  !== null ? pre  : '—'}</td>
                  <td class="text-left">${post !== null ? post : '—'}</td>
                  <td class="text-left ${deltaClass}">${delta !== null ? (delta >= 0 ? '+' : '') + delta : '—'}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function _infoBox() {
  return `
    <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
      <h4 class="font-medium text-sm text-white mb-2">ℹ️ Informasi</h4>
      <ul class="text-xs text-gray-400 space-y-1">
        <li>• <span class="text-teal-400">Ujian</span> — nilai dari submissions ujian online (scoring engine)</li>
        <li>• <span class="text-yellow-400">CSV</span> — nilai dari import CSV (sub tab Import CSV)</li>
        <li>• Jika keduanya ada, nilai ujian online yang dipakai</li>
        <li>• Sinkronisasi fetch semua submissions → hitung skor → update bimtek_scores</li>
      </ul>
    </div>`;
}

function _esc(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}
