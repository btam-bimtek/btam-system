// admin/js/modules/bimtek/tab-ujian.js
// Tab Ujian di halaman detail bimtek.
// Mengelola exam config (pretest/posttest) dan magic link generation.

import { showToast }     from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import {
  listExams, createExam, updateExam, deleteExam, publishExam,
  listSessions, generateSessions, deleteSession, resetSession,
} from './exam-api.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';
import { db } from '../../../../shared/db.js';
import {
  collection, getDocs, query, where, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COL } from '../../../../shared/constants.js';

// Exam host — base URL untuk magic link
// Admin app: https://btam-bimtek.github.io/btam-system/admin/...
// Exam app:  https://btam-bimtek.github.io/btam-system/exam/
// Derive base path dari pathname saat ini agar works di semua environment
// (GitHub Pages dengan subfolder, maupun local dev di root)
const EXAM_HOST = (() => {
  const base = window.location.pathname.split('/admin/')[0];
  return `${window.location.origin}${base}/exam/`;
})();

const TIPE_LABEL = {
  pretest:           'Pre-Test',
  posttest:          'Post-Test',
  pretest_posttest:  'Pre-Test & Post-Test',
};

const SESSION_STATUS_LABEL = {
  issued:    'Belum Dikerjakan',
  started:   'Sedang Dikerjakan',
  submitted: 'Selesai',
  expired:   'Kadaluarsa',
};

const SESSION_STATUS_BADGE = {
  issued:    'badge-gray',
  started:   'badge-blue',
  submitted: 'badge-green',
  expired:   'badge-red',
};

// ─── ENTRY POINT ─────────────────────────────────────────────

export async function renderTabUjian(app, el, S) {
  el.innerHTML = `<div class="flex items-center justify-center py-10">
    <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>`;

  try {
    const [exams, sessions] = await Promise.all([
      listExams(S.id),
      _listAllSessions(S.id),
    ]);
    _render(app, el, S, exams, sessions);
  } catch (err) {
    el.innerHTML = `<p class="text-red-400 text-sm p-4">Gagal memuat: ${err.message}</p>`;
  }
}

async function _listAllSessions(bimtekId) {
  // Ambil semua sessions dari semua exam di bimtek ini
  const exams = await listExams(bimtekId);
  if (!exams.length) return [];
  const all = await Promise.all(exams.map(e => listSessions(e.id)));
  return all.flat();
}

// ─── RENDER ──────────────────────────────────────────────────

function _render(app, el, S, exams, sessions) {
  const canEdit = ['draft', 'planned'].includes(S.bimtek?.status);

  // Group sessions by examId
  const sessionsByExam = {};
  sessions.forEach(s => {
    if (!sessionsByExam[s.examId]) sessionsByExam[s.examId] = [];
    sessionsByExam[s.examId].push(s);
  });

  const examCards = exams.map(e => _buildExamCard(e, sessionsByExam[e.id] || [], S, canEdit)).join('');

  el.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-500">${exams.length} ujian dikonfigurasi</span>
        ${canEdit ? `<button id="btn-buat-ujian" class="px-3 py-1.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">+ Buat Ujian</button>` : ''}
      </div>
      ${exams.length === 0
        ? `<div class="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500 text-sm">
             Belum ada ujian. ${canEdit ? 'Klik "+ Buat Ujian" untuk mulai.' : ''}
           </div>`
        : examCards
      }
    </div>`;

  // Bind events
  el.querySelector('#btn-buat-ujian')?.addEventListener('click', () =>
    _showExamModal(app, el, S, null)
  );

  el.querySelectorAll('.btn-edit-exam').forEach(btn => {
    const exam = exams.find(e => e.id === btn.dataset.id);
    if (exam) btn.addEventListener('click', () => _showExamModal(app, el, S, exam));
  });

  el.querySelectorAll('.btn-delete-exam').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Hapus Ujian', message: 'Hapus ujian ini beserta semua magic link-nya?', danger: true });
      if (!ok) return;
      try {
        await deleteExam(btn.dataset.id);
        await renderTabUjian(app, el, S);
        showToast('Ujian dihapus', 'success');
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  });

  el.querySelectorAll('.btn-publish-exam').forEach(btn => {
    btn.addEventListener('click', async () => {
      const published = btn.dataset.published === 'true';
      try {
        await publishExam(btn.dataset.id, !published);
        await renderTabUjian(app, el, S);
        showToast(!published ? 'Ujian dipublish' : 'Ujian di-unpublish', 'success');
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  });

  el.querySelectorAll('.btn-gen-links').forEach(btn => {
    const exam = exams.find(e => e.id === btn.dataset.id);
    if (exam) btn.addEventListener('click', () => _generateLinks(app, el, S, exam));
  });

  el.querySelectorAll('.btn-show-links').forEach(btn => {
    const exam  = exams.find(e => e.id === btn.dataset.id);
    const sesis = sessionsByExam[btn.dataset.id] || [];
    if (exam) btn.addEventListener('click', () => _showLinksModal(app, el, S, exam, sesis));
  });
}

function _buildExamCard(exam, sessions, S, canEdit) {
  const tipeLabel    = TIPE_LABEL[exam.tipe] || exam.tipe;
  const jumlahSoal   = exam.soalIds?.length || 0;
  const sessionCount = sessions.length;
  const submitted    = sessions.filter(s => s.status === 'submitted').length;

  const statusBadge = exam.published
    ? `<span class="badge badge-green">Published</span>`
    : `<span class="badge badge-gray">Draft</span>`;

  const actions = canEdit ? `
    <button class="btn-edit-exam text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" data-id="${exam.id}">Edit</button>
    <button class="btn-publish-exam text-xs px-2 py-1 rounded ${exam.published ? 'bg-yellow-900/50 hover:bg-yellow-900 text-yellow-300' : 'bg-green-900/50 hover:bg-green-900 text-green-300'} transition-colors"
      data-id="${exam.id}" data-published="${exam.published}">
      ${exam.published ? 'Unpublish' : 'Publish'}
    </button>
    <button class="btn-delete-exam text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-900 text-red-300 transition-colors" data-id="${exam.id}">Hapus</button>` : '';

  const linkActions = `
    ${canEdit ? `<button class="btn-gen-links text-xs px-2 py-1 rounded bg-blue-900/50 hover:bg-blue-800 text-blue-300 transition-colors" data-id="${exam.id}">Generate Magic Link</button>` : ''}
    ${sessionCount > 0 ? `<button class="btn-show-links text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" data-id="${exam.id}">Lihat Link (${sessionCount})</button>` : ''}`;

  return `
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div class="flex items-start justify-between px-4 py-3 border-b border-gray-800">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-medium text-white text-sm">${_esc(exam.judul)}</span>
          <span class="badge badge-blue">${tipeLabel}</span>
          ${statusBadge}
        </div>
        <div class="flex gap-1.5 flex-wrap justify-end">${actions}</div>
      </div>
      <div class="px-4 py-3 flex flex-wrap gap-4 text-xs text-gray-400">
        <span>⏱ ${exam.durasi} menit</span>
        <span>📋 ${jumlahSoal} soal dipilih → ${exam.jumlahDitampilkan} ditampilkan</span>
        <span>🔗 ${sessionCount} link${submitted ? ` (${submitted} selesai)` : ''}</span>
      </div>
      <div class="px-4 pb-3 flex gap-2 flex-wrap">${linkActions}</div>
    </div>`;
}

// ─── EXAM MODAL (Create / Edit) ───────────────────────────────

async function _showExamModal(app, el, S, exam) {
  // Load soal langsung via Firestore — hanya filter active=true
  // filter bidang dan deleted dilakukan di client untuk hindari composite index issue
  let soalPool = [];
  try {
    const bidangIds  = new Set(S.bimtek?.bidangIds || []);
    const snap = await getDocs(
      query(collection(db, COL.BANK_SOAL), where('active', '==', true), limit(500))
    );
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Filter deleted + bidang di client
    soalPool = all.filter(s => {
      if (s.deleted) return false;
      if (bidangIds.size > 0 && !bidangIds.has(s.bidangId)) return false;
      return true;
    });
  } catch (err) {
    showToast('Gagal memuat bank soal: ' + err.message, 'error');
    return;
  }

  if (soalPool.length === 0) {
    showToast('Tidak ada soal aktif di bank soal untuk bidang ini', 'info');
    return;
  }

  const isEdit         = !!exam;
  const selectedSoalIds = new Set(exam?.soalIds || []);

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60';
  modal.innerHTML = `
    <div class="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl mx-4 flex flex-col" style="max-height:95vh">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
        <h3 class="font-semibold text-white">${isEdit ? 'Edit Ujian' : 'Buat Ujian'}</h3>
        <button id="exam-modal-close" class="text-gray-400 hover:text-white text-xl leading-none">×</button>
      </div>

      <div class="overflow-y-auto flex-1 p-5 space-y-4 min-h-0">
        <!-- Info dasar -->
        <div class="grid grid-cols-1 gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Judul Ujian</label>
            <input id="exam-judul" type="text" class="form-input w-full" value="${_esc(exam?.judul || '')}" placeholder="Misal: Pre-Test Produksi 2026">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-400 mb-1">Tipe</label>
              <select id="exam-tipe" class="form-select w-full">
                <option value="pretest"          ${exam?.tipe === 'pretest'          ? 'selected' : ''}>Pre-Test</option>
                <option value="posttest"         ${exam?.tipe === 'posttest'         ? 'selected' : ''}>Post-Test</option>
                <option value="pretest_posttest" ${exam?.tipe === 'pretest_posttest' ? 'selected' : ''}>Pre-Test & Post-Test (soal sama)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Durasi (menit)</label>
              <input id="exam-durasi" type="number" class="form-input w-full" value="${exam?.durasi || 60}" min="1" max="300">
            </div>
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Jumlah soal ditampilkan per sesi</label>
            <input id="exam-jumlah" type="number" class="form-input w-full" value="${exam?.jumlahDitampilkan || ''}" min="1" placeholder="Harus ≤ jumlah soal dipilih">
            <p class="text-xs text-gray-500 mt-1">Untuk Pre-Test & Post-Test: soal identik, urutan diacak. Jumlah harus sama dengan soal dipilih.</p>
          </div>
        </div>

        <!-- Soal picker -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-gray-400">Pilih Soal dari Bank Soal</label>
            <span id="soal-count-label" class="text-xs text-blue-400">0 dipilih</span>
          </div>
          <div class="flex gap-2 mb-2 flex-wrap">
            <input id="soal-search" type="text" placeholder="Cari pertanyaan atau EK…" class="form-input flex-1 text-xs" style="min-width:140px">
            ${(S.bimtek?.bidangIds?.length || 0) > 1 ? `
            <select id="soal-filter-bidang" class="form-select text-xs">
              <option value="">Semua Bidang</option>
              ${(S.bimtek.bidangIds).map(bid => {
                const nama = BIDANG_LIST.find(b => b.bidangId === bid)?.nama || bid;
                return `<option value="${_esc(bid)}">${_esc(nama)}</option>`;
              }).join('')}
            </select>` : ''}
            <select id="soal-filter-bloom" class="form-select text-xs">
              <option value="">Semua Bloom</option>
              <option value="C1">C1 Mengingat</option>
              <option value="C2">C2 Memahami</option>
              <option value="C3">C3 Menerapkan</option>
              <option value="C4">C4 Menganalisis</option>
              <option value="C5">C5 Mengevaluasi</option>
              <option value="C6">C6 Mencipta</option>
            </select>
          </div>
          <div id="soal-list" class="bg-gray-800 rounded-lg overflow-y-auto space-y-0.5 p-2" style="max-height:280px"></div>
        </div>
      </div>

      <div id="exam-error" class="hidden mx-5 mb-0 text-red-400 text-sm bg-red-900/30 rounded p-3"></div>
      <div class="flex justify-end gap-3 px-5 py-4 border-t border-gray-800 shrink-0">
        <button id="exam-modal-cancel" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Batal</button>
        <button id="exam-modal-save" class="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">Simpan</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const soalListEl  = modal.querySelector('#soal-list');
  const searchEl    = modal.querySelector('#soal-search');
  const bloomEl     = modal.querySelector('#soal-filter-bloom');
  const bidangEl    = modal.querySelector('#soal-filter-bidang');
  const countLbl    = modal.querySelector('#soal-count-label');
  const errEl       = modal.querySelector('#exam-error');

  function _updateCount() {
    countLbl.textContent = `${selectedSoalIds.size} dipilih`;
  }

  function _renderSoal() {
    const q      = searchEl.value.toLowerCase();
    const bloom  = bloomEl.value;
    const bidang = bidangEl?.value || '';
    const hasil  = soalPool.filter(s => {
      const matchQ      = !q      || s.pertanyaan?.toLowerCase().includes(q) || s.elemenKompetensi?.toLowerCase().includes(q);
      const matchBloom  = !bloom  || s.bloomLevel === bloom;
      const matchBidang = !bidang || s.bidangId   === bidang;
      return matchQ && matchBloom && matchBidang;
    });

    if (hasil.length === 0) {
      soalListEl.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">Tidak ada soal.</p>`;
      return;
    }

    soalListEl.innerHTML = hasil.map(s => `
      <label class="flex items-start gap-2 px-2 py-2 rounded hover:bg-gray-700 cursor-pointer transition-colors">
        <input type="checkbox" class="soal-cb mt-0.5 shrink-0 accent-blue-500" value="${s.soalId}" ${selectedSoalIds.has(s.soalId) ? 'checked' : ''}>
        <div class="min-w-0">
          <p class="text-xs text-white leading-snug line-clamp-2">${_esc(s.pertanyaan)}</p>
          <p class="text-xs text-gray-400 mt-0.5">${_esc(s.elemenKompetensi || '-')} · ${s.bloomLevel}</p>
        </div>
      </label>`).join('');

    soalListEl.querySelectorAll('.soal-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        cb.checked ? selectedSoalIds.add(cb.value) : selectedSoalIds.delete(cb.value);
        _updateCount();

        // Auto-set jumlahDitampilkan kalau tipe pretest_posttest
        const tipe = modal.querySelector('#exam-tipe').value;
        if (tipe === 'pretest_posttest') {
          modal.querySelector('#exam-jumlah').value = selectedSoalIds.size;
        }
      });
    });
  }

  searchEl.addEventListener('input', _renderSoal);
  bloomEl.addEventListener('change', _renderSoal);
  bidangEl?.addEventListener('change', _renderSoal);
  modal.querySelector('#exam-tipe').addEventListener('change', e => {
    const jumlahEl = modal.querySelector('#exam-jumlah');
    if (e.target.value === 'pretest_posttest') {
      jumlahEl.value    = selectedSoalIds.size;
      jumlahEl.readOnly = true;
    } else {
      jumlahEl.readOnly = false;
    }
  });

  // Init readonly state
  if (exam?.tipe === 'pretest_posttest') {
    modal.querySelector('#exam-jumlah').readOnly = true;
  }

  _renderSoal();
  _updateCount();

  const close = () => modal.remove();
  modal.querySelector('#exam-modal-close').addEventListener('click', close);
  modal.querySelector('#exam-modal-cancel').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  modal.querySelector('#exam-modal-save').addEventListener('click', async () => {
    errEl.classList.add('hidden');
    const btn  = modal.querySelector('#exam-modal-save');
    const data = {
      tipe:              modal.querySelector('#exam-tipe').value,
      judul:             modal.querySelector('#exam-judul').value,
      durasi:            parseInt(modal.querySelector('#exam-durasi').value) || 0,
      soalIds:           [...selectedSoalIds],
      jumlahDitampilkan: parseInt(modal.querySelector('#exam-jumlah').value) || 0,
    };

    // Enforce pretest_posttest: jumlahDitampilkan harus = soalIds.length
    if (data.tipe === 'pretest_posttest') data.jumlahDitampilkan = data.soalIds.length;

    btn.disabled = true; btn.textContent = 'Menyimpan...';
    try {
      if (isEdit) await updateExam(exam.id, data);
      else        await createExam(S.id, data);
      modal.remove();
      await renderTabUjian(app, el, S);
      showToast(isEdit ? 'Ujian diperbarui' : 'Ujian dibuat', 'success');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  });
}

// ─── GENERATE MAGIC LINK ─────────────────────────────────────

async function _generateLinks(app, el, S, exam) {
  const pesertaIds = S.bimtek?.pesertaIds || [];
  if (pesertaIds.length === 0) {
    showToast('Belum ada peserta di bimtek ini. Tambah peserta dulu di tab Peserta.', 'info');
    return;
  }

  const ok = await confirmDialog({
    title:   'Generate Magic Link',
    message: `Generate link ujian untuk ${pesertaIds.length} peserta? Link yang sudah ada tidak akan diganti.`,
  });
  if (!ok) return;

  try {
    const { created, skipped } = await generateSessions(exam, pesertaIds);
    await renderTabUjian(app, el, S);
    showToast(`${created} link dibuat, ${skipped} sudah ada (dilewati)`, 'success');
  } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
}

// ─── LIHAT MAGIC LINK ────────────────────────────────────────

function _showLinksModal(app, el, S, exam, sessions) {
  const tipeLabel = TIPE_LABEL[exam.tipe] || exam.tipe;

  // Group by noPeserta
  const byPeserta = {};
  sessions.forEach(s => {
    if (!byPeserta[s.noPeserta]) byPeserta[s.noPeserta] = {};
    byPeserta[s.noPeserta][s.tipeSession] = s;
  });

  const rows = Object.entries(byPeserta).map(([noPeserta, sesiMap]) => {
    const cols = exam.tipe === 'pretest_posttest'
      ? ['pretest', 'posttest']
      : [exam.tipe];

    const sessionCols = cols.map(tipe => {
      const s = sesiMap[tipe];
      if (!s) return `<td class="text-xs text-gray-500">—</td>`;
      const link    = `${EXAM_HOST}#/session/${s.token}`;
      const badge   = SESSION_STATUS_BADGE[s.status] || 'badge-gray';
      const lbl     = SESSION_STATUS_LABEL[s.status] || s.status;
      return `
        <td>
          <div class="flex items-center gap-1.5">
            <span class="badge ${badge} text-xs">${lbl}</span>
            ${s.status === 'issued' || s.status === 'expired' ? `
              <button class="btn-copy-link text-xs text-blue-400 hover:text-blue-300 underline" data-link="${_esc(link)}" data-token="${s.token}">Copy</button>
            ` : ''}
            <button class="btn-reset-session text-xs text-gray-400 hover:text-gray-200" data-id="${s.id}" title="Reset session">↺</button>
          </div>
        </td>`;
    }).join('');

    return `<tr>
      <td class="text-xs text-gray-400">${_esc(noPeserta)}</td>
      ${sessionCols}
    </tr>`;
  }).join('');

  const thCols = exam.tipe === 'pretest_posttest'
    ? '<th>Pre-Test</th><th>Post-Test</th>'
    : `<th>${tipeLabel}</th>`;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60';
  modal.innerHTML = `
    <div class="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl mx-4 flex flex-col" style="max-height:90vh">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
        <div>
          <h3 class="font-semibold text-white">Magic Link — ${_esc(exam.judul)}</h3>
          <p class="text-xs text-gray-500 mt-0.5">${sessions.length} session · ${tipeLabel}</p>
        </div>
        <button id="links-modal-close" class="text-gray-400 hover:text-white text-xl leading-none">×</button>
      </div>

      <div class="px-5 pt-3 pb-2 shrink-0">
        <input id="links-search" type="text" placeholder="Cari noPeserta…" class="form-input w-full text-sm">
      </div>

      <div class="overflow-auto flex-1 px-5 pb-4 min-h-0">
        <table class="btam-table w-full" id="links-table">
          <thead><tr><th>No Peserta</th>${thCols}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="flex justify-between items-center px-5 py-4 border-t border-gray-800 shrink-0">
        <button id="btn-copy-all" class="text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">Copy Semua Link</button>
        <button id="links-modal-close2" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Tutup</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#links-modal-close').addEventListener('click', close);
  modal.querySelector('#links-modal-close2').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  // Search filter
  modal.querySelector('#links-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    modal.querySelectorAll('#links-table tbody tr').forEach(row => {
      row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  // Copy single link
  modal.querySelectorAll('.btn-copy-link').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.link)
        .then(() => showToast('Link disalin', 'success'))
        .catch(() => showToast('Gagal menyalin', 'error'));
    });
  });

  // Reset session
  modal.querySelectorAll('.btn-reset-session').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Reset Session', message: 'Reset session ini? Status kembali ke "Belum Dikerjakan".', danger: true });
      if (!ok) return;
      try {
        await resetSession(btn.dataset.id);
        modal.remove();
        await renderTabUjian(app, el, S);
        showToast('Session direset', 'success');
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  });

  // Copy all links
  modal.querySelector('#btn-copy-all').addEventListener('click', () => {
    const lines = [];
    sessions.forEach(s => {
      const link = `${EXAM_HOST}#/session/${s.token}`;
      lines.push(`${s.noPeserta}\t${s.tipeSession}\t${link}`);
    });
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => showToast(`${lines.length} link disalin`, 'success'))
      .catch(() => showToast('Gagal menyalin', 'error'));
  });
}

// ─── HELPER ──────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
