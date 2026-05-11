# RESUME Diskusi Sistem BTAM — 20 April 2026

**Cakupan:** Response 1-10 chat 20 April 2026.  
**Status:** OPUSPLAN revisi mayor dengan seed data historis BTAM + fix kode_daerah.  
**File yang harus diupdate di project knowledge:** `OPUSPLAN.md` (versi baru) + `kode_daerah_fixed.xlsx` (file sumber yang sudah difix).  
**Next step:** Mulai coding Milestone 1.1 Foundation, atau diskusi detail lain.

---

## 1. Update dari User di Awal Sesi

### 1.1. Mapel 1-9 JP (sebelumnya 1-6)
- Range mapel diperluas dari 1-6 JP jadi **1-9 JP**.
- Maks harian Senin-Kamis tetap 9 JP, dengan **warning non-blocker kalau >8 JP** ("hari padat, hati-hati kelelahan").

### 1.2. ISHOMA Jumat 11:15-13:45
- Sebelumnya 11:15-13:30, sekarang **11:15-13:45** (+15 menit untuk sholat Jumat + makan).
- **Blocker baru:** Mapel dengan `totalJp > 7` **tidak boleh dijadwalkan di hari Jumat** (tidak muat karena ISHOMA panjang).

### 1.3. File Excel diupload
3 file di-upload ke project knowledge untuk diperiksa:
- `kode_daerah.xlsx` (407 rows)
- `data_kinerja_1.xlsx` (407 rows, nilai kinerja instansi 2019-2023)
- `data_all.xlsx` (12.355 rows, data alumni BTAM 1990-2025)

---

## 2. Temuan dari Inspeksi Data

### 2.1. kode_daerah.xlsx (407 rows)
**Masalah yang ditemukan:**

1. **Hanya 36 provinsi, bukan 38** — Papua Pegunungan (95) dan Papua Barat Daya (96) pemekaran 2022 belum ada.
2. **Duplikat `id_Daerah_kabkota`** — 6 pasangan konflik:
   - 3273: Kota Bandung vs Kab. Trenggalek
   - 3517: Kab. Jombang vs Kota Samarinda
   - 5201: Kab. Lombok Barat vs Kota Mataram
   - 6303: Kab. Banjar vs Kota Banjarbaru
   - 6502: Kab. Bulungan vs Kab. Malinau
   - 6504: Kab. Tana Tidung vs Kota Tarakan
3. **Kolom `Kab_Kota` punya nilai "Provinsi"** (4 baris) — anomali level administratif.

### 2.2. data_kinerja_1.xlsx (407 rows)
- 399 instansi PDAM/PERUMDAM/PT unik dengan skor kinerja 2019-2023 (skala 1.23-4.49, kemungkinan rating 1-5).
- Coverage nilai: 2021-2023 >95%, 2019-2020 ~74%.
- `instansi_id` format `NNN_NNN` — prefix sequential per provinsi (Aceh=001, Sumut=002, ..., Papua Selatan=036), **bukan kode BPS**. Ini sistem penomoran internal BTAM.
- Match ke data_kinerja: 407/407 (karena keduanya mengikuti struktur error yang sama di kode_daerah asli).

### 2.3. data_all.xlsx (12.355 rows, 29 kolom)
**Tahun Bimtek: 1990-2025.** Kualitas sangat bervariasi:
- 1990-2011: hampir semua kolom kosong, hanya nama + tahun
- 2012-2019: ada sebagian email + pendidikan
- 2020-2024: kualitas baik (60-80% kolom lengkap)
- **JK hanya lengkap mulai 2024** (601/966 di tahun 2024)
- **Email <10%, nomor HP ~13%** di seluruh data

**Kolom baru yang belum dimodelkan di OPUSPLAN:**
- `ttl` (tempat tanggal lahir)
- `kelas_Jabatan`
- `kode_Pelatihan` (kode internal BTAM per Bimtek)
- `periode_original` (string bebas, sumber parsing tanggal)

**Enum perlu diperluas:**
- **Tipe Bimtek historis:** Reguler/Regular, PNBP, Kerjasama/Kerja Sama (typo), e-Learning, OJT
- **Bidang historis:** 4 utama + "NON-AM" (172 record, bukan Air Minum) + "Produksi & ME" (29 record multi-bidang)

**Data messy:**
- 33 variasi nama provinsi (UPPERCASE, typo, istilah lama: "Irian Jaya", "TIMOR TIMUR")
- Format `nama_Daerah` beda: "Kab. XXX", "Kota XXX", "Pusat-Satker", "Regional-Kepulauan Riau"
- 14 record durasi_hari negatif (tanggal terbalik)
- Instansi: 256/275 match ke master, sisanya UPTD/Dinas PUPR (kategori di luar PDAM)

---

## 3. Keputusan User di Sesi Ini

### 3.1. Fix kode_daerah
**Keputusan:** Kombinasi — fix duplikat kritis + tambah 2 prov di file sumber, sisanya cleaning di sistem import.

**Yang sudah di-fix** di `kode_daerah_fixed.xlsx`:
- 7 koreksi kode kab/kota (Trenggalek 3503, Samarinda 6472, Mataram 5271, Banjarbaru 6372, Malinau 6501, Nunukan 6504, Tana Tidung 6503, Tarakan 6571)
- Tambah Papua Pegunungan (95) dengan 8 kabupaten (Jayawijaya, Pegunungan Bintang, Yahukimo, Tolikara, Mamberamo Tengah, Yalimo, Lanny Jaya, Nduga)
- Tambah Papua Barat Daya (96) dengan 6 kab/kota (Sorong, Sorong Selatan, Raja Ampat, Tambrauw, Maybrat, Kota Sorong)

**Hasil:** 421 rows, **38 provinsi, 417 kab/kota unik, 0 duplikat, 100% match prefix**.

### 3.2. Jenis Bimtek diperluas
**Keputusan:** Kerjasama/Kerja Sama merge ke **PNBP**, sisanya ditambah sebagai enum legacy.

**Enum final di schema:**
```js
tipe: 'reguler' | 'pnbp' | 'e_learning' | 'ojt' | 'lainnya'
```

**Aliasing di `app_settings.dataCleaningDefaults.bimtekTypeAliases`:**
- Reguler/Regular → reguler
- PNBP/Kerjasama/Kerja Sama → pnbp
- e-Learning → e_learning
- OJT → ojt
- null → lainnya

**UI pembuatan Bimtek baru:** hanya menampilkan Reguler + PNBP. 3 enum lain hanya valid untuk data historis.

### 3.3. Linkage Kinerja Instansi
**Keputusan:** Ya, full integrasi — dashboard kinerja jadi fitur strategis.

**Dampak ke schema:**
- `instansi_master` expand dengan `kinerjaHistoris: {2019, 2020, 2021, 2022, 2023}`, `idLegacy`, `kategori`, `jenisLokasi`, `namaAlias[]`
- `alumni_historis.instansiId` (FK ke instansi_master) — link peserta ke kinerja instansinya
- Milestone baru **M2a.5 Dashboard Kinerja Instansi** (10-15 jam)

---

## 4. Perubahan di OPUSPLAN.md (versi baru)

File tersimpan di `/mnt/user-data/outputs/OPUSPLAN.md`. Ganti versi di project knowledge.

### Section yang berubah:
- **Header** (tanggal 20 April, list file pelengkap)
- **1.3 Struktur Phase Final** — Phase 2a naik 35-53 → 54-80 jam, total 333-467 jam
- **4.2 Collection Overview** — kabkota_master ~514 → 417
- **4.6 instansi_master** — expand dengan `kinerjaHistoris`, `idLegacy`, `kategori` (8 opsi), `jenisLokasi`, `namaAlias`, seed plan dari data_kinerja_1
- **4.7 bidang** — tambah `multi_bidang` dan `non_am` (legacy, `active: false`), field `aliases`
- **4.7b provinsi_master & kabkota_master** — audit trail 8 koreksi kode BPS, field `namaPolos` dan `idLegacy`, rujukan file fixed
- **4.9 bimtek** — enum `tipe` expand 2→5
- **4.16 alumni_historis** — 12 field baru: `namaOriginal`, `kelasJabatan`, `kodePendidikan`, `ttl`, `nomorHp`, `email`, `instansiId`, `jenisLokasi`, `kodePelatihan`, `bimtekTipe`, `bimtekPeriode`, `bimtekStart/End`, `bimtekDurasiHari`, `dataQuality`
- **4.17 app_settings** — tambah `dataCleaningDefaults` dengan 4 mapping (provinsi, tipeBimtek, bidang, mode) + validasi durasi
- **6.2 Workflow** — tabel Reguler vs PNBP + section aliasing tipe historis
- **M2a.0 Seed** — expand ke 8-12 jam (seed instansi + kinerja + verifikasi GeoJSON pemekaran)
- **M2a.1 Import** — expand ke 15-22 jam (cleaning engine untuk data_all.xlsx)
- **M2a.2 Dashboard** — naik ke 10-14 jam (tambah chart tipe Bimtek)
- **M2a.5 BARU** — Dashboard Kinerja Instansi (10-15 jam)
- **Risk Register** — tambah R26 (korelasi ≠ kausasi disclaimer), R27 (GeoJSON pemekaran Papua), R28 (linkage instansi rapuh), R29 (gap data kinerja), R30 (data minimal pra-2012)

---

## 5. Yang Masih Perlu Diputuskan

Belum dibahas dan perlu keputusan sebelum M2a.0 dimulai:

1. **4 baris level "Provinsi" di kode_daerah** — saat ini tetap di file fixed, tidak ter-seed ke kabkota_master. Apa keputusan: biarkan (reference saja) atau drop?
2. **Kab/Kota yang hilang dari master** (417 di file vs 514 referensi BPS nasional). Apakah BTAM hanya tracking kab/kota dengan PDAM/PERUMDAM? Kalau iya, 417 sudah cukup. Kalau butuh semua kab/kota untuk peta lengkap, perlu top-up ~97 kab/kota tambahan.
3. **Kategorisasi instansi** — 19 instansi non-PDAM di data_all.xlsx (UPTD SPAM, Dinas PUPR, PRKP/PAM) — apakah dimasukkan ke instansi_master untuk tracking alumni atau di-exclude?
4. **Import data_all.xlsx saat M2a.1** — mode insert (append) atau bersih (wipe + insert)? Kalau admin sudah edit manual beberapa record, re-import bisa conflict.

---

## 6. Prinsip Desain yang Di-reinforce di Sesi Ini

1. **Data dari file sumber harus difix di sumber kalau structural** (duplikat PK, missing records) — tidak cukup patch di import engine.
2. **Fixed enum di schema, aliasing di settings** — enum Firestore stabil, variasi historis dihandle via `dataCleaningDefaults`.
3. **Disclaimer transparan untuk analisis statistik** — korelasi Bimtek ↔ kinerja tidak boleh diklaim sistem sebagai kausasi; insight hanya observational.
4. **`dataQuality` flag** untuk data historis yang kualitasnya bervariasi — default dashboard exclude yang minimal, admin bisa toggle.
5. **Audit trail untuk koreksi data** — 8 koreksi kode BPS di kode_daerah_fixed.xlsx terdokumentasi di OPUSPLAN section 4.7b.

---

## 7. Next Actions

**Immediate (user):**
1. Upload `kode_daerah_fixed.xlsx` ke project knowledge (atau replace file lama)
2. Ganti `OPUSPLAN.md` di project knowledge dengan versi baru
3. Jawab 4 pertanyaan pending di section 5 atas (bisa di sesi berikut)

**Siap mulai coding:**
1. Siapkan GitHub account, Firebase project baru, 1 email admin, domain GitHub Pages
2. Chat baru dengan share `OPUSPLAN.md` + `kode_daerah_fixed.xlsx` + `data_kinerja_1.xlsx` + `data_all.xlsx` → kerja **Milestone 1.1 Foundation** (15-20 jam)
3. Target 1 milestone per chat session

---

## 8. Catatan untuk Claude di Chat Berikutnya

Saat user kembali dan share file ini + OPUSPLAN.md (versi 20 Apr) + 3 file Excel sumber:
- Konteks sudah sangat lengkap — jangan ulang analisa data dari nol
- `kode_daerah_fixed.xlsx` adalah file kanonik, jangan pakai `kode_daerah.xlsx` lama
- Inkonsistensi di data historis sudah didokumentasi, fokus ke execution
- User suka di-challenge, tidak suka flattery, lebih baik pushback jujur daripada setuju kosong

**Identitas dokumen relevan di project knowledge:**
1. `OPUSPLAN.md` — blueprint final (versi 20 April, ~3190 baris)
2. `RESUME_DISKUSI_19APR2026.md` — sesi 1
3. `RESUME_DISKUSI_19APR2026_SESI2.md` — sesi 2 (mapel/sesi refactor, evaluasi pengajar)
4. `RESUME_DISKUSI_20APR2026.md` — file ini (seed data historis + fix kode daerah)
5. `kode_daerah_fixed.xlsx` — master geografis kanonik (38 prov, 417 kab/kota)
6. `data_kinerja_1.xlsx` — seed instansi_master (~399 PDAM/PERUMDAM + kinerja 2019-2023)
7. `data_all.xlsx` — seed alumni_historis (~12.355 records 1990-2025)
8. `SCHEMA_HARMONIZATION.md` — referensi legacy
9. `STRUKTUR_APLIKASI_v3.md` — referensi legacy
10. `STATUS_DISKUSI.md` — outdated, OPUSPLAN sudah superset
