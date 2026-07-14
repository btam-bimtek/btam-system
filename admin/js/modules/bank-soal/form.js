// admin/js/modules/bank-soal/form.js
// Modal add/edit soal. Support 2-6 opsi, preview pertanyaan, kunci jawaban terpisah.

import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { createSoal, updateSoal, getSoal } from './api.js';
import { BIDANG_LIST, BLOOM_LEVELS } from '../../../../shared/constants.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { storage } from '../../../../shared/firebase-config.js';
import { generateId } from '../../../../shared/normalize.js';
import { listUKAktif } from '../master-uk/api.js';

// State gambar — di-reset setiap kali form dibuka
let _pendingFile      = null;   // File object baru yang dipilih user
let _removeImage      = false;  // true jika user klik "Hapus Gambar"
let _existingImageUrl = null;   // URL gambar saat ini (mode edit)

// State UK picker
let _ukList     = [];           // Array UK dari master (dimuat sekali per form open)
let _selectedUK = null;         // { id, kode, nama } atau null

/**
 * @param {string|null} soalId  - null = mode create, string = mode edit
 * @param {function}    onSaved - callback setelah berhasil simpan
 */
export async function openSoalForm(soalId = null, onSaved) {
  // Reset state setiap kali form dibuka
  _pendingFile      = null;
  _removeImage      = false;
  _existingImageUrl = null;
  _ukList           = [];
  _selectedUK       = null;

  const isEdit   = !!soalId;
  const existing = isEdit ? await getSoal(soalId) : null;

  // Simpan URL gambar existing untuk referensi saat submit
  _existingImageUrl = existing?.pertanyaanImage ?? null;

  // Default 4 opsi
  const defaultOpsi = existing?.opsi ?? [
    { id: 'a', text: '', image: null },
    { id: 'b', text: '', image: null },
    { id: 'c', text: '', image: null },
    { id: 'd', text: '', image: null }
  ];

  const body = `
    <form id="soal-form" novalidate class="space-y-5">

      <!-- Kategorisasi -->
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">
            Bidang <span class="text-red-400">*</span>
          </label>
          <select name="bidangId" class="form-select" required>
            <option value="">— Pilih —</option>
            ${BIDANG_LIST.filter(b => b.bidangId !== 'multi_bidang' && b.bidangId !== 'non_am')
              .map(b => `<option value="${b.bidangId}" ${existing?.bidangId === b.bidangId ? 'selected' : ''}>${b.nama}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">
            Bloom Level
          </label>
          <select name="bloomLevel" class="form-select">
            <option value="">— Pilih —</option>
            ${BLOOM_LEVELS.map(b =>
              `<option value="${b.level}" ${existing?.bloomLevel === b.level ? 'selected' : ''}>
                ${b.level} — ${b.nama}
              </option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Unit Kompetensi</label>
          <!-- UK picker — combobox inline -->
          <div class="relative" id="uk-picker-wrap">
            <!-- Hidden inputs yang dikirim saat submit -->
            <input type="hidden" id="uk-value" name="unitKompetensi" value="" />
            <input type="hidden" id="uk-nama-hidden" name="ekNama" value="" />

            <!-- Trigger button -->
            <button type="button" id="btn-uk-trigger"
                    class="form-input w-full text-left flex items-start justify-between gap-2 pr-2 min-h-[2.25rem]">
              <span id="uk-display" class="text-gray-500 text-sm leading-snug">Pilih Unit Kompetensi…</span>
              <div class="flex items-center gap-1 shrink-0">
                <span id="btn-uk-clear"
                      class="hidden text-gray-500 hover:text-red-400 transition-colors p-0.5 rounded cursor-pointer"
                      title="Hapus pilihan">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </span>
                <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </div>
            </button>

            <!-- Dropdown -->
            <div id="uk-dropdown"
                 class="hidden absolute z-30 left-0 right-0 mt-1 bg-gray-800 border border-gray-700
                        rounded-xl shadow-2xl overflow-hidden">
              <div class="p-2 border-b border-gray-700">
                <input type="text" id="uk-search" placeholder="Cari kode atau nama UK…"
                       class="form-input w-full text-xs" autocomplete="off" />
              </div>
              <div id="uk-list"
                   class="overflow-y-auto max-h-52 py-1"
                   style="scrollbar-width:thin">
                <div class="px-3 py-6 text-center text-xs text-gray-500">Memuat daftar UK…</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pertanyaan -->
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1.5">
          Pertanyaan <span class="text-red-400">*</span>
        </label>
        <textarea name="pertanyaan" class="form-textarea h-28" required
                  placeholder="Tulis pertanyaan di sini…">${_esc(existing?.pertanyaan ?? '')}</textarea>
      </div>

      <!-- Gambar Soal (opsional) -->
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1.5">
          Gambar Soal
          <span class="text-gray-600 font-normal">(opsional)</span>
        </label>
        <div id="soal-image-preview" class="${existing?.pertanyaanImage ? '' : 'hidden'} mb-2">
          <img id="soal-image-thumb"
               src="${existing?.pertanyaanImage ?? ''}"
               alt="Gambar soal"
               class="max-h-48 rounded-lg border border-gray-700 object-contain" />
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <label class="cursor-pointer text-xs bg-gray-800 hover:bg-gray-700 text-gray-300
                        px-3 py-1.5 rounded-lg border border-gray-700 transition-colors">
            <input type="file" id="soal-image-input" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" />
            Pilih Gambar
          </label>
          <span id="soal-image-filename" class="text-xs text-gray-500 truncate max-w-xs">
            ${existing?.pertanyaanImage ? 'Gambar tersimpan' : 'Belum ada gambar'}
          </span>
          <button type="button" id="btn-clear-image"
                  class="${existing?.pertanyaanImage ? '' : 'hidden'} text-xs text-red-400 hover:text-red-300 transition-colors">
            Hapus
          </button>
        </div>
        <p class="text-xs text-gray-600 mt-1.5">Format: JPG, PNG, WebP, GIF. Maks 2MB.</p>
        <div id="soal-image-upload-progress" class="hidden mt-2">
          <div class="text-xs text-blue-400">Mengupload gambar…</div>
        </div>
      </div>

      <!-- Opsi Jawaban -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs font-medium text-gray-400">
            Opsi Jawaban <span class="text-red-400">*</span>
          </label>
          <div class="flex items-center gap-2">
            <button type="button" id="btn-remove-opsi"
              class="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-gray-800">
              − Kurangi
            </button>
            <button type="button" id="btn-add-opsi"
              class="text-xs text-gray-500 hover:text-blue-400 transition-colors px-2 py-1 rounded hover:bg-gray-800">
              + Tambah
            </button>
          </div>
        </div>
        <div id="opsi-container" class="space-y-2">
          ${defaultOpsi.map(o => _opsiRow(o, existing?.kunci)).join('')}
        </div>
        <p class="text-xs text-gray-600 mt-2">Klik radio button untuk pilih kunci jawaban yang benar.</p>
      </div>

      <!-- Pembahasan -->
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1.5">
          Pembahasan / Penjelasan Jawaban
          <span class="text-gray-600 font-normal">(opsional, untuk review peserta)</span>
        </label>
        <textarea name="pembahasan" class="form-textarea h-20"
                  placeholder="Jelaskan mengapa jawaban tersebut benar…">${_esc(existing?.pembahasan ?? '')}</textarea>
      </div>

      <!-- Tags & Status -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Tags (pisah koma)</label>
          <input name="tags" class="form-input"
                 value="${_esc((existing?.tags ?? []).join(', '))}"
                 placeholder="Misal: pompa, IPA, perpipaan" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Preferensi Mode</label>
          <select name="jenisPelatihanPreferensi" class="form-select">
            <option value="">Semua mode</option>
            <option value="online"  ${existing?.jenisPelatihanPreferensi === 'online'  ? 'selected' : ''}>Online</option>
            <option value="offline" ${existing?.jenisPelatihanPreferensi === 'offline' ? 'selected' : ''}>Offline</option>
          </select>
        </div>
      </div>

      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="active" ${existing?.active !== false ? 'checked' : ''} class="w-4 h-4 rounded" />
          <span class="text-sm text-gray-300">Soal aktif (digunakan dalam random picker)</span>
        </label>
      </div>

      <!-- Error -->
      <div id="form-error" class="hidden text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2"></div>
    </form>
  `;

  const modal = openModal({
    title:  isEdit ? 'Edit Soal' : 'Tambah Soal',
    body,
    size:   'xl',
    actions: [
      { label: 'Batal',                           type: 'secondary', onClick: ({ close }) => close() },
      { label: isEdit ? 'Simpan' : 'Tambah Soal', type: 'primary',   onClick: ({ close }) => _submit(close, soalId, onSaved) }
    ]
  });

  _bindOpsiEvents();
  _bindImageEvents();
  _initUKPicker(existing);

}

// ─── Opsi row HTML ────────────────────────────────────────────

function _opsiRow(opsi, kunci = null) {
  const ids    = ['a','b','c','d','e','f'];
  const colors = { a:'blue', b:'green', c:'yellow', d:'purple', e:'pink', f:'gray' };
  const color  = colors[opsi.id] ?? 'gray';

  return `
    <div class="flex items-center gap-3 opsi-row" data-id="${opsi.id}">
      <!-- Radio kunci -->
      <input type="radio" name="kunci" value="${opsi.id}"
             ${kunci === opsi.id ? 'checked' : ''}
             class="w-4 h-4 text-blue-500 shrink-0 cursor-pointer" required />

      <!-- Label opsi -->
      <span class="w-6 h-6 rounded-full bg-${color}-900/50 border border-${color}-700
                   flex items-center justify-center text-xs font-bold text-${color}-400 shrink-0 uppercase">
        ${opsi.id}
      </span>

      <!-- Input teks -->
      <input type="text" name="opsi_${opsi.id}" class="form-input flex-1"
             value="${_esc(opsi.text)}"
             placeholder="Teks opsi ${opsi.id.toUpperCase()}…" />
    </div>`;
}

// ─── Bind opsi add/remove ─────────────────────────────────────

function _bindOpsiEvents() {
  const ids = ['a','b','c','d','e','f'];
  let currentCount = document.querySelectorAll('.opsi-row').length;

  document.getElementById('btn-add-opsi')?.addEventListener('click', () => {
    if (currentCount >= 6) { return; }
    const nextId   = ids[currentCount];
    const container = document.getElementById('opsi-container');
    container.insertAdjacentHTML('beforeend', _opsiRow({ id: nextId, text: '', image: null }, null));
    currentCount++;
    _updateOpsiButtons(currentCount);
  });

  document.getElementById('btn-remove-opsi')?.addEventListener('click', () => {
    if (currentCount <= 2) { return; }
    const rows = document.querySelectorAll('.opsi-row');
    const last = rows[rows.length - 1];

    // Kalau kunci ada di opsi yang dihapus, reset
    const removedId  = last.dataset.id;
    const kunciInput = document.querySelector(`input[name="kunci"][value="${removedId}"]`);
    if (kunciInput?.checked) kunciInput.checked = false;

    last.remove();
    currentCount--;
    _updateOpsiButtons(currentCount);
  });

  _updateOpsiButtons(currentCount);
}

function _updateOpsiButtons(count) {
  const addBtn    = document.getElementById('btn-add-opsi');
  const removeBtn = document.getElementById('btn-remove-opsi');
  if (addBtn)    addBtn.style.opacity    = count >= 6 ? '0.3' : '1';
  if (removeBtn) removeBtn.style.opacity = count <= 2 ? '0.3' : '1';
}

// ─── Image upload events ──────────────────────────────────────

function _bindImageEvents() {
  const input    = document.getElementById('soal-image-input');
  const preview  = document.getElementById('soal-image-preview');
  const thumb    = document.getElementById('soal-image-thumb');
  const filename = document.getElementById('soal-image-filename');
  const clearBtn = document.getElementById('btn-clear-image');

  input?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran gambar maksimal 2MB.', 'error');
      input.value = '';
      return;
    }

    _pendingFile = file;
    _removeImage = false;
    filename.textContent = file.name;
    thumb.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
    clearBtn.classList.remove('hidden');
  });

  clearBtn?.addEventListener('click', () => {
    _pendingFile      = null;
    _removeImage      = true;
    _existingImageUrl = null;
    if (input) input.value = '';
    if (thumb) thumb.src   = '';
    preview?.classList.add('hidden');
    clearBtn.classList.add('hidden');
    if (filename) filename.textContent = 'Belum ada gambar';
  });
}

// ─── UK Picker ────────────────────────────────────────────────

async function _initUKPicker(existing) {
  // Coba cocokkan existing unitKompetensi ke master UK (bisa berupa docId atau kode)
  const existingVal  = existing?.unitKompetensi ?? null;
  const existingNama = existing?.ekNama ?? null;

  // Load UK list (listUKAktif returns array langsung)
  try {
    _ukList = await listUKAktif();
  } catch {
    _ukList = [];
  }

  // Cari UK yang sesuai dengan nilai existing
  if (existingVal) {
    _selectedUK = _ukList.find(u =>
      u.id === existingVal ||
      (u.kode && u.kode.toLowerCase() === existingVal.toLowerCase())
    ) ?? { id: existingVal, kode: existingVal, nama: existingNama ?? existingVal };
  }

  _renderUKSelection();
  _bindUKPickerEvents();
}

function _renderUKSelection() {
  const display    = document.getElementById('uk-display');
  const valInput   = document.getElementById('uk-value');
  const namaInput  = document.getElementById('uk-nama-hidden');
  const clearBtn   = document.getElementById('btn-uk-clear');
  if (!display) return;

  if (_selectedUK) {
    const label = _selectedUK.kode
      ? `<span class="font-mono text-blue-400 mr-1.5">${_esc(_selectedUK.kode)}</span><span class="text-gray-200">${_esc(_selectedUK.nama)}</span>`
      : `<span class="text-gray-200">${_esc(_selectedUK.nama)}</span>`;
    display.innerHTML = label;
    display.classList.remove('text-gray-500');
    valInput.value  = _selectedUK.id  ?? '';
    namaInput.value = _selectedUK.nama ?? '';
    clearBtn?.classList.remove('hidden');
  } else {
    display.innerHTML = 'Pilih Unit Kompetensi…';
    display.className = display.className.replace('text-gray-200','') + ' text-gray-500';
    valInput.value  = '';
    namaInput.value = '';
    clearBtn?.classList.add('hidden');
  }
}

function _renderUKList(filter = '') {
  const listEl = document.getElementById('uk-list');
  if (!listEl) return;

  const bidangId = document.querySelector('[name="bidangId"]')?.value ?? '';
  const q        = filter.toLowerCase().trim();

  // Filter by bidang: UK dengan bidangIds kosong dianggap lintas bidang (tetap tampil)
  let hits = bidangId
    ? _ukList.filter(u => !u.bidangIds?.length || u.bidangIds.includes(bidangId))
    : _ukList;

  if (q) {
    hits = hits.filter(u =>
      (u.kode && u.kode.toLowerCase().includes(q)) ||
      (u.nama && u.nama.toLowerCase().includes(q))
    );
  }

  let html = '';

  // Tampilkan label bidang aktif
  if (bidangId && !q) {
    const bidangNama = BIDANG_LIST.find(b => b.bidangId === bidangId)?.nama ?? bidangId;
    html += `<div class="px-3 py-1.5 text-xs text-gray-600 border-b border-gray-700/50">
      UK untuk bidang: <span class="text-gray-400 font-medium">${_esc(bidangNama)}</span>
    </div>`;
  }

  if (!hits.length) {
    html += `<div class="px-3 py-4 text-center text-xs text-gray-500">
      ${q ? 'Tidak ditemukan.' : (bidangId ? 'Tidak ada UK untuk bidang ini.' : 'Belum ada Unit Kompetensi aktif.')}
    </div>`;
  } else {
    html += hits.map(u => {
      const isSelected = _selectedUK?.id === u.id;
      return `
        <button type="button" data-uk-id="${u.id}" data-uk-kode="${_esc(u.kode ?? '')}" data-uk-nama="${_esc(u.nama)}"
                class="uk-item w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors
                       ${isSelected ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300 hover:bg-gray-700'}">
          <div class="flex flex-col min-w-0">
            ${u.kode
              ? `<span class="font-mono text-xs text-blue-400">${_esc(u.kode)}</span>`
              : `<span class="text-xs text-gray-600 italic">Non-SKKNI</span>`}
            <span class="text-sm text-gray-200 leading-snug">${_esc(u.nama)}</span>
          </div>
          ${isSelected ? '<svg class="w-3.5 h-3.5 ml-auto shrink-0 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
        </button>`;
    }).join('');
  }

  // Opsi input manual — tampil saat ada teks pencarian
  if (q) {
    html += `
      <div class="border-t border-gray-700 mt-1 px-3 py-2">
        <button type="button" id="btn-uk-manual" data-uk-manual="${_esc(filter)}"
                class="w-full text-left text-xs text-gray-500 hover:text-blue-400 transition-colors py-1 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          Isi manual: "<span class="text-gray-300 font-medium">${_esc(filter)}</span>"
        </button>
      </div>`;
  }

  listEl.innerHTML = html;

  // Bind klik item dari daftar
  listEl.querySelectorAll('.uk-item').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedUK = {
        id:   btn.dataset.ukId,
        kode: btn.dataset.ukKode || null,
        nama: btn.dataset.ukNama,
      };
      _renderUKSelection();
      _closeUKDropdown();
    });
  });

  // Bind klik input manual
  document.getElementById('btn-uk-manual')?.addEventListener('click', e => {
    const val = e.currentTarget.dataset.ukManual;
    _selectedUK = { id: val, kode: null, nama: val };
    _renderUKSelection();
    _closeUKDropdown();
  });
}

function _openUKDropdown() {
  const dropdown = document.getElementById('uk-dropdown');
  const search   = document.getElementById('uk-search');
  dropdown?.classList.remove('hidden');
  search?.focus();
  _renderUKList('');
}

function _closeUKDropdown() {
  document.getElementById('uk-dropdown')?.classList.add('hidden');
  if (document.getElementById('uk-search'))
    document.getElementById('uk-search').value = '';
}

function _bindUKPickerEvents() {
  const trigger  = document.getElementById('btn-uk-trigger');
  const clearBtn = document.getElementById('btn-uk-clear');
  const search   = document.getElementById('uk-search');
  const dropdown = document.getElementById('uk-dropdown');

  // Toggle dropdown on trigger click (but not if clicking the clear button)
  trigger?.addEventListener('click', e => {
    if (e.target.closest('#btn-uk-clear')) return;
    dropdown?.classList.contains('hidden') ? _openUKDropdown() : _closeUKDropdown();
  });

  // Clear selection
  clearBtn?.addEventListener('click', e => {
    e.stopPropagation();
    _selectedUK = null;
    _renderUKSelection();
    _closeUKDropdown();
  });

  // Search filter
  let _deb;
  search?.addEventListener('input', e => {
    clearTimeout(_deb);
    _deb = setTimeout(() => _renderUKList(e.target.value), 150);
  });

  // Re-filter list saat bidang berubah (dropdown sedang terbuka atau tidak)
  document.querySelector('[name="bidangId"]')?.addEventListener('change', () => {
    const dd = document.getElementById('uk-dropdown');
    if (!dd?.classList.contains('hidden')) {
      _renderUKList(document.getElementById('uk-search')?.value ?? '');
    }
  });

  // Close dropdown on click outside
  document.addEventListener('click', function _outsideClick(e) {
    const wrap = document.getElementById('uk-picker-wrap');
    if (wrap && !wrap.contains(e.target)) {
      _closeUKDropdown();
      document.removeEventListener('click', _outsideClick);
    }
  });
}

// ─── Submit ───────────────────────────────────────────────────

async function _submit(close, soalId, onSaved) {
  const form    = document.getElementById('soal-form');
  const errorEl = document.getElementById('form-error');
  const isEdit  = !!soalId;
  const btnLabel = isEdit ? 'Simpan' : 'Tambah Soal';
  const btn     = document.querySelector(`[data-action="${btnLabel}"]`);

  errorEl.classList.add('hidden');

  const fd    = new FormData(form);
  const kunci = fd.get('kunci');

  // Kumpulkan opsi dari DOM
  const opsiRows = document.querySelectorAll('.opsi-row');
  const opsi     = Array.from(opsiRows).map(row => ({
    id:   row.dataset.id,
    text: fd.get(`opsi_${row.dataset.id}`) ?? '',
    image: null
  }));

  const data = {
    pertanyaan:              fd.get('pertanyaan'),
    bidangId:                fd.get('bidangId'),
    bloomLevel:              fd.get('bloomLevel'),
    unitKompetensi:          fd.get('unitKompetensi') || null,
    ekNama:                  fd.get('ekNama') || null,
    opsi,
    kunci,
    pembahasan:              fd.get('pembahasan'),
    tags:                    fd.get('tags'),
    jenisPelatihanPreferensi: fd.get('jenisPelatihanPreferensi') || null,
    active:                  fd.get('active') === 'on'
  };

  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }

  const progressEl = document.getElementById('soal-image-upload-progress');

  try {
    // Tentukan soalId target — pre-generate untuk soal baru agar path Storage konsisten
    const targetId = soalId ?? generateId();

    // Handle gambar
    let pertanyaanImage = _removeImage ? null : _existingImageUrl;
    if (_pendingFile) {
      if (btn) btn.textContent = 'Upload gambar…';
      progressEl?.classList.remove('hidden');

      const rawExt = _pendingFile.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
      const ext    = rawExt || 'jpg';
      const sRef   = storageRef(storage, `bank-soal/${targetId}/pertanyaan.${ext}`);
      const snap   = await uploadBytes(sRef, _pendingFile);
      pertanyaanImage = await getDownloadURL(snap.ref);

      progressEl?.classList.add('hidden');
      if (btn) btn.textContent = 'Menyimpan…';
    }

    data.pertanyaanImage = pertanyaanImage;

    if (isEdit) {
      await updateSoal(targetId, data);
      showToast('Soal diperbarui.', 'success');
    } else {
      await createSoal(data, targetId);
      showToast('Soal ditambahkan.', 'success');
    }
    close();
    onSaved?.();
  } catch (err) {
    progressEl?.classList.add('hidden');
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
  }
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
