# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: staf BTAM (admin/panitia) yang mengelola kegiatan Bimtek sehari-hari dari kantor, di desktop/laptop. Mereka menangani pendaftaran/enroll peserta, penjadwalan, bank soal, penilaian, dan penerbitan sertifikat sebagai bagian dari rutinitas kerja kantor (bukan lapangan/mobile).

Role tambahan yang ada di sistem (dari kode, `admin/js/auth-guard.js`): `superadmin` (akses penuh + admin users), `viewer` (read-only, tidak bisa write), dan role admin biasa. Redesign difokuskan ke pengalaman staf admin/panitia harian sebagai prioritas utama.

## Product Purpose

Sistem manajemen Bimbingan Teknis (Bimtek) untuk Balai Teknik Air Minum (BTAM) — unit di bawah Ditjen Cipta Karya, Kementerian PU — menggantikan proses manual (Excel/Word) dengan platform digital end-to-end: pendaftaran peserta, penjadwalan, ujian online, penilaian, sertifikat, hingga laporan.

Sukses berarti staf BTAM bisa menjalankan siklus penuh satu angkatan Bimtek (pendaftaran → jadwal → ujian → nilai → sertifikat → laporan) tanpa keluar dari sistem, dan tanpa rekonsiliasi manual di Excel.

## Positioning

Bukan LMS generik — alur kerjanya mengikuti struktur birokrasi pelatihan pemerintah yang spesifik: bobot penilaian 8 komponen dengan redistribusi otomatis, kelulusan gabungan nilai+kehadiran (≥90%), kunci jawaban ujian disimpan terpisah dari soal untuk keamanan, dan sertifikat dua-mode (CSS fallback / overlay PNG dari desain Canva tahunan) karena desain sertifikat berubah tiap tahun mengikuti kebijakan internal.

## Operating Context

- Skala: >20 bimtek/tahun, ratusan peserta/tahun, dua tipe (Reguler & PNBP).
- Dua aplikasi terpisah: `/admin/` (login wajib, semua fitur manajemen — target redesign saat ini) dan `/exam/` (tanpa login, akses via magic link token, dipakai peserta).
- Staf admin bekerja lintas banyak tab dalam satu sesi: detail bimtek punya banyak sub-tab (Jadwal, Peserta, Pengajar, Ujian, Penilaian, Laporan) yang dibuka bergantian dalam satu alur kerja.
- Modal dipakai luas untuk create/edit (bank soal, bimtek, ujian, dll) — beberapa form panjang dengan banyak field/dynamic list (contoh: form ujian dengan soal picker).

## Capabilities and Constraints

Fitur inti yang sudah berjalan (Phase 1 selesai): master data (peserta/pengajar/instansi), bank soal, CRUD bimtek + jadwal, exam editor + magic link, exam runner dengan anti-cheat, input nilai (kehadiran/manual/pre-post/kelulusan) + scoring engine, laporan (penyelenggara + per-peserta) dengan Chart.js, dashboard + settings, sertifikat + surat keterangan.

Constraint teknis saat ini (boleh diubah untuk redesign ini, sesuai keputusan user): Vanilla JS ES modules tanpa bundler, Tailwind CDN, hash-based routing SPA, hosting GitHub Pages, Firebase (Firestore + Auth + Storage). User membuka opsi mengganti stack kalau memang dibutuhkan desain barunya — belum ada keputusan final soal bundler/framework baru, akan ditentukan saat masuk tahap implementasi.

Terminologi domain: Bimtek (kegiatan pelatihan), peserta, pengajar, panitia, bidang (bidang keahlian), Bloom level (C1–C6, taksonomi soal), KKM (nilai batas kelulusan), pretest/posttest, PNBP (jenis bimtek berbayar).

## Brand Commitments

Nama "BTAM" (Balai Teknik Air Minum) dan logo instansi (Kementerian PU / Ditjen Cipta Karya) wajib tetap ada dan terlihat di desain baru — ini identitas resmi lembaga pemerintah, bukan elemen dekoratif yang bebas diganti.

## Evidence on Hand

- Logo lembaga: diupload admin sendiri via Settings → Storage (`settings/logo.{ext}`), dipakai di kop surat laporan/sertifikat. Belum tentu sudah terpasang di setiap environment — cek sebelum mengasumsikan asetnya ada.
- Tidak ada style guide/brand book terpisah yang ditemukan di repo — DESIGN.md belum ada, jadi UI yang berjalan sekarang (dark theme, Tailwind utility classes langsung di JS template strings) adalah bukti visual satu-satunya, bukan otoritas final untuk redesign ini karena user secara eksplisit minta "sesuatu yang berbeda".

## Product Principles

1. Alur kerja mengikuti siklus birokrasi Bimtek nyata (pendaftaran → jadwal → ujian → nilai → sertifikat → laporan) — desain harus mendukung urutan ini, bukan memaksakan pola generik.
2. Staf admin bekerja lintas banyak sub-tab dan modal panjang dalam satu sesi — desain harus mengutamakan scanability dan meminimalkan kehilangan pekerjaan yang belum tersimpan (baru saja jadi masalah nyata: modal form panjang tertutup tak sengaja).
3. Identitas kelembagaan (BTAM, logo Kementerian PU) adalah elemen wajib, bukan opsional — desain baru harus tetap terasa sebagai sistem resmi instansi pemerintah, bukan produk konsumer.
4. Data dan angka (nilai, kehadiran, kelulusan, laporan) adalah inti pekerjaan — visual harus memprioritaskan kejelasan angka/tabel/chart di atas dekorasi.

## Accessibility & Inclusion

Belum ada requirement aksesibilitas spesifik yang dikonfirmasi user untuk admin dashboard ini.
