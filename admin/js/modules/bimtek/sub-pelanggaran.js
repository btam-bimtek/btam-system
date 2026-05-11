// admin/js/modules/bimtek/sub-pelanggaran.js
// Tampilkan daftar pelanggaran anti-cheat per peserta
// Data dari exam_submissions.warningCount + submitReason

import {
  db, collection, getDocs, query, where, snapToArray
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';
import { listExams } from './exam-api.js';

const SUBMIT_REASON_LABEL = {
  manual:          'Submit Manual',
  timeout:         'Waktu Habis',
  tab_switch:      'Pindah Tab',
  window_blur:     'Keluar Window',
  exit_fullscreen: 'Keluar Fullscreen',
  max_warnings:    'Batas Peringatan',
};

// submitReason selain 'manual' dianggap auto-submit karena anti-cheat/timeout
const isAutoSubmit = s => !!(s.submitReason && s.submitReason !== 'manual');

export async function renderSubPelanggaran(container, bimtekId) {
  container.innerHTML = '<div class="text-gray-400 text-sm">Memuat data pelanggaran...</div>';
  try {
    const [submissionsSnap, exams] = await Promise.all([
      getDocs(query(collection(db, COL.EXAM_SUBMISSIONS), where('bimtekId', '==', bimtekId))),
      listExams(bimtekId),
    ]);

    const submissions = snapToArray(submissionsSnap);

    if (submissions.length === 0) {
      container.innerHTML = '<div class="text-gray-400 text-sm">Belum ada submission untuk bimtek ini.</div>';
      return;
    }

    const examMap = Object.fromEntries(exams.map(e => [e.id, e]));

    // Urutkan: auto-submit dulu, lalu warningCount desc
    submissions.sort((a, b) => {
      const aAuto = isAutoSubmit(a), bAuto = isAutoSubmit(b);
      if (bAuto !== aAuto) return bAuto ? 1 : -1;
      return (b.warningCount || 0) - (a.warningCount || 0);
    });

    const maxWarn = 3;
    const autoCount = submissions.filter(isAutoSubmit).length;
    const warnCount = submissions.filter(s => (s.warningCount || 0) > 0).length;

    container.innerHTML = `
      <div class="mb-4 flex gap-4 text-xs flex-wrap">
        <div class="bg-red-900 bg-opacity-30 px-3 py-2 rounded">
          <span class="text-red-400 font-bold">${autoCount}</span>
          <span class="text-red-300 ml-1">Auto-Submit</span>
        </div>
        <div class="bg-yellow-900 bg-opacity-30 px-3 py-2 rounded">
          <span class="text-yellow-400 font-bold">${warnCount}</span>
          <span class="text-yellow-300 ml-1">Memiliki Peringatan</span>
        </div>
        <div class="bg-gray-800 px-3 py-2 rounded">
          <span class="text-white font-bold">${submissions.length}</span>
          <span class="text-gray-400 ml-1">Total Submission</span>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="btam-table">
          <thead>
            <tr>
              <th>Peserta</th>
              <th>Exam</th>
              <th class="text-center">Sesi</th>
              <th class="text-center">Peringatan</th>
              <th class="text-center">Status Submit</th>
              <th class="text-center">Alasan</th>
            </tr>
          </thead>
          <tbody>
            ${submissions.map(s => {
              const warn = s.warningCount || 0;
              const exam = examMap[s.examId];
              const auto = isAutoSubmit(s);
              const warnClass = auto ? 'text-red-400 font-bold' : warn > 0 ? 'text-yellow-400' : 'text-gray-500';
              const reasonLabel = SUBMIT_REASON_LABEL[s.submitReason] || s.submitReason || '—';
              return `
                <tr class="${auto ? 'bg-red-950 bg-opacity-20' : ''}">
                  <td class="font-medium text-sm whitespace-nowrap">${_esc(s.noPeserta)}</td>
                  <td class="text-sm text-gray-300">${exam ? _esc(exam.judul) : _esc(s.examId)}</td>
                  <td class="text-center text-xs text-gray-400">${s.tipeSession === 'pretest' ? 'Pre' : s.tipeSession === 'posttest' ? 'Post' : _esc(s.tipeSession || '—')}</td>
                  <td class="text-center">
                    <span class="${warnClass}">${warn} / ${maxWarn}</span>
                  </td>
                  <td class="text-center">
                    ${auto
                      ? '<span class="badge badge-red text-xs">Auto-Submit</span>'
                      : '<span class="badge badge-green text-xs">Manual</span>'}
                  </td>
                  <td class="text-center text-xs text-gray-400">${_esc(reasonLabel)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div class="mt-4 bg-gray-900 p-3 rounded text-xs text-gray-500">
        Pelanggaran dicatat otomatis: pindah tab, keluar window, keluar fullscreen, akses DevTools, atau copy-paste.
        Peserta dengan ${maxWarn} peringatan akan di-submit otomatis (ditandai <span class="text-red-400">Auto-Submit</span>).
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`;
    console.error(err);
  }
}

function _esc(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}
