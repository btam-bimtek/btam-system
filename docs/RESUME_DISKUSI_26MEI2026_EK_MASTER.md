# Resume Diskusi — Master Elemen Kompetensi (EK)

**Tanggal:** 26 Mei 2026  
**Topik:** Perancangan fitur Master EK global + tracing kompetensi peserta lintas bimtek  
**Status:** Keputusan final — siap implementasi  

---

## Latar Belakang

Saat ini field `elemenKompetensi` di bank_soal hanya berupa string bebas (kode seperti "EK-01"). Tidak ada master data EK yang resmi. Akibatnya:

- EK yang muncul di laporan peserta = **auto-discovered dari soal yang kebetulan masuk ujian**, bukan dari daftar yang sengaja didefinisikan per bimtek.
- Tidak ada nama deskriptif resmi per EK (hanya kode).
- Tidak bisa tracing: EK yang sama di beberapa bimtek tidak saling terhubung.
- Laporan Section C tidak menampilkan EK yang tidak diujikan (tapi seharusnya diukur).

---

## Keputusan Desain

### 1. Master EK — Global, Lintas Bidang

**Keputusan:** EK adalah entitas global, **bukan milik satu bidang atau satu bimtek**. Satu EK bisa:
- Dipakai di beberapa bimtek yang berbeda bidang.
- Dikaitkan ke soal-soal dari bidang yang berbeda.

**Konsekuensi:**
- Ada collection baru `elemen_kompetensi` sebagai master data global.
- `bidangIds` di EK bersifat **informatif** (EK ini relevan untuk bidang apa), bukan constraint ketat.
- Admin bisa assign EK apapun ke bimtek apapun.

### 2. Hubungan EK ↔ Bimtek

**Keputusan:** Bimtek punya field `ekIds: string[]` — daftar EK yang **resmi diukur** di bimtek ini.

Ini berbeda dari sekarang yang auto-discover. Dengan field ini:
- Laporan peserta bisa tampilkan semua EK yang diukur, termasuk yang tidak ada datanya (karena soalnya tidak ada di bank atau recipe exam tidak menutup EK itu).
- Admin bisa set ekspektasi kompetensi secara eksplisit sebelum bimtek berjalan.

### 3. Hubungan EK ↔ Bank Soal

**Keputusan:** Field `elemenKompetensi` di bank_soal tetap string kode (e.g. "EK-001"), **tidak diubah ke FK reference**. Alasan:
- Backward compatible — soal yang sudah ada tidak rusak.
- Fleksibel — soal bisa punya EK yang belum ada di master (transisi bertahap).
- Saat query laporan, kode dicocokkan ke master EK untuk ambil nama deskriptif.

Field `ekNama` di bank_soal juga tetap ada sebagai denormalized cache (untuk display cepat tanpa join ke master).

### 4. Tracing Lintas Bimtek — UI di Profil Peserta

**Rekomendasi yang dipilih:** Tab "Kompetensi" di **halaman detail Peserta** (belum ada, perlu dibangun).

**Alasan:**
- Tracing adalah perspektif per-peserta → paling natural di profil peserta.
- Halaman peserta detail belum ada → kesempatan untuk membangun secara komprehensif.
- Tidak perlu halaman terpisah → lebih hemat navigasi.
- Admin bisa klik peserta mana saja dari list → langsung lihat riwayat + EK trend.

**Struktur halaman detail peserta** (new):
```
/peserta/:noPeserta
  → Tab Info          (data master: nama, jabatan, instansi, dll)
  → Tab Riwayat Bimtek (list semua bimtek yang pernah diikuti + status lulus/tidak)
  → Tab Kompetensi    (EK tracing: per EK, semua bimtek, chart trend naik/turun)
```

**Tidak dibangun** (untuk saat ini):
- Halaman terpisah "Analisis Kompetensi" — bisa Phase 3 kalau dibutuhkan.
- Notifikasi otomatis EK yang terus menurun — Phase 3.

### 5. Tracing: Compute on-the-fly vs Cached Collection

**Keputusan:** **Compute on-the-fly** dari `exam_results` yang sudah ada.

Tidak perlu collection baru `peserta_ek_history`. Alasan:
- Data sudah tersedia: `exam_results` punya `detail` per soal, soal punya `elemenKompetensi`.
- Collection baru berarti sinkronisasi dua sumber kebenaran → risiko inkonsistensi.
- Tracing per peserta dipanggil jarang (view by demand, bukan dashboard real-time).
- Kalau nanti perlu performa, bisa cache di `peserta_master` atau collection terpisah di Phase 3.

---

## Schema Baru

### Collection `elemen_kompetensi/{ekId}`

```js
{
  ekId: string,         // PK — kode singkat, misal "EK-001", "EK-PROD-01"
  nama: string,         // WAJIB — deskripsi lengkap: "Perencanaan Sistem Distribusi Air Minum"
  deskripsi: string | null,  // penjelasan lebih panjang (opsional)
  bidangIds: string[],  // informatif: bidang mana yang relevan. Bisa kosong [] = lintas semua.
  status: 'aktif' | 'nonaktif',  // nonaktif = tidak muncul di picker, tapi data lama tetap valid
  
  // Audit
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: string,
  deleted: boolean,
  deletedAt: Timestamp | null
}
```

### Update `bimtek/{bimtekId}`

Tambah field:
```js
ekIds: string[],   // default [] — kode EK yang diukur di bimtek ini
```

---

## Scope Implementasi

### M1.11 — Master EK + Link ke Bimtek + Update Laporan (~8-12 jam)

**Deliverables:**
1. **Modul `master-ek`** (admin app):
   - List EK dengan filter bidang + status
   - CRUD (form: kode, nama, deskripsi, bidangIds, status)
   - Import Excel (kolom: kode, nama, deskripsi, bidang)
   - Soft delete

2. **Update form Bimtek:**
   - Tambah section "Elemen Kompetensi yang Diukur" (multi-select dari master EK, filter per bidang bimtek)
   - Bisa tambah/hapus EK dari detail bimtek

3. **Update Laporan Peserta (Section C):**
   - Ambil `bimtek.ekIds` sebagai baseline EK yang diukur
   - EK yang ada di baseline tapi tidak ada di exam_results → tampil sebagai "Tidak ada data ujian"
   - Fallback: kalau `bimtek.ekIds` kosong → pakai behavior lama (auto-discover dari soal)

4. **Update `shared/constants.js`:**
   - Tambah `COL.ELEMEN_KOMPETENSI = 'elemen_kompetensi'`

5. **Update Firestore rules:**
   - `elemen_kompetensi`: read admin, write canWrite()

### M1.12 — Tracing Kompetensi Peserta (~6-10 jam)

**Deliverables:**
1. **Halaman detail Peserta** (`/peserta/:noPeserta`):
   - Tab Info: data master peserta (read-only view, plus link ke edit)
   - Tab Riwayat Bimtek: list bimtek yang diikuti (dari `bimtek` collection filter `pesertaIds`)
   - Tab Kompetensi: EK tracing

2. **Tab Kompetensi:**
   - Per-EK: semua bimtek yang pernah diikuti, pre% dan post%
   - Chart line trend per EK (Chart.js)
   - Tabel ringkasan: EK | Terakhir Diukur | Bimtek | Pre% | Post% | Δ
   - Filter: per EK, per rentang tahun
   - Highlight EK yang konsisten naik / konsisten turun / belum pernah diukur

3. **Update list peserta:**
   - Nama peserta jadi link yang bisa diklik → ke halaman detail

4. **`peserta-api.js` baru / update:**
   - `getPesertaEKHistory(noPeserta)` — query semua exam_results peserta, group per EK, sort by bimtek date

---

## Risiko & Mitigasi

| Risiko | Kemungkinan | Mitigasi |
|---|---|---|
| EK di bank soal tidak match kode di master EK | Sedang | UI warning di bank soal kalau elemenKompetensi tidak ada di master EK |
| Bimtek lama tidak punya ekIds → tracing tidak akurat | Tinggi | Fallback ke auto-discover; admin bisa retro-fill ekIds kapan saja |
| Compute on-the-fly tracing lambat kalau data banyak | Rendah (peserta jarang diakses satu-satu) | Kalau perlu, cache di Phase 3 |
| Admin lupa set ekIds di bimtek → laporan Section C generik | Sedang | Warning di tab Report kalau `bimtek.ekIds` kosong |

---

## Urutan Implementasi

```
M1.11 dulu → M1.12 setelahnya → M1.10 (E2E Testing) di akhir
```

**Catatan:** M1.10 (End-to-end Testing) dipindah ke setelah M1.11 dan M1.12 selesai, supaya testing mencakup fitur EK juga.

---

## File yang Akan Disentuh

### Baru:
- `admin/js/modules/master-ek/api.js`
- `admin/js/modules/master-ek/index.js`
- `admin/js/modules/master-ek/form.js`
- `admin/js/modules/master-ek/import.js`
- `admin/js/modules/peserta-master/detail.js`  ← halaman profil peserta

### Diubah:
- `shared/constants.js` — tambah `COL.ELEMEN_KOMPETENSI`
- `admin/js/router.js` — tambah route `/master-ek` + `/peserta/:id`
- `admin/js/layout/navbar.js` — tambah menu Master EK
- `admin/js/modules/bimtek/form.js` — tambah EK multi-select
- `admin/js/modules/bimtek/api.js` — update schema bimtek
- `admin/js/modules/bimtek/report-api.js` — gunakan ekIds sebagai baseline
- `admin/js/modules/peserta-master/index.js` — nama peserta jadi link
- `firestore.rules` — tambah rule untuk `elemen_kompetensi`
