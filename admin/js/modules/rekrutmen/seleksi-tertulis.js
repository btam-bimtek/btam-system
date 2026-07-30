// admin/js/modules/rekrutmen/seleksi-tertulis.js
// B3 — Monitor seleksi tertulis & link ke exam system.

import { setPageTitle }  from '../../layout/navbar.js';
import { showToast }     from '../../components/toast.js';
import { getState }      from '../../store.js';
import { listSiklus, getSiklus, updateSiklus } from './siklus-api.js';
import { generateSeleksiSessionsBulk, listSeleksiSessions, scoreSeleksiSubmissionsBulk } from './seleksi-exam-api.js';
import { setExamIdTertulis } from './siklus-api.js';
import { listExams } from '../bimtek/exam-api.js';
import { db }            from '../../../../shared/firebase-config.js';
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, updateDoc, Timestamp
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';

let _S = { tahun: null, siklus: null };

export async function renderSeleksiTertulis() {
  setPageTitle('Rekrutmen — Seleksi Tertulis');

  const sikluses = await listSiklus();
  const aktif    = sikluses.find(s => ['administrasi','tertulis'].includes(s.status)) ?? sikluses[0];
  _S.tahun  = aktif?.tahun ?? null;
  _S.siklus = aktif ?? null;

  document.getElementById('app').innerHTML = `
    <div class="max-w-4xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-white">Seleksi Tertulis</h1>
          <p class="text-xs text-gray-500 mt-0.5">Konfigurasi ujian dan monitoring peserta seleksi tertulis</p>
        </div>
        <select id="sel-siklus" class="form-input text-sm py-1.5 w-44">
          ${sikluses.map(s => `<option value="${s.tahun}" ${s.tahun === _S.tahun ? 'selected' : ''}>${s.nama}</option>`).join('')}
        </select>
      </div>
      <div id="content"></div>
    </div>`;

  document.getElementById('sel-siklus')?.addEventListener('change', async e => {
    _S.tahun  = parseInt(e.target.value);
    _S.siklus = await getSiklus(_S.tahun);
    _renderContent();
  });

  _renderContent();
}

async function _renderContent() {
  const content = document.getElementById('content');
  if (!content || !_S.siklus) return;

  const window_s = _S.siklus.phases?.tertulis?.start;
  const window_e = _S.siklus.phases?.tertulis?.end;
  const bimtekPilihan = _S.siklus.bimtekPilihan || [];

  content.innerHTML = `
    <div class="space-y-4">

      <!-- Konfigurasi Exam per Bimtek -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white mb-4">Ujian Seleksi Tertulis per Bimtek</h2>
        ${bimtekPilihan.length === 0 ? `
          <p class="text-sm text-gray-500">Belum ada bimtek dikonfigurasi. Atur di tab Kuota &amp; Aturan Bimtek.</p>` : `
          <div class="space-y-2" id="bimtek-exam-list">
            ${bimtekPilihan.map(b => `
              <div class="flex items-center justify-between gap-3 bg-gray-800/50 rounded-lg px-3 py-2">
                <p class="text-sm text-gray-200 flex-1 truncate">${_esc(b.namaBimtek)}</p>
                <select class="sel-exam-bimtek form-input text-sm py-1 w-64" data-bimtek-id="${_esc(b.bimtekId)}">
                  <option value="">— Belum dipilih —</option>
                </select>
              </div>`).join('')}
          </div>
          <div class="flex justify-end mt-4">
            <button id="btn-gen-links-bulk" class="px-3 py-1.5 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
              Generate Magic Link (Semua Bimtek)
            </button>
          </div>`}
      </div>

      <!-- Window waktu ujian -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-white">Window Ujian</h2>
          <button id="btn-save-window" class="px-3 py-1.5 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
            Simpan
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Mulai</label>
            <input id="inp-window-start" type="datetime-local" class="form-input text-sm"
                   value="${_tsToInput(window_s)}" />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Selesai</label>
            <input id="inp-window-end" type="datetime-local" class="form-input text-sm"
                   value="${_tsToInput(window_e)}" />
          </div>
        </div>
        <p class="text-xs text-gray-600 mt-2">
          Peserta dapat mengakses ujian kapan saja dalam window ini. Timer ujian mulai berjalan saat mereka klik "Mulai".
        </p>
      </div>

      ${bimtekPilihan.some(b => b.examIdTertulis) ? `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-white">Monitor Ujian</h2>
            <div class="flex gap-2">
              <button id="btn-sync-nilai" class="px-3 py-1.5 rounded-lg text-xs bg-green-700 hover:bg-green-600 text-white transition-colors">
                Sinkronkan Nilai (Semua Bimtek)
              </button>
              <button id="btn-refresh-stat" class="text-xs text-gray-500 hover:text-gray-300 transition-colors">↻ Refresh</button>
            </div>
          </div>
          ${await _renderMonitorPerBimtek(bimtekPilihan)}
        </div>` : ''}
    </div>`;

  for (const b of bimtekPilihan) {
    const sel = document.querySelector(`.sel-exam-bimtek[data-bimtek-id="${b.bimtekId}"]`);
    if (!sel) continue;
    const exams = (await listExams(b.bimtekId)).filter(e => e.tipe === 'seleksi_tertulis');
    sel.innerHTML = `<option value="">— Belum dipilih —</option>` +
      exams.map(e => `<option value="${_esc(e.id)}" ${e.id === b.examIdTertulis ? 'selected' : ''}>${_esc(e.judul)}</option>`).join('');
    sel.addEventListener('change', async () => {
      const email = getState('auth')?.user?.email;
      try {
        await setExamIdTertulis(_S.tahun, b.bimtekId, sel.value || null, email);
        _S.siklus = await getSiklus(_S.tahun);
        showToast('Exam ditautkan', 'success');
      } catch (e) { showToast(e.message, 'error'); }
    });
  }

  _bindContentEvents();
}

async function _renderMonitorPerBimtek(bimtekPilihan) {
  const blocks = [];
  for (const b of bimtekPilihan) {
    if (!b.examIdTertulis) continue;
    const sesiList = await listSeleksiSessions(b.examIdTertulis);
    const statSesi = { issued: 0, started: 0, submitted: 0, expired: 0 };
    sesiList.forEach(s => { statSesi[s.status] = (statSesi[s.status] ?? 0) + 1; });
    blocks.push(`
      <div class="mb-3 last:mb-0">
        <p class="text-xs text-gray-400 font-medium mb-1.5">${_esc(b.namaBimtek)}</p>
        <div class="grid grid-cols-4 gap-2 text-center text-xs">
          <div class="bg-gray-800 rounded-lg p-2"><p class="text-lg font-bold text-gray-300">${statSesi.issued}</p><p class="text-gray-500">Belum Mulai</p></div>
          <div class="bg-gray-800 rounded-lg p-2"><p class="text-lg font-bold text-yellow-400">${statSesi.started}</p><p class="text-gray-500">Sedang Ujian</p></div>
          <div class="bg-gray-800 rounded-lg p-2"><p class="text-lg font-bold text-green-400">${statSesi.submitted}</p><p class="text-gray-500">Selesai</p></div>
          <div class="bg-gray-800 rounded-lg p-2"><p class="text-lg font-bold text-gray-600">${statSesi.expired}</p><p class="text-gray-500">Kadaluarsa</p></div>
        </div>
      </div>`);
  }
  return blocks.join('') || '<p class="text-sm text-gray-500">Belum ada bimtek dengan exam tertaut.</p>';
}

function _bindContentEvents() {
  const email = getState('auth')?.user?.email;

  document.getElementById('btn-save-window')?.addEventListener('click', async () => {
    const start = document.getElementById('inp-window-start')?.value;
    const end   = document.getElementById('inp-window-end')?.value;
    try {
      await updateSiklus(_S.tahun, {
        'phases.tertulis.start': start || null,
        'phases.tertulis.end':   end   || null,
      }, email);
      showToast('Window ujian disimpan', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  document.getElementById('btn-refresh-stat')?.addEventListener('click', _renderContent);

  document.getElementById('btn-sync-nilai')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-nilai');
    btn.disabled = true; btn.textContent = 'Memproses...';
    try {
      const { processed, failed } = await scoreSeleksiSubmissionsBulk(_S.siklus);
      showToast(`${processed} nilai disinkronkan${failed ? `, ${failed} gagal` : ''}`, failed ? 'info' : 'success');
      _renderContent();
    } catch (e) {
      showToast('Gagal sinkronkan nilai: ' + e.message, 'error');
      btn.disabled = false; btn.textContent = 'Sinkronkan Nilai (Semua Bimtek)';
    }
  });

  document.getElementById('btn-gen-links-bulk')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-gen-links-bulk');
    const lulusAdminList = await _fetchLulusAdminList();
    if (!lulusAdminList.length) { showToast('Belum ada calon yang lolos administrasi di bimtek manapun.', 'info'); return; }
    btn.disabled = true; btn.textContent = 'Memproses...';
    try {
      const expiredAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const { created, skipped } = await generateSeleksiSessionsBulk(_S.siklus, lulusAdminList, expiredAt);
      showToast(`${created} sesi dibuat, ${skipped} sudah ada (dilewati)`, 'success');
      _renderContent();
    } catch (e) {
      showToast('Gagal: ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Generate Magic Link (Semua Bimtek)';
    }
  });
}

async function _fetchLulusAdminList() {
  try {
    const snap = await getDocs(query(
      collection(db, COL.CALON_PESERTA),
      where('tahun', '==', _S.tahun),
      where('statusAdminOverall', '==', 'lulus')
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}

function _tsToInput(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 16);
}
function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
