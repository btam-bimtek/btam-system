// exam/js/ui-modal.js
// Modal custom (pengganti confirm()/alert() native) — konsisten dengan visual language exam app.

function _esc(str) {
  const el = document.createElement('span');
  el.appendChild(document.createTextNode(str ?? ''));
  return el.innerHTML;
}

/** Modal konfirmasi. Resolve true/false. */
export function showConfirmModal({ title, body, confirmLabel = 'Ya', cancelLabel = 'Batal', danger = false }) {
  return new Promise((resolve) => {
    document.getElementById('exam-modal')?.remove();
    const el = document.createElement('div');
    el.id = 'exam-modal';
    el.className = 'fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4';
    el.innerHTML = `
      <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 class="font-bold text-gray-900 text-lg mb-2">${_esc(title)}</h3>
        <p class="text-gray-600 text-sm mb-5 whitespace-pre-line">${_esc(body)}</p>
        <div class="flex gap-3">
          <button id="modal-cancel" class="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm">${_esc(cancelLabel)}</button>
          <button id="modal-confirm" class="flex-1 py-2.5 rounded-xl text-white font-medium text-sm ${danger ? 'bg-red-600' : 'bg-blue-600'}">${_esc(confirmLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    const cleanup = (result) => { el.remove(); resolve(result); };
    el.querySelector('#modal-cancel').addEventListener('click', () => cleanup(false));
    el.querySelector('#modal-confirm').addEventListener('click', () => cleanup(true));
  });
}

/** Modal error/notice satu tombol (pengganti alert()). */
export function showErrorModal(title, body) {
  document.getElementById('exam-modal')?.remove();
  const el = document.createElement('div');
  el.id = 'exam-modal';
  el.className = 'fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4';
  el.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
      <div class="text-4xl mb-2">⚠️</div>
      <h3 class="font-bold text-gray-900 text-lg mb-2">${_esc(title)}</h3>
      <p class="text-gray-600 text-sm mb-5 whitespace-pre-line">${_esc(body)}</p>
      <button id="modal-ok" class="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm">Mengerti</button>
    </div>
  `;
  document.body.appendChild(el);
  el.querySelector('#modal-ok').addEventListener('click', () => el.remove());
}
