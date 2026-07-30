# Seleksi Tertulis Per-Bimtek + Distribusi Mandiri — Design

**Tanggal:** 2026-07-30
**Status:** Disetujui, siap masuk fase implementation plan.

## Latar Belakang

Modul Rekrutmen (`admin/js/modules/rekrutmen/`) mengelola siklus seleksi calon peserta bimtek: pendaftaran → seleksi administrasi → seleksi tertulis → penentuan. Implementasi saat ini punya dua masalah yang saling terkait:

1. **Satu ujian tertulis untuk semua bimtek.** `siklus_seleksi.phases.tertulis.examId` adalah satu field, dipakai untuk semua calon dalam satu siklus/tahun, tidak peduli bimtek mana yang mereka tuju. Padahal tiap bimtek seharusnya punya soal ujian sendiri sesuai topiknya.
2. **Distribusi link tidak scalable.** Magic link ujian (`exam/?token=...`) saat ini didistribusikan admin satu per satu lewat tombol "Salin Link" per calon (`admin/js/modules/rekrutmen/seleksi-tertulis.js`). Untuk ribuan calon, ini tidak mungkin dikerjakan manual.

Investigasi lebih lanjut menemukan `statusAdmin` (kelulusan administrasi) juga bukan per-bimtek — cuma boolean `lulus`/`gugur` global ("lulus jika memenuhi rules minimal satu bimtek pilihan"), sehingga sistem tidak tahu persis bimtek mana saja yang calon lolos administrasinya. Ini harus diperbaiki lebih dulu supaya sistem tahu bimtek mana yang perlu diujikan ke tiap calon.

Ditemukan juga bahwa `pendaftar/js/pages/status.js` ("Cek Status Pendaftaran") sudah menjadi halaman self-service publik (tanpa login) yang dipakai calon untuk memantau progres seleksinya, dibaca dari koleksi `status_lookup`. Ini jadi kanal distribusi link ujian yang jauh lebih baik daripada CSV export atau blast WA/email — tidak perlu infrastruktur baru, dan calon sudah terbiasa memakainya.

## Keputusan Desain

1. Soal ujian tertulis **beda per bimtek**.
2. Kelulusan administrasi **dievaluasi per bimtek pilihan** — calon bisa lolos di sebagian pilihan, gugur di sisanya.
3. Distribusi link ujian **self-service** lewat halaman Cek Status Pendaftaran yang sudah ada — bukan export CSV, bukan auto-kirim email/WA.
4. Window waktu ujian tertulis **tetap satu, bersama untuk semua bimtek** dalam satu siklus (tidak per-bimtek) — YAGNI, bisa ditambah nanti kalau memang dibutuhkan.
5. Tidak ada auto-kirim notifikasi (email/WA) dari sistem — sepenuhnya inisiatif calon mengecek status sendiri.

## 1. Perubahan Data Model

### `calon_peserta.statusAdmin`

Dari string tunggal jadi map per bimtek, key = `bimtekId` (hanya bimtek yang ada di `pilihanBimtekIds` calon yang dievaluasi):

```js
statusAdmin: {
  'bimtekId1': { status: 'lulus', reason: null },
  'bimtekId2': { status: 'gugur', reason: 'Tidak memenuhi syarat X' }
}
```

`applyAdminRules()` (`calon-api.js`) dievaluasi per bimtek dalam `pilihan`, bukan "lolos kalau salah satu terpenuhi lalu berhenti" — semua bimtek pilihan calon dicek dan dicatat hasilnya masing-masing.

### `siklus_seleksi.bimtekPilihan[]`

Tiap item tambah field `examIdTertulis` (di samping `adminRules` dan `larangRepeatBimtek3Tahun` yang sudah ada):

```js
{ bimtekId, namaBimtek, adminRules: [...], larangRepeatBimtek3Tahun, examIdTertulis: 'examXyz' }
```

`siklus.phases.tertulis.examId` (field lama, single) dihapus — exam sekarang selalu direferensikan per bimtek lewat `bimtekPilihan[].examIdTertulis`.

### `calon_peserta.nilaiTertulis`

Dari angka tunggal jadi map per bimtek:

```js
nilaiTertulis: { 'bimtekId1': 78, 'bimtekId2': 85 }
```

### `exam_sessions` (koleksi bersama dengan pretest/posttest)

Sesi bertipe `seleksi_tertulis` tambah field `bimtekId`. Satu calon bisa punya beberapa sesi seleksi tertulis (satu per bimtek yang dia lolos administrasinya), masing-masing token unik.

### `status_lookup` (dibaca publik tanpa auth oleh `pendaftar/`)

Tambah field `ujianTertulis`, array berisi ringkasan per sesi:

```js
ujianTertulis: [
  { bimtekId, namaBimtek, token, status: 'issued'|'started'|'submitted', nilai: null|number }
]
```

Field lama `statusTertulis` dan `nilaiTertulis` (flat, single) di `status_lookup` diganti turunan dari array ini saat render (misal "selesai" kalau semua sesi `submitted`).

## 2. Alur Admin (`admin/js/modules/rekrutmen/`)

### Seleksi Administrasi (`calon-peserta.js`, `calon-api.js`)

- `applyAdminRules()`: loop tiap bimtek di `pilihan` calon, evaluasi rules bimtek itu sendiri, simpan hasil ke `statusAdmin[bimtekId]`. Tidak berhenti di kecocokan pertama.
- Tampilan detail calon (`calon-peserta.js`) menunjukkan status per bimtek pilihan, bukan satu badge.

### Seleksi Tertulis (`seleksi-tertulis.js`, `seleksi-exam-api.js`)

- Kartu "Ujian Seleksi Tertulis" tunggal → daftar per bimtek (dari `bimtekPilihan`), masing-masing punya kontrol pilih/ganti `examIdTertulis` sendiri.
- Window waktu (`inp-window-start`/`end`) tetap satu form, tersimpan di `phases.tertulis.start/end` seperti sekarang (lihat Keputusan Desain #4).
- Tombol **"Generate Magic Link"** jadi bulk generate: untuk tiap calon yang `statusAdmin[bimtekId].status === 'lulus'` pada bimtek manapun, generate satu sesi `exam_sessions` per pasangan (calon, bimtek), pakai `bimtekPilihan[bimtekId].examIdTertulis`. Skip pasangan yang sudah punya sesi (idempotent, sama seperti perilaku sekarang).
- Setelah generate/setiap kali status sesi berubah (mulai, submit), sinkronkan ringkasannya ke `status_lookup.ujianTertulis` milik calon terkait.
- Tabel monitoring dikelompokkan per bimtek (bukan daftar flat), tombol "Salin Link" tetap ada per baris sebagai cadangan manual.
- `scoreSeleksiSubmissions()`: tulis skor ke `calon_peserta.nilaiTertulis[bimtekId]`, bukan field flat. Sinkronkan juga `status_lookup.ujianTertulis[].nilai`.

## 3. Alur Calon Peserta — Self-Service (`pendaftar/js/pages/status.js`, `pendaftar/js/api.js`)

Step "Seleksi Tertulis" pada hasil `_renderResult()` diperluas: kalau `d.ujianTertulis` berisi entri, render daftar per bimtek:

- Sesi `issued`/`started` → tombol **"Mulai Ujian →"**, link ke `exam/?token={token}` (buka di tab baru).
- Sesi `submitted` → tampilkan nilai (kalau sudah disinkron) atau "Menunggu Penilaian".

Tidak ada perubahan pada `exam/` app — alur `?token=` yang sudah ada dipakai apa adanya.

## 4. Penentuan (`penentuan.js`)

Ranking baca `c.nilaiTertulis[b.bimtekId]` (bukan `c.nilaiTertulis` flat) saat mengurutkan calon dalam blok bimtek tertentu — logika pass1/pass2 (prioritas pilihan) tidak berubah.

## Yang Tidak Berubah

- `exam/` app (runner, anti-cheat, submit flow) — tidak disentuh, token flow generik sudah cukup.
- Window waktu ujian tertulis tetap satu untuk semua bimtek dalam siklus.
- Tidak ada integrasi email/WA otomatis.
- Struktur `bank_soal` / cara membuat exam baru tidak berubah — admin tetap bikin exam seperti biasa lewat modul Bimtek/Bank Soal, lalu menautkannya per bimtek di sini.

## Dampak Migrasi

Belum ada siklus seleksi yang berjalan/punya data di format lama saat spec ini ditulis — jadi tidak ada migrasi data yang diperlukan. Implementasi bisa langsung mengasumsikan skema baru (`statusAdmin` map, `nilaiTertulis` map, `bimtekPilihan[].examIdTertulis`) tanpa perlu jalur baca-format-lama/fallback.
