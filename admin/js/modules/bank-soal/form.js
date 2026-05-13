// admin/js/modules/bank-soal/form.js
// Modal add/edit soal. Support 2-6 opsi, preview pertanyaan, kunci jawaban terpisah.

import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { createSoal, updateSoal, getSoal } from './api.js';
import { BIDANG_LIST, BLOOM_LEVELS } from '../../../../shared/constants.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { storage } from '../../../../shared/firebase-config.js';
import { generateId } from '../../../../shared/normalize.js';

// State gambar — di-reset setiap kali form dibuka
let _pendingFile      = null;   // File object baru yang dipilih user
let _removeImage      = false;  // true jika user klik "Hapus Gambar"
let _existingImageUrl = null;   // URL gambar saat ini (mode edit)

/**
 * @param {string|null} soalId  - null = mode create, string = mode edit
 * @param {function}    onSaved - callback setelah berhasil simpan
 */
export async function openSoalForm(soalId = null, onSaved) {
  // Reset state gambar setiap kali form dibuka
  _pendingFile      = null;
  _removeImage      = false;
  _existingImageUrl = null;

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
            Bloom Level <span class="text-red-400">*</span>
          </label>
          <select name="bloomLevel" class="form-select" required>
            <option value="">— Pilih —</option>
            ${BLOOM_LEVELS.map(b =>
              `<option value="${b.level}" ${existing?.bloomLevel === b.level ? 'selected' : ''}>
                ${b.level} — ${b.nama}
              </option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1.5">Elemen Kompetensi</label>
          <input name="elemenKompetensi" class="form-input" placeholder="Misal: EK-01"
                 value="${_esc(existing?.elemenKompetensi ?? '')}" />
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

  openModal({
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
    elemenKompetensi:        fd.get('elemenKompetensi'),
    ekNama:                  null,
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
