// pendaftar/js/pages/konfirmasi.js

export function renderKonfirmasi(app, hash) {
  // Parse query: /konfirmasi?id=REG-...&tahun=2027
  const params = new URLSearchParams(hash.split('?')[1] ?? '');
  const id     = params.get('id') ?? '';
  const tahun  = params.get('tahun') ?? '';

  app.innerHTML = `
    ${_header()}
    <main class="max-w-lg mx-auto px-4 py-10 text-center">

      <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </div>

      <h1 class="text-xl font-bold text-gray-800 mb-2">Pendaftaran Berhasil!</h1>
      <p class="text-gray-500 text-sm mb-6">
        Pendaftaran Anda telah diterima. Simpan nomor pendaftaran berikut untuk keperluan selanjutnya.
      </p>

      <!-- Nomor pendaftaran -->
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
        <p class="text-xs text-blue-600 font-medium mb-1">Nomor Pendaftaran Anda</p>
        <p id="no-daftar" class="text-2xl font-bold text-blue-800 tracking-wide font-mono">${_esc(id)}</p>
        <button id="btn-copy" class="mt-3 text-xs text-blue-600 hover:text-blue-800 underline">
          Salin nomor
        </button>
      </div>

      <!-- Timeline tahapan -->
      <div class="bg-white border border-gray-200 rounded-xl p-5 text-left mb-6">
        <h2 class="text-sm font-semibold text-gray-700 mb-4">Tahapan Selanjutnya</h2>
        <ol class="space-y-3">
          ${[
            { label: 'Verifikasi Administrasi',  desc: 'Tim BTAM akan memeriksa kelengkapan dan kesesuaian data Anda.' },
            { label: 'Pengumuman Administrasi',  desc: 'Hasil seleksi administrasi akan diumumkan melalui sistem ini.' },
            { label: 'Seleksi Tertulis',         desc: 'Peserta yang lulus administrasi akan mengikuti ujian tertulis online.' },
            { label: 'Pengumuman Final',         desc: 'Peserta terpilih akan diinformasikan beserta jadwal bimtek.' },
          ].map((t, i) => `
            <li class="flex gap-3">
              <div class="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">${i+1}</div>
              <div>
                <p class="text-sm font-medium text-gray-800">${t.label}</p>
                <p class="text-xs text-gray-500 mt-0.5">${t.desc}</p>
              </div>
            </li>`).join('')}
        </ol>
      </div>

      <div class="flex flex-col sm:flex-row gap-3">
        <a href="#/status" class="btn-primary flex-1 text-center">Cek Status Pendaftaran</a>
        <a href="#/" class="btn-secondary flex-1 text-center">Kembali ke Beranda</a>
      </div>

    </main>
    ${_footer()}`;

  document.getElementById('btn-copy')?.addEventListener('click', () => {
    navigator.clipboard.writeText(id).then(() => {
      const btn = document.getElementById('btn-copy');
      if (btn) { btn.textContent = 'Tersalin!'; setTimeout(() => { btn.textContent = 'Salin nomor'; }, 2000); }
    });
  });
}

function _header() {
  return `
    <header class="bg-white border-b border-gray-200">
      <div class="max-w-lg mx-auto px-4 h-14 flex items-center">
        <a href="#/" class="flex items-center gap-2 text-blue-700 font-bold text-sm">
          <div class="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
          </div>
          SI-SABAT
        </a>
      </div>
    </header>`;
}
function _footer() { return `<footer class="text-center py-8 text-xs text-gray-400">Balai Teknik Air Minum — Direktorat Jenderal Cipta Karya</footer>`; }
function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
