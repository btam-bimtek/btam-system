// admin/js/modules/bimtek/tab-ujian.js
// Tab Ujian di halaman detail bimtek.
// Mengelola exam config (pretest/posttest) dan sesi ujian.

import { showToast }     from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import {
  listExams, deleteExam, publishExam,
  listSessions, generateSessions, deleteSession, resetSession, extendSession,
  unlockDeviceSession, setExamWindow, fixSessionsExpiry,
} from './exam-api.js';
import { generateBimtekAccessCode } from './api.js';
import { showExamModal } from './exam-modal.js';


const TIPE_LABEL = {
  pretest:            'Pre-Test',
  posttest:           'Post-Test',
  pretest_posttest:   'Pre-Test & Post-Test',
  seleksi_tertulis:   'Seleksi Tertulis',
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
    <div class="w-5 h-5 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin"></div>
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
      ${_buildAccessCodeSection(S.bimtek)}
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-500">${exams.length} ujian dikonfigurasi</span>
        ${canEdit ? `<button id="btn-buat-ujian" class="px-3 py-1.5 rounded-lg text-sm bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">+ Buat Ujian</button>` : ''}
      </div>
      ${exams.length === 0
        ? `<div class="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500 text-sm">
             Belum ada ujian. ${canEdit ? 'Klik "+ Buat Ujian" untuk mulai.' : ''}
           </div>`
        : examCards
      }
    </div>`;

  // Bind events
  // Kode Ujian events
  el.querySelector('#btn-copy-kode')?.addEventListener('click', () => {
    navigator.clipboard.writeText(S.bimtek.accessCode)
      .then(() => showToast('Kode ujian disalin', 'success'))
      .catch(() => showToast('Gagal menyalin', 'error'));
  });

  el.querySelector('#btn-gen-kode')?.addEventListener('click', async () => {
    const btn = el.querySelector('#btn-gen-kode');
    btn.disabled = true; btn.textContent = 'Membuat...';
    try {
      const code = await generateBimtekAccessCode(S.id);
      S.bimtek.accessCode = code;
      await renderTabUjian(app, el, S);
      showToast('Kode ujian berhasil dibuat', 'success');
    } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
  });

  el.querySelector('#btn-buat-ujian')?.addEventListener('click', () =>
    showExamModal({
      bimtekId: S.id,
      bidangIds: S.bimtek?.bidangIds || [],
      exam: null,
      onSaved: () => renderTabUjian(app, el, S),
    })
  );

  el.querySelectorAll('.btn-edit-exam').forEach(btn => {
    const exam = exams.find(e => e.id === btn.dataset.id);
    if (exam) btn.addEventListener('click', () => showExamModal({
      bimtekId: S.id,
      bidangIds: S.bimtek?.bidangIds || [],
      exam,
      onSaved: () => renderTabUjian(app, el, S),
    }));
  });

  el.querySelectorAll('.btn-delete-exam').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Hapus Ujian', message: 'Hapus ujian ini beserta semua sesi pesertanya?', danger: true });
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

  el.querySelectorAll('.btn-fix-expiry').forEach(btn => {
    const exam = exams.find(e => e.id === btn.dataset.id);
    if (exam) btn.addEventListener('click', () => _fixExpiry(app, el, S, exam));
  });

  // Inline unlock device
  el.querySelectorAll('.btn-unlock-device').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Buka Kunci Perangkat', message: 'Peserta akan dapat masuk dari perangkat lain. Lanjutkan?', danger: false });
      if (!ok) return;
      try {
        await unlockDeviceSession(btn.dataset.id);
        await renderTabUjian(app, el, S);
        showToast('Kunci perangkat dibuka. Peserta dapat masuk dari perangkat lain.', 'success');
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  });

  // Inline reset session
  el.querySelectorAll('.btn-reset-session').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Reset Session', message: 'Reset session ini? Status kembali ke "Belum Dikerjakan".', danger: true });
      if (!ok) return;
      try {
        await resetSession(btn.dataset.id);
        await renderTabUjian(app, el, S);
        showToast('Session direset', 'success');
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  });

  // Toggle window open/close
  el.querySelectorAll('.btn-toggle-window').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tipe   = btn.dataset.tipe;
      const isOpen = btn.dataset.open === 'true';
      const action = isOpen ? 'Tutup' : 'Buka';
      const label  = TIPE_LABEL[tipe] || tipe;
      const ok = await confirmDialog({
        title:   `${action} Ujian ${label}`,
        message: isOpen
          ? `Peserta tidak dapat lagi memulai ${label} baru setelah ditutup. Peserta yang sedang mengerjakan tidak terdampak. Lanjutkan?`
          : `Peserta dapat mulai mengerjakan ${label}. Lanjutkan?`,
        danger: isOpen,
      });
      if (!ok) return;
      try {
        await setExamWindow(btn.dataset.id, tipe, !isOpen);
        await renderTabUjian(app, el, S);
        showToast(!isOpen ? `${label} dibuka. Peserta dapat memulai ujian.` : `${label} ditutup.`, 'success');
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
  });

  // Inline extend session
  el.querySelectorAll('.btn-extend-session').forEach(btn => {
    btn.addEventListener('click', async () => {
      const current = parseInt(btn.dataset.ext) || 0;
      const input   = prompt(
        `Tambah berapa menit waktu ujian?\n(Sudah diperpanjang: ${current} menit. Masukkan nilai positif.)`,
        '10'
      );
      if (input === null) return;
      const menit = parseInt(input);
      if (!menit || menit <= 0) { showToast('Jumlah menit tidak valid.', 'error'); return; }
      try {
        const total = await extendSession(btn.dataset.id, menit);
        await renderTabUjian(app, el, S);
        showToast(`Waktu diperpanjang +${menit} menit (total: ${total} menit). Peserta perlu refresh halaman ujian.`, 'success');
      } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
    });
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

  // Inline sessions table
  const inlineSessions = _buildInlineSessions(exam, sessions);

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
      <div class="px-4 pb-3 flex gap-2 flex-wrap items-center">
        ${canEdit ? `<button class="btn-gen-links text-xs px-2 py-1 rounded bg-[#0d9488]/20 hover:bg-[#0d9488]/30 text-[#5eead4] transition-colors" data-id="${exam.id}">Generate Sesi</button>` : ''}
        <button class="btn-fix-expiry text-xs px-2 py-1 rounded bg-amber-900/50 hover:bg-amber-800 text-amber-300 transition-colors" data-id="${exam.id}">Perbaiki Kadaluarsa</button>
        ${_buildWindowToggles(exam)}
      </div>
      ${inlineSessions}
    </div>`;
}

// ─── WINDOW TOGGLE BUILDER ───────────────────────────────────

function _buildWindowToggles(exam) {
  const tipes = exam.tipe === 'pretest_posttest' ? ['pretest', 'posttest'] : [exam.tipe];
  return tipes.map(tipe => {
    const isOpen  = exam.windowOpen?.[tipe] === true;
    const label   = TIPE_LABEL[tipe] || tipe;
    const openCls = 'bg-green-900/50 hover:bg-red-900/50 text-green-300';
    const clsCls  = 'bg-gray-800 hover:bg-green-900/50 text-gray-400 hover:text-green-300';
    return `<button class="btn-toggle-window text-xs px-2 py-1 rounded border ${isOpen ? 'border-green-700' : 'border-gray-700'} ${isOpen ? openCls : clsCls} transition-colors"
      data-id="${exam.id}" data-tipe="${tipe}" data-open="${isOpen}" title="${isOpen ? 'Klik untuk menutup ujian' : 'Klik untuk membuka ujian'}">
      ${isOpen ? `✓ ${label}: Terbuka` : `✗ ${label}: Tertutup`}
    </button>`;
  }).join('');
}

// ─── GENERATE MAGIC LINK ─────────────────────────────────────

function _defaultExpiryForTipe(tipeSession, bimtek) {
  const dateStr = tipeSession === 'posttest' ? bimtek?.periode?.selesai : bimtek?.periode?.mulai;
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59);
  }
  return new Date(Date.now() + 72 * 60 * 60 * 1000);
}

function _toDatetimeLocalValue(dt) {
  const pad = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

async function _generateLinks(app, el, S, exam) {
  const pesertaIds = S.bimtek?.pesertaIds || [];
  if (pesertaIds.length === 0) {
    showToast('Belum ada peserta di bimtek ini. Tambah peserta dulu di tab Peserta.', 'info');
    return;
  }

  const tipes = exam.tipe === 'pretest_posttest' ? ['pretest', 'posttest'] : [exam.tipe];

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60';
  modal.innerHTML = `
    <div class="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md mx-4">
      <div class="p-5 border-b border-gray-800">
        <h3 class="font-semibold text-white">Generate Sesi Ujian</h3>
        <p class="text-xs text-gray-500 mt-1">Untuk ${pesertaIds.length} peserta. Sesi yang sudah ada tidak akan diganti.</p>
      </div>
      <div class="p-5 space-y-3">
        ${tipes.map(t => `
          <div>
            <label class="text-xs text-gray-400 block mb-1">Kadaluarsa ${TIPE_LABEL[t] || t}</label>
            <input type="datetime-local" id="gen-expiry-${t}" class="form-input text-sm w-full"
              value="${_toDatetimeLocalValue(_defaultExpiryForTipe(t, S.bimtek))}">
          </div>`).join('')}
      </div>
      <div class="p-5 border-t border-gray-800 flex justify-end gap-2">
        <button id="gen-cancel" class="px-3 py-1.5 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors">Batal</button>
        <button id="gen-submit" class="px-3 py-1.5 text-sm rounded-lg bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">Generate</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#gen-cancel').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  modal.querySelector('#gen-submit').addEventListener('click', async () => {
    const expiredAt = {};
    for (const t of tipes) {
      const val = modal.querySelector(`#gen-expiry-${t}`).value;
      if (!val) { showToast(`Isi kadaluarsa ${TIPE_LABEL[t] || t}`, 'info'); return; }
      expiredAt[t] = new Date(val);
    }

    const btn = modal.querySelector('#gen-submit');
    btn.disabled = true; btn.textContent = 'Memproses...';
    try {
      const { created, skipped } = await generateSessions(exam, pesertaIds, expiredAt);
      close();
      await renderTabUjian(app, el, S);
      showToast(`${created} sesi dibuat, ${skipped} sudah ada (dilewati)`, 'success');
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
      btn.disabled = false; btn.textContent = 'Generate';
    }
  });
}

async function _fixExpiry(app, el, S, exam) {
  const tipes = exam.tipe === 'pretest_posttest' ? ['pretest', 'posttest'] : [exam.tipe];

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60';
  modal.innerHTML = `
    <div class="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md mx-4">
      <div class="p-5 border-b border-gray-800">
        <h3 class="font-semibold text-white">Perbaiki Kadaluarsa Sesi</h3>
        <p class="text-xs text-gray-500 mt-1">Menimpa waktu kadaluarsa semua sesi yang sudah ada untuk ujian ini, per tipe.</p>
      </div>
      <div class="p-5 space-y-3">
        ${tipes.map(t => `
          <div>
            <label class="text-xs text-gray-400 block mb-1">Kadaluarsa ${TIPE_LABEL[t] || t}</label>
            <input type="datetime-local" id="fix-expiry-${t}" class="form-input text-sm w-full"
              value="${_toDatetimeLocalValue(_defaultExpiryForTipe(t, S.bimtek))}">
          </div>`).join('')}
      </div>
      <div class="p-5 border-t border-gray-800 flex justify-end gap-2">
        <button id="fix-cancel" class="px-3 py-1.5 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors">Batal</button>
        <button id="fix-submit" class="px-3 py-1.5 text-sm rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors">Perbaiki</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#fix-cancel').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  modal.querySelector('#fix-submit').addEventListener('click', async () => {
    const expiredAt = {};
    for (const t of tipes) {
      const val = modal.querySelector(`#fix-expiry-${t}`).value;
      if (!val) { showToast(`Isi kadaluarsa ${TIPE_LABEL[t] || t}`, 'info'); return; }
      expiredAt[t] = new Date(val);
    }

    const ok = await confirmDialog({
      title:   'Perbaiki Kadaluarsa Sesi',
      message: `Timpa kadaluarsa semua sesi (${tipes.map(t => TIPE_LABEL[t] || t).join(', ')}) untuk ujian ini? Tindakan ini tidak bisa dibatalkan.`,
      danger:  true,
    });
    if (!ok) return;

    const btn = modal.querySelector('#fix-submit');
    btn.disabled = true; btn.textContent = 'Memproses...';
    try {
      const { updated } = await fixSessionsExpiry(exam.id, expiredAt);
      close();
      await renderTabUjian(app, el, S);
      showToast(`${updated} sesi diperbarui kadaluarsanya`, 'success');
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
      btn.disabled = false; btn.textContent = 'Perbaiki';
    }
  });
}

// ─── INLINE SESSIONS TABLE ───────────────────────────────────

function _buildInlineSessions(exam, sessions) {
  if (sessions.length === 0) return '';

  const byPeserta = {};
  sessions.forEach(s => {
    if (!byPeserta[s.noPeserta]) byPeserta[s.noPeserta] = { _nama: s.namaPeserta || '' };
    byPeserta[s.noPeserta][s.tipeSession] = s;
    if (!byPeserta[s.noPeserta]._nama && s.namaPeserta) byPeserta[s.noPeserta]._nama = s.namaPeserta;
  });

  const tipeCols = exam.tipe === 'pretest_posttest'
    ? ['pretest', 'posttest']
    : [exam.tipe];

  const thCols = tipeCols.map(t => `<th class="text-left text-xs">${TIPE_LABEL[t] || t}</th>`).join('');

  const rows = Object.entries(byPeserta).sort(([a], [b]) => a.localeCompare(b)).map(([noPeserta, sesiMap]) => {
    const nama = sesiMap._nama;
    const cols = tipeCols.map(tipe => {
      const s = sesiMap[tipe];
      if (!s) return `<td class="text-xs text-gray-500">—</td>`;
      const dispStatus = _displayStatus(s);
      const badge = SESSION_STATUS_BADGE[dispStatus] || 'badge-gray';
      const lbl   = SESSION_STATUS_LABEL[dispStatus] || dispStatus;
      const extLabel = s.timeExtensionMinutes ? `+${s.timeExtensionMinutes}m` : '';
      return `<td>
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="badge ${badge} text-xs">${lbl}</span>
          ${extLabel ? `<span class="text-xs text-amber-400" title="Waktu diperpanjang ${s.timeExtensionMinutes} menit">${extLabel}</span>` : ''}
          ${s.status === 'started' ? `<button class="btn-extend-session text-xs text-amber-500 hover:text-amber-300" data-id="${s.id}" data-ext="${s.timeExtensionMinutes || 0}" title="Perpanjang waktu">+Waktu</button>` : ''}
          ${s.status === 'started' && s.deviceToken ? `<button class="btn-unlock-device text-xs text-orange-400 hover:text-orange-200" data-id="${s.id}" title="Buka kunci perangkat">Buka Kunci</button>` : ''}
          <button class="btn-reset-session" text-xs text-gray-500 hover:text-gray-200" data-id="${s.id}" title="Reset session">Reset</button>
        </div>
      </td>`;
    }).join('');

    return `<tr>
      <td class="text-xs text-gray-400 font-mono">${_esc(noPeserta)}</td>
      <td class="text-xs text-gray-200">${_esc(nama) || '—'}</td>
      ${cols}
    </tr>`;
  }).join('');

  return `
    <div class="border-t border-gray-800 px-4 py-3 overflow-x-auto">
      <table class="btam-table text-xs">
        <thead>
          <tr>
            <th class="text-left">No Peserta</th>
            <th class="text-left">Nama</th>
            ${thCols}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── ACCESS CODE SECTION ─────────────────────────────────────

function _buildAccessCodeSection(bimtek) {
  const code    = bimtek?.accessCode || '';
  const display = code ? `${code.slice(0, 3)}-${code.slice(3)}` : '';
  return `
    <div class="bg-[#0d9488]/10 border border-[#0d9488]/30 rounded-xl p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold text-[#2dd4bf] uppercase tracking-wide mb-1">Kode Ujian Bimtek</p>
          ${display
            ? `<p class="text-2xl font-mono font-bold text-white tracking-widest">${_esc(display)}</p>
               <p class="text-xs text-[#2dd4bf] mt-1">Bagikan kode ini ke peserta — mereka input di halaman ujian</p>`
            : `<p class="text-sm text-gray-400">Kode ujian belum dibuat</p>
               <p class="text-xs text-gray-500 mt-0.5">Generate kode agar peserta dapat mengakses ujian</p>`
          }
        </div>
        ${display
          ? `<button id="btn-copy-kode" class="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-[#0d9488]/30 hover:bg-[#0d9488]/40 text-[#99f6e4] transition-colors">Salin</button>`
          : `<button id="btn-gen-kode" class="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">Generate Kode</button>`
        }
      </div>
    </div>`;
}

// ─── HELPER ──────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _toDate(ts) {
  if (!ts)                return null;
  if (ts.toDate)           return ts.toDate();
  if (ts instanceof Date)  return ts;
  if (ts.seconds)          return new Date(ts.seconds * 1000);
  return new Date(ts);
}

/**
 * Status TIDAK pernah ditulis sebagai 'expired' di Firestore — tidak ada job
 * server yang menyapu sesi yang lewat waktu. Kalau peserta menutup browser
 * sebelum auto-submit terkirim, sesi selamanya tersangkut di 'started'.
 * Fungsi ini hanya untuk TAMPILAN: turunkan 'expired' dari expiredAt tanpa
 * mengubah data asli, supaya admin tidak salah kira peserta masih mengerjakan.
 */
function _displayStatus(s) {
  if (s.status !== 'started') return s.status;
  const expiredAt = _toDate(s.expiredAt);
  if (expiredAt && Date.now() > expiredAt.getTime()) return 'expired';
  return s.status;
}

