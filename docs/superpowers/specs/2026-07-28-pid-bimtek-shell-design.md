# Redesign P&ID — Modul Bimtek, Fase A (Shell/List)

## Konteks

Semua modul CRUD sederhana (Instansi, Peserta, Pengajar, Bank Soal, Unit Kompetensi, Admin Users, Settings, Data Historis, Laporan Evaluasi, Rekrutmen) sudah selesai mewarisi tema P&ID mengikuti resep pattern-setter dari modul Instansi. Modul **Bimtek** (`admin/js/modules/bimtek/`) adalah satu-satunya yang belum tersentuh — dan jauh lebih kompleks: 27 file, termasuk halaman detail dengan navigasi tab kustom (Ujian, Pengajar, Jadwal, Penilaian, Evaluasi, dan lain-lain) yang masing-masing punya sub-file sendiri.

Modul ini terlalu besar untuk satu spec. Spec ini adalah **Fase A**: merestyle bagian shell/navigasi bertitik-pengungkit-tinggi — `list.js` (halaman daftar) dan `detail.js` (fungsi navigasi tab yang dipakai oleh semua tab). Isi di dalam setiap tab (`tab-ujian.js`, `tab-pengajar.js`, `tab-jadwal.js`, `tab-penilaian.js`, `tab-evaluasi.js`, `tab-report.js`, `tab-uk.js`, dan seluruh file `sub-*.js`) **di luar scope** — akan jadi Fase B, spec terpisah.

## Keputusan Desain

### 1. `list.js` — tombol halaman

Mengikuti resep baku yang sudah dipakai di semua modul CRUD sebelumnya:
- Tombol "+ Bimtek Baru" (baris 18): `bg-blue-600 hover:bg-blue-500 text-white` → `bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa]`.
- Tombol "Reset" (baris 46): `hover:bg-gray-800` → `hover:bg-[#12181c]` (tombol ini tidak punya border untuk diubah).

### 2. `detail.js` — navigasi tab

Navigasi tab terpusat di dua fungsi: `_tabButton()` (baris ~147, generate HTML tombol tab) dan `_setTabActive()` (baris ~151, toggle class saat tab diklik). Keduanya memakai string class identik untuk state aktif: `text-blue-400 border-blue-400` (underline bawah 2px). Karena terpusat, satu perubahan otomatis berlaku ke semua tab.

Ganti ke `text-[#2dd4bf] border-[#2dd4bf]` — warna yang sama dengan "dim active text"/border-accent yang sudah dipakai konsisten untuk elemen aktif/dipilih lain di seluruh aplikasi (nav sidebar `pid-nav-active`, focus ring). State non-aktif (`text-gray-400 border-transparent hover:text-gray-200`) tidak berubah.

### 3. Badge tipe & status di `list.js` — tidak disentuh

`_badgeTipe()` dan `_badgeStatus()` memakai warna inline custom per status (draft/planned/ongoing/completed/cancelled, reguler/pnbp/e_learning/ojt/lainnya) — warna semantik untuk membedakan kategori/status, bukan aksen brand. Konsisten dengan keputusan badge di seluruh fase-fase sebelumnya (Dashboard, shared-components, modul CRUD): tetap dipertahankan.

## Di luar scope (Fase B, spec terpisah nanti)

- Semua isi tab: `tab-ujian.js`, `tab-pengajar.js`, `tab-jadwal.js`, `tab-penilaian.js`, `tab-evaluasi.js`, `tab-report.js`, `tab-uk.js`.
- Semua file `sub-*.js` (sub-kelulusan, sub-kehadiran, sub-nilai-manual, sub-prepost, sub-import-nilai, sub-report-peserta, sub-report-penyelenggara, sub-pelanggaran).
- `form.js`, `form-mapel.js` — form modal Bimtek (kemungkinan sudah otomatis ikut lewat `openModal()` shared component untuk sebagian, tapi perlu diverifikasi terpisah di Fase B).
- File non-UI: `api.js`, `exam-api.js`, `scorer.js`, `evaluasi-api.js`, `penilaian-api.js`, `report-api.js`, `evaluasi-ui.js`, `report-narrative.js`, `PATCH_INSTRUCTIONS.js`.

## Testing

Verifikasi manual di browser:
- Buka Daftar Bimtek, pastikan tombol "+ Bimtek Baru" cyan-teal dan "Reset" ikut hover P&ID.
- Buka detail salah satu Bimtek, klik antar-tab (Ujian, Pengajar, dll.), pastikan underline tab aktif cyan-teal (`#2dd4bf`), bukan biru.
- Console bersih dari error.
