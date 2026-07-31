// admin/js/modules/bimtek/exam-modal.js
// Modal buat/edit exam + pilih soal dari Bank Soal — dipakai Tab Ujian (exam
// terikat bimtek) dan Seleksi Tertulis rekrutmen (exam berdiri sendiri,
// bimtekId null).

import { showToast }     from '../../components/toast.js';
import { createExam, updateExam } from './exam-api.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';
import { db } from '../../../../shared/db.js';
import {
  collection, getDocs, query, where, limit
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COL } from '../../../../shared/constants.js';

/**
 * Tampilkan modal buat/edit exam.
 * @param {object} opts
 * @param {string|null} opts.bimtekId - null untuk exam berdiri sendiri (mis. seleksi tertulis rekrutmen)
 * @param {string[]}    opts.bidangIds - filter bidang bank soal (kosong = semua bidang)
 * @param {object|null} opts.exam - exam doc untuk mode edit, null untuk buat baru
 * @param {Function}    opts.onSaved - dipanggil setelah simpan berhasil (async ok)
 * @param {string}      [opts.defaultTipe] - tipe default saat buat baru (default 'pretest')
 */
export async function showExamModal({ bimtekId, bidangIds = [], exam = null, onSaved, defaultTipe = 'pretest' }) {
  if (exam?.published) {
    showToast('Ujian sudah dipublish. Unpublish dulu sebelum mengedit.', 'info');
    return;
  }

  let soalPool = [];
  try {
    const bidangSet = new Set(bidangIds);
    const snap = await getDocs(
      query(collection(db, COL.BANK_SOAL), where('active', '==', true), limit(500))
    );
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    soalPool = all.filter(s => {
      if (s.deleted) return false;
      if (bidangSet.size > 0 && !bidangSet.has(s.bidangId)) return false;
      return true;
    });
  } catch (err) {
    showToast('Gagal memuat bank soal: ' + err.message, 'error');
    return;
  }

  if (soalPool.length === 0) {
    showToast('Tidak ada soal aktif di bank soal untuk cakupan ini', 'info');
    return;
  }

  const isEdit          = !!exam;
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
        <div class="grid grid-cols-1 gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Judul Ujian</label>
            <input id="exam-judul" type="text" class="form-input w-full" value="${_esc(exam?.judul || '')}" placeholder="Misal: Pre-Test Produksi 2026">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-400 mb-1">Tipe</label>
              <select id="exam-tipe" class="form-select w-full">
                <option value="pretest"           ${(exam?.tipe || defaultTipe) === 'pretest'           ? 'selected' : ''}>Pre-Test</option>
                <option value="posttest"          ${(exam?.tipe || defaultTipe) === 'posttest'          ? 'selected' : ''}>Post-Test</option>
                <option value="pretest_posttest"  ${(exam?.tipe || defaultTipe) === 'pretest_posttest'  ? 'selected' : ''}>Pre-Test & Post-Test (soal sama)</option>
                <option value="seleksi_tertulis"  ${(exam?.tipe || defaultTipe) === 'seleksi_tertulis'  ? 'selected' : ''}>Seleksi Tertulis</option>
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

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-gray-400">Pilih Soal dari Bank Soal</label>
            <span id="soal-count-label" class="text-xs text-[#2dd4bf]">0 dipilih</span>
          </div>
          <div class="flex gap-2 mb-2 flex-wrap">
            <input id="soal-search" type="text" placeholder="Cari pertanyaan atau UK…" class="form-input flex-1 text-xs" style="min-width:140px">
            ${bidangIds.length > 1 ? `
            <select id="soal-filter-bidang" class="form-select text-xs">
              <option value="">Semua Bidang</option>
              ${bidangIds.map(bid => {
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
        <button id="exam-modal-cancel" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-[#12181c] transition-colors">Batal</button>
        <button id="exam-modal-save" class="px-4 py-2 rounded-lg text-sm bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">Simpan</button>
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
      const matchQ      = !q      || s.pertanyaan?.toLowerCase().includes(q) || s.unitKompetensi?.toLowerCase().includes(q);
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
          <p class="text-xs text-gray-400 mt-0.5">${_esc(s.unitKompetensi || '-')} · ${s.bloomLevel}</p>
        </div>
      </label>`).join('');

    soalListEl.querySelectorAll('.soal-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        cb.checked ? selectedSoalIds.add(cb.value) : selectedSoalIds.delete(cb.value);
        _updateCount();

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

  if (exam?.tipe === 'pretest_posttest') {
    modal.querySelector('#exam-jumlah').readOnly = true;
  }

  _renderSoal();
  _updateCount();

  const close = () => modal.remove();
  modal.querySelector('#exam-modal-close').addEventListener('click', close);
  modal.querySelector('#exam-modal-cancel').addEventListener('click', close);

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

    if (data.tipe === 'pretest_posttest') data.jumlahDitampilkan = data.soalIds.length;

    btn.disabled = true; btn.textContent = 'Menyimpan...';
    try {
      if (isEdit) await updateExam(exam.id, data);
      else        await createExam(bimtekId, data);
      modal.remove();
      await onSaved?.();
      showToast(isEdit ? 'Ujian diperbarui' : 'Ujian dibuat', 'success');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  });
}

function _esc(str) {
  const el = document.createElement('span');
  el.appendChild(document.createTextNode(str ?? ''));
  return el.innerHTML;
}
