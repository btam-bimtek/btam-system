// admin/js/modules/bank-soal/bloom-review.js
// Peninjauan usulan level Bloom untuk soal lama yang belum berlevel.
// Keputusan disimpan di memori sampai admin menekan Simpan, supaya
// meninjau 150+ butir tidak menghasilkan 150 tulisan terpisah.

import { listBloomSuggestions, applyBloomSuggestions } from './api.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { BLOOM_LEVELS } from '../../../../shared/constants.js';

export async function renderBloomReview(container, onSelesai) {
  container.innerHTML = `<div class="flex justify-center py-10">
    <div class="w-5 h-5 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin"></div>
  </div>`;

  let usulan;
  try {
    usulan = await listBloomSuggestions();
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red-400 p-4">Gagal memuat: ${_esc(err.message)}</p>`;
    return;
  }

  if (!usulan.length) {
    container.innerHTML = `<div class="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
      <p class="text-gray-400 text-sm font-medium">Tidak ada usulan menunggu</p>
      <p class="text-gray-600 text-xs mt-1">Semua soal sudah punya level Bloom.</p>
    </div>`;
    return;
  }

  // soalId → { level, status }. Awalnya semua mengikuti usulan, belum diputus.
  const keputusan = new Map(
    usulan.map(u => [u.soalId, { level: u.usulLevel, status: null }])
  );

  container.innerHTML = `
    <div class="space-y-4">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <h3 class="text-sm font-semibold text-white mb-1">Usulan Level Bloom</h3>
          <p class="text-xs text-gray-500">
            Tiap usulan disertai alasannya. Ubah bila tidak setuju, atau tolak untuk
            membiarkan soal tanpa level. Perubahan baru tersimpan saat Anda menekan Simpan.
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span id="bloom-progres" class="text-xs text-gray-500"></span>
          <button id="btn-setujui-sisa" class="px-3 py-2 rounded-lg text-xs text-gray-300 border border-[#1e3a3f] hover:bg-[#12181c] transition-colors">
            Setujui semua sisa
          </button>
          <button id="btn-simpan-bloom" class="px-4 py-2 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
            Simpan
          </button>
        </div>
      </div>
      <div id="bloom-list" class="space-y-3"></div>
    </div>`;

  const listEl = container.querySelector('#bloom-list');
  listEl.innerHTML = usulan.map(u => _kartu(u)).join('');

  function perbaruiProgres() {
    const diputus = [...keputusan.values()].filter(k => k.status).length;
    container.querySelector('#bloom-progres').textContent =
      `${diputus} dari ${usulan.length} diputuskan`;
  }
  perbaruiProgres();

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-aksi]');
    if (!btn) return;
    const soalId = btn.dataset.soalId;
    const k = keputusan.get(soalId);
    if (!k) return;

    if (btn.dataset.aksi === 'setuju') k.status = 'disetujui';
    if (btn.dataset.aksi === 'tolak')  k.status = 'ditolak';

    _tandaiKartu(listEl, soalId, k);
    perbaruiProgres();
  });

  listEl.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-soal-id]');
    if (!sel) return;
    const k = keputusan.get(sel.dataset.soalId);
    if (!k) return;
    k.level  = sel.value;
    k.status = 'diubah';
    _tandaiKartu(listEl, sel.dataset.soalId, k);
    perbaruiProgres();
  });

  container.querySelector('#btn-setujui-sisa').addEventListener('click', () => {
    keputusan.forEach((k, soalId) => {
      if (!k.status) { k.status = 'disetujui'; _tandaiKartu(listEl, soalId, k); }
    });
    perbaruiProgres();
  });

  container.querySelector('#btn-simpan-bloom').addEventListener('click', async () => {
    const siap = [...keputusan.entries()]
      .filter(([, k]) => k.status)
      .map(([soalId, k]) => ({ soalId, level: k.level, status: k.status }));

    if (!siap.length) { showToast('Belum ada usulan yang diputuskan.', 'warning'); return; }

    const terap = siap.filter(s => s.status !== 'ditolak').length;
    const ok = await confirmDialog({
      title: 'Simpan keputusan level Bloom',
      message: `${terap} soal akan diberi level Bloom, ${siap.length - terap} ditolak. `
        + `Ini mengubah bobot soal tersebut pada penilaian berikutnya. `
        + `Nilai bimtek yang sudah selesai tidak terpengaruh.`
    });
    if (!ok) return;

    const btn = container.querySelector('#btn-simpan-bloom');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';
    try {
      const { diterapkan, ditolak } = await applyBloomSuggestions(siap);
      showToast(`${diterapkan} soal diperbarui, ${ditolak} ditolak.`, 'ok');
      if (onSelesai) onSelesai();
      else renderBloomReview(container);
    } catch (err) {
      showToast(`Gagal menyimpan: ${err.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  });
}

function _kartu(u) {
  const opsi = (u.soal.opsi ?? [])
    .map(o => `<li class="text-gray-500">${_esc(o.id)}. ${_esc(o.text)}</li>`).join('');

  return `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4" data-kartu="${_esc(u.soalId)}">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm text-gray-200 mb-2">${_esc(u.soal.pertanyaan)}</p>
          <ul class="text-xs space-y-0.5 mb-2">${opsi}</ul>
          <p class="text-xs text-gray-600">
            <span class="font-mono text-[#2dd4bf]">${_esc(u.soal.unitKompetensi || '—')}</span>
            ${u.soal.ekNama ? ` · ${_esc(u.soal.ekNama)}` : ''}
          </p>
        </div>
        <div class="shrink-0 w-56 space-y-2">
          <select data-soal-id="${_esc(u.soalId)}" class="form-select text-xs w-full">
            ${BLOOM_LEVELS.map(b =>
              `<option value="${b.level}" ${b.level === u.usulLevel ? 'selected' : ''}>${b.level} — ${b.nama}</option>`
            ).join('')}
          </select>
          <p class="text-xs text-gray-500 italic">${_esc(u.alasan ?? '')}</p>
          <div class="flex gap-2">
            <button data-aksi="setuju" data-soal-id="${_esc(u.soalId)}"
              class="flex-1 px-2 py-1.5 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">Setuju</button>
            <button data-aksi="tolak" data-soal-id="${_esc(u.soalId)}"
              class="px-2 py-1.5 rounded-lg text-xs text-gray-400 border border-[#1e3a3f] hover:bg-[#12181c] transition-colors">Tolak</button>
          </div>
          <p class="text-xs" data-status="${_esc(u.soalId)}"></p>
        </div>
      </div>
    </div>`;
}

function _tandaiKartu(listEl, soalId, k) {
  const el = listEl.querySelector(`[data-status="${CSS.escape(soalId)}"]`);
  if (!el) return;
  const teks = { disetujui: '✓ disetujui', diubah: `✓ diubah ke ${k.level}`, ditolak: '✗ ditolak' };
  el.textContent = teks[k.status] ?? '';
  el.className = `text-xs ${k.status === 'ditolak' ? 'text-gray-500' : 'text-teal-400'}`;
  listEl.querySelector(`[data-kartu="${CSS.escape(soalId)}"]`)
    ?.classList.toggle('opacity-50', k.status === 'ditolak');
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
