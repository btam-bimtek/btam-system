# Redesain Tab Korelasi — Validitas Statistik

**Tanggal:** 7 Agustus 2026
**File utama:** `admin/js/modules/historis/tab-korelasi.js`, `admin/js/modules/historis/api.js`

## 1. Latar Belakang & Masalah

Tab Korelasi (`/historis` → Korelasi) punya 7 view (K-1..K-5, Tabel, Diagnostik) yang membandingkan intensitas bimtek BTAM dengan kinerja PDAM (BPPSPAM, tersedia 2021-2023 saja meski data bimtek mencakup 1990-2025).

Review menemukan cacat metodologis sistemik di K-1, K-2, K-3, K-4B, K-5:

1. **Look-ahead bias / overlap waktu**: variabel X (partisipasi bimtek) dihitung sebagai total *lifetime* atau window yang tumpang tindih dengan periode Y (tren/level kinerja 2021-2023). Ini membuat chart mengukur asosiasi kontemporer, bukan "bimtek → kinerja masa depan".
2. **OLS slope dari 3 titik data** (2021/2022/2023) — nyaris tidak ada derajat kebebasan statistik, sangat rapuh terhadap satu tahun anomali, tanpa CI/N ditampilkan.
3. **Confounding ukuran/kapasitas PDAM** — PDAM besar & mapan wajar punya total riwayat bimtek lebih banyak sekaligus kinerja lebih baik terlepas dari efek bimtek itu sendiri. Tidak ada view yang mengontrol atau menstratifikasi variabel ini.
4. **Regression to the mean** tidak dikontrol pada view berbasis slope/level.
5. **Ecological fallacy** di K-5 — agregasi per provinsi tidak mewakili pola di level instansi individual.
6. **Data dredging** — K-3 Explorer memungkinkan ratusan kombinasi X/Y tanpa koreksi multiple-comparison, berisiko menghasilkan pola palsu yang meyakinkan secara visual.

K-4A (lag tahun: bimtek T → kinerja T+1) adalah satu-satunya view existing yang sudah menerapkan aturan "X berhenti sebelum Y mulai" dengan benar.

**Prinsip desain baru:** X (partisipasi bimtek) harus secara struktural berhenti sebelum window Y (kinerja) dimulai. Setiap klaim asosiasi harus disertai N per grup/sel dan caveat non-kausal eksplisit.

## 2. Keputusan per View

| View | Keputusan | Alasan |
|---|---|---|
| K-1 Intensitas | **Pensiun** — konsolidasi ke K-4A | Overlap waktu fatal; K-4A sudah menjawab pertanyaan yang sama dengan kerangka waktu benar |
| K-2 Bidang | **Pensiun** — konsolidasi ke K-4A (diperluas per bidang) | Overlap waktu sama seperti K-1, plus tumpang tindih efek antar-bidang tidak terkontrol |
| K-3 Explorer | **Pensiun sementara, tanpa pengganti** | Overlap waktu + risiko data dredging; versi lag-safe kemungkinan tetap N-kecil per kombinasi dan belum tentu insightful — energi dialihkan ke view Dampak |
| K-4A Lag Tahun | **Dipertahankan & diperluas** | Satu-satunya desain lag yang sudah benar; jadi tulang punggung |
| K-4B Transisi Kategori | **Digabung ke view "Dampak" baru** | Ide kontingensi grup×transisi sudah tepat, tapi butuh perbaikan window waktu, persentase per baris, dan N per sel — hasil perbaikan itu = K-6 Dampak yang dibahas terpisah, jadi digabung jadi satu view |
| K-5 Provinsi | **Dipertahankan, diubah jadi deskriptif murni** | Ecological fallacy membuat garis regresi/klaim korelasi tidak valid di level agregat; tetap berguna sbg peta sebaran jangkauan |
| Tabel, Diagnostik | Tidak berubah | Di luar cakupan — bukan alat analisis korelasi |

## 3. Spesifikasi Teknis

### 3.1 K-4A — Lag Tahun (diperluas)

Struktur lag existing dipertahankan (`tab-korelasi.js:464-521`): bimtek tahun T → kinerja tahun T+1 (level untuk pair pertama, Δ untuk pair berikutnya).

**Penambahan:**
- Dropdown breakdown bidang: `Semua Bidang / Produksi / Trandis / ME / Pendukung`. Saat bidang dipilih, X = `alumni.byYearBidang[T][bidang]` bukan `alumni.byYear[T]` total.
- Subtitle chart selalu menampilkan N eksplisit (sudah ada pola `${points.length} instansi ...`).
- Catatan tetap di UI: "Hypothesis-generating — N kecil per kombinasi, bukan bukti kausal."

### 3.2 View "Dampak" (baru, menggantikan K-4B + rencana K-6)

Menempati slot view baru (mis. `k-dampak`), menggantikan sub-tab K-4B lama.

**Kontrol window (fleksibel, sesuai keputusan user):**
Dropdown "Window intensitas: N tahun sebelum 2021" — opsi 1/2/3/5 tahun, default 2. Kinerja dasar tetap 2021, kinerja akhir tetap 2023 (dibatasi ketersediaan data BPPSPAM).

**Definisi grup (dihitung ulang tiap window berubah):**
- Intensitas = total peserta bimtek instansi **dalam window itu saja** (bukan lifetime).
- Threshold grup sama seperti K-4B lama: Tidak Ada (0) / Rendah (1-10) / Sedang (11-30) / Tinggi (31+).
- Instansi disertakan hanya jika `kinerja.byYear['2021']` DAN `kinerja.byYear['2023']` tersedia; sisanya dihitung sbg "N dikecualikan" dan ditampilkan terpisah (bukan disembunyikan).

**Output ganda:**
1. **Tabel kontingensi** grup × transisi kategori (naik/tetap/turun), ditampilkan sbg **persentase per baris** (bukan count mentah) dengan N mentah di tooltip/subtext tiap sel. Sel dengan N<5 ditandai visual (redup/italic) sbg peringatan.
2. **Ringkasan Δskor** rata-rata per grup (`total_kinerja_2023 - total_kinerja_2021`) sbg pelengkap angka kategori.

**Caveat banner permanen** di atas view (tidak bisa ditutup permanen, cukup dismissible per sesi jika perlu):
> "Ini asosiasi, bukan bukti sebab-akibat. Belum mengontrol ukuran/kapasitas PDAM. Perhatikan N per sel — sel kecil tidak bisa disimpulkan."

### 3.3 K-5 — Peta Provinsi (deskriptif)

Hapus garis regresi (`showRegression`) dan framing scatter korelasi. Ganti jadi tabel/list terurut per provinsi dengan dua kolom independen:
- Total peserta bimtek dari provinsi (jangkauan program)
- Rata-rata skor kinerja PDAM di provinsi (kondisi terkini)

Tidak ada sumbu X/Y yang diplot berpasangan sbg klaim hubungan. Catatan di UI: "Deskriptif — dua angka independen per provinsi, bukan korelasi (rawan ecological fallacy di level agregat)."

### 3.4 Perubahan Data Layer

`getKorelasiData()` (`admin/js/modules/historis/api.js:351-461`) perlu tambahan agregasi per instansi:

```
byYearBidang: { "2021": { produksi: 2, trandis: 3, me: 0, pendukung: 1 }, ... }
```

Dibutuhkan oleh breakdown bidang K-4A (§3.1) dan window fleksibel view Dampak (§3.2, untuk menghitung intensitas per window tahun tanpa scan ulang raw docs). Dihitung dari field `bidang` + `tahun` yang sudah ada di `alumni_historis` — tidak perlu perubahan schema Firestore, hanya tambahan logika agregasi di `getKorelasiData()`.

## 4. Di Luar Cakupan (Fase Berikutnya)

- Stratifikasi/kontrol confounder ukuran-kapasitas PDAM (mis. `jumlah_pelanggan`/`jumlah_pegawai` dari `kinerja_instansi`) pada view Dampak.
- Analisis dosis-respons kontinu (intensitas vs besar perbaikan, bukan grup kategorikal).
- Revival K-3 Explorer versi lag-safe, jika setelah view Dampak berjalan ternyata masih dibutuhkan alat eksplorasi bebas.
- Perluasan data kinerja ke tahun-tahun lain (2019-2020, 2024-2025) jika hasil awal terlihat solid dan user ingin memperkuat window before/after — akan dievaluasi user setelah melihat hasil fase ini.

## 5. Ringkasan Perubahan File

- `admin/js/modules/historis/api.js` — tambah `byYearBidang` di `getKorelasiData()`.
- `admin/js/modules/historis/tab-korelasi.js` — hapus render K-1/K-2/K-3 dan tombol tab-nya; perluas `_renderK4A` dengan dropdown bidang; ganti `_renderK4B` jadi view Dampak baru (window dropdown, tabel persentase, caveat banner, ringkasan Δskor); ubah `_renderK5` jadi list deskriptif tanpa regresi.
