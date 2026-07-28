# Redesign P&ID — Modul Instansi (Pattern-Setter)

## Konteks

Fase shell + komponen bersama (`docs/superpowers/specs/2026-07-28-pid-redesign-shell-shared-components-design.md`) sudah selesai dan di-merge ke `main`. Fase itu merestyle primitif bersama (shell, `.btam-table`, `.form-input`, `data-table.js`, `openModal()`) sehingga semua modul otomatis mewarisi warna dasar & modal.

Yang **tidak** ikut ter-cover: elemen yang ditulis langsung per modul, di luar primitif bersama — terutama tombol aksi halaman (`+ Tambah X`, `Export`, dll). Saat verifikasi visual hasil merge, ini terlihat jelas: tombol "+ Tambah Instansi" masih `bg-blue-600`.

Spec ini adalah fase ketiga: menetapkan pola restyle untuk elemen per-halaman tersebut, menggunakan modul **Instansi** (`admin/js/modules/instansi-master/index.js`) sebagai pattern-setter — modul CRUD paling sederhana (1 tabel + 1 modal form). Pola yang ditemukan di sini akan direplikasi ke modul lain (Peserta, Pengajar, Bank Soal, dll.) sebagai fase terpisah berikutnya.

## Keputusan Desain

### 1. Tombol primary halaman ("+ Tambah Instansi")

Pindah ke cyan-teal penuh — identik dengan style `primary` di `openModal()` (`bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa]`). Divalidasi: konsisten dengan commitment "satu warna dominan" DESIGN.md, bukan skema "cyan readout / biru aksi" yang sempat dipertimbangkan tapi ditolak di fase shell.

### 2. Tombol sekunder/netral ("Export")

Border & hover pindah ke palet P&ID gelap (`border-[#1e3a3f] hover:bg-[#12181c]`), menggantikan `border-gray-700 hover:bg-gray-800`. Warna teks (`text-gray-400`) tidak berubah — ini bukan aksen warna, cuma border/hover netral yang diselaraskan ke skema gelap yang sama dengan shell/tabel/modal.

### 3. Tombol danger ("Ganti dengan Data Kinerja PDAM")

**Tidak diubah.** Merah tetap warna semantik untuk aksi destruktif, konsisten dengan keputusan `badge-red` dan tombol `danger` di `openModal()` pada fase-fase sebelumnya.

### 4. Judul & subjudul halaman

**Tidak diubah.** Teks putih polos (h1) dan abu-abu polos (subjudul) sudah netral dan terbaca baik di atas shell gelap baru. Treatment `pid-label` (uppercase, letter-spacing) direservasi untuk header panel/section instrumen (Dashboard, sidebar), bukan judul halaman CRUD biasa.

### 5. Search bar & badge

Tidak disentuh spec ini — search bar sudah pakai `.form-input` (otomatis ikut restyle dari fase shared-components), badge kategori/PNBP tetap warna semantik (keputusan lama, tidak diubah).

## Pola yang Dihasilkan (untuk Direplikasi)

Resep 3-baris untuk modul CRUD lain:
- Tombol primary aksi halaman → `bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa]`
- Tombol sekunder/netral → `border-[#1e3a3f] hover:bg-[#12181c]`
- Tombol danger → tidak disentuh

## Di luar scope (sengaja tidak disentuh)

- `admin/js/modules/instansi-master/api.js` — tidak ada UI di sini.
- Modul lain (Peserta, Pengajar, Bank Soal, dll.) — replikasi pola ini adalah fase terpisah setelah spec ini selesai.
- Judul/subjudul halaman, search bar, badge — lihat poin 4 & 5 di atas.

## Testing

Verifikasi manual di browser (pola yang sudah dipakai sepanjang proyek ini):
- Buka modul Instansi, pastikan tombol "+ Tambah Instansi" cyan-teal, tombol "Export" border gelap P&ID, tombol "Ganti dengan Data Kinerja PDAM" tetap merah.
- Console bersih dari error.
