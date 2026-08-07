# Integrasi Cluster Struktural PDAM ke View Dampak

**Tanggal:** 7 Agustus 2026
**File terkait:** `admin/js/modules/historis/normalize.js`, `api.js`, `index.js`, `tab-korelasi.js`

## 1. Latar Belakang

View "Dampak" (K-4B) di Tab Korelasi membandingkan grup intensitas bimtek terhadap transisi kategori kinerja, tapi belum mengontrol confounder ukuran/kapasitas PDAM (didokumentasikan sbg keterbatasan di spec redesain Tab Korelasi sebelumnya).

Riset terpisah (project claude.ai "Relasi Kinerja PDAM") sudah menghasilkan clustering K-means atas 393 PDAM berdasarkan 4 variabel struktural eksogen (skala pelanggan, rasio aset/SR, kepadatan pipa per pelanggan, rasio pegawai/1000 pelanggan) — menghasilkan 5 klaster PDAM yang sebanding secara struktural. Variabel ini **provisional**: pemilik proyek sendiri menilai belum ideal (variabel ideal — sumber air baku, status kelembagaan, topografi, riwayat program lain — datanya belum tersedia) tapi dipakai dulu sbg langkah awal.

**Keputusan:** import hasil cluster ini sbg field baru di `kinerja_instansi`, dipakai sbg filter stratifikasi di view Dampak — supaya perbandingan treatment/kontrol bisa dilakukan di dalam klaster struktural yang sama.

## 2. Sumber Data

File: `data/pdam_klaster_struktural.csv` (393 baris + header), kolom relevan: `nama`, `cluster` (0-4), `nama_klaster` (label deskriptif).

5 klaster: `Kecil-Tidak Efisien` (0), `Kecil-Sedang Tipikal` (1), `Besar-Efisien` (2), `Ekstrem Terisolasi` (3, n=8 — PERLU perlakuan khusus, jangan dipaksa dibandingkan dgn klaster lain), `Kecil-Sedang Aset Tinggi` (4).

## 3. Data Model

Field baru pada dokumen `kinerja_instansi`:
```
klaster: { cluster: number, nama_klaster: string }
```
Tidak ada collection baru — field ini ditambahkan langsung ke dokumen existing lewat batch update (matching by `nama_bumd`), supaya otomatis ikut ke `getKorelasiData()` tanpa perubahan struktur join.

## 4. Matching

CSV `nama` dicocokkan ke `kinerja_instansi.nama_bumd`: exact match dulu, fallback ke normalisasi yang sama dengan join alumni↔kinerja (`_normInstansi`: strip PDAM/PERUMDAM/PERUMDA/PUDAM, strip kabupaten/kota/kec, lowercase). Baris CSV yang tidak match dilaporkan di UI import sbg "tidak ditemukan" (bukan silent skip).

## 5. Import UI

Tab baru "Klaster" di halaman Data Historis (`historis/index.js`), pola sama seperti tab Import Kinerja yang sudah ada:
1. Upload CSV (pakai SheetJS, sudah ter-lazy-load di modul ini)
2. Preview: N baris valid, N matched, N tidak matched (ditampilkan daftar nama yang gagal match)
3. Tombol konfirmasi → `batchImportKlaster()` di `api.js` — update field `klaster` ke dokumen `kinerja_instansi` yang match. Overwrite (bukan append), supaya bisa diulang kalau cluster di-refresh nanti dengan variabel yang lebih ideal.

## 6. Perubahan View Dampak (K-4B)

Dropdown baru "Cluster" di atas tabel Dampak, opsi: `Semua Cluster` + 5 label klaster (`nama_klaster`).
- Default: "Semua Cluster" (perilaku sama seperti sekarang).
- Kalau pilih klaster spesifik: `_filtered()` di dalam `_renderK4B` ditambah filter `d.kinerja?.klaster?.cluster === selectedCluster` sebelum grouping treatment/kontrol.
- Caveat banner ditambah 1 baris: cluster berbasis 4 variabel struktural (skala, aset/SR, kepadatan pipa, rasio SDM) — **provisional**, akan diperbarui kalau variabel ideal (sumber air baku, kelembagaan, dst — lihat riset terpisah) sudah tersedia.
- Klaster 3 (Ekstrem Terisolasi, n=8 nasional) — kalau dipilih, tambahkan catatan N sangat kecil secara nasional, hasil di dalam BTAM (subset yg match alumni) kemungkinan besar N=0-2.

## 7. Di Luar Cakupan

- Update otomatis cluster (re-run K-means) dari dalam aplikasi — tetap manual re-import CSV kalau ada versi baru.
- Variabel cluster ideal (RISPAM, BPS, JDIH) — menunggu pengumpulan data terpisah di luar sistem ini.
