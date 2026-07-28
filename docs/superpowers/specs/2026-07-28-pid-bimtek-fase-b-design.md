# Redesign P&ID — Modul Bimtek, Fase B (Isi Tab)

## Konteks

Fase A (`docs/superpowers/specs/2026-07-28-pid-bimtek-shell-design.md`, commit `3ff9409`) sudah merestyle shell modul Bimtek: `list.js` dan navigasi tab terpusat di `detail.js`. Isi di dalam setiap tab sengaja dideferred ke fase ini.

Survei menemukan 76 kemunculan warna biru tersebar di 16 file: `tab-ujian.js`, `tab-pengajar.js`, `tab-jadwal.js`, `tab-penilaian.js`, `tab-uk.js`, `tab-report.js`, `sub-kelulusan.js`, `sub-kehadiran.js`, `sub-nilai-manual.js`, `sub-prepost.js`, `sub-import-nilai.js`, `sub-report-peserta.js`, `sub-report-penyelenggara.js`, `form.js`, `form-mapel.js`, dan bagian `detail.js` yang belum tersentuh Fase A (konten tab Mata Pelajaran dan Peserta). `tab-evaluasi.js` dan `sub-pelanggaran.js` tidak punya kemunculan biru — tidak perlu disentuh.

Selain pola tombol primary/netral yang sudah baku dari fase-fase sebelumnya, survei menemukan 3 pola baru yang khas modul ini: sub-tab navigasi bersarang (tab di dalam tab Penilaian/Report, dan tab di form modal Bimtek), teks "readout" (angka statistik, kode ujian, counter), dan tombol chip kecil bergaya pill redup + kotak info.

## Keputusan Desain — Pemetaan Warna

| Kategori | Sebelum | Sesudah |
|---|---|---|
| Tombol primary | `bg-blue-600 hover:bg-blue-500 text-white` | `bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa]` |
| Tombol/border netral | `border-gray-700 hover:bg-gray-800` | `border-[#1e3a3f] hover:bg-[#12181c]` |
| Underline tab (utama & bersarang) | `text-blue-400 border-blue-400` | `text-[#2dd4bf] border-[#2dd4bf]` |
| Teks readout (angka, kode, counter — berdiri sendiri, tanpa bg/border) | `text-blue-400` | `text-[#2dd4bf]` |
| Chip/pill redup (tombol kecil bergaya pill) | `bg-blue-900/40 hover:bg-blue-800 text-blue-400` (atau varian shade serupa: `text-blue-300`, `bg-blue-900/50`) | `bg-[#0d9488]/20 hover:bg-[#0d9488]/30 text-[#5eead4]` |
| Kotak info (callout box) | `bg-blue-950 border-blue-800` | `bg-[#0d9488]/10 border-[#0d9488]/30` |
| Border tipis pada chip (bila ada, mis. `border-blue-700/40`) | `border-blue-700/40` | `border-[#0d9488]/40` |

**Sub-tab bersarang** — pola yang sama persis dengan navigasi tab utama Fase A (`text-blue-400 border-blue-400` di `tab-penilaian.js`, `tab-report.js`, `form.js`) mendapat perlakuan identik: `text-[#2dd4bf] border-[#2dd4bf]`, konsisten dengan `detail.js` yang sudah selesai di Fase A.

## Di luar scope (tidak disentuh)

- Badge status/tipe (warna semantik) — konsisten dengan seluruh fase sebelumnya.
- Tombol danger (merah) — tidak ditemukan di 16 file ini pada survei, tapi bila ada, tetap tidak disentuh mengikuti aturan baku.
- `tab-evaluasi.js`, `sub-pelanggaran.js` — tidak ada kemunculan biru, tidak perlu diedit.
- Layout, teks, dan logika — hanya class warna Tailwind yang berubah.

## Pendekatan Eksekusi

76 kemunculan di 16 file, semuanya mengikuti salah satu dari 7 pola di tabel pemetaan. Diproses per-file secara mekanis (grep untuk lokasi tiap pola, edit sesuai pemetaan), diverifikasi dengan `node --check` per file setelah selesai, lalu commit satu kali mencakup semua file (mengikuti pola eksekusi fase-fase modul CRUD sebelumnya).

## Testing

Verifikasi manual di browser:
- Buka detail Bimtek, cek tab Ujian (kode ujian readout, tombol Generate Sesi), Penilaian (sub-tab Kehadiran/Nilai/Prepost/Kelulusan), Jadwal (badge "Jumat", info row), Report (sub-tab Penyelenggara/Peserta, stat card).
- Buka modal "Tambah Mata Pelajaran" dan form Bimtek (tab "Informasi").
- Pastikan tidak ada warna biru tersisa kecuali badge status/tipe semantik.
- Console bersih dari error.
