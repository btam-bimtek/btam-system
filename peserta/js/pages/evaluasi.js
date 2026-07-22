// peserta/js/pages/evaluasi.js
// Form evaluasi fixed-question (bukan template builder dinamis — lihat plan
// Portal Peserta). Jawaban tersimpan dengan noPeserta (untuk audit manual),
// tapi UI admin yang menampilkan hasil evaluasi tidak menampilkan identitas.

import { getBimtek, getPengajar, sudahEvaluasi, submitEvaluasi } from '../api.js';
import {
  RATING_LABEL, PERTANYAAN_PENYELENGGARA, PERTANYAAN_KEPUASAN, PERTANYAAN_PENGAJAR
} from '../../../shared/evaluasi-questions.js';

const SKALA = [1, 2, 3, 4, 5];
const STAR_SVG = `<svg viewBox="0 0 20 20" class="w-7 h-7" fill="currentColor"><path d="M10 1.5l2.6 5.5 6 .7-4.4 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.4 7.7l6-.7L10 1.5z"/></svg>`;

export async function renderEvaluasi(app, session, bimtekId) {
  app.innerHTML = `
    ${_header()}
    <main class="max-w-2xl mx-auto px-4 py-8">
      <a href="#/" class="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 mb-5">← Kembali ke Dashboard</a>
      <div id="eval-content">${_skeleton()}</div>
    </main>
    ${_footer()}`;

  const content = document.getElementById('eval-content');
  try {
    const [bimtek, sudah] = await Promise.all([
      getBimtek(bimtekId),
      sudahEvaluasi(bimtekId, session.noPeserta),
    ]);

    if (!bimtek || !(bimtek.pesertaIds || []).includes(session.noPeserta)) {
      content.innerHTML = `<p class="text-sm text-red-600 py-8 text-center">Bimtek tidak ditemukan.</p>`;
      return;
    }
    if (!['ongoing', 'completed'].includes(bimtek.status)) {
      content.innerHTML = `<p class="text-sm text-gray-500 py-8 text-center">Evaluasi belum dibuka untuk bimtek ini.</p>`;
      return;
    }
    if (sudah) {
      content.innerHTML = `
        <div class="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div class="text-3xl mb-2">✓</div>
          <p class="text-sm font-medium text-gray-700">Anda sudah mengisi evaluasi untuk bimtek ini.</p>
          <p class="text-xs text-gray-500 mt-1">Terima kasih atas partisipasi Anda.</p>
        </div>`;
      return;
    }

    const pengajarList = await Promise.all(
      (bimtek.pengajarIds || []).map(id => getPengajar(id))
    );
    const pengajarValid = pengajarList.filter(Boolean);

    content.innerHTML = `
      <h1 class="text-xl font-bold text-gray-800 mb-1">Evaluasi Bimtek</h1>
      <p class="text-sm text-gray-500 mb-1">${_esc(bimtek.nama)}</p>
      <p class="text-xs text-gray-400 mb-6">Jawaban Anda tersimpan secara rahasia dan tidak ditampilkan ke publik dengan identitas Anda — silakan isi dengan jujur.</p>

      <form id="eval-form" class="space-y-6">
        ${_section('Penyelenggara', 'penyelenggara', PERTANYAAN_PENYELENGGARA)}
        ${_section('Kepuasan Peserta', 'kepuasan', PERTANYAAN_KEPUASAN)}
        ${pengajarValid.map(p => _section(`Pengajar — ${_esc(p.nama)}`, `pengajar_${p.id}`, PERTANYAAN_PENGAJAR)).join('')}

        <div id="eval-error" class="hidden text-xs text-red-600"></div>
        <button type="submit" id="btn-submit-eval" class="btn-primary w-full">Kirim Evaluasi</button>
      </form>
    `;

    const evalForm = document.getElementById('eval-form');
    if (evalForm) _bindRatingStars(evalForm);

    evalForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const err = document.getElementById('eval-error');
      const btn = document.getElementById('btn-submit-eval');
      err.classList.add('hidden');

      const form = e.target;
      const groups = [
        { field: 'penyelenggara', pertanyaan: PERTANYAAN_PENYELENGGARA },
        { field: 'kepuasan',      pertanyaan: PERTANYAAN_KEPUASAN },
        ...pengajarValid.map(p => ({ field: `pengajar_${p.id}`, pertanyaan: PERTANYAAN_PENGAJAR })),
      ];

      const missing = groups.some(g => g.pertanyaan.some(q =>
        !form.querySelector(`input[type="hidden"][name="${g.field}.${q.key}"]`)?.value
      ));
      if (missing) {
        err.textContent = 'Mohon isi semua pertanyaan skala sebelum mengirim.';
        err.classList.remove('hidden');
        return;
      }

      btn.disabled = true; btn.textContent = 'Mengirim…';

      const payload = { penyelenggara: _readGroup(form, 'penyelenggara', PERTANYAAN_PENYELENGGARA), kepuasan: _readGroup(form, 'kepuasan', PERTANYAAN_KEPUASAN) };
      if (pengajarValid.length) {
        payload.pengajar = {};
        for (const p of pengajarValid) payload.pengajar[p.id] = _readGroup(form, `pengajar_${p.id}`, PERTANYAAN_PENGAJAR);
      }

      try {
        await submitEvaluasi(bimtekId, session.noPeserta, payload);
        content.innerHTML = `
          <div class="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div class="text-3xl mb-2">✓</div>
            <p class="text-sm font-medium text-gray-700">Evaluasi berhasil terkirim. Terima kasih!</p>
            <a href="#/" class="inline-block mt-4 text-sm text-blue-600 hover:underline">Kembali ke Dashboard</a>
          </div>`;
      } catch (ex) {
        err.textContent = 'Gagal mengirim: ' + ex.message;
        err.classList.remove('hidden');
        btn.disabled = false; btn.textContent = 'Kirim Evaluasi';
      }
    });
  } catch (e) {
    content.innerHTML = `<p class="text-sm text-red-600 py-8 text-center">Gagal memuat: ${_esc(e.message)}</p>`;
  }
}

function _section(title, field, pertanyaan) {
  return `
    <div class="bg-white rounded-xl border border-gray-200 p-5">
      <h2 class="text-sm font-semibold text-gray-700 mb-4">${title}</h2>
      <div class="space-y-5">
        ${pertanyaan.map(q => `
          <div>
            <p class="text-xs text-gray-600 mb-2">${_esc(q.label)}</p>
            <div class="rating-group flex items-center gap-1" data-name="${field}.${q.key}">
              ${SKALA.map(n => `
                <button type="button" class="star-btn text-gray-300 hover:scale-110 transition-transform" data-val="${n}" aria-label="${n} bintang">
                  ${STAR_SVG}
                </button>`).join('')}
              <span class="rating-text text-xs text-gray-400 ml-2"></span>
            </div>
            <input type="hidden" name="${field}.${q.key}" value="">
          </div>`).join('')}
      </div>
      <div class="mt-4">
        <label class="block text-xs text-gray-500 mb-1">Komentar (opsional)</label>
        <textarea name="${field}.komentar" rows="2" class="form-input text-xs"></textarea>
      </div>
    </div>`;
}

/** Bind klik bintang untuk semua .rating-group di dalam form (event delegation). */
function _bindRatingStars(form) {
  form.addEventListener('click', e => {
    const btn = e.target.closest('.star-btn');
    if (!btn) return;
    const group = btn.closest('.rating-group');
    const val   = Number(btn.dataset.val);
    const hidden = form.querySelector(`input[type="hidden"][name="${group.dataset.name}"]`);
    if (hidden) hidden.value = String(val);

    group.querySelectorAll('.star-btn').forEach(b => {
      const filled = Number(b.dataset.val) <= val;
      b.classList.toggle('text-amber-400', filled);
      b.classList.toggle('text-gray-300', !filled);
    });
    group.querySelector('.rating-text').textContent = RATING_LABEL[val] ?? '';
  });
}

function _readGroup(form, field, pertanyaan) {
  const skor = {};
  for (const q of pertanyaan) {
    skor[q.key] = Number(form.querySelector(`input[type="hidden"][name="${field}.${q.key}"]`)?.value ?? 0);
  }
  return { skor, komentar: form.querySelector(`textarea[name="${field}.komentar"]`)?.value.trim() || null };
}

function _skeleton() {
  return `<div class="animate-pulse space-y-3">
    <div class="h-6 bg-gray-200 rounded w-64"></div>
    <div class="h-40 bg-gray-200 rounded-xl"></div>
  </div>`;
}

function _header() {
  return `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-2xl mx-auto px-4 h-14 flex items-center">
        <span class="text-blue-700 font-bold text-sm">Portal Peserta</span>
      </div>
    </header>`;
}
function _footer() { return `<footer class="text-center py-8 text-xs text-gray-400">Balai Teknik Air Minum — Direktorat Jenderal Cipta Karya</footer>`; }
function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
