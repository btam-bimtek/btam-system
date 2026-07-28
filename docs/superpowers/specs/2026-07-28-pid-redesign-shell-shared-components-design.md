# Redesign P&ID — Shell + Komponen Bersama

## Konteks

`DESIGN.md` mendefinisikan direction contract "P&ID / Diagram Proses Pengolahan Air" untuk Dashboard admin (selesai). Scope-nya eksplisit dibatasi:

> "Staging: Dashboard/beranda admin sebagai first surface, modul lain BELUM mewarisi."

Spec ini adalah tahap kedua: memperluas bahasa visual P&ID ke luar Dashboard, dimulai dari elemen yang paling berdampak luas — bukan modul per modul, tapi **shell (layout global)** dan **komponen bersama** yang dipakai lintas modul.

## Keputusan Scope

**Bukan** "redesign modul X sebagai contoh, modul lain menyusul nanti" — melainkan **restyle primitif bersama** yang otomatis dipakai ulang oleh semua modul yang mengimpornya. Ditemukan saat eksplorasi kode bahwa tabel, badge, form input, dan modal SUDAH terpusat di komponen bersama (bukan diduplikasi per modul), jadi ini titik pengungkit paling efisien:

| Primitif | File | Dipakai oleh |
|---|---|---|
| Shell (sidebar+navbar+container) | `admin/js/layout/sidebar.js`, `admin/js/layout/navbar.js`, `admin/js/main.js` (`_renderShell()`) | Semua halaman |
| Tabel | `admin/js/components/data-table.js`, `.btam-table` di `admin/styles/main.css` | Instansi, Peserta, Pengajar, Bank Soal, Alumni, Calon Peserta, dll. |
| Badge status | `.badge`, `.badge-blue/green/yellow/red/purple/gray` di `main.css` | Hampir semua modul |
| Modal | `admin/js/components/modal.js` (`openModal`) | Hampir semua modul |
| Form input | `.form-input`, `.form-select` di `main.css` | Semua form |

Modul dengan UI kustom di luar primitif ini (mis. Bimtek yang punya tab-tab kompleks dengan markup sendiri) **tidak masuk scope spec ini** — akan jadi spec terpisah yang memanfaatkan primitif yang sudah direstyle di sini.

## Keputusan Desain (divalidasi lewat mockup visual companion)

### 1. Shell — "Instrument Rail"

- Latar shell (sidebar, navbar, container `#app`) pindah ke base P&ID (`#0b0f10`–`#12181c` family), bukan `bg-gray-900`/`bg-gray-950` lama.
- Font: label nav & judul halaman pakai IBM Plex Sans (sudah dimuat sejak redesign Dashboard); section label sidebar (UTAMA, MASTER DATA, dst.) dapat treatment `pid-label` (uppercase, letter-spacing, warna redup) seperti header panel Dashboard.
- Nav item aktif: border kiri 2px cyan-teal (`#2dd4bf`) — "pipe stub" yang menandakan sambungan ke konten aktif, BUKAN kotak instrumen penuh (ditolak — opsi C di mockup, terlalu berat untuk 15+ item nav padat, bertentangan dengan prinsip scanability di PRODUCT.md).
- Navbar: strip pipa tipis beranimasi (`.pid-pipe`, sudah ada di `main.css` dari redesign Dashboard) di tepi bawah, menggantikan `border-b border-gray-800` polos.
- Icon SVG nav tetap seperti sekarang (tidak diganti set ikon baru) — cukup warnanya mengikuti state aktif/nonaktif yang baru.

### 2. Warna aksi — cyan-teal penuh (bukan biru)

Divalidasi: opsi "cyan buat readout, biru buat tombol aksi" ditolak — pilih **konsisten satu warna dominan** sesuai commitment di `DESIGN.md` Color Strategy. Semua yang sebelumnya `bg-blue-600`/`text-blue-400`/`border-blue-*` di primitif bersama (tombol primary modal, tombol primary halaman, active state pagination, link) pindah ke skala cyan-teal (`#0d9488`/`#2dd4bf`/`#5eead4`).

Tidak berubah: warna `danger` (merah) dan `secondary` (abu-abu) di `openModal` actions, serta `badge-red`/`badge-green`/`badge-yellow` — ini status semantik (bukan warna brand), tetap dipertahankan seperti keputusan Dashboard soal status legend.

### 3. Tabel & badge

- `.btam-table`: header background & border pindah ke skala `#0b0f10`/`#1e3a3f`, hover row pakai nuansa gelap yang sama (bukan `#1f2937` biru-abu lama).
- Badge: TIDAK diubah — sistem warna semantik (`badge-blue/green/yellow/red/purple/gray`) sudah berfungsi baik untuk membedakan status, dan Dashboard sendiri mempertahankan pola serupa (dot status hijau/amber/merah) di luar aksen cyan hero. Konsisten dengan itu.
- Pagination aktif (`data-table.js` `_renderPagination`): `bg-blue-600` → cyan-teal.

### 4. Modal (`openModal`)

- Container modal: `bg-gray-900 border-gray-700` → base P&ID gelap + border `#1e3a3f`.
- Border header/footer: `border-gray-800` → `#1e3a3f`.
- Tombol `primary`: `bg-blue-600 hover:bg-blue-500` → cyan-teal.
- Tombol `secondary`/`danger`: tidak berubah.

### 5. Form input

- `.form-input`/`.form-select`: border & focus-ring pindah ke skala P&ID + cyan-teal saat fokus (menggantikan focus ring biru lama).

## Di luar scope (sengaja tidak disentuh)

- Markup/struktur HTML tiap modul (tab Bimtek, form panjang Bank Soal, dll.) — cuma primitif bersama yang berubah, modul lain otomatis ikut lewat warisan CSS/komponen tanpa perlu file modul disentuh.
- Chart.js color scheme di laporan/dashboard — sudah punya palet sendiri, tidak bagian dari primitif ini.
- Exam app (`exam/`, `pendaftar/`, `peserta/`) — punya identitas visual terpisah (light theme), di luar scope P&ID admin.

## Testing

Setelah implementasi, verifikasi manual di browser (pola yang sudah dipakai sepanjang sesi ini):
- Shell: cek sidebar+navbar di beberapa rute berbeda, pastikan nav aktif ter-highlight benar.
- Minimal 2 modul yang pakai tabel (mis. Instansi + Peserta) — pastikan keduanya otomatis berubah tanpa disentuh filenya.
- 1 modal (mis. form Instansi) — pastikan tombol primary cyan, secondary/danger tidak berubah.
- Console bersih dari error di setiap halaman yang dicek.
