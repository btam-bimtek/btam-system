# Redesign P&ID — Shell + Komponen Bersama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perluas bahasa visual P&ID (dipakai di Dashboard admin) ke shell (sidebar+navbar) dan komponen bersama (tabel, modal, form input), supaya semua modul admin yang memakainya otomatis ikut berubah tanpa disentuh file modulnya satu-satu.

**Architecture:** Restyle CSS di `admin/styles/main.css` (base warna, border, table, form-input) dan markup/class di 4 file JS (`main.js` shell container, `sidebar.js`, `navbar.js`, `components/data-table.js`, `components/modal.js`). Tidak ada perubahan logika/data — murni presentational.

**Tech Stack:** Vanilla JS ES modules (tanpa bundler), Tailwind CDN utility classes + custom CSS di `admin/styles/main.css`, tanpa framework/test runner (project ini tidak punya `package.json`/test suite).

## Global Constraints

- Warna base P&ID: `#0b0f10` (paling gelap, dipakai shell container & table header) dan `#12181c` (panel, sudah dipakai `.pid-panel`).
- Border P&ID: `#1e3a3f` (sudah dipakai `.pid-panel`, `.pid-unit`).
- Aksen cyan-teal — SATU warna dominan (bukan campur cyan+biru), dari spec `docs/superpowers/specs/2026-07-28-pid-redesign-shell-shared-components-design.md`:
  - Tombol primary: bg `#0d9488`, hover `#14b8a6`, teks `#f0fdfa`
  - Teks/border aktif: `#2dd4bf` (sudah dipakai `.pid-pipe`, `.pid-unit`)
  - Teks aktif redup (contoh: nav label aktif): `#5eead4`
  - Focus ring: `rgba(45,212,191,0.15)` (pengganti `rgba(59,130,246,0.15)`)
- **TIDAK berubah** (di luar scope, sengaja dipertahankan): `.badge-*` (badge status semantik), warna `danger`/`secondary` di modal actions, markup/struktur HTML tiap modul.
- Tidak ada test framework di project ini. "Testing" = `node --check <file>` untuk validasi sintaks JS, lalu verifikasi visual manual di browser (tab baru — module ES di browser ini di-cache per-tab, jadi SELALU pakai tab baru saat verifikasi, jangan reuse tab lama) dengan cek screenshot + console error kosong.
- Server lokal untuk verifikasi: `npx http-server -p 8765 -c-1` dari root project (pola yang sudah dipakai sepanjang sesi sebelumnya). Kalau server belum jalan, jalankan dulu sebelum task browser-check manapun.

---

### Task 1: CSS — base warna shell, tabel, dan form input di `main.css`

**Files:**
- Modify: `admin/styles/main.css:103-132` (`.btam-table` block)
- Modify: `admin/styles/main.css:152-184` (`.form-input`/`.form-select`/`.form-textarea` block)

**Interfaces:**
- Consumes: tidak ada (murni CSS, tidak bergantung task lain)
- Produces: class `.btam-table` dan `.form-input`/`.form-select`/`.form-textarea` dengan warna P&ID — dipakai oleh Task 5 (data-table.js, tidak mengubah markup, cukup warisan CSS) dan semua form modul (tidak mengubah markup modul, cukup warisan CSS)

- [ ] **Step 1: Ganti warna `.btam-table`**

Cari blok ini di `admin/styles/main.css` (baris 103-132):

```css
.btam-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.btam-table th {
  text-align: left;
  padding: 0.625rem 0.875rem;
  font-weight: 500;
  color: #9ca3af;
  background: #111827;
  border-bottom: 1px solid #1f2937;
  white-space: nowrap;
}

.btam-table td {
  padding: 0.625rem 0.875rem;
  border-bottom: 1px solid #1f2937;
  color: #e5e7eb;
  vertical-align: middle;
}

.btam-table tbody tr:hover td {
  background: #1f2937;
}

.btam-table tbody tr:last-child td {
  border-bottom: none;
}
```

Ganti jadi:

```css
.btam-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.btam-table th {
  text-align: left;
  padding: 0.625rem 0.875rem;
  font-weight: 500;
  color: #6b8085;
  background: #0b0f10;
  border-bottom: 1px solid #1e3a3f;
  white-space: nowrap;
}

.btam-table td {
  padding: 0.625rem 0.875rem;
  border-bottom: 1px solid #1e3a3f;
  color: #e5e7eb;
  vertical-align: middle;
}

.btam-table tbody tr:hover td {
  background: #12181c;
}

.btam-table tbody tr:last-child td {
  border-bottom: none;
}
```

- [ ] **Step 2: Ganti warna form input**

Cari blok ini di `admin/styles/main.css` (baris 152-184):

```css
/* ─── Form inputs (override untuk konsistensi) ─────────────── */
.form-input,
.form-select,
.form-textarea {
  width: 100%;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  padding: 0.5rem 0.875rem;
  color: #f3f4f6;
  font-size: 0.875rem;
  transition: border-color 150ms, box-shadow 150ms;
}

.form-input::placeholder,
.form-textarea::placeholder { color: #4b5563; }

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
}
```

Ganti jadi (hanya `background`, `border`, `:focus border-color`/`box-shadow` yang berubah — `background-image` picker di `.form-select` di baris setelahnya TIDAK diubah):

```css
/* ─── Form inputs (override untuk konsistensi) ─────────────── */
.form-input,
.form-select,
.form-textarea {
  width: 100%;
  background: #12181c;
  border: 1px solid #1e3a3f;
  border-radius: 0.5rem;
  padding: 0.5rem 0.875rem;
  color: #f3f4f6;
  font-size: 0.875rem;
  transition: border-color 150ms, box-shadow 150ms;
}

.form-input::placeholder,
.form-textarea::placeholder { color: #4b5563; }

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #2dd4bf;
  box-shadow: 0 0 0 3px rgba(45,212,191,0.15);
}
```

- [ ] **Step 3: Validasi tidak ada syntax error CSS**

Buka file di editor/`cat` dan pastikan jumlah kurung kurawal `{`/`}` seimbang (CSS tidak punya linter di project ini). Cepat cek manual:

Run: `grep -c "{" admin/styles/main.css && grep -c "}" admin/styles/main.css`
Expected: kedua angka sama persis.

- [ ] **Step 4: Commit**

```bash
git add admin/styles/main.css
git commit -m "style: warna P&ID untuk .btam-table dan form input di main.css"
```

---

### Task 2: Shell container — `main.js`

**Files:**
- Modify: `admin/js/main.js:54-59` (fungsi `_renderShell()`)

**Interfaces:**
- Consumes: tidak ada
- Produces: `#shell` container dengan warna dasar P&ID — sidebar (Task 3) dan navbar (Task 4) tetap punya `id="sidebar"`/`id="navbar"` yang sama, cuma class warna induknya yang berubah di sini

- [ ] **Step 1: Ganti class warna shell**

Cari blok ini di `admin/js/main.js` (baris 54-59):

```js
    <div id="shell" class="hidden min-h-screen flex bg-gray-950 text-gray-100">
      <aside id="sidebar" class="w-64 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      </aside>
      <div id="shell-content" class="flex-1 flex flex-col min-w-0">
        <header id="navbar" class="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-6 shrink-0">
        </header>
        <main id="app" class="flex-1 p-6 overflow-auto">
        </main>
      </div>
    </div>
```

Ganti jadi (`bg-gray-950`→`bg-[#0b0f10]`, `bg-gray-900`→`bg-[#0d1416]`, `border-gray-800`→`border-[#1e3a3f]`, pola arbitrary-value Tailwind ini sudah dipakai di dashboard sejak redesign sebelumnya):

```js
    <div id="shell" class="hidden min-h-screen flex bg-[#0b0f10] text-gray-100">
      <aside id="sidebar" class="w-64 shrink-0 bg-[#0d1416] border-r border-[#1e3a3f] flex flex-col">
      </aside>
      <div id="shell-content" class="flex-1 flex flex-col min-w-0">
        <header id="navbar" class="h-14 bg-[#0d1416] border-b border-[#1e3a3f] flex items-center px-6 shrink-0">
        </header>
        <main id="app" class="flex-1 p-6 overflow-auto">
        </main>
      </div>
    </div>
```

- [ ] **Step 2: Validasi sintaks JS**

Run: `node --check admin/js/main.js`
Expected: tidak ada output (exit code 0 = valid).

- [ ] **Step 3: Commit**

```bash
git add admin/js/main.js
git commit -m "style: warna dasar shell (sidebar/navbar container) ke P&ID"
```

(Verifikasi visual shell lengkap dilakukan di akhir Task 4, setelah sidebar+navbar keduanya selesai — supaya sekali cek browser langsung lihat hasil gabungan.)

---

### Task 3: Sidebar — "Instrument Rail" nav aktif

**Files:**
- Modify: `admin/js/layout/sidebar.js:126-167` (`_buildNavHTML()` dan `_highlightActive()`)

**Interfaces:**
- Consumes: tidak ada
- Produces: class `.nav-item` dengan state aktif baru (`pid-nav-active` alih-alih toggle `bg-gray-800`/`text-white`) — dikonsumsi murni oleh CSS baru yang ditambahkan di step ini sendiri, tidak ada task lain yang bergantung pada nama class ini

- [ ] **Step 1: Tambah CSS untuk nav item aktif ("pipe stub")**

Tambahkan blok baru di `admin/styles/main.css`, tepat setelah blok `.pid-dot-idle { background: #374151; }` (akhir grup P&ID di baris ~55, sebelum `/* ─── Scrollbar ─── */`):

```css
/* ─── Sidebar nav — "pipe stub" pada item aktif ──────────── */
.pid-nav-active {
  background: #12181c;
  border-left: 2px solid #2dd4bf;
  color: #5eead4 !important;
  padding-left: calc(0.75rem - 2px); /* kompensasi border 2px supaya konten tidak geser */
}
.pid-nav-active svg { color: #2dd4bf; }
```

- [ ] **Step 2: Ubah `_highlightActive()` supaya pakai class baru**

Cari fungsi ini di `admin/js/layout/sidebar.js` (baris 154-167):

```js
function _highlightActive() {
  const current = window.location.hash.slice(1) || '/';
  document.querySelectorAll('.nav-item').forEach(el => {
    const href = el.dataset.href;
    // Exact match untuk /, prefix match untuk yang lain
    const isActive = href === '/'
      ? current === '/'
      : current === href || current.startsWith(href + '/');

    el.classList.toggle('bg-gray-800',    isActive);
    el.classList.toggle('text-white',     isActive);
    el.classList.toggle('text-gray-400',  !isActive);
  });
}
```

Ganti jadi:

```js
function _highlightActive() {
  const current = window.location.hash.slice(1) || '/';
  document.querySelectorAll('.nav-item').forEach(el => {
    const href = el.dataset.href;
    // Exact match untuk /, prefix match untuk yang lain
    const isActive = href === '/'
      ? current === '/'
      : current === href || current.startsWith(href + '/');

    el.classList.toggle('pid-nav-active', isActive);
    el.classList.toggle('text-gray-400',  !isActive);
  });
}
```

- [ ] **Step 3: Sesuaikan class dasar `.nav-item` di `_buildNavHTML()`**

Cari blok ini di `admin/js/layout/sidebar.js` (baris 126-141), perhatikan class `hover:bg-gray-800 hover:text-gray-100`:

```js
function _buildNavHTML() {
  return NAV_ITEMS.map(section => {
    const itemsHTML = section.items
      .filter(item => !item.superadminOnly || _currentProfile?.role === 'superadmin')
      .map(item => `
        <a href="#${item.href}"
           data-href="${item.href}"
           class="nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                  text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-colors">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
               stroke-width="1.75" viewBox="0 0 24 24">
            ${ICONS[item.icon] ?? ''}
          </svg>
          ${item.label}
        </a>`).join('');
```

Ganti class `hover:bg-gray-800` jadi `hover:bg-[#12181c]` (tetap pakai `rounded-lg`, TIDAK dihapus — cuma warna hover-nya yang berubah, biar item non-aktif tetap dapat feedback saat di-hover):

```js
function _buildNavHTML() {
  return NAV_ITEMS.map(section => {
    const itemsHTML = section.items
      .filter(item => !item.superadminOnly || _currentProfile?.role === 'superadmin')
      .map(item => `
        <a href="#${item.href}"
           data-href="${item.href}"
           class="nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                  text-gray-400 hover:bg-[#12181c] hover:text-gray-100 transition-colors">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
               stroke-width="1.75" viewBox="0 0 24 24">
            ${ICONS[item.icon] ?? ''}
          </svg>
          ${item.label}
        </a>`).join('');
```

- [ ] **Step 4: Sesuaikan warna section label dan border/hover elemen lain di sidebar.js**

Cari 3 tempat berikut di file yang sama dan ganti persis seperti tabel di bawah (semua kemunculan `border-gray-800` dan `bg-gray-800` di file ini, di luar yang sudah diubah step 1-3):

| Baris (sebelum edit step 1-3) | Cari | Ganti jadi |
|---|---|---|
| 76 (`<div class="px-5 py-5 border-b border-gray-800">`) | `border-b border-gray-800` | `border-b border-[#1e3a3f]` |
| 98 (`<div class="px-3 py-4 border-t border-gray-800" id="sidebar-user">`) | `border-t border-gray-800` | `border-t border-[#1e3a3f]` |
| 99 (`<div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/50 mb-2">`) | `bg-gray-800/50` | `bg-[#12181c]` |
| 109 (`hover:bg-gray-800 hover:text-red-400` tombol logout) | `hover:bg-gray-800` | `hover:bg-[#12181c]` |
| 146 (`<p class="text-xs font-medium text-gray-600 uppercase tracking-wider px-3 mb-1">`) | `text-gray-600` | `text-[#4b5f63]` |

Gunakan tool edit dengan `old_string`/`new_string` yang menyertakan cukup baris di sekitarnya (tiap baris di atas unik dalam file, jadi cukup ganti tiap kemunculan satu per satu).

- [ ] **Step 5: Validasi sintaks JS**

Run: `node --check admin/js/layout/sidebar.js`
Expected: tidak ada output.

- [ ] **Step 6: Commit**

```bash
git add admin/styles/main.css admin/js/layout/sidebar.js
git commit -m "style: sidebar nav aktif jadi pipe-stub cyan (Instrument Rail)"
```

---

### Task 4: Navbar — strip pipa animasi

**Files:**
- Modify: `admin/js/layout/navbar.js:6-21` (`renderNavbar()`)

**Interfaces:**
- Consumes: class CSS `.pid-pipe` (sudah ada di `main.css`, dipakai Dashboard sejak redesign sebelumnya — TIDAK perlu didefinisikan ulang)
- Produces: navbar dengan strip pipa di tepi bawah — task terakhir shell, setelah ini shell secara visual selesai (Task 2+3+4 digabung)

- [ ] **Step 1: Tambah strip pipa di navbar**

Cari blok ini di `admin/js/layout/navbar.js` (baris 6-21):

```js
export function renderNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  navbar.innerHTML = `
    <div class="flex items-center justify-between w-full">
      <!-- Page title (diupdate oleh setPageTitle) -->
      <h2 id="page-title" class="text-sm font-semibold text-gray-100">Dashboard</h2>

      <!-- Right side -->
      <div class="flex items-center gap-3">
        <!-- Lembaga label -->
        <span id="navbar-lembaga" class="text-xs text-gray-500 hidden sm:block">BTAM</span>
      </div>
    </div>
  `;
```

Ganti jadi (tambah `relative` di header via style inline lewat wrapper, dan div strip pipa absolut di tepi bawah — header `#navbar` sendiri sudah `shrink-0` dari `main.js`, jadi aman ditambah anak absolut):

```js
export function renderNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  navbar.style.position = 'relative';
  navbar.innerHTML = `
    <div class="flex items-center justify-between w-full">
      <!-- Page title (diupdate oleh setPageTitle) -->
      <h2 id="page-title" class="text-sm font-semibold text-gray-100">Dashboard</h2>

      <!-- Right side -->
      <div class="flex items-center gap-3">
        <!-- Lembaga label -->
        <span id="navbar-lembaga" class="text-xs text-gray-500 hidden sm:block">BTAM</span>
      </div>
    </div>
    <div class="pid-pipe" style="position:absolute;left:0;right:0;bottom:-1px;opacity:0.5;"></div>
  `;
```

- [ ] **Step 2: Validasi sintaks JS**

Run: `node --check admin/js/layout/navbar.js`
Expected: tidak ada output.

- [ ] **Step 3: Commit**

```bash
git add admin/js/layout/navbar.js
git commit -m "style: strip pipa animasi di navbar"
```

- [ ] **Step 4: Verifikasi visual shell (Task 2+3+4 gabungan) di browser**

Pastikan server statis jalan:

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8765/admin/index.html`
Expected: `200`. Kalau bukan 200, jalankan dulu: `npx http-server -p 8765 -c-1` (background) dari root project, lalu ulangi curl ini.

Buka **tab browser BARU** (bukan reuse tab lama — module JS di-cache per-tab) ke `http://localhost:8765/admin/index.html#/`, login kalau diminta, tunggu render (dashboard render bisa butuh retry — kalau blank, klik menu sidebar lain lalu kembali, ini race condition auth-guard pre-existing yang sudah diperbaiki di commit `406b257` tapi tetap beri jeda 5-8 detik untuk auth resolve).

Ambil screenshot. Verifikasi manual:
- Latar sidebar & navbar gelap teknis (`#0d1416`/`#0b0f10`), BUKAN abu-abu (`gray-900`) lama.
- Item nav "Dashboard" (halaman aktif) punya garis kiri cyan tipis + teks agak terang cyan, BUKAN highlight abu-abu blok penuh.
- Ada garis tipis putus-putus di tepi bawah navbar (dekat judul halaman), warnanya cyan pudar.
- Buka DevTools console (via `read_console_messages` kalau pakai claude-in-chrome, atau F12 manual) — pastikan tidak ada error.
- Klik 2-3 menu sidebar lain (mis. Bimtek, Peserta) — pastikan nav aktif berpindah mengikuti, dan tidak ada elemen sidebar/navbar yang pecah/hilang.

Kalau ada yang tidak sesuai, perbaiki file terkait (Task 2/3/4) sebelum lanjut ke Task 5.

---

### Task 5: Tabel — warna aktif pagination

**Files:**
- Modify: `admin/js/components/data-table.js:138-150` (`_renderPagination()`)

**Interfaces:**
- Consumes: tidak ada
- Produces: tombol pagination aktif dengan warna cyan-teal — dipakai otomatis oleh SEMUA modul yang memanggil `renderDataTable()` (Instansi, Peserta, Pengajar, Bank Soal, Alumni, Calon Peserta, dll.), tidak ada file modul yang perlu disentuh

- [ ] **Step 1: Ganti warna tombol halaman aktif**

Cari blok ini di `admin/js/components/data-table.js` (baris 138-150):

```js
function _renderPagination(el, current, total, onChange) {
  const pages = _getPageNumbers(current, total);
  el.innerHTML = pages.map(p => {
    if (p === '...') return `<span class="px-1 text-gray-600">…</span>`;
    return `
      <button data-page="${p}"
        class="w-7 h-7 rounded flex items-center justify-center text-xs transition-colors
               ${p === current
                 ? 'bg-blue-600 text-white'
                 : 'text-gray-400 hover:bg-gray-700 hover:text-white'}">
        ${p}
      </button>`;
  }).join('');
```

Ganti jadi:

```js
function _renderPagination(el, current, total, onChange) {
  const pages = _getPageNumbers(current, total);
  el.innerHTML = pages.map(p => {
    if (p === '...') return `<span class="px-1 text-gray-600">…</span>`;
    return `
      <button data-page="${p}"
        class="w-7 h-7 rounded flex items-center justify-center text-xs transition-colors
               ${p === current
                 ? 'bg-[#0d9488] text-white'
                 : 'text-gray-400 hover:bg-[#12181c] hover:text-white'}">
        ${p}
      </button>`;
  }).join('');
```

- [ ] **Step 2: Ganti hover prev/next di fungsi yang sama**

Beberapa baris di bawahnya, di fungsi yang sama, cari:

```js
  const nav = `
    <button data-page="${current - 1}" ${current <= 1 ? 'disabled' : ''}
      class="w-7 h-7 rounded flex items-center justify-center text-gray-400
             hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      ‹
    </button>
    ${el.innerHTML}
    <button data-page="${current + 1}" ${current >= total ? 'disabled' : ''}
      class="w-7 h-7 rounded flex items-center justify-center text-gray-400
             hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      ›
    </button>`;
  el.innerHTML = nav;
```

Ganti kedua `hover:bg-gray-700` jadi `hover:bg-[#12181c]`:

```js
  const nav = `
    <button data-page="${current - 1}" ${current <= 1 ? 'disabled' : ''}
      class="w-7 h-7 rounded flex items-center justify-center text-gray-400
             hover:bg-[#12181c] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      ‹
    </button>
    ${el.innerHTML}
    <button data-page="${current + 1}" ${current >= total ? 'disabled' : ''}
      class="w-7 h-7 rounded flex items-center justify-center text-gray-400
             hover:bg-[#12181c] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      ›
    </button>`;
  el.innerHTML = nav;
```

- [ ] **Step 3: Validasi sintaks JS**

Run: `node --check admin/js/components/data-table.js`
Expected: tidak ada output.

- [ ] **Step 4: Commit**

```bash
git add admin/js/components/data-table.js
git commit -m "style: warna cyan-teal untuk pagination data-table"
```

- [ ] **Step 5: Verifikasi visual di browser (2 modul berbeda, buktikan warisan otomatis)**

Di tab browser baru yang sama dari Task 4 (atau buka tab baru lagi kalau sudah ditutup), navigasi ke `#/instansi`. Screenshot, verifikasi:
- Header tabel (`Nama Instansi`, dst.) berlatar sangat gelap (`#0b0f10`), bukan abu-abu.
- Hover salah satu baris tabel — warna hover gelap teknis, bukan abu-abu biru lama.

Lalu navigasi ke `#/peserta` (modul BERBEDA, tidak disentuh filenya sama sekali). Screenshot, verifikasi warna tabel SAMA seperti di `#/instansi` — buktikan warisan otomatis dari `.btam-table` bekerja tanpa perlu edit `peserta-master/index.js`.

Kalau tabel `#/peserta` punya data > 1 halaman, cek tombol pagination aktif berwarna cyan-teal (`#0d9488`), bukan biru.

Console harus bersih dari error di kedua halaman.

---

### Task 6: Modal — warna container dan tombol primary

**Files:**
- Modify: `admin/js/components/modal.js:28-63`

**Interfaces:**
- Consumes: tidak ada
- Produces: `openModal()` dengan tampilan P&ID — dipakai otomatis oleh semua modul yang memanggil `openModal`/`confirmDialog` (tidak ada file modul yang perlu disentuh)

- [ ] **Step 1: Ganti warna tombol primary**

Cari blok ini di `admin/js/components/modal.js` (baris 28-37):

```js
  const actionsHTML = actions.map(a => {
    const styles = {
      primary:   'bg-blue-600 hover:bg-blue-500 text-white',
      danger:    'bg-red-700 hover:bg-red-600 text-white',
      secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200'
    }[a.type ?? 'secondary'];
    return `<button data-action="${a.label}" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${styles}">
      ${a.label}
    </button>`;
  }).join('');
```

Ganti HANYA baris `primary` (`danger` dan `secondary` TIDAK berubah, sesuai spec — warna status semantik dipertahankan):

```js
  const actionsHTML = actions.map(a => {
    const styles = {
      primary:   'bg-[#0d9488] hover:bg-[#14b8a6] text-white',
      danger:    'bg-red-700 hover:bg-red-600 text-white',
      secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200'
    }[a.type ?? 'secondary'];
    return `<button data-action="${a.label}" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${styles}">
      ${a.label}
    </button>`;
  }).join('');
```

- [ ] **Step 2: Ganti warna container, border, dan backdrop**

Cari blok ini di `admin/js/components/modal.js` (baris 39-64):

```js
  const el = document.createElement('div');
  el.id = id;
  el.className = 'fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto';
  el.innerHTML = `
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="${id}-backdrop"></div>
    <div class="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full ${sizeClass} mb-8"
         style="display:flex;flex-direction:column">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800" style="flex-shrink:0">
        <h3 class="text-base font-semibold text-white">${title}</h3>
        ${closable ? `<button id="${id}-close" class="text-gray-500 hover:text-gray-300 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>` : ''}
      </div>
      <!-- Body -->
      <div class="px-6 py-5" id="${id}-body">
        ${body}
      </div>
      <!-- Footer -->
      ${actionsHTML ? `<div class="px-6 py-4 border-t border-gray-800 flex justify-end gap-3" style="flex-shrink:0">
        ${actionsHTML}
      </div>` : ''}
    </div>
  `;
```

Ganti `bg-gray-900 border-gray-700` (container) dan kedua `border-gray-800` (header/footer) — backdrop `bg-black/60` TIDAK berubah:

```js
  const el = document.createElement('div');
  el.id = id;
  el.className = 'fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto';
  el.innerHTML = `
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="${id}-backdrop"></div>
    <div class="relative bg-[#0d1416] border border-[#1e3a3f] rounded-2xl shadow-2xl w-full ${sizeClass} mb-8"
         style="display:flex;flex-direction:column">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-[#1e3a3f]" style="flex-shrink:0">
        <h3 class="text-base font-semibold text-white">${title}</h3>
        ${closable ? `<button id="${id}-close" class="text-gray-500 hover:text-gray-300 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>` : ''}
      </div>
      <!-- Body -->
      <div class="px-6 py-5" id="${id}-body">
        ${body}
      </div>
      <!-- Footer -->
      ${actionsHTML ? `<div class="px-6 py-4 border-t border-[#1e3a3f] flex justify-end gap-3" style="flex-shrink:0">
        ${actionsHTML}
      </div>` : ''}
    </div>
  `;
```

- [ ] **Step 3: Validasi sintaks JS**

Run: `node --check admin/js/components/modal.js`
Expected: tidak ada output.

- [ ] **Step 4: Commit**

```bash
git add admin/js/components/modal.js
git commit -m "style: warna P&ID untuk modal (container, border, tombol primary)"
```

- [ ] **Step 5: Verifikasi visual di browser**

Di tab yang sama dari Task 5, tetap di `#/instansi`. Klik tombol "+ Tambah" (atau tombol setara untuk buka form tambah data).

Screenshot modal yang terbuka. Verifikasi:
- Latar modal gelap teknis (`#0d1416`), border tipis `#1e3a3f` — bukan abu-abu (`gray-900`/`gray-700`) lama.
- Tombol primary (submit/simpan) berwarna teal (`#0d9488`), BUKAN biru.
- Tombol "Batal" tetap abu-abu (secondary, tidak berubah).
- Input di dalam form modal (dari Task 1) berlatar `#12181c`, border `#1e3a3f`, dan saat diklik/fokus border/ring berubah cyan — bukan biru.

Klik tombol close (X) atau "Batal", pastikan modal tertutup normal tanpa error. Cek console bersih.

Kalau modul Instansi tidak punya tombol "+ Tambah" yang gampang diakses, buka modul lain yang pasti punya form modal sederhana (mis. `#/pengajar` atau `#/master-uk`) — modal-nya SAMA (`openModal` dipakai bersama), jadi hasilnya identik.

---

## Self-Review (dilakukan penulis plan, bukan reviewer terpisah)

**Spec coverage** — cross-check tiap butir spec:
- Shell "Instrument Rail" → Task 2 (container), Task 3 (nav aktif pipe-stub), Task 4 (strip pipa navbar). ✅
- Warna aksi cyan-teal penuh (bukan campur biru) → Task 5 (pagination), Task 6 (tombol primary modal). ✅
- Tabel & badge: badge TIDAK diubah (sesuai spec), tabel diubah di Task 1. ✅
- Modal → Task 6. ✅
- Form input → Task 1 Step 2. ✅
- Di luar scope (markup modul, Chart.js, exam app) — tidak ada task yang menyentuhnya. ✅

**Placeholder scan** — tidak ada "TBD"/"nanti"/"tambahkan validasi" tanpa kode konkret di seluruh task di atas.

**Type/nama konsisten** — class baru `.pid-nav-active` didefinisikan di Task 3 Step 1 dan dipakai di Step 2 (fungsi yang sama, file yang sama) — tidak ada task lain yang mereferensikannya. Semua hex warna (`#0d9488`, `#14b8a6`, `#2dd4bf`, `#5eead4`, `#0b0f10`, `#0d1416`, `#12181c`, `#1e3a3f`) dipakai identik persis di seluruh task, disalin dari Global Constraints — tidak ada varian typo hex berbeda.
